import { useMemo } from 'react';
import { useUser } from '@clerk/react';
import { ArrowDownRight, ArrowUpRight, Brain, CheckCircle2, CircleDot, Gauge, RefreshCw, ShieldCheck, Target, Wifi } from 'lucide-react';
import { useGetDashboard, useGetMarkets, useGetOpportunities, useHealthCheck, type Dashboard, type Market, type Opportunity } from '@workspace/api-client-react';
import { Badge, MarketRow, Notice, OpportunityCard, PageButton, PageHeader, SectionLabel } from '@/components/common';
import { useI18n } from '@/lib/i18n';

function useMockOr<T>(data: T | undefined, mock: T) { return data ?? mock; }

function money(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function signedMoney(value: number) {
  return `${value >= 0 ? '+' : ''}${money(value)}`;
}

function signedPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

type PositionView = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
};

function StatusCard({ label, value, detail, tone = 'teal' }: { label: string; value: string; detail: string; tone?: 'teal' | 'amber' | 'red' }) {
  const toneClass = tone === 'red' ? 'text-destructive' : tone === 'amber' ? 'text-primary' : 'text-accent';
  const dotClass = tone === 'red' ? 'bg-destructive' : tone === 'amber' ? 'bg-primary' : 'bg-accent';
  return <div className="rounded-lg border border-border bg-card/75 p-4">
    <div className="mb-3 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dotClass}`} /><span className="eyebrow">{label}</span></div>
    <p className={`display text-xl font-bold ${toneClass}`}>{value}</p>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
  </div>;
}

export function DashboardV71Page() {
  const { t } = useI18n();
  const { user } = useUser();
  const displayName = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || t('shell.analyst');

  const mockOpps: Opportunity[] = useMemo(() => [
    { symbol: 'EUR/USD', signal: 'BUY', confidence: 78, risk: 'MEDIUM', state: 'Valutabile', rationale: 'Trend positivo e conferma multi-timeframe; il rischio resta entro i limiti PAPER.' },
    { symbol: 'XAU/USD', signal: 'WAIT', confidence: 62, risk: 'HIGH', state: 'Attendere', rationale: 'Flussi difensivi presenti, ma prezzo esteso e rischio elevato.' },
    { symbol: 'NAS100', signal: 'NO TRADE', confidence: 41, risk: 'HIGH', state: 'Bloccato', rationale: 'Correlazioni instabili e spread di rischio elevato: la protezione ha priorità.' },
  ], []);

  const mockDash: Dashboard = useMemo(() => ({
    marketState: 'INCERTO', marketStateDetail: 'Segnali misti: il sistema privilegia selettività e protezione del capitale.',
    riskScore: 58, riskLabel: 'High Risk', riskUpdatedAt: 'ultimo controllo', paperCapital: 25000, equity: 25184.6,
    dailyPnl: 184.6, openPositions: 2, exposure: 18.4, drawdown: 2.1, opportunities: mockOpps, regime: 'UNSTABLE', warningLevel: 'ELEVATED',
  }), [mockOpps]);

  const mockMarkets: Market[] = useMemo(() => [
    { symbol: 'EUR/USD', name: 'Euro / Dollaro', assetClass: 'FOREX', price: 1.09, change: 0.0032, changePercent: 0.29, sparkline: [2, 3, 2.7, 4.4, 4, 5.2], status: t('common.open') },
    { symbol: 'XAU/USD', name: 'Gold', assetClass: 'COMMODITY', price: 2364.2, change: -8.4, changePercent: -0.35, sparkline: [6, 5.4, 4.8, 5, 3.8, 4.2], status: t('common.open') },
    { symbol: 'NAS100', name: 'Nasdaq 100', assetClass: 'INDEX', price: 19428.6, change: -112.5, changePercent: -0.58, sparkline: [7, 6.5, 5.4, 6.1, 4.5, 5], status: t('common.open') },
    { symbol: 'BTC/USD', name: 'Bitcoin', assetClass: 'CRYPTO', price: 64120, change: 842, changePercent: 1.33, sparkline: [3, 4, 3.5, 5.2, 4.9, 6.2], status: t('common.open') },
  ], [t]);

  const dashboardQuery = useGetDashboard();
  const marketsQuery = useGetMarkets();
  const oppsQuery = useGetOpportunities();
  const healthQuery = useHealthCheck();

  const dashboard = useMockOr(dashboardQuery.data, mockDash);
  const markets = useMockOr(marketsQuery.data, mockMarkets);
  const opportunities = useMockOr(oppsQuery.data, mockOpps);
  const refreshing = dashboardQuery.isFetching || marketsQuery.isFetching || oppsQuery.isFetching;

  const buyDecision = opportunities.find((item) => /^(BUY|ACQUISTA)$/i.test(String(item.signal).trim()));
  const systemHealthy = !healthQuery.isError;
  const rawDashboard = dashboard as unknown as Record<string, unknown>;
  const rawPositions = Array.isArray(rawDashboard.positions) ? rawDashboard.positions as Array<Record<string, unknown>> : [];

  const demoPositions: PositionView[] = useMemo(() => [
    { symbol: 'QQQ', quantity: 10, avgPrice: 423.00, currentPrice: 443.81 },
    { symbol: 'GLD', quantity: 20, avgPrice: 210.00, currentPrice: 214.66 },
    { symbol: 'SPY', quantity: 20, avgPrice: 507.00, currentPrice: 518.42 },
  ], []);

  const positions: PositionView[] = rawPositions.length > 0 ? rawPositions.map((p) => ({
    symbol: String(p.symbol ?? p.ticker ?? '—'),
    quantity: Number(p.quantity ?? p.qty ?? p.volume ?? 0),
    avgPrice: Number(p.avgPrice ?? p.averagePrice ?? p.entryPrice ?? p.costBasis ?? 0),
    currentPrice: Number(p.currentPrice ?? p.mark ?? p.price ?? 0),
  })).filter((p) => p.quantity > 0 && p.avgPrice > 0 && p.currentPrice > 0) : demoPositions;

  const isPerformanceMock = rawPositions.length === 0;
  const invested = positions.reduce((sum, p) => sum + p.quantity * p.avgPrice, 0);
  const currentValue = positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  const unrealized = currentValue - invested;
  const unrealizedPct = invested > 0 ? unrealized / invested * 100 : 0;
  const realized = Number(rawDashboard.realizedPnl ?? rawDashboard.realizedPnL ?? 0);

  const refreshAll = () => {
    void dashboardQuery.refetch();
    void marketsQuery.refetch();
    void oppsQuery.refetch();
    void healthQuery.refetch();
  };

  return <div className="content-wrap">
    <PageHeader
      eyebrow="PANORAMICA OPERATIVA / V7.1"
      title={`Buongiorno, ${displayName}.`}
      subtitle="Cabina di comando: stato del sistema, decisioni di acquisto, rischio e performance delle posizioni in una sola vista."
      action={<button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary" data-testid="button-refresh-dashboard-v71"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />Aggiorna dati</button>}
    />

    <section className="mb-5 rounded-lg border border-border bg-card/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">PAPER</Badge>
          <Badge tone={systemHealthy ? 'positive' : 'negative'}><Wifi size={11} /> Sistema {systemHealthy ? 'operativo' : 'degradato'}</Badge>
          <Badge tone="positive"><ShieldCheck size={11} /> Sentinel attivo</Badge>
          <Badge tone="teal"><Brain size={11} /> 5 cervelli operativi</Badge>
        </div>
        <div className="mono text-[10px] text-muted-foreground">RISK {dashboard.riskScore}/100 · DD {dashboard.drawdown}% · ESP. {dashboard.exposure}%</div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((brain) => <div key={brain} className="rounded-md border border-border bg-background/50 px-3 py-2 text-center"><div className="mx-auto mb-1 h-2 w-2 rounded-full bg-accent" /><span className="mono text-[9px] text-muted-foreground">CERVELLO {brain}</span></div>)}
      </div>
    </section>

    <div className="mb-5 grid gap-3 md:grid-cols-5">
      <StatusCard label="1 · Sta funzionando?" value={systemHealthy ? 'SÌ' : 'ATTENZIONE'} detail={systemHealthy ? 'Servizi disponibili e controllo attivo.' : 'Controllare lo stato sistema.'} tone={systemHealthy ? 'teal' : 'red'} />
      <StatusCard label="2 · Sta tradando?" value={buyDecision ? 'VALUTA BUY' : 'IN ATTESA'} detail={buyDecision ? `${buyDecision.symbol} · decisione PAPER` : 'Nessun acquisto attivo in questo momento.'} tone={buyDecision ? 'amber' : 'teal'} />
      <StatusCard label="3 · Cosa sta facendo?" value={buyDecision ? buyDecision.symbol : 'MONITORA'} detail={buyDecision ? 'Preparazione proposta di acquisto simulata.' : 'Scansione mercati e opportunità.'} tone={buyDecision ? 'amber' : 'teal'} />
      <StatusCard label="4 · Perché?" value={buyDecision ? `${buyDecision.confidence}%` : 'NESSUN BUY'} detail={buyDecision?.rationale ?? 'I 5 cervelli non hanno prodotto una decisione di acquisto.'} tone={buyDecision ? 'amber' : 'teal'} />
      <StatusCard label="5 · Quanto rischia?" value={`${dashboard.riskScore}/100`} detail={`Drawdown ${dashboard.drawdown}% · esposizione ${dashboard.exposure}%`} tone={dashboard.riskScore >= 65 ? 'red' : dashboard.riskScore >= 45 ? 'amber' : 'teal'} />
    </div>

    {buyDecision && <section className="mb-5 rounded-lg border border-primary/45 bg-primary/5 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><p className="eyebrow mb-2 text-primary">ATTIVITÀ AI · SOLO DECISIONI DI ACQUISTO</p><h2 className="display text-2xl font-bold text-foreground">BUY {buyDecision.symbol}</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{buyDecision.rationale}</p></div>
        <Badge tone="amber">PAPER · CONFIDENZA {buyDecision.confidence}%</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Consenso</p><p className="mono mt-1 text-sm text-accent">5 cervelli</p></div>
        <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Rischio</p><p className="mono mt-1 text-sm text-primary">{buyDecision.risk}</p></div>
        <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Stato</p><p className="mono mt-1 text-sm text-foreground">{buyDecision.state}</p></div>
        <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Esecuzione</p><p className="mono mt-1 text-sm text-accent">SOLO SIMULATA</p></div>
      </div>
    </section>}

    {!buyDecision && <div className="mb-5 rounded-lg border border-border bg-card/40 px-4 py-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Attività AI:</span> nessuna decisione di acquisto attiva. Le decisioni WAIT/NO TRADE restano nelle pagine di dettaglio.</div>}

    <section className="mb-5 panel p-5 md:p-6">
      <SectionLabel aside={isPerformanceMock ? <Badge tone="amber">LAYOUT MOCK · collegare posizioni reali</Badge> : <Badge tone="positive">DATI POSIZIONI</Badge>}>Performance posizioni in trade</SectionLabel>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-background/45 p-4"><p className="eyebrow">Totale acquistato</p><p className="mono mt-2 text-xl text-foreground">{money(invested)}</p></div>
        <div className="rounded-md border border-border bg-background/45 p-4"><p className="eyebrow">Valore attuale</p><p className="mono mt-2 text-xl text-foreground">{money(currentValue)}</p></div>
        <div className="rounded-md border border-border bg-background/45 p-4"><p className="eyebrow">P&L non realizzato</p><p className={`mono mt-2 text-xl ${unrealized >= 0 ? 'text-accent' : 'text-destructive'}`}>{signedMoney(unrealized)} · {signedPct(unrealizedPct)}</p></div>
        <div className="rounded-md border border-border bg-background/45 p-4"><p className="eyebrow">P&L realizzato</p><p className={`mono mt-2 text-xl ${realized >= 0 ? 'text-accent' : 'text-destructive'}`}>{signedMoney(realized)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-secondary/45 text-muted-foreground"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Quantità</th><th className="px-4 py-3">Prezzo medio acquisto</th><th className="px-4 py-3">Prezzo attuale</th><th className="px-4 py-3">P&L</th><th className="px-4 py-3">P&L %</th><th className="px-4 py-3">Stato</th></tr></thead>
          <tbody>{positions.map((p) => {
            const pnl = p.quantity * (p.currentPrice - p.avgPrice);
            const pct = (p.currentPrice - p.avgPrice) / p.avgPrice * 100;
            const positive = pnl >= 0;
            return <tr key={p.symbol} className="border-t border-border">
              <td className="px-4 py-3 font-bold text-foreground">{p.symbol}</td><td className="mono px-4 py-3 text-muted-foreground">{p.quantity}</td><td className="mono px-4 py-3 text-foreground">{money(p.avgPrice)}</td><td className="mono px-4 py-3 text-foreground">{money(p.currentPrice)}</td><td className={`mono px-4 py-3 font-semibold ${positive ? 'text-accent' : 'text-destructive'}`}>{signedMoney(pnl)}</td><td className={`mono px-4 py-3 font-semibold ${positive ? 'text-accent' : 'text-destructive'}`}>{signedPct(pct)}</td><td className="px-4 py-3"><Badge tone={positive ? 'positive' : 'negative'}>{positive ? 'IN ATTIVO' : 'IN PASSIVO'}</Badge></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>

    <div className="mb-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <section className="panel p-5"><div className="mb-4 flex items-start justify-between"><div><p className="eyebrow mb-2">STATO MERCATO</p><h2 className="display text-2xl font-bold text-foreground">{dashboard.marketState}</h2><p className="mt-1 text-xs text-muted-foreground">{dashboard.marketStateDetail}</p></div><Badge tone="teal"><CircleDot size={11} />{dashboard.regime}</Badge></div><div className="grid grid-cols-3 gap-3 border-t border-border pt-4"><div><p className="eyebrow">P&L oggi</p><p className={`mono mt-1 text-sm ${dashboard.dailyPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>{signedMoney(dashboard.dailyPnl)}</p></div><div><p className="eyebrow">Posizioni</p><p className="mono mt-1 text-sm text-foreground">{dashboard.openPositions}</p></div><div><p className="eyebrow">Rischio</p><p className="mono mt-1 text-sm text-primary">{dashboard.riskScore}/100</p></div></div></section>
      <section className="panel p-5"><SectionLabel aside={<PageButton href="/risk">Apri controlli</PageButton>}>Rischio</SectionLabel><div className="flex items-center gap-5"><Gauge size={42} className={dashboard.riskScore >= 65 ? 'text-destructive' : 'text-accent'} /><div><p className="mono text-3xl text-foreground">{dashboard.riskScore}<span className="text-sm text-muted-foreground">/100</span></p><p className="mt-1 text-xs text-muted-foreground">Drawdown {dashboard.drawdown}% · limite operativo protetto</p></div></div></section>
    </div>

    <div className="mb-5 grid gap-5 xl:grid-cols-2">
      <section><SectionLabel aside={<PageButton href="/markets">Tutti i mercati</PageButton>}>Mercati monitorati</SectionLabel><div className="space-y-2">{markets.slice(0, 4).map((market) => <MarketRow market={market} key={market.symbol} />)}</div></section>
      <section><SectionLabel aside={<PageButton href="/opportunities">Vedi classifica</PageButton>}>Decisioni principali</SectionLabel><div className="grid gap-3 sm:grid-cols-2">{opportunities.slice(0, 4).map((opportunity, index) => <OpportunityCard opportunity={opportunity} index={index} key={opportunity.symbol} />)}</div></section>
    </div>

    <Notice tone="teal"><span><strong>Ambiente simulato.</strong> La dashboard V7.1 non abilita esecuzione live e non modifica la logica dei 5 cervelli.</span></Notice>
  </div>;
}
