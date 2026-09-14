import { useState, type FormEvent, useMemo } from 'react';
import { useUser } from '@clerk/react';
import { ArrowDownRight, ArrowUpRight, BarChart3, Brain, CheckCircle2, CircleDot, Clock3, ExternalLink, Gauge, Info, LockKeyhole, Pause, Play, Plus, Radio, RefreshCw, ShieldAlert, SlidersHorizontal, Target, Timer, Wifi } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { useGetAssetAnalysis, getGetAssetAnalysisQueryKey, useGetBrokerStatus, getGetBrokerStatusQueryKey, useGetDashboard, useGetMarkets, useGetOpportunities, useHealthCheck, useGetNews, getGetNewsQueryKey, type AssetAnalysis, type Dashboard, type Market, type Opportunity, type GetNewsParams } from '@workspace/api-client-react';
import { Badge, MarketRow, Metric, Notice, OpportunityCard, PageButton, PageHeader, SectionLabel, StateMessage } from '@/components/common';
import { useI18n } from '@/lib/i18n';

function useMockOr<T>(data: T | undefined, mock: T) { return data ?? mock; }

function formatNewsTimestamp(value: string, locale: 'it' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date) + ' UTC';
}

function verificationTone(status: 'confirmed' | 'contradicted' | 'duplicate' | 'standalone') {
  return status === 'confirmed' ? 'positive' : status === 'contradicted' ? 'negative' : status === 'duplicate' ? 'amber' : 'neutral';
}

export function DashboardPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const displayName = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || t('shell.analyst');
  const mockOpps: Opportunity[] = useMemo(() => [
    { symbol: 'QQQ', signal: 'LONG BIAS', confidence: 78, risk: 'Moderato', state: 'Aumento di slancio', rationale: 'Migliora l\'ampiezza tecnica mentre il regime macro rimane a supporto.' },
    { symbol: 'GLD', signal: 'LONG BIAS', confidence: 71, risk: 'Basso', state: 'Trend intatto', rationale: 'La domanda difensiva e l\'indebolimento del rendimento reale sono allineati.' },
    { symbol: 'TLT', signal: 'WAIT', confidence: 63, risk: 'Moderato', state: 'In flessione', rationale: 'I tassi si avvicinano a una zona decisionale.' },
    { symbol: 'BTC-USD', signal: 'AVOID', confidence: 67, risk: 'Alto', state: 'Rumore elevato', rationale: 'Il prezzo è sotto il trend di breve termine.' },
  ], []);
  const mockDash: Dashboard = useMemo(() => ({ marketState: 'Cautamente costruttivo', marketStateDetail: 'L\'ampiezza sta migliorando, ma i tassi rimangono la variabile chiave.', riskScore: 32, riskLabel: t('dashboard.contained'), riskUpdatedAt: '2 min fa', paperCapital: 100000, equity: 103842, dailyPnl: 486.2, openPositions: 3, exposure: 42, drawdown: 1.8, opportunities: mockOpps, regime: 'Espansione tardiva', warningLevel: 'low' }), [t, mockOpps]);
  const mockMarkets: Market[] = useMemo(() => [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: t('news.catEquities'), price: 518.42, change: 2.18, changePercent: 0.42, sparkline: [4, 3.2, 3.4, 5, 4.2, 6, 6.4], status: t('common.open') },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: t('news.catEquities'), price: 443.81, change: 3.72, changePercent: 0.85, sparkline: [2, 2.8, 2.2, 3.5, 4.5, 4.2, 5.8], status: t('common.open') },
    { symbol: 'BTC-USD', name: 'Bitcoin / Dollaro USA', assetClass: t('news.catCrypto'), price: 67240.15, change: -412.2, changePercent: -0.61, sparkline: [7, 6, 6.7, 5.6, 5.8, 4.8, 4.3], status: t('common.open') },
    { symbol: 'GLD', name: 'SPDR Gold Shares', assetClass: 'Materie Prime', price: 214.66, change: 0.84, changePercent: 0.39, sparkline: [3, 3.4, 3.1, 3.9, 4, 4.4, 4.8], status: t('common.open') },
    { symbol: 'TLT', name: 'iShares 20+ Year Treasury', assetClass: t('news.catMacroRates'), price: 91.27, change: -0.3, changePercent: -0.33, sparkline: [5, 5.4, 4, 4.3, 3.8, 3.1, 2.7], status: t('common.open') },
  ], [t]);

  const query = useGetDashboard();
  const dashboard = useMockOr(query.data, mockDash);
  const marketsQuery = useGetMarkets();
  const markets = useMockOr(marketsQuery.data, mockMarkets);
  const oppsQuery = useGetOpportunities();
  const opportunities = useMockOr(oppsQuery.data, mockOpps);
  const refreshing = query.isFetching || marketsQuery.isFetching;
  
  return <div className="content-wrap">
     <PageHeader eyebrow={t('dashboard.eyebrow')} title={`${t('dashboard.greeting')} ${displayName}.`} subtitle={t('dashboard.subtitle')} action={<div className="flex items-center gap-2">{query.isError && <Badge tone="amber">{t('common.mockSnapshot')}</Badge>}<button onClick={() => query.refetch()} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary" data-testid="button-refresh-dashboard"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />{t('dashboard.refresh')}</button></div>} />
    <div className="mb-6 grid gap-3 md:grid-cols-4">
      <Metric label={t('dashboard.paperEquity')} value={`$${dashboard.equity.toLocaleString()}`} detail={`${t('dashboard.capital')} $${dashboard.paperCapital.toLocaleString()}`} tone="amber" icon={<WalletIcon />} />
      <Metric label={t('dashboard.dailyPnl')} value={`${dashboard.dailyPnl >= 0 ? '+' : ''}$${dashboard.dailyPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} detail={t('dashboard.previousClose')} tone={dashboard.dailyPnl >= 0 ? 'positive' : 'negative'} icon={dashboard.dailyPnl >= 0 ? <ArrowUpRight size={16} className="text-accent" /> : <ArrowDownRight size={16} className="text-destructive" />} />
      <Metric label={t('dashboard.openPositions')} value={String(dashboard.openPositions)} detail={`${dashboard.exposure}% ${t('dashboard.exposure')}`} icon={<Target size={16} className="text-muted-foreground" />} />
      <Metric label={t('dashboard.riskScore')} value={`${dashboard.riskScore}/100`} detail={`${dashboard.riskLabel} · ${dashboard.riskUpdatedAt}`} tone={dashboard.riskScore > 65 ? 'negative' : 'positive'} icon={<Gauge size={16} className={dashboard.riskScore > 65 ? 'text-destructive' : 'text-accent'} />} />
    </div>
    <div className="mb-6 grid gap-5 lg:grid-cols-[1.45fr_.85fr]">
      <section className="panel overflow-hidden p-5 md:p-6">
        <div className="mb-7 flex items-start justify-between"><div><p className="eyebrow mb-2">{t('dashboard.regime')}</p><h2 className="display text-2xl font-bold text-foreground">{dashboard.marketState}</h2><p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{dashboard.marketStateDetail}</p></div><Badge tone="teal"><CircleDot size={11} />{dashboard.regime}</Badge></div>
        <div className="relative h-32 overflow-hidden rounded-md border border-border bg-background/50 p-3"><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" /><svg viewBox="0 0 800 120" preserveAspectRatio="none" className="h-full w-full text-primary"><path d="M0,88 C55,94 70,55 125,63 S205,95 252,69 S315,46 354,56 S411,89 459,58 S519,38 550,47 S600,82 644,52 S710,28 800,31" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg><div className="absolute bottom-2 left-3 right-3 flex justify-between mono text-[9px] text-muted-foreground"><span>{t('dashboard.daysAgo')}</span><span>{t('dashboard.now')}</span></div></div>
        <div className="mt-4 grid grid-cols-3 gap-3"><div><p className="eyebrow">{t('dashboard.breadth')}</p><p className="mono mt-1 text-sm text-accent">+14.2%</p></div><div><p className="eyebrow">{t('dashboard.volatility')}</p><p className="mono mt-1 text-sm text-foreground">{t('dashboard.contained')}</p></div><div><p className="eyebrow">{t('dashboard.warning')}</p><p className="mono mt-1 text-sm text-primary">{dashboard.warningLevel}</p></div></div>
      </section>
      <section className="panel p-5 md:p-6"><SectionLabel aside={<PageButton href="/risk">{t('common.openControls')}</PageButton>}>{t('dashboard.riskPosture')}</SectionLabel><div className="flex items-center gap-6 py-4"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--accent)) ${dashboard.riskScore}%, hsl(var(--secondary)) 0)` }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card"><span className="mono text-3xl text-foreground">{dashboard.riskScore}</span><span className="eyebrow mt-1">{t('dashboard.of')}</span></div></div><div><Badge tone="positive">{dashboard.riskLabel}</Badge><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('dashboard.currentBook')}</p></div></div><div className="mt-2 border-t border-border pt-4"><div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('dashboard.drawdown')}</span><span className="mono text-foreground">{dashboard.drawdown}% / {t('dashboard.limit')} 8%</span></div><div className="mt-2 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(dashboard.drawdown / 8 * 100, 100)}%` }} /></div></div></section>
    </div>
    <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section><SectionLabel aside={<PageButton href="/markets">{t('common.allMarkets')}</PageButton>}>{t('dashboard.trackedMarkets')}</SectionLabel><div className="space-y-2">{markets.slice(0, 4).map((market) => <MarketRow market={market} key={market.symbol} />)}</div></section>
      <section><SectionLabel aside={<PageButton href="/opportunities">{t('common.viewRanking')}</PageButton>}>{t('dashboard.highestConviction')}</SectionLabel><div className="grid gap-3 sm:grid-cols-2">{opportunities.slice(0, 4).map((opportunity, index) => <OpportunityCard opportunity={opportunity} index={index} key={opportunity.symbol} />)}</div></section>
    </div>
    <Notice tone="teal"><span><strong>{t('dashboard.simulatedEnv')}</strong> {t('dashboard.simulatedNotice')}{query.isError && ' ' + t('dashboard.mockNotice')}</span></Notice>
  </div>;
}

function WalletIcon() { return <span className="mono text-[11px] text-primary">$</span>; }

export function MarketsPage() {
  const { t } = useI18n();
  const mockMarkets: Market[] = useMemo(() => [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: t('news.catEquities'), price: 518.42, change: 2.18, changePercent: 0.42, sparkline: [4, 3.2, 3.4, 5, 4.2, 6, 6.4], status: t('common.open') },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: t('news.catEquities'), price: 443.81, change: 3.72, changePercent: 0.85, sparkline: [2, 2.8, 2.2, 3.5, 4.5, 4.2, 5.8], status: t('common.open') },
    { symbol: 'BTC-USD', name: 'Bitcoin / Dollaro USA', assetClass: t('news.catCrypto'), price: 67240.15, change: -412.2, changePercent: -0.61, sparkline: [7, 6, 6.7, 5.6, 5.8, 4.8, 4.3], status: t('common.open') },
    { symbol: 'GLD', name: 'SPDR Gold Shares', assetClass: 'Materie Prime', price: 214.66, change: 0.84, changePercent: 0.39, sparkline: [3, 3.4, 3.1, 3.9, 4, 4.4, 4.8], status: t('common.open') },
    { symbol: 'TLT', name: 'iShares 20+ Year Treasury', assetClass: t('news.catMacroRates'), price: 91.27, change: -0.3, changePercent: -0.33, sparkline: [5, 5.4, 4, 4.3, 3.8, 3.1, 2.7], status: t('common.open') },
  ], [t]);
  const query = useGetMarkets(); const [filter, setFilter] = useState(t('markets.all'));
  const markets = useMockOr(query.data, mockMarkets); const classes = [t('markets.all'), ...Array.from(new Set(markets.map((m) => m.assetClass)))];
  const filtered = filter === t('markets.all') ? markets : markets.filter((m) => m.assetClass === filter);
  return <div className="content-wrap"><PageHeader eyebrow={t('markets.eyebrow')} title={t('markets.title')} subtitle={t('markets.subtitle')} action={<Badge tone="neutral"><Radio size={11} />{markets.length} {t('common.instrument')}</Badge>} /><div className="mb-5 flex flex-wrap gap-2">{classes.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${filter === item ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`} data-testid={`button-filter-${item.toLowerCase()}`}>{item}</button>)}</div>{query.isLoading ? <StateMessage kind="loading" title={t('markets.loading')} body="" /> : query.isError && !query.data ? <StateMessage kind="error" title={t('markets.unavailable')} body={t('markets.unavailableBody')} onRetry={() => query.refetch()} /> : <div className="space-y-2">{filtered.map((market) => <MarketRow market={market} key={market.symbol} />)}</div>}<p className="mt-4 mono text-[10px] text-muted-foreground">{t('markets.quotes')}</p></div>;
}

export function OpportunitiesPage() {
  const { t } = useI18n();
  const mockOpps: Opportunity[] = useMemo(() => [
    { symbol: 'QQQ', signal: 'LONG BIAS', confidence: 78, risk: 'Moderato', state: 'Aumento di slancio', rationale: 'Migliora l\'ampiezza tecnica mentre il regime macro rimane a supporto.' },
    { symbol: 'GLD', signal: 'LONG BIAS', confidence: 71, risk: 'Basso', state: 'Trend intatto', rationale: 'La domanda difensiva e l\'indebolimento del rendimento reale sono allineati.' },
    { symbol: 'TLT', signal: 'WAIT', confidence: 63, risk: 'Moderato', state: 'In flessione', rationale: 'I tassi si avvicinano a una zona decisionale.' },
    { symbol: 'BTC-USD', signal: 'AVOID', confidence: 67, risk: 'Alto', state: 'Rumore elevato', rationale: 'Il prezzo è sotto il trend di breve termine.' },
  ], []);
  const query = useGetOpportunities(); const opportunities = useMockOr(query.data, mockOpps); const [mode, setMode] = useState(t('opps.all'));
  const filters = [t('opps.all'), 'LONG BIAS', 'WATCH', 'AVOID']; const filtered = mode === t('opps.all') ? opportunities : opportunities.filter((o) => o.signal === mode);
  return <div className="content-wrap"><PageHeader eyebrow={t('opps.eyebrow')} title={t('opps.title')} subtitle={t('opps.subtitle')} action={<div className="flex items-center gap-2">{query.isError && <Badge tone="amber">{t('opps.mockBoard')}</Badge>}<Badge tone="amber"><Brain size={11} />{t('opps.threeBrain')}</Badge></div>} /><div className="mb-5 flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-md px-3 py-2 text-xs font-semibold ${mode === item ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`} data-testid={`button-opportunity-filter-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}</div>{query.isLoading ? <StateMessage kind="loading" title={t('opps.title')} body="" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{filtered.map((item, index) => <OpportunityCard opportunity={item} index={index} key={item.symbol} />)}</div>}<div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground"><Info size={14} className="mr-2 inline text-primary" />{t('opps.agreement')}</div></div>;
}

export function AssetPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol || 'SPY';
  const analysisParams = { locale };
  const query = useGetAssetAnalysis(symbol, analysisParams, { query: { queryKey: getGetAssetAnalysisQueryKey(symbol, analysisParams) } });

  const asset = query.data;
  const brain = asset ? [{ label: t('asset.techBrain'), data: asset.technical, color: 'text-accent' }, { label: t('asset.fundBrain'), data: asset.fundamental, color: 'text-primary' }, { label: t('asset.riskBrain'), data: asset.risk, color: 'text-[hsl(209_78%_65%)]' }] : [];

  return <div className="content-wrap">
    <PageHeader eyebrow={`${t('asset.eyebrow')} / ${symbol}`} title={asset?.name || symbol} subtitle={t('asset.subtitle')} action={<PageButton href="/simulator">{t('asset.openSimulator')}</PageButton>} />
    {query.isLoading ? <StateMessage kind="loading" title={t('markets.loading')} body="" /> : query.isError && !asset ? <StateMessage kind="error" title={t('error.title')} body={t('error.desc')} onRetry={() => query.refetch()} /> : asset ? <>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.05fr_1fr_1fr]">
        <div className="panel p-5"><p className="eyebrow">{t('asset.lastPrice')}</p><p className="mono mt-3 text-4xl text-foreground">{asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p><div className="mt-5 flex items-center gap-2"><Badge tone={asset.decision.toLowerCase().includes('buy') ? 'positive' : asset.decision.toLowerCase().includes('sell') ? 'negative' : 'amber'}>{asset.decision}</Badge><span className="text-xs text-muted-foreground">{t('asset.modelConfidence')} {asset.confidence}%</span></div></div>
        <div className="panel p-5 lg:col-span-2"><div className="flex items-start justify-between"><div><p className="eyebrow">{t('asset.composite')}</p><h2 className="display mt-2 text-2xl font-bold text-foreground">{asset.decision === 'BUY' ? t('asset.consideredEntry') : t('asset.wait')}</h2></div><Badge tone={asset.riskLevel.toLowerCase().includes('high') || asset.riskLevel.toLowerCase().includes('alto') ? 'negative' : 'positive'}>{t('asset.riskLevel')} {asset.riskLevel.toLowerCase()}</Badge></div><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{asset.explanation}</p><div className="mt-4"><Notice tone="teal"><span>{t('news.paperContext')}</span></Notice></div><div className="mt-5 flex items-center gap-4 border-t border-border pt-4"><span className="eyebrow">{t('asset.regime')}</span><span className="mono text-xs text-primary">{asset.regime}</span><span className="ml-auto mono text-xs text-muted-foreground">{t('common.confidence').toLowerCase()} {asset.confidence}%</span></div></div>
      </div>

      <SectionLabel aside={<Badge tone="neutral">{t('asset.directional')}</Badge>}>{t('asset.detail')}</SectionLabel>
      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        {brain.map(({ label, data, color }) => <div className="panel p-5" key={label}><div className="flex items-center justify-between"><span className="eyebrow">{label}</span><Brain size={15} className={color} /></div><div className="mt-5 flex items-end justify-between"><span className={`mono text-3xl ${color}`}>{data.score}</span><Badge tone={data.direction.toLowerCase().includes('bull') || data.direction.toLowerCase().includes('rialz') ? 'positive' : data.direction.toLowerCase().includes('caut') ? 'amber' : 'neutral'}>{data.direction}</Badge></div><div className="mt-4 h-1 rounded-full bg-secondary"><div className={`h-full rounded-full ${color.replace('text-', 'bg-')}`} style={{ width: `${data.score}%` }} /></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{data.rationale}</p><p className="mt-3 mono text-[10px] text-muted-foreground">{t('common.confidence').toLowerCase()} {data.confidence}%</p></div>)}
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <SectionLabel>{t('asset.thesis')}</SectionLabel>
          <div className="space-y-4">
            <div><p className="text-sm font-semibold text-foreground">{t('asset.thesis.summary')}</p><p className="mt-1 text-xs text-muted-foreground">{asset.thesis.summary}</p></div>
            <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
              <div><span className="eyebrow block mb-1">{t('asset.thesis.short')}</span><p className="text-xs text-muted-foreground">{asset.thesis.short}</p></div>
              <div><span className="eyebrow block mb-1">{t('asset.thesis.medium')}</span><p className="text-xs text-muted-foreground">{asset.thesis.medium}</p></div>
              <div><span className="eyebrow block mb-1">{t('asset.thesis.long')}</span><p className="text-xs text-muted-foreground">{asset.thesis.long}</p></div>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <SectionLabel>{t('asset.riskLimits')}</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-secondary/30 p-3"><span className="eyebrow">{t('asset.risk.maxLoss')}</span><p className="mono mt-2 text-xl text-destructive">{asset.riskLimits.maxLossPercent}%</p></div>
            <div className="rounded-md bg-secondary/30 p-3"><span className="eyebrow">{t('asset.risk.maxExposure')}</span><p className="mono mt-2 text-xl text-primary">{asset.riskLimits.maxExposurePercent}%</p></div>
          </div>
          <div className="mt-4 border-t border-border pt-4"><span className="eyebrow">{t('asset.risk.sizing')}</span><p className="mt-1 text-xs text-muted-foreground">{asset.riskLimits.positionSizing}</p></div>
          <div className="mt-4 border-t border-border pt-4"><span className="eyebrow block mb-2">{t('asset.risk.limitations')}</span><ul className="space-y-1">{asset.riskLimits.limitations.map((limit, idx) => <li key={idx} className="flex gap-2 text-xs text-muted-foreground"><ShieldAlert size={14} className="shrink-0 text-amber-500" />{limit}</li>)}</ul></div>
        </section>
      </div>

      <SectionLabel>{t('asset.precedents')}</SectionLabel>
      <div className="mb-6 space-y-3">
        {asset.historicalPrecedents.length > 0 ? asset.historicalPrecedents.map((prec, idx) => <div key={idx} className="panel p-5 md:p-6" data-testid={`precedent-${idx}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 mb-2"><Badge tone="neutral">{t('asset.precedent.match')}: {prec.matchScore}%</Badge><span className="mono text-xs text-muted-foreground">{prec.date}</span></div><h3 className="text-lg font-bold text-foreground">{prec.event}</h3></div><Badge tone="neutral">{t('asset.precedent.trigger')}: {prec.trigger}</Badge></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-md bg-secondary/30 p-4"><span className="eyebrow block mb-1 text-primary">{t('asset.precedent.takeaway')}</span><p className="text-xs text-muted-foreground">{prec.takeaway}</p></div><div className="rounded-md bg-secondary/30 p-4"><span className="eyebrow block mb-1 text-destructive">{t('asset.precedent.caveat')}</span><p className="text-xs text-muted-foreground">{prec.caveat}</p></div></div><div className="mt-5"><span className="eyebrow block mb-3">{t('asset.precedent.outcomes')}</span><div className="grid grid-cols-3 gap-3">{prec.outcomes.map((outcome, oIdx) => <div key={oIdx} className="rounded-md border border-border p-3 flex flex-col justify-between"><span className="eyebrow block mb-2">{outcome.horizon}</span><div className="flex items-end justify-between"><div><span className="text-[10px] text-muted-foreground block">{t('asset.precedent.medianReturn')}</span><span className={`mono text-lg ${outcome.medianReturn >= 0 ? 'text-accent' : 'text-destructive'}`}>{outcome.medianReturn > 0 ? '+' : ''}{outcome.medianReturn}%</span></div><div className="text-right"><span className="text-[10px] text-muted-foreground block">{t('asset.precedent.positiveRate')}</span><span className="mono text-sm text-foreground">{outcome.positiveRate}%</span></div></div></div>)}</div></div></div>) : <Notice><span>{t('asset.noPrecedents')}</span></Notice>}
      </div>

      <SectionLabel aside={<Badge tone={asset.newsSourceStatus === 'live' ? 'positive' : 'amber'}>{t('asset.newsSource')}: {asset.newsSourceStatus === 'live' ? t('news.source.live') : asset.newsSourceStatus === 'partial' ? t('news.source.partial') : asset.newsSourceStatus === 'contextual' ? t('news.source.contextual') : t('news.source.degraded')}</Badge>}>{t('asset.news')}</SectionLabel>
      <p className="mb-3 mono text-[10px] text-muted-foreground">{asset.newsSourceLabel}</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={asset.newsSourceCoverage.available === asset.newsSourceCoverage.expected ? 'positive' : 'amber'}>{t('news.sourcesAvailable')}: {asset.newsSourceCoverage.available}/{asset.newsSourceCoverage.expected}</Badge>
        {asset.newsSources.map((source) => <a href={source.homepageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 mono text-[9px] uppercase tracking-wider text-muted-foreground hover:border-primary/50 hover:text-primary" key={source.id} data-testid={`asset-news-source-${source.id}`}>{source.label}<ExternalLink size={10} /></a>)}
      </div>
      {asset.newsSourceStatus !== 'live' && <div className="mb-3"><Notice><span>{t('news.reducedAvailability')}</span></Notice></div>}
      {asset.newsConflicts.length > 0 && <div className="mb-3"><Notice tone="negative"><span>{t('news.conflicts')}: {asset.newsConflicts.map((conflict) => conflict.theme).join(', ')}.</span></Notice></div>}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {asset.news.length > 0 ? asset.news.map((item) => <article key={item.id} className="panel panel-hover p-4" data-testid={`asset-news-${item.id}`}><div className="flex flex-wrap justify-between items-start gap-2 mb-2"><div><span className="mono text-xs text-muted-foreground">{formatNewsTimestamp(item.publishedAt, locale)}</span><p className="mt-1 text-xs font-semibold text-accent">{item.source}</p></div><div className="flex gap-1"><Badge tone={item.sentiment === 'supportive' ? 'positive' : item.sentiment === 'adverse' ? 'negative' : 'neutral'}>{item.sentiment === 'supportive' ? t('news.sentiment.supportive') : item.sentiment === 'adverse' ? t('news.sentiment.adverse') : t('news.sentiment.mixed')}</Badge><Badge tone={verificationTone(item.verification.status)}>{item.verification.status === 'confirmed' ? t('news.verification.confirmed') : item.verification.status === 'contradicted' ? t('news.verification.contradicted') : item.verification.status === 'duplicate' ? t('news.verification.duplicate') : t('news.verification.standalone')}</Badge></div></div><Link href="/news" className="text-sm font-semibold text-foreground hover:text-primary">{item.title}</Link><p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.summary}</p><a href={item.canonicalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" data-testid={`asset-news-citation-${item.id}`}><ExternalLink size={12} />{t('news.openSource')}</a></article>) : <Notice><span>{t('asset.noNews')}</span></Notice>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <section className="panel p-5"><SectionLabel>{t('asset.snapshot')}</SectionLabel><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(asset.indicators).map(([key, value]) => <div className="rounded-md bg-secondary/60 p-3" key={key}><p className="eyebrow">{key.replaceAll('_', ' ')}</p><p className="mono mt-2 text-sm text-foreground">{typeof value === 'number' ? value.toFixed(2) : value}</p></div>)}</div></section>
        <Notice tone="negative"><span><strong>{t('asset.invalidation')}:</strong> {asset.invalidation}</span></Notice>
      </div>
    </> : null}
  </div>;
}

export function PortfolioPage() {
  const { t } = useI18n();
  const [notice, setNotice] = useState(false);
  return <div className="content-wrap"><PageHeader eyebrow={t('portfolio.eyebrow')} title={t('portfolio.title')} subtitle={t('portfolio.subtitle')} action={<Badge tone="teal"><LockKeyhole size={11} />{t('portfolio.simulatedOnly')}</Badge>} /><Notice tone="amber"><span><strong>{t('portfolio.apiUnavailable')}</strong> {t('portfolio.mockNotice')}</span></Notice><div className="mt-5 grid gap-3 md:grid-cols-4"><Metric label={t('portfolio.paperEquity')} value="$103,842" detail={t('portfolio.mockSnapshot')} tone="amber" /><Metric label={t('portfolio.unrealizedPnl')} value="+$3,842" detail={`+3.84% ${t('portfolio.sinceInception')}`} tone="positive" /><Metric label={t('portfolio.invested')} value="$43,567" detail={`42.0% ${t('portfolio.ofEquity')}`} /><Metric label={t('portfolio.cashAvailable')} value="$60,275" detail={t('portfolio.readyForProposals')} tone="positive" /></div><div className="mt-6 panel overflow-hidden"><div className="flex items-center justify-between border-b border-border p-5"><h2 className="text-sm font-bold">{t('portfolio.openPositions')}</h2><button onClick={() => setNotice(true)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary" data-testid="button-add-position"><Plus size={14} />{t('portfolio.addPosition')}</button></div>{notice && <div className="border-b border-primary/20 bg-primary/5 px-5 py-3 text-xs text-primary">{t('portfolio.creationUnavailable')}</div>}<div className="divide-y divide-border">{[['QQQ', 'Invesco QQQ Trust', '$443.81', '+$1,280.40', '+4.72%'], ['GLD', 'SPDR Gold Shares', '$214.66', '+$428.20', '+2.19%'], ['SPY', 'SPDR S&P 500 ETF', '$518.42', '+$2,133.40', '+4.34%']].map(([symbol, name, price, pnl, pct]) => <div className="grid grid-cols-[1.3fr_.7fr_.7fr] gap-3 p-4 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-5" key={symbol}><div><span className="mono text-sm text-foreground">{symbol}</span><p className="mt-1 text-xs text-muted-foreground">{name}</p></div><div className="hidden md:block"><p className="eyebrow">{t('portfolio.mark')}</p><p className="mono mt-1 text-sm text-foreground">{price}</p></div><div><p className="eyebrow">{t('portfolio.pnl')}</p><p className="mono mt-1 text-sm text-accent">{pnl}</p></div><div className="text-right"><Badge tone="positive">{pct}</Badge></div></div>)}</div></div></div>;
}

export function SimulatorPage() {
  const { t } = useI18n();
  const mockMarkets: Market[] = useMemo(() => [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: t('news.catEquities'), price: 518.42, change: 2.18, changePercent: 0.42, sparkline: [4, 3.2, 3.4, 5, 4.2, 6, 6.4], status: t('common.open') },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: t('news.catEquities'), price: 443.81, change: 3.72, changePercent: 0.85, sparkline: [2, 2.8, 2.2, 3.5, 4.5, 4.2, 5.8], status: t('common.open') },
    { symbol: 'BTC-USD', name: 'Bitcoin / Dollaro USA', assetClass: t('news.catCrypto'), price: 67240.15, change: -412.2, changePercent: -0.61, sparkline: [7, 6, 6.7, 5.6, 5.8, 4.8, 4.3], status: t('common.open') },
    { symbol: 'GLD', name: 'SPDR Gold Shares', assetClass: 'Materie Prime', price: 214.66, change: 0.84, changePercent: 0.39, sparkline: [3, 3.4, 3.1, 3.9, 4, 4.4, 4.8], status: t('common.open') },
    { symbol: 'TLT', name: 'iShares 20+ Year Treasury', assetClass: t('news.catMacroRates'), price: 91.27, change: -0.3, changePercent: -0.33, sparkline: [5, 5.4, 4, 4.3, 3.8, 3.1, 2.7], status: t('common.open') },
  ], [t]);
  const [symbol, setSymbol] = useState('QQQ'); const [side, setSide] = useState('Buy'); const [size, setSize] = useState('5000'); const [submitted, setSubmitted] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); };
  return <div className="content-wrap"><PageHeader eyebrow={t('simulator.eyebrow')} title={t('simulator.title')} subtitle={t('simulator.subtitle')} action={<Badge tone="amber"><SlidersHorizontal size={11} />{t('simulator.builder')}</Badge>} /><div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><form className="panel p-5 md:p-6" onSubmit={submit}><SectionLabel>{t('simulator.inputs')}</SectionLabel><div className="space-y-5"><label className="block"><span className="eyebrow">{t('simulator.instrument')}</span><select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm text-foreground" data-testid="select-simulator-symbol">{mockMarkets.map((m) => <option value={m.symbol} key={m.symbol}>{m.symbol} — {m.name}</option>)}</select></label><div><span className="eyebrow">{t('simulator.direction')}</span><div className="mt-2 grid grid-cols-2 gap-2">{['Buy', 'Sell'].map((item) => <button type="button" onClick={() => setSide(item)} className={`rounded-md border py-3 text-sm font-semibold ${side === item ? item === 'Buy' ? 'border-accent bg-accent/10 text-accent' : 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground'}`} key={item} data-testid={`button-side-${item.toLowerCase()}`}>{item === 'Buy' ? t('simulator.buy') : t('simulator.sell')}</button>)}</div></div><label className="block"><span className="eyebrow">{t('simulator.notional')}</span><div className="mt-2 flex items-center rounded-md border border-input bg-background px-3"><span className="mono text-muted-foreground">$</span><input value={size} onChange={(e) => setSize(e.target.value)} type="number" min="100" step="100" className="w-full bg-transparent px-2 py-3 mono text-sm text-foreground outline-none" data-testid="input-paper-notional" /></div></label><label className="block"><span className="eyebrow">{t('simulator.why')}</span><textarea placeholder={t('simulator.whyPlaceholder')} className="mt-2 min-h-[92px] w-full resize-none rounded-md border border-input bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground" data-testid="input-trade-rationale" /></label><button type="submit" className="w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110" data-testid="button-generate-proposal"><Play size={15} className="mr-2 inline" />{t('simulator.generate')}</button></div></form><div className="space-y-4"><div className="panel p-5 md:p-6"><SectionLabel aside={<Badge tone="neutral">{t('common.mock')}</Badge>}>{t('simulator.preview')}</SectionLabel><div className="flex items-center justify-between border-b border-border py-4"><div><span className="mono text-2xl text-foreground">{symbol}</span><p className="mt-1 text-xs text-muted-foreground">{t('simulator.currentProposal')}</p></div><Badge tone={side === 'Buy' ? 'positive' : 'negative'}>{side === 'Buy' ? t('simulator.buy') : t('simulator.sell')}</Badge></div><div className="grid grid-cols-2 gap-4 py-5"><div><p className="eyebrow">{t('history.notional')}</p><p className="mono mt-2 text-xl text-foreground">${Number(size || 0).toLocaleString()}</p></div><div><p className="eyebrow">{t('simulator.maxLoss')}</p><p className="mono mt-2 text-xl text-primary">${Math.round(Number(size || 0) * .02).toLocaleString()}</p></div></div><Notice tone="teal"><span>{t('simulator.boundedNotice')}</span></Notice>{submitted && <div className="mt-4 flex items-center gap-2 rounded-md border border-accent/25 bg-accent/5 p-3 text-xs text-accent" data-testid="status-proposal-created"><CheckCircle2 size={15} />{t('simulator.createdLocally')}</div>}</div><div className="panel p-5"><SectionLabel>{t('simulator.before')}</SectionLabel><ul className="space-y-3 text-xs text-muted-foreground"><li className="flex gap-2"><CheckCircle2 size={14} className="shrink-0 text-accent" />{t('simulator.check1')}</li><li className="flex gap-2"><CheckCircle2 size={14} className="shrink-0 text-accent" />{t('simulator.check2')}</li><li className="flex gap-2"><CheckCircle2 size={14} className="shrink-0 text-accent" />{t('simulator.check3')}</li></ul></div></div></div></div>;
}

export function NewsPage() {
  const { t, locale } = useI18n();
  const [theme, setTheme] = useState<string>('');
  const [horizon, setHorizon] = useState<'' | 'short' | 'medium' | 'long'>('');

  const queryParams: GetNewsParams = {
    locale,
    ...(theme && theme !== t('news.all') ? { theme } : {}),
    ...(horizon ? { horizon } : {}),
  };

  const query = useGetNews(queryParams, { query: { queryKey: getGetNewsQueryKey(queryParams) } });

  const themes = [
    { value: '', label: t('news.all') },
    { value: 'Macro / Tassi', label: t('news.catMacroRates') },
    { value: 'Azionario', label: t('news.catEquities') },
    { value: 'FX / Macro', label: t('news.catFxMacro') },
    { value: 'Crypto', label: t('news.catCrypto') },
    { value: 'Materie prime', label: t('news.catCommodities') },
  ];
  const horizons: Array<{ label: string; value: '' | 'short' | 'medium' | 'long' }> = [{ label: t('news.all'), value: '' }, { label: t('news.horizon.short'), value: 'short' }, { label: t('news.horizon.medium'), value: 'medium' }, { label: t('news.horizon.long'), value: 'long' }];

  const feed = query.data;

  return <div className="content-wrap">
    <PageHeader
      eyebrow={t('news.eyebrow')}
      title={t('news.title')}
      subtitle={t('news.subtitle')}
      action={
        feed && (
          <div className="flex items-center gap-2">
            <Badge tone={feed.sourceStatus === 'live' ? 'positive' : 'amber'}>
              {feed.sourceStatus === 'live' ? <Wifi size={11} className="mr-1 inline" /> : <ShieldAlert size={11} className="mr-1 inline" />}
              {t('news.sourceStatus')}: {feed.sourceStatus === 'live' ? t('news.source.live') : feed.sourceStatus === 'partial' ? t('news.source.partial') : t('news.source.degraded')}
            </Badge>
            <Badge tone="neutral">
              <Clock3 size={11} className="mr-1 inline" />
              {t('news.updated')} {formatNewsTimestamp(feed.updatedAt, locale)}
            </Badge>
          </div>
        )
      }
    />
    {feed && <section className="mb-6 panel p-4 md:p-5" data-testid="news-verification-summary">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div><SectionLabel>{t('news.verificationTitle')}</SectionLabel><p className="text-xs leading-relaxed text-muted-foreground">{feed.sourceLabel}</p></div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={feed.sourceCoverage.available === feed.sourceCoverage.expected ? 'positive' : 'amber'}>{t('news.sourcesAvailable')}: {feed.sourceCoverage.available}/{feed.sourceCoverage.expected}</Badge>
          <Badge tone={feed.conflicts.length ? 'negative' : 'neutral'}>{t('news.conflicts')}: {feed.conflicts.length}</Badge>
          <Badge tone={feed.duplicates.length ? 'amber' : 'neutral'}>{t('news.duplicates')}: {feed.duplicates.length}</Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {feed.sources.map((source) => <a key={source.id} href={source.homepageUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${source.status === 'live' ? 'border-accent/30 bg-accent/5 text-accent' : 'border-border bg-secondary/40 text-muted-foreground'}`} data-testid={`news-source-${source.id}`}><span className={`h-1.5 w-1.5 rounded-full ${source.status === 'live' ? 'bg-accent' : 'bg-muted-foreground'}`} />{source.label} · {source.itemCount}<ExternalLink size={12} /></a>)}
      </div>
      {feed.sourceStatus !== 'live' && <div className="mt-4"><Notice><span>{t('news.reducedAvailability')}</span></Notice></div>}
      {feed.conflicts.length > 0 && <div className="mt-3"><Notice tone="negative"><span>{t('news.conflicts')}: {feed.conflicts.map((conflict) => `${conflict.theme} (${conflict.sources.join(' / ')})`).join('; ')}.</span></Notice></div>}
      {feed.duplicates.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{t('news.duplicates')}: {feed.duplicates.length} · {t('news.duplicateNote')}</p>}
    </section>}
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <div>
        <span className="eyebrow block mb-2">{t('news.theme')}</span>
        <div className="flex flex-wrap gap-2">
          {themes.map((item) => (
            <button
              key={item.value || 'all'}
              onClick={() => setTheme(item.value)}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${
                theme === item.value ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground transition'
              }`}
              data-testid={`button-news-theme-${item.value.toLowerCase().replaceAll(/[^a-z]+/g, '-') || 'all'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="eyebrow block mb-2">{t('news.horizon')}</span>
        <div className="flex flex-wrap gap-2">
          {horizons.map((item) => (
            <button
              key={item.label}
              onClick={() => setHorizon(item.value)}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${
                horizon === item.value ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground transition'
              }`}
              data-testid={`button-news-horizon-${item.value || 'all'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {query.isLoading ? (
      <StateMessage kind="loading" title={t('news.title')} body="" />
    ) : query.isError && !feed ? (
      <StateMessage kind="error" title={t('error.title')} body={t('error.desc')} onRetry={() => query.refetch()} />
    ) : (
      <div className="mt-5 space-y-3">
        {feed?.items.map((item) => (
          <article className="panel panel-hover p-5" key={item.id} data-testid={`news-item-${item.id}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="mono text-xs text-muted-foreground">{formatNewsTimestamp(item.publishedAt, locale)}</span>
                <span className="text-xs font-semibold text-muted-foreground">•</span>
                <span className="text-xs font-semibold text-accent">{item.source}</span>
              </div>
              <div className="flex gap-2">
                <Badge tone={item.sentiment === 'supportive' ? 'positive' : item.sentiment === 'adverse' ? 'negative' : 'neutral'}>
                  {item.sentiment === 'supportive' ? t('news.sentiment.supportive') : item.sentiment === 'adverse' ? t('news.sentiment.adverse') : t('news.sentiment.mixed')}
                </Badge>
                <Badge tone="amber">{item.theme === 'Macro / Tassi' ? t('news.catMacroRates') : item.theme === 'Azionario' ? t('news.catEquities') : item.theme === 'FX / Macro' ? t('news.catFxMacro') : item.theme === 'Materie prime' ? t('news.catCommodities') : item.theme}</Badge>
                <Badge tone={verificationTone(item.verification.status)}>{item.verification.status === 'confirmed' ? t('news.verification.confirmed') : item.verification.status === 'contradicted' ? t('news.verification.contradicted') : item.verification.status === 'duplicate' ? t('news.verification.duplicate') : t('news.verification.standalone')}</Badge>
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
            <a href={item.canonicalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" data-testid={`news-citation-${item.id}`}><ExternalLink size={13} />{t('news.openSource')}</a>

            <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <span className="eyebrow block mb-2">{t('news.impactAnalysis')}</span>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.analysis}</p>
                <p className="mt-3 text-[11px] text-muted-foreground">{item.verification.sourceCount > 1 ? `${t('news.sourcesAvailable')}: ${item.verification.sourceCount}` : t('news.singleSource')}</p>
              </div>
              <div>
                <span className="eyebrow block mb-2">{t('news.relevance')}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.relevance}%` }} />
                  </div>
                  <span className="mono text-xs text-primary">{item.relevance}%</span>
                </div>
                <div className="mt-3">
                  <span className="eyebrow block mb-1">{t('dashboard.trackedMarkets')}</span>
                  <div className="flex gap-1 flex-wrap">
                    {item.symbols.map(sym => <span key={sym} className="mono text-[10px] rounded bg-secondary/50 px-1.5 py-0.5 text-foreground">{sym}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
        {(!feed?.items || feed.items.length === 0) && (
          <Notice><span>{t('asset.noNews')}</span></Notice>
        )}
      </div>
    )}
  </div>;
}

export function RiskPage() {
  const { t } = useI18n();
  const [guardrails, setGuardrails] = useState({ exposure: true, concentration: true, drawdown: true });
  return <div className="content-wrap"><PageHeader eyebrow={t('risk.eyebrow')} title={t('risk.title')} subtitle={t('risk.subtitle')} action={<Badge tone="positive"><ShieldAlert size={11} />{t('risk.passing')}</Badge>} /><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="panel p-5 md:p-6"><SectionLabel aside={<Badge tone="teal">{t('risk.monitor')}</Badge>}>{t('risk.status')}</SectionLabel><div className="space-y-2">{[['exposure', t('risk.exposure'), t('risk.exposureUsed')], ['concentration', t('risk.concentration'), t('risk.concentrationUsed')], ['drawdown', t('risk.drawdown'), t('risk.drawdownUsed')]].map(([key, label, value]) => <div className="flex items-center justify-between border-b border-border py-4 last:border-0" key={key}><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent"><CheckCircle2 size={16} /></div><div><p className="text-sm font-semibold text-foreground">{label}</p><p className="mono mt-1 text-[10px] text-muted-foreground">{value}</p></div></div><span className="relative h-5 w-9 rounded-full bg-accent/30"><button onClick={() => setGuardrails((old) => ({ ...old, [key]: !old[key as keyof typeof old] }))} className={`absolute top-0.5 h-4 w-4 rounded-full bg-accent transition-transform ${guardrails[key as keyof typeof guardrails] ? 'translate-x-4' : 'translate-x-0.5'}`} data-testid={`button-toggle-${key}`} aria-label={`Attiva/Disattiva ${label}`} /></span></div>)}</div></section><div className="space-y-4"><div className="panel p-5"><SectionLabel>{t('risk.history')}</SectionLabel><div className="mt-4 h-28"><svg viewBox="0 0 500 100" preserveAspectRatio="none" className="h-full w-full text-accent"><path d="M0,57 C50,62 80,32 125,46 S190,70 230,52 S290,35 330,50 S400,68 500,40" fill="none" stroke="currentColor" strokeWidth="3" /></svg></div><div className="flex justify-between mono text-[9px] text-muted-foreground"><span>{t('risk.daysAgo')}</span><span>{t('risk.now')} · 32</span></div></div><Notice tone="teal"><span>{t('risk.noBlock')}</span></Notice></div></div></div>;
}

export function BacktestPage() {
  const { t } = useI18n();
  return <div className="content-wrap"><PageHeader eyebrow={t('backtest.eyebrow')} title={t('backtest.title')} subtitle={t('backtest.subtitle')} /><div className="panel flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><BarChart3 size={25} /></div><Badge tone="amber">{t('backtest.unavailable')}</Badge><h2 className="display mt-5 text-2xl font-bold text-foreground">{t('backtest.notConnected')}</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t('backtest.desc')}</p><button className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground" onClick={() => undefined} data-testid="button-backtest-notify"><Info size={14} />{t('backtest.notify')}</button></div></div>;
}

export function HistoryPage() {
  const { t } = useI18n();
  const rows = [[`12 ${t('history.jun')}`, 'QQQ', t('history.buy'), '$5,000', '+$184.20', t('history.closed')], [`10 ${t('history.jun')}`, 'GLD', t('history.buy'), '$3,200', '+$76.80', t('history.closed')], [`08 ${t('history.jun')}`, 'BTC-USD', t('history.sell'), '$2,500', '-$112.50', t('history.closed')], [`04 ${t('history.jun')}`, 'SPY', t('history.buy'), '$7,500', '+$241.20', t('history.closed')]];
  return <div className="content-wrap"><PageHeader eyebrow={t('history.eyebrow')} title={t('history.title')} subtitle={t('history.subtitle')} action={<Badge tone="neutral"><HistoryIcon />{t('history.proposals')}</Badge>} /><Notice><span><strong>{t('history.mockHistory')}</strong> {t('history.notPersisted')}</span></Notice><div className="mt-5 panel overflow-hidden"><div className="grid grid-cols-[.8fr_1fr_.8fr_.8fr_1fr_.8fr] gap-3 border-b border-border bg-secondary/40 px-5 py-3 eyebrow"><span>{t('history.date')}</span><span>{t('history.instrument')}</span><span>{t('history.side')}</span><span>{t('history.notional')}</span><span>{t('history.result')}</span><span>{t('history.status')}</span></div>{rows.map((row) => <div className="grid grid-cols-[.8fr_1fr_.8fr_.8fr_1fr_.8fr] items-center gap-3 border-b border-border px-5 py-4 last:border-0" key={row[0]}>{row.map((cell, i) => <span className={`mono text-xs ${i === 4 ? cell.startsWith('+') ? 'text-accent' : 'text-destructive' : i === 5 ? 'text-muted-foreground' : 'text-foreground'}`} key={cell}>{cell}</span>)}</div>)}</div></div>;
}
function HistoryIcon() { return <Clock3 size={12} />; }

export function SystemPage() {
  const { t } = useI18n();
  const query = useHealthCheck();
  const online = query.data?.status === 'ok' || query.data?.status === 'healthy';
  const brokerQuery = useGetBrokerStatus({ query: { queryKey: getGetBrokerStatusQueryKey(), refetchInterval: 5_000 } });
  const broker = brokerQuery.data;
  const services = [
    [t('system.marketData'), t('system.delayed15m'), true],
    [t('system.analysisEngine'), t('system.threeBrainsReady'), true],
    [t('system.paperPersistence'), t('system.unavailable'), false],
    [t('system.healthEndpoint'), query.isLoading ? t('system.checking') : online ? t('system.healthy') : t('system.mockFallback'), online],
  ];
  const brokerState = broker?.connected ? t('broker.ready') : t('broker.disconnected');
  const healthTone = broker?.health === 'healthy' ? 'positive' : broker?.health === 'degraded' ? 'negative' : 'amber';
   const databaseTone = broker?.database?.status === 'healthy' ? 'positive' : broker?.database?.status === 'degraded' ? 'negative' : 'amber';
   const databaseLabel = broker?.database?.status === 'healthy' ? t('broker.persistenceHealthy') : broker?.database?.status === 'degraded' ? t('broker.persistenceDegraded') : t('broker.persistenceUnknown');
   const databaseMessage = broker?.database?.status === 'healthy' ? t('broker.persistenceHealthyMessage') : broker?.database?.status === 'degraded' ? t('broker.persistenceDegradedMessage') : t('broker.persistenceUnknownMessage');
  const dataReads: Array<[string, string, { status: string; lastCheckedAt?: string }]> = broker ? [
    ['quotes', t('broker.readQuotes'), broker.dataStatus.quotes],
    ['account', t('broker.readAccount'), broker.dataStatus.account],
    ['positions', t('broker.readPositions'), broker.dataStatus.positions],
    ['history', t('broker.readHistory'), broker.dataStatus.history],
  ] : [];
  const dataReadTone = (status: string) => status === 'available' ? 'positive' : status === 'unknown' ? 'amber' : 'negative';
  const dataReadLabel = (status: string) => status === 'available'
    ? t('broker.dataAvailable')
    : status === 'unavailable'
      ? t('broker.dataUnavailable')
      : status === 'malformed'
        ? t('broker.dataMalformed')
        : status === 'error'
          ? t('broker.dataError')
          : t('broker.dataUnknown');
  const hasDataReadIssue = dataReads.some(([, , read]) => ['unavailable', 'malformed', 'error'].includes(read.status));
  const heartbeatAgeMs = broker?.lastHeartbeatAt
    ? Math.max(0, Date.now() - Date.parse(broker.lastHeartbeatAt))
    : undefined;
  const heartbeatState = !broker
    ? 'unknown'
    : broker.connected
      ? 'fresh'
      : broker.lastHeartbeatAt
        ? 'stale'
        : 'missing';
  const heartbeatTone = heartbeatState === 'fresh' ? 'positive' : heartbeatState === 'stale' ? 'negative' : 'amber';
  const formatHeartbeatAge = (ageMs?: number) => {
    if (ageMs === undefined) return t('broker.heartbeatUnknownAge');
    const totalSeconds = Math.floor(ageMs / 1_000);
    if (totalSeconds < 60) return `${totalSeconds}${t('broker.seconds')}`;
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}${t('broker.minutes')}`;
    const totalHours = Math.floor(totalMinutes / 60);
    return `${totalHours}${t('broker.hours')} ${totalMinutes % 60}${t('broker.minutes')}`;
  };
  const formatTimestamp = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : t('broker.noHeartbeat');
  return <div className="content-wrap">
    <PageHeader eyebrow={t('system.eyebrow')} title={t('system.title')} subtitle={t('system.subtitle')} action={<button onClick={() => { query.refetch(); brokerQuery.refetch(); }} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="button-refresh-system"><RefreshCw size={14} />{t('system.runChecks')}</button>} />
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <Metric label={t('system.state')} value={t('system.operational')} detail={t('system.surfacesAvailable')} tone="positive" icon={<Wifi size={15} className="text-accent" />} />
      <Metric label={t('system.freshness')} value={t('system.15min')} detail={t('system.quotesDelayed')} tone="amber" icon={<Timer size={15} className="text-primary" />} />
      <Metric label={t('system.execLink')} value={t('system.disabled')} detail={t('system.paperOnlyEnv')} icon={<Pause size={15} className="text-muted-foreground" />} />
    </div>
    {heartbeatState === 'stale' && <Notice tone="negative"><div><p className="font-semibold">{t('broker.heartbeatStaleTitle')}</p><p className="mt-1">{t('broker.heartbeatStaleDetail')} <strong>{formatHeartbeatAge(heartbeatAgeMs)}</strong>. {t('broker.checkVps')}</p></div></Notice>}
    {heartbeatState === 'missing' && <Notice><div><p className="font-semibold">{t('broker.heartbeatMissingTitle')}</p><p className="mt-1">{t('broker.heartbeatMissingDetail')} {t('broker.checkVps')}</p></div></Notice>}
    {hasDataReadIssue && <div className="mt-3"><Notice tone="negative"><div><p className="font-semibold">{t('broker.dataReadAttentionTitle')}</p><p className="mt-1">{t('broker.dataReadAttentionDetail')}</p></div></Notice></div>}
    <div className="mb-5 panel p-5 md:p-6">
      <SectionLabel aside={<Badge tone={broker?.connected ? 'positive' : 'amber'}>{broker?.mode === 'paper' ? t('broker.paperOnly') : brokerState}</Badge>}>{t('broker.title')}</SectionLabel>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="text-sm font-semibold text-foreground">{brokerState}</p><p className="mt-1 text-xs text-muted-foreground">{broker?.message ?? t('broker.bridgeRequired')}</p></div>
        <div className="flex flex-wrap gap-2"><Badge tone="neutral">{broker?.provider?.toUpperCase() ?? 'AXI'}</Badge><Badge tone="neutral">{broker?.venue?.toUpperCase() ?? 'MT5'}</Badge><Badge tone="negative">{t('broker.executionDisabled')}</Badge></div>
      </div>
       <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-5">
        <div><p className="eyebrow">{t('broker.health')}</p><Badge tone={healthTone}>{broker?.health ?? 'unknown'}</Badge></div>
        <div><p className="eyebrow">{t('broker.heartbeatStatus')}</p><Badge tone={heartbeatTone}>{heartbeatState === 'fresh' ? t('broker.heartbeatFresh') : heartbeatState === 'stale' ? t('broker.heartbeatStale') : heartbeatState === 'missing' ? t('broker.heartbeatMissing') : t('broker.heartbeatUnknown')}</Badge></div>
        <div><p className="eyebrow">{t('broker.lastHeartbeat')}</p><p className="mt-1 mono text-xs text-foreground">{formatTimestamp(broker?.lastHeartbeatAt)}</p></div>
        <div><p className="eyebrow">{t('broker.version')}</p><p className="mt-1 mono text-xs text-foreground">{broker?.bridgeVersion ?? '—'}</p></div>
         <div><p className="eyebrow">{t('broker.auditPersistence')}</p><Badge tone={databaseTone}>{databaseLabel}</Badge><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{databaseMessage}</p></div>
      </div>
    </div>
    {broker && <div className="mb-5 panel p-5 md:p-6">
      <SectionLabel>{t('broker.dataReads')}</SectionLabel>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t('broker.dataReadsDetail')}</p>
      <div className="divide-y divide-border">
        {dataReads.map(([key, label, read]) => <div className="flex items-center justify-between gap-4 py-3" key={key} data-testid={`broker-read-status-${key}`}>
          <div><p className="text-sm font-semibold text-foreground">{label}</p><p className="mt-1 mono text-[10px] text-muted-foreground">{read.lastCheckedAt ? formatTimestamp(read.lastCheckedAt) : t('broker.dataUnknown')}</p></div>
          <Badge tone={dataReadTone(read.status)}>{dataReadLabel(read.status)}</Badge>
        </div>)}
      </div>
    </div>}
    <div className="mb-5 panel p-5 md:p-6">
      <SectionLabel>{t('broker.auditTrail')}</SectionLabel>
      {broker?.auditTrail?.length ? <div className="divide-y divide-border">{broker.auditTrail.slice(-5).reverse().map((event) => <div className="flex items-start justify-between gap-4 py-3" key={`${event.at}-${event.event}`}><div><p className="mono text-xs text-foreground">{event.event}</p><p className="mt-1 text-xs text-muted-foreground">{event.detail ?? event.actor}</p></div><time className="shrink-0 mono text-[10px] text-muted-foreground">{formatTimestamp(event.at)}</time></div>)}</div> : <p className="text-sm text-muted-foreground">{t('broker.noAudit')}</p>}
    </div>
    <div className="panel p-5 md:p-6"><SectionLabel aside={<Badge tone={online ? 'positive' : 'amber'}>{online ? t('system.healthy') : t('system.mockFallback')}</Badge>}>{t('system.serviceChecks')}</SectionLabel><div className="divide-y divide-border">{services.map(([name, status, good]) => <div className="flex items-center justify-between py-4" key={name as string}><div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${good ? 'bg-accent' : 'bg-primary'}`} /><span className="text-sm text-foreground">{name}</span></div><span className={`mono text-xs ${good ? 'text-accent' : 'text-primary'}`}>{status}</span></div>)}</div></div>
  </div>;
}

export function SettingsPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState('Beginner'); const [saved, setSaved] = useState(false); const [updates, setUpdates] = useState(true);
  return <div className="content-wrap"><PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} subtitle={t('settings.subtitle')} action={saved ? <Badge tone="positive"><CheckCircle2 size={11} />{t('settings.savedLocally')}</Badge> : undefined} /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="panel p-5"><SectionLabel>{t('settings.expLevel')}</SectionLabel><p className="mb-4 text-xs leading-relaxed text-muted-foreground">{t('settings.expDesc')}</p><div className="space-y-2">{['Beginner', 'Advanced'].map((item) => <button onClick={() => setMode(item)} className={`flex w-full items-center justify-between rounded-md border p-4 text-left transition ${mode === item ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`} key={item} data-testid={`button-mode-${item.toLowerCase()}`}><div><p className="text-sm font-semibold text-foreground">{item === 'Beginner' ? t('settings.beginner') : t('settings.advanced')}</p><p className="mt-1 text-xs text-muted-foreground">{item === 'Beginner' ? t('settings.beginnerDesc') : t('settings.advancedDesc')}</p></div><span className={`h-4 w-4 rounded-full border-2 ${mode === item ? 'border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--card))]' : 'border-muted-foreground'}`} /></button>)}</div></section><section className="panel p-5 md:p-6"><SectionLabel>{t('settings.behavior')}</SectionLabel><div className="divide-y divide-border"><div className="flex items-center justify-between py-4"><div><p className="text-sm font-semibold text-foreground">{t('settings.refresh')}</p><p className="mt-1 text-xs text-muted-foreground">{t('settings.refreshDesc')}</p></div><button onClick={() => setUpdates(!updates)} className={`h-6 w-11 rounded-full p-1 transition ${updates ? 'bg-accent/60' : 'bg-secondary'}`} data-testid="button-toggle-market-refresh"><span className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${updates ? 'translate-x-5' : ''}`} /></button></div><div className="flex items-center justify-between py-4"><div><p className="text-sm font-semibold text-foreground">{t('settings.paperMode')}</p><p className="mt-1 text-xs text-muted-foreground">{t('settings.paperModeDesc')}</p></div><Badge tone="teal"><LockKeyhole size={11} />{t('settings.locked')}</Badge></div><div className="flex items-center justify-between py-4"><div><p className="text-sm font-semibold text-foreground">{t('settings.resetLocal')}</p><p className="mt-1 text-xs text-muted-foreground">{t('settings.resetDesc')}</p></div><button onClick={() => { setMode('Beginner'); setUpdates(true); setSaved(false); }} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-destructive/40 hover:text-destructive" data-testid="button-reset-preferences">{t('settings.reset')}</button></div></div><button onClick={() => setSaved(true)} className="mt-5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:brightness-110" data-testid="button-save-preferences">{t('settings.save')}</button></section></div></div>;
}