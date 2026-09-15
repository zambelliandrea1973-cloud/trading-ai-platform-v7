import { useEffect, useState } from "react";
import { Activity, Clock3, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge, Notice, PageHeader, SectionLabel } from "@/components/common";

type Mode = "OFF" | "DEMO" | "LIVE";
type Strategy = "SCALP" | "INTRADAY" | "SWING";
type RiskControls = {
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenExposurePct: number;
  maxConcurrentPositions: number;
};
type Profile = {
  strategy: Strategy;
  mode: Mode;
  minSamples: number;
  completedSamples: number;
  maxHoldingMinutes: number;
  allowedTimeframes: string[];
  maxSpreadMultiple: number;
  maxSlippageR: number;
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  riskControls: RiskControls;
  liveEligible: false;
  liveBlockers: string[];
};
type Lock = {
  canonicalSymbol: string;
  ownerStrategy: Strategy;
  runMode: Exclude<Mode, "OFF">;
  direction: string;
  status: string;
  acquiredAt: string;
};

const descriptions: Record<Strategy, string> = {
  SCALP: "Secondi/minuti · M1–M5 · costi, latenza e liquidità determinanti.",
  INTRADAY: "Minuti/ore · chiusura nella giornata · tecnica e calendario macro.",
  SWING: "Ore/giorni · H1–D1 · tecnico, macro, COT, stagionalità e fair value.",
};

const emptyRiskControls: RiskControls = {
  maxRiskPerTradePct: 0,
  maxDailyLossPct: 0,
  maxOpenExposurePct: 0,
  maxConcurrentPositions: 0,
};

export function StrategyControlPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [locks, setLocks] = useState<Lock[]>([]);
  const [riskControls, setRiskControls] = useState<RiskControls>(emptyRiskControls);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/strategy-control", { credentials: "include" });
      if (!response.ok) throw new Error("Controllo strategie non disponibile.");
      const data = await response.json() as {
        profiles?: Profile[];
        locks?: Lock[];
        riskControls?: RiskControls;
      };
      setProfiles(data.profiles ?? []);
      setLocks(data.locks ?? []);
      setRiskControls(data.riskControls ?? data.profiles?.[0]?.riskControls ?? emptyRiskControls);
      setMessage(undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changeMode = async (strategy: Strategy, mode: Mode) => {
    setMessage(undefined);
    try {
      const response = await fetch(`/api/strategy-control/${strategy}/mode`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await response.json() as { error?: string; blockers?: string[] };
      if (!response.ok) setMessage([data.error, ...(data.blockers ?? [])].filter(Boolean).join(" "));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore aggiornamento modalità.");
    } finally {
      await load();
    }
  };

  return <div className="content-wrap">
    <PageHeader
      eyebrow="Controllo / strategie"
      title="Modalità operative"
      subtitle="Scalp, intraday e swing lavorano con regole separate sotto un unico Risk Brain."
      action={<button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground" disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Aggiorna</button>}
    />
    {message && <div className="mb-4"><Notice tone="negative"><span>{message}</span></Notice></div>}
    <Notice tone="teal"><span><strong>Protezione interferenze attiva.</strong> Uno strumento assegnato a una strategia non può essere acquisito dalle altre fino alla chiusura confermata da MT5. Le altre strategie continuano l’analisi shadow.</span></Notice>

    <section className="panel mt-5 p-5">
      <SectionLabel aside={<Badge tone="amber">Account-wide</Badge>}>Controlli rischio condivisi</SectionLabel>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Gli stessi limiti vengono applicati a SCALP, INTRADAY e SWING in OFF e DEMO. Non sono modificabili da questa superficie.</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-md bg-secondary/50 p-3"><span className="block text-muted-foreground">Rischio/trade</span><strong>{riskControls.maxRiskPerTradePct}%</strong></div>
        <div className="rounded-md bg-secondary/50 p-3"><span className="block text-muted-foreground">Perdita giornaliera</span><strong>{riskControls.maxDailyLossPct}%</strong></div>
        <div className="rounded-md bg-secondary/50 p-3"><span className="block text-muted-foreground">Esposizione aperta</span><strong>{riskControls.maxOpenExposurePct}%</strong></div>
        <div className="rounded-md bg-secondary/50 p-3"><span className="block text-muted-foreground">Posizioni max</span><strong>{riskControls.maxConcurrentPositions}</strong></div>
      </div>
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-3">
      {profiles.map((profile) => <section className="panel p-5" key={profile.strategy}>
        <SectionLabel aside={<Badge tone={profile.mode === "DEMO" ? "teal" : "neutral"}>{profile.mode}</Badge>}>{profile.strategy}</SectionLabel>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{descriptions[profile.strategy]}</p>
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-secondary/50 p-3"><Clock3 size={14} className="mb-2 text-primary" /><span className="block text-muted-foreground">Timeframe</span><strong>{profile.allowedTimeframes.join(" · ")}</strong></div>
          <div className="rounded-md bg-secondary/50 p-3"><ShieldCheck size={14} className="mb-2 text-accent" /><span className="block text-muted-foreground">Rischio/trade</span><strong>{profile.maxRiskPerTradePct}%</strong></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["OFF", "DEMO", "LIVE"] as Mode[]).map((mode) => <button key={mode} disabled={mode === "LIVE" || loading} onClick={() => void changeMode(profile.strategy, mode)} className={`rounded-md border px-2 py-2 text-xs font-bold ${profile.mode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"} disabled:cursor-not-allowed disabled:opacity-35`} data-testid={`strategy-${profile.strategy.toLowerCase()}-${mode.toLowerCase()}`}>{mode}</button>)}
        </div>
        <p className="mt-4 mono text-[10px] text-muted-foreground">Test: {profile.completedSamples}/{profile.minSamples} · spread ≤ {profile.maxSpreadMultiple}× · slippage ≤ {profile.maxSlippageR}R</p>
        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3"><p className="text-[10px] font-bold uppercase text-primary">LIVE bloccato</p><ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">{profile.liveBlockers.map((x) => <li key={x}>• {x}</li>)}</ul></div>
      </section>)}
    </div>

    <section className="panel mt-5 p-5">
      <SectionLabel aside={<Badge tone={locks.length ? "amber" : "positive"}><LockKeyhole size={11} />{locks.length} lock</Badge>}>Proprietà degli strumenti</SectionLabel>
      {locks.length ? <div className="divide-y divide-border">{locks.map((lock) => <div className="grid gap-2 py-3 text-xs sm:grid-cols-5" key={lock.canonicalSymbol}><strong>{lock.canonicalSymbol}</strong><span>{lock.ownerStrategy}</span><span>{lock.runMode}</span><span>{lock.direction}</span><span className="text-muted-foreground">{lock.status}</span></div>)}</div> : <div className="flex items-center gap-3 text-sm text-muted-foreground"><Activity size={17} />Nessuno strumento attualmente assegnato.</div>}
    </section>
  </div>;
}