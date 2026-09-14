import { ArrowRightLeft, Bot, CheckCircle2, FlaskConical, Settings2, ShieldCheck } from 'lucide-react';
import { Badge, PageHeader, SectionLabel } from '@/components/common';

const metrics = [
  ['Rendimento netto', '—', '—'],
  ['Win rate', '—', '—'],
  ['Profit factor', '—', '—'],
  ['Expectancy / trade', '—', '—'],
  ['Max drawdown', '—', '—'],
  ['Trade chiusi', '0', '0'],
];

function StrategyCard({ title, subtitle, status, tone, children }: { title: string; subtitle: string; status: string; tone: 'positive' | 'amber'; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card/70 p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><p className="eyebrow mb-2">{subtitle}</p><h2 className="display text-2xl font-bold text-foreground">{title}</h2></div>
      <Badge tone={tone}>{status}</Badge>
    </div>
    {children}
  </div>;
}

export function StrategyComparisonPage() {
  return <div className="content-wrap">
    <PageHeader
      eyebrow="LABORATORIO STRATEGIE / PAPER"
      title="AI vs Berto"
      subtitle="Due motori indipendenti ricevono lo stesso mercato e gestiscono due portafogli demo separati. I risultati verranno confrontati senza contaminare le rispettive regole."
    />

    <div className="mb-5 grid gap-4 lg:grid-cols-2">
      <StrategyCard title="Motore AI" subtitle="STRATEGIA A" status="PRONTA" tone="positive">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Continua a usare la logica decisionale AI già presente nel sistema, con il proprio controllo del rischio e la propria cronologia PAPER.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Capitale demo</p><p className="mono mt-1 text-foreground">SEPARATO</p></div>
            <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Feed mercato</p><p className="mono mt-1 text-accent">CONDIVISO</p></div>
          </div>
        </div>
      </StrategyCard>

      <StrategyCard title="Berto" subtitle="STRATEGIA B" status="IN ATTESA REGOLE" tone="amber">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>La scatola è pronta per inglobare fedelmente la strategia del broker: ingressi, uscite, timeframe, filtri, stop, target e sizing.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Motore</p><p className="mono mt-1 text-primary">PREDISPOSTO</p></div>
            <div className="rounded-md bg-secondary/45 p-3"><p className="eyebrow">Esecuzione</p><p className="mono mt-1 text-foreground">DISABILITATA</p></div>
          </div>
        </div>
      </StrategyCard>
    </div>

    <section className="mb-5 panel p-5 md:p-6">
      <SectionLabel aside={<Badge tone="neutral"><FlaskConical size={11} /> A/B TEST</Badge>}>Comparazione risultati</SectionLabel>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="bg-secondary/45 text-muted-foreground"><tr><th className="px-4 py-3">Metrica</th><th className="px-4 py-3">Motore AI</th><th className="px-4 py-3">Berto</th><th className="px-4 py-3">Vantaggio</th></tr></thead>
          <tbody>{metrics.map(([metric, ai, berto]) => <tr key={metric} className="border-t border-border"><td className="px-4 py-3 font-semibold text-foreground">{metric}</td><td className="px-4 py-3 mono">{ai}</td><td className="px-4 py-3 mono">{berto}</td><td className="px-4 py-3 text-muted-foreground">Dati insufficienti</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">I valori restano vuoti finché Berto non riceve le regole e non iniziano trade PAPER reali. Nessun risultato demo viene inventato.</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2"><Settings2 size={17} className="text-primary" /><h3 className="display text-lg font-bold">Scatola regole Berto</h3></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {['Universo strumenti', 'Timeframe', 'Regole BUY/SELL', 'Filtri di conferma', 'Stop loss / take profit', 'Sizing e rischio', 'Regole di uscita', 'Orari / sessioni'].map((item) => <div key={item} className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs"><CheckCircle2 size={14} className="text-accent" /><span>{item}</span></div>)}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2"><ArrowRightLeft size={17} className="text-accent" /><h3 className="display text-lg font-bold">Regole del confronto</h3></div>
        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">Stesso feed:</strong> entrambi ricevono prezzo, timestamp e contesto nello stesso momento.</p>
          <p><strong className="text-foreground">Portafogli separati:</strong> saldo, posizioni, P&amp;L e drawdown non si mescolano.</p>
          <p><strong className="text-foreground">Costi coerenti:</strong> spread, commissioni e slippage devono essere applicati nello stesso modo.</p>
          <p><strong className="text-foreground">Solo PAPER:</strong> nessun ordine live viene abilitato da questa funzione.</p>
        </div>
      </div>
    </section>

    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-xs text-muted-foreground">
      <ShieldCheck size={15} className="text-accent" /><span>Struttura predisposta. Prossimo input necessario: le regole operative complete della strategia Berto.</span><Bot size={15} className="ml-auto text-primary" />
    </div>
  </div>;
}
