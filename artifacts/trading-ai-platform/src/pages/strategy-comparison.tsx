import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  Clock3,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Badge, Notice, PageHeader, SectionLabel } from '@/components/common';

type Metrics = {
  initialCapital: number;
  finalCapital: number;
  netPnl: number;
  netReturnPct: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  profitFactor: number | null;
  expectancyR: number | null;
  maxDrawdownPct: number;
  totalCosts: number;
};

type BertoRules = {
  signalSymbol: string;
  executionSymbol: string;
  timezone: string;
  sessionOpen: string;
  entryWindowStart: string;
  forcedExit: string;
  minimumDistancePoints: number;
  suffixClusterDistance: number;
  stopLossPoints: number;
  takeProfitPoints: number;
  originalRiskPerTradePct: number;
  normalizedComparisonRiskPct: number;
  executionEnabled: false;
  mode: 'SHADOW';
};

type Snapshot = {
  mode: 'SHADOW';
  executionEnabled: false;
  sharedMarketData: true;
  isolatedPortfolios: true;
  decisionCrossInfluence: false;
  initialCapital: number;
  strategies: {
    FIVE_BRAINS_STRATEGY: Metrics;
    BERTO_GOLDEN_SETUP: Metrics;
  };
  bertoRules: BertoRules;
  verdict: 'INSUFFICIENT_DATA';
  minimumClosedTradesForReview: number;
  persistence?: { status: 'healthy' | 'degraded'; message?: string };
};

const emptyMetrics = (capital = 5_000): Metrics => ({
  initialCapital: capital,
  finalCapital: capital,
  netPnl: 0,
  netReturnPct: 0,
  closedTrades: 0,
  wins: 0,
  losses: 0,
  winRatePct: null,
  profitFactor: null,
  expectancyR: null,
  maxDrawdownPct: 0,
  totalCosts: 0,
});

const fallback: Snapshot = {
  mode: 'SHADOW',
  executionEnabled: false,
  sharedMarketData: true,
  isolatedPortfolios: true,
  decisionCrossInfluence: false,
  initialCapital: 5_000,
  strategies: {
    FIVE_BRAINS_STRATEGY: emptyMetrics(),
    BERTO_GOLDEN_SETUP: emptyMetrics(),
  },
  bertoRules: {
    signalSymbol: 'QQQ',
    executionSymbol: 'US500',
    timezone: 'America/New_York',
    sessionOpen: '09:30',
    entryWindowStart: '10:00',
    forcedExit: '15:55',
    minimumDistancePoints: 20,
    suffixClusterDistance: 10,
    stopLossPoints: 31,
    takeProfitPoints: 89,
    originalRiskPerTradePct: 5,
    normalizedComparisonRiskPct: 0.5,
    executionEnabled: false,
    mode: 'SHADOW',
  },
  verdict: 'INSUFFICIENT_DATA',
  minimumClosedTradesForReview: 100,
  persistence: { status: 'degraded', message: 'Dati persistenti non ancora caricati.' },
};

const money = (value: number) => new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
}).format(value);

const number = (value: number | null, suffix = '') =>
  value === null ? '—' : `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

function StrategyCard({
  title,
  subtitle,
  status,
  tone,
  metrics,
  description,
}: {
  title: string;
  subtitle: string;
  status: string;
  tone: 'positive' | 'amber';
  metrics: Metrics;
  description: ReactNode;
}) {
  return <section className="rounded-xl border border-border bg-card/70 p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><p className="eyebrow mb-2">{subtitle}</p><h2 className="display text-2xl font-bold text-foreground">{title}</h2></div>
      <Badge tone={tone}>{status}</Badge>
    </div>
    <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{description}</p>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md bg-secondary/45 p-3"><WalletCards size={14} className="mb-2 text-primary" /><p className="eyebrow">Capitale virtuale</p><p className="mono mt-1 text-sm text-foreground">{money(metrics.finalCapital)}</p></div>
      <div className="rounded-md bg-secondary/45 p-3"><TrendingUp size={14} className="mb-2 text-accent" /><p className="eyebrow">Rendimento netto</p><p className="mono mt-1 text-sm text-foreground">{number(metrics.netReturnPct, '%')}</p></div>
      <div className="rounded-md bg-secondary/45 p-3"><Target size={14} className="mb-2 text-primary" /><p className="eyebrow">Trade chiusi</p><p className="mono mt-1 text-sm text-foreground">{metrics.closedTrades}</p></div>
      <div className="rounded-md bg-secondary/45 p-3"><TrendingDown size={14} className="mb-2 text-destructive" /><p className="eyebrow">Max drawdown</p><p className="mono mt-1 text-sm text-foreground">{number(metrics.maxDrawdownPct, '%')}</p></div>
    </div>
  </section>;
}

export function StrategyComparisonPage() {
  const [snapshot, setSnapshot] = useState<Snapshot>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/strategy-comparison', { credentials: 'include' });
      if (!response.ok) throw new Error('Laboratorio strategie non disponibile.');
      setSnapshot(await response.json() as Snapshot);
      setError(undefined);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Errore caricamento confronto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const ai = snapshot.strategies.FIVE_BRAINS_STRATEGY;
  const berto = snapshot.strategies.BERTO_GOLDEN_SETUP;
  const rows: Array<[string, string, string]> = [
    ['Capitale iniziale', money(ai.initialCapital), money(berto.initialCapital)],
    ['Capitale finale', money(ai.finalCapital), money(berto.finalCapital)],
    ['Rendimento netto', number(ai.netReturnPct, '%'), number(berto.netReturnPct, '%')],
    ['Win rate', number(ai.winRatePct, '%'), number(berto.winRatePct, '%')],
    ['Profit factor', number(ai.profitFactor), number(berto.profitFactor)],
    ['Expectancy', number(ai.expectancyR, ' R'), number(berto.expectancyR, ' R')],
    ['Max drawdown', number(ai.maxDrawdownPct, '%'), number(berto.maxDrawdownPct, '%')],
    ['Trade chiusi', String(ai.closedTrades), String(berto.closedTrades)],
    ['Costi + slippage', money(ai.totalCosts), money(berto.totalCosts)],
  ];
  const rules = snapshot.bertoRules;

  return <div className="content-wrap">
    <PageHeader
      eyebrow="STRATEGY COMPARISON LAB / SHADOW"
      title="5 Cervelli vs Berto"
      subtitle="Due strategie autonome, stesso capitale iniziale, stesso feed Axi e stesso periodo. Nessun segnale, veto o risultato passa da un motore all'altro."
      action={<button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Aggiorna</button>}
    />

    {error && <div className="mb-4"><Notice tone="negative"><span>{error}</span></Notice></div>}
    {snapshot.persistence?.status === 'degraded' && <div className="mb-4"><Notice tone="negative"><span><strong>Registro confronto non disponibile.</strong> {snapshot.persistence.message}</span></Notice></div>}
    <Notice tone="teal"><span><strong>Separazione attiva.</strong> Portafogli, P&amp;L, drawdown, ordini virtuali e cronologie sono indipendenti. LIVE è disabilitato per entrambi.</span></Notice>

    <div className="my-5 grid gap-4 lg:grid-cols-2">
      <StrategyCard
        title="5 Cervelli"
        subtitle="STRATEGIA A · LOGICA AI"
        status="SHADOW"
        tone="positive"
        metrics={ai}
        description="Motore tecnico, macro, fondamentale, statistico e Risk Brain con parametri propri. Non usa livelli o conferme Berto."
      />
      <StrategyCard
        title="Berto Golden Setup"
        subtitle="STRATEGIA B · REGOLE FISSE"
        status="REGOLE CARICATE"
        tone="amber"
        metrics={berto}
        description="Segnale QQQ e livelli US500 deterministici. Non riceve punteggi, pesi, conferme o veto dai cinque cervelli."
      />
    </div>

    <section className="mb-5 panel p-5 md:p-6">
      <SectionLabel aside={<Badge tone="neutral"><FlaskConical size={11} /> STESSA BASE</Badge>}>Confronto affiancato</SectionLabel>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="bg-secondary/45 text-muted-foreground"><tr><th className="px-4 py-3">Metrica</th><th className="px-4 py-3">5 Cervelli</th><th className="px-4 py-3">Berto</th></tr></thead>
          <tbody>{rows.map(([metric, left, right]) => <tr key={metric} className="border-t border-border"><td className="px-4 py-3 font-semibold text-foreground">{metric}</td><td className="px-4 py-3 mono">{left}</td><td className="px-4 py-3 mono">{right}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Nessun vincitore viene indicato prima di almeno {snapshot.minimumClosedTradesForReview} trade chiusi per strategia e di una verifica fuori campione.</p>
    </section>

    <section className="mb-5 panel p-5 md:p-6">
      <SectionLabel aside={<Badge tone="amber">V1.0 · BLOCCATA</Badge>}>Regole Berto implementate</SectionLabel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Rule icon={<TrendingUp size={15} />} title="Filtro QQQ" text="Opera solo se la candela regolare precedente è verde. Suffissi dai centesimi di Low e High." />
        <Rule icon={<ArrowRightLeft size={15} />} title="Anti-clustering" text={`Distanza circolare < ${rules.suffixClusterDistance}: conserva soltanto il suffisso numericamente più basso.`} />
        <Rule icon={<Target size={15} />} title="Livelli US500" text={`Solo livelli sotto l'open, griglia 100 pt, distanza minima ${rules.minimumDistancePoints} pt. Solo LONG.`} />
        <Rule icon={<Clock3 size={15} />} title="Sessione New York" text={`${rules.sessionOpen}–09:59: tocchi invalidati. Entry da ${rules.entryWindowStart}. Chiusura ${rules.forcedExit}.`} />
        <Rule icon={<ShieldCheck size={15} />} title="Primo tocco" text="Un livello può entrare una sola volta. Se toccato prima della finestra operativa resta escluso per tutta la giornata." />
        <Rule icon={<TrendingDown size={15} />} title="Stop loss" text={`Entry − ${rules.stopLossPoints} punti, inclusivo del punto previsto per spread/slippage.`} />
        <Rule icon={<TrendingUp size={15} />} title="Take profit" text={`Entry + ${rules.takeProfitPoints} punti. Nessun trailing o modifica da parte dell'AI.`} />
        <Rule icon={<WalletCards size={15} />} title="Due letture rischio" text={`Originale Berto ${rules.originalRiskPerTradePct}%; confronto normalizzato ${rules.normalizedComparisonRiskPct}% per isolare la qualità dei segnali.`} />
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2"><Bot size={17} className="text-primary" /><h3 className="display text-lg font-bold">Isolamento decisionale</h3></div>
        <Check text="I cinque cervelli non vedono livelli, trade o risultati Berto." />
        <Check text="Berto non usa punteggi, confidenza, pesi o Risk Brain AI." />
        <Check text="I portafogli virtuali partono dallo stesso capitale." />
        <Check text="Ogni operazione conserva strategyId, costi e slippage propri." />
      </div>
      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-accent" /><h3 className="display text-lg font-bold">Barriere operative</h3></div>
        <Check text="Modalità SHADOW e executionEnabled=false hardcoded." />
        <Check text="Nessuna posizione overnight: uscita temporale obbligatoria." />
        <Check text="Il confronto osserva i risultati ma non seleziona automaticamente il LIVE." />
        <Check text="Dati insufficienti restano indicati come tali, senza valori inventati." />
      </div>
    </section>
  </div>;
}

function Rule({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-lg border border-border bg-background/35 p-4"><div className="mb-2 flex items-center gap-2 text-primary">{icon}<strong className="text-xs text-foreground">{title}</strong></div><p className="text-[11px] leading-relaxed text-muted-foreground">{text}</p></div>;
}

function Check({ text }: { text: string }) {
  return <div className="mb-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent" /><span>{text}</span></div>;
}
