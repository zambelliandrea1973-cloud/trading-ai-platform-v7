import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, CircleHelp, LoaderCircle, RefreshCw, ServerCrash } from 'lucide-react';
import { Link } from 'wouter';
import { type ReactNode } from 'react';
import type { Market, Opportunity } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow mb-2">{eyebrow}</p><h1 className="display text-3xl font-bold tracking-tight text-foreground md:text-[34px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p></div>{action}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'positive' | 'negative' | 'amber' | 'neutral' | 'teal' }) {
  const classes = { positive: 'border-accent/30 bg-accent/10 text-accent', negative: 'border-destructive/30 bg-destructive/10 text-destructive', amber: 'border-primary/30 bg-primary/10 text-primary', teal: 'border-[hsl(209_78%_65%/.3)] bg-[hsl(209_78%_65%/.1)] text-[hsl(209_78%_65%)]', neutral: 'border-border bg-secondary text-muted-foreground' };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 mono text-[9px] uppercase tracking-wider ${classes[tone]}`}>{children}</span>;
}

export function Metric({ label, value, detail, tone = 'neutral', icon }: { label: string; value: string; detail?: string; tone?: 'positive' | 'negative' | 'amber' | 'neutral'; icon?: ReactNode }) {
  return <div className="panel p-4"><div className="mb-4 flex items-center justify-between"><span className="eyebrow">{label}</span>{icon}</div><p className={`mono text-2xl font-medium tracking-tight ${tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : tone === 'amber' ? 'text-amber' : 'text-foreground'}`}>{value}</p>{detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}</div>;
}

export function Sparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const safe = values?.length ? values : [2, 3, 2.5, 4, 3.7, 5, 4.8];
  const min = Math.min(...safe); const max = Math.max(...safe); const range = max - min || 1;
  const points = safe.map((v, i) => `${(i / (safe.length - 1 || 1)) * 100},${34 - ((v - min) / range) * 29}`).join(' ');
  return <svg viewBox="0 0 100 38" className={`h-9 w-[100px] ${positive ? 'text-accent' : 'text-destructive'}`} preserveAspectRatio="none" aria-label="Trend del prezzo"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function StateMessage({ kind, title, body, onRetry }: { kind: 'loading' | 'error' | 'empty'; title: string; body: string; onRetry?: () => void }) {
  const { t } = useI18n();
  if (kind === 'loading') return <div className="panel p-6"><div className="flex items-center gap-3"><LoaderCircle className="animate-spin text-primary" size={17} /><span className="text-sm text-muted-foreground">{title}</span></div><div className="mt-5 space-y-3"><div className="skeleton h-3 w-2/3" /><div className="skeleton h-3 w-1/2" /></div></div>;
  return <div className={`panel flex flex-col items-start p-7 ${kind === 'error' ? 'border-destructive/35' : ''}`}><div className={`mb-4 rounded-lg p-2.5 ${kind === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>{kind === 'error' ? <ServerCrash size={19} /> : <CircleHelp size={19} />}</div><h3 className="text-base font-semibold text-foreground">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>{onRetry && <button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary" data-testid="button-retry"><RefreshCw size={14} />{t('common.retryConnection')}</button>}</div>;
}

export function MarketRow({ market }: { market: Market }) {
  const { t } = useI18n();
  const up = market.changePercent >= 0;
  return <Link href={`/assets/${market.symbol}`} className="panel panel-hover grid grid-cols-[1.2fr_.8fr_110px_100px] items-center gap-3 px-4 py-3 no-underline" data-testid={`row-market-${market.symbol}`}>
    <div><div className="flex items-center gap-2"><span className="mono text-sm font-medium text-foreground">{market.symbol}</span><Badge tone="neutral">{market.assetClass}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{market.name}</p></div>
    <div className="text-right"><p className="mono text-sm text-foreground">{market.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p><p className={`mono text-[11px] ${up ? 'text-positive' : 'text-negative'}`}>{up ? '+' : ''}{market.changePercent.toFixed(2)}%</p></div>
    <Sparkline values={market.sparkline} positive={up} /><div className="flex justify-end"><Badge tone={market.status.toLowerCase().includes('active') || market.status.toLowerCase().includes('attivo') ? 'positive' : 'neutral'}>{market.status === 'Active' || market.status === 'Open' ? t('common.open') : market.status}</Badge></div>
  </Link>;
}

export function OpportunityCard({ opportunity, index = 0 }: { opportunity: Opportunity; index?: number }) {
  const { t } = useI18n();
  const buy = opportunity.signal.toLowerCase().includes('buy') || opportunity.signal.toLowerCase().includes('long');
  return <Link href={`/assets/${opportunity.symbol}`} className={`panel panel-hover block p-5 no-underline fade-up delay-${Math.min(index + 1, 3)}`} data-testid={`card-opportunity-${opportunity.symbol}`}><div className="mb-4 flex items-start justify-between"><div><span className="mono text-lg font-medium text-foreground">{opportunity.symbol}</span><p className="mt-1 text-xs text-muted-foreground">{opportunity.state}</p></div><Badge tone={buy ? 'positive' : 'negative'}>{buy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{opportunity.signal}</Badge></div><p className="min-h-[40px] text-xs leading-relaxed text-muted-foreground">{opportunity.rationale}</p><div className="mt-5 flex items-end justify-between border-t border-border pt-4"><div><span className="eyebrow">{t('common.confidence')}</span><p className="mono mt-1 text-sm text-primary">{Math.round(opportunity.confidence)}%</p></div><div className="text-right"><span className="eyebrow">{t('common.risk')}</span><p className={`mono mt-1 text-sm ${opportunity.risk.toLowerCase().includes('high') || opportunity.risk.toLowerCase().includes('alto') ? 'text-negative' : 'text-foreground'}`}>{opportunity.risk}</p></div><ChevronRight size={16} className="mb-1 text-muted-foreground" /></div></Link>;
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) { return <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">{children}</h2>{aside}</div>; }

export function Notice({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'negative' | 'teal' }) { return <div className={`flex items-start gap-3 rounded-lg border p-3 text-xs leading-relaxed ${tone === 'negative' ? 'border-destructive/25 bg-destructive/5 text-destructive' : tone === 'teal' ? 'border-accent/25 bg-accent/5 text-accent' : 'border-primary/25 bg-primary/5 text-primary'}`}><AlertTriangle size={15} className="mt-0.5 shrink-0" />{children}</div>; }

export function PageButton({ href, children }: { href: string; children: ReactNode }) { return <Link href={href} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground no-underline transition hover:border-primary/50 hover:text-primary" data-testid={`link-${href.slice(1).replaceAll('/', '-') || 'home'}`}>{children}<ChevronRight size={13} /></Link>; }