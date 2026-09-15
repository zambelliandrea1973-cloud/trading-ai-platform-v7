import { and, eq } from "drizzle-orm";
import {
  db,
  instrumentLocksTable,
  strategyModesTable,
  userRiskControlsTable,
} from "@workspace/db";

export type StrategyKind = "SCALP" | "INTRADAY" | "SWING";
export type StrategyRunMode = "OFF" | "DEMO" | "LIVE";
export type TradeDirection = "BUY" | "SELL";
export type LockStatus = "PENDING" | "OPEN" | "CLOSING";

export const STRATEGIES: StrategyKind[] = ["SCALP", "INTRADAY", "SWING"];
export const RUN_MODES: StrategyRunMode[] = ["OFF", "DEMO", "LIVE"];

/**
 * There is intentionally no environment switch for this value.  LIVE
 * execution requires a future, reviewed code authorization rather than a
 * deploy-time setting that could accidentally enable it.
 */
const LIVE_EXECUTION_AUTHORIZED = false;

export type RiskControls = {
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenExposurePct: number;
  maxConcurrentPositions: number;
};

export type StrategyProfile = {
  strategy: StrategyKind;
  mode: StrategyRunMode;
  experimentPassed: boolean;
  minSamples: number;
  completedSamples: number;
  maxHoldingMinutes: number;
  allowedTimeframes: string[];
  maxSpreadMultiple: number;
  maxSlippageR: number;
  /** These are the account-wide controls, repeated for a simple client contract. */
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  cooldownMinutes: number;
  riskControls: RiskControls;
  liveEligible: false;
  liveBlockers: string[];
};

const DEFAULT_RISK_CONTROLS: RiskControls = {
  maxRiskPerTradePct: 0.5,
  maxDailyLossPct: 2,
  maxOpenExposurePct: 5,
  maxConcurrentPositions: 3,
};

const defaults: Record<StrategyKind, Omit<StrategyProfile, "mode" | "experimentPassed" | "completedSamples" | "maxRiskPerTradePct" | "maxDailyLossPct" | "riskControls" | "liveEligible" | "liveBlockers">> = {
  SCALP: {
    strategy: "SCALP",
    minSamples: 200,
    maxHoldingMinutes: 15,
    allowedTimeframes: ["M1", "M5"],
    maxSpreadMultiple: 1.35,
    maxSlippageR: 0.08,
    cooldownMinutes: 3,
  },
  INTRADAY: {
    strategy: "INTRADAY",
    minSamples: 100,
    maxHoldingMinutes: 720,
    allowedTimeframes: ["M5", "M15", "M30", "H1"],
    maxSpreadMultiple: 1.8,
    maxSlippageR: 0.18,
    cooldownMinutes: 10,
  },
  SWING: {
    strategy: "SWING",
    minSamples: 60,
    maxHoldingMinutes: 10080,
    allowedTimeframes: ["H1", "H4", "D1"],
    maxSpreadMultiple: 2.5,
    maxSlippageR: 0.25,
    cooldownMinutes: 60,
  },
};

export function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(/\//g, "").replace(/\.[A-Z0-9_-]+$/, "");
  if (!/^[A-Z0-9_-]{2,24}$/.test(normalized)) throw new Error("Simbolo non valido.");
  return normalized;
}

export function liveBlockers(input: {
  experimentPassed: boolean;
  completedSamples: number;
  minSamples: number;
  brokerConnected: boolean;
  brokerExecutionEnabled: boolean;
  persistenceHealthy: boolean;
  /** Retained for diagnostics; this can never override the hard authorization gate. */
  environmentEnabled: boolean;
}): string[] {
  const blockers: string[] = [];
  if (!input.experimentPassed) blockers.push("Sperimentazione non approvata.");
  if (input.completedSamples < input.minSamples) {
    blockers.push(`Campione insufficiente: ${input.completedSamples}/${input.minSamples}.`);
  }
  if (!input.brokerConnected) blockers.push("Bridge MT5 non connesso.");
  if (!input.brokerExecutionEnabled) blockers.push("Esecuzione broker non abilitata.");
  if (!input.persistenceHealthy) blockers.push("Persistenza/audit non sana.");
  if (!input.environmentEnabled) blockers.push("LIVE_EXECUTION_ENABLED non attivo.");
  if (!LIVE_EXECUTION_AUTHORIZED) {
    blockers.push("LIVE richiede una futura autorizzazione esplicita; resta tecnicamente disabilitato.");
  }
  return blockers;
}

export function evaluateEngagement(
  profile: StrategyProfile,
  input: {
    timeframe: string;
    spreadMultiple: number;
    slippageR: number;
    expectedEdgeR: number;
    minutesToHighImpactEvent?: number | null;
  },
) {
  const reasons: string[] = [];
  if (profile.mode === "OFF") reasons.push("Strategia disattivata.");
  if (!profile.allowedTimeframes.includes(input.timeframe.toUpperCase())) reasons.push("Timeframe non ammesso.");
  if (input.spreadMultiple > profile.maxSpreadMultiple) reasons.push("Spread oltre limite.");
  if (input.slippageR > profile.maxSlippageR) reasons.push("Slippage oltre limite.");
  if (input.expectedEdgeR <= input.slippageR) reasons.push("Vantaggio atteso non superiore ai costi.");
  if (profile.strategy === "SCALP" && input.minutesToHighImpactEvent != null && input.minutesToHighImpactEvent <= 10) {
    reasons.push("Evento macro imminente: scalp sospeso.");
  }
  return { allowed: reasons.length === 0, reasons };
}

export function evaluateRiskBudget(
  controls: RiskControls,
  input: { riskPerTradePct?: number; dailyLossPct?: number; openExposurePct?: number; openPositionCount?: number },
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.riskPerTradePct != null && input.riskPerTradePct > controls.maxRiskPerTradePct) {
    reasons.push("Rischio per trade oltre il limite account-wide.");
  }
  if (input.dailyLossPct != null && input.dailyLossPct >= controls.maxDailyLossPct) {
    reasons.push("Perdita giornaliera oltre il limite account-wide.");
  }
  if (input.openExposurePct != null && input.openExposurePct > controls.maxOpenExposurePct) {
    reasons.push("Esposizione aperta oltre il limite account-wide.");
  }
  if (input.openPositionCount != null && input.openPositionCount >= controls.maxConcurrentPositions) {
    reasons.push("Numero massimo di posizioni account-wide raggiunto.");
  }
  return { allowed: reasons.length === 0, reasons };
}

function numeric(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function riskControlsFromRow(row?: typeof userRiskControlsTable.$inferSelect): RiskControls {
  if (!row) return { ...DEFAULT_RISK_CONTROLS };
  return {
    maxRiskPerTradePct: numeric(row.maxRiskPerTradePct, DEFAULT_RISK_CONTROLS.maxRiskPerTradePct),
    maxDailyLossPct: numeric(row.maxDailyLossPct, DEFAULT_RISK_CONTROLS.maxDailyLossPct),
    maxOpenExposurePct: numeric(row.maxOpenExposurePct, DEFAULT_RISK_CONTROLS.maxOpenExposurePct),
    maxConcurrentPositions: numeric(row.maxConcurrentPositions, DEFAULT_RISK_CONTROLS.maxConcurrentPositions),
  };
}

export class StrategyModeManager {
  async getRiskControls(userId: string): Promise<RiskControls> {
    const [row] = await db.select().from(userRiskControlsTable).where(eq(userRiskControlsTable.userId, userId)).limit(1);
    return riskControlsFromRow(row);
  }

  async list(
    userId: string,
    broker: { connected: boolean; executionEnabled: boolean; persistenceHealthy: boolean },
  ): Promise<StrategyProfile[]> {
    const [rows, riskRows] = await Promise.all([
      db.select().from(strategyModesTable).where(eq(strategyModesTable.userId, userId)),
      db.select().from(userRiskControlsTable).where(eq(userRiskControlsTable.userId, userId)).limit(1),
    ]);
    const byStrategy = new Map(rows.map((row) => [row.strategy, row]));
    const controls = riskControlsFromRow(riskRows[0]);
    return STRATEGIES.map((strategy) => {
      const base = defaults[strategy];
      const row = byStrategy.get(strategy);
      // Never expose a persisted LIVE value as active. This protects against
      // legacy rows or direct database edits until reviewed authorization exists.
      const persistedMode = row?.mode as StrategyRunMode | undefined;
      const mode: StrategyRunMode = persistedMode === "OFF" || persistedMode === "DEMO" ? persistedMode : "OFF";
      const experimentPassed = row?.experimentPassed ?? false;
      const completedSamples = row?.completedSamples ?? 0;
      const blockers = liveBlockers({
        experimentPassed,
        completedSamples,
        minSamples: base.minSamples,
        brokerConnected: broker.connected,
        brokerExecutionEnabled: broker.executionEnabled,
        persistenceHealthy: broker.persistenceHealthy,
        environmentEnabled: false,
      });
      return {
        ...base,
        mode,
        experimentPassed,
        completedSamples,
        maxRiskPerTradePct: controls.maxRiskPerTradePct,
        maxDailyLossPct: controls.maxDailyLossPct,
        riskControls: controls,
        liveEligible: false,
        liveBlockers: blockers,
      };
    });
  }

  async setMode(
    userId: string,
    strategy: StrategyKind,
    requestedMode: StrategyRunMode,
    broker: { connected: boolean; executionEnabled: boolean; persistenceHealthy: boolean },
  ) {
    if (!STRATEGIES.includes(strategy) || !RUN_MODES.includes(requestedMode)) throw new Error("Strategia o modalità non valida.");
    const profiles = await this.list(userId, broker);
    const profile = profiles.find((item) => item.strategy === strategy)!;
    if (requestedMode === "LIVE") {
      return {
        updated: false as const,
        profile,
        error: "LIVE non autorizzato.",
        blockers: [...profile.liveBlockers],
      };
    }
    const ownedLocks = await db.select({ symbol: instrumentLocksTable.canonicalSymbol })
      .from(instrumentLocksTable)
      .where(and(eq(instrumentLocksTable.userId, userId), eq(instrumentLocksTable.ownerStrategy, strategy)))
      .limit(1);
    if (ownedLocks.length && requestedMode !== profile.mode) {
      return {
        updated: false as const,
        profile,
        error: "Modalità non modificabile durante un'operazione attiva.",
        blockers: ["Chiudere la posizione e attendere la conferma MT5."],
      };
    }
    const [row] = await db.insert(strategyModesTable)
      .values({
        userId,
        strategy,
        mode: requestedMode,
        experimentPassed: profile.experimentPassed,
        completedSamples: profile.completedSamples,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [strategyModesTable.userId, strategyModesTable.strategy],
        set: { mode: requestedMode, updatedAt: new Date() },
      })
      .returning();
    return { updated: true as const, row, profile };
  }

  async acquireLock(
    userId: string,
    input: {
      symbol: string;
      strategy: StrategyKind;
      runMode: Exclude<StrategyRunMode, "OFF">;
      direction: TradeDirection;
      externalPositionId?: string;
      ttlMinutes: number;
      riskPerTradePct?: number;
      dailyLossPct?: number;
      openExposurePct?: number;
      openPositionCount?: number;
    },
  ) {
    if (!STRATEGIES.includes(input.strategy) || !["DEMO", "LIVE"].includes(input.runMode)) {
      return { acquired: false as const, reason: "Input lock non valido." };
    }
    if (input.runMode === "LIVE") {
      return { acquired: false as const, reason: "LIVE non autorizzato: i lock LIVE sono disabilitati." };
    }
    const controls = await this.getRiskControls(userId);
    const currentLocks = await db.select({ symbol: instrumentLocksTable.canonicalSymbol })
      .from(instrumentLocksTable)
      .where(eq(instrumentLocksTable.userId, userId));
    const risk = evaluateRiskBudget(controls, {
      ...input,
      openPositionCount: Math.max(input.openPositionCount ?? 0, currentLocks.length),
    });
    if (!risk.allowed) return { acquired: false as const, reason: risk.reasons.join(" "), riskControls: controls };
    const canonicalSymbol = normalizeSymbol(input.symbol);
    // expiresAt is informational only. It must never be used to release a
    // lock: ownership ends only after broker-confirmed closure.
    const expiresAt = new Date(Date.now() + Math.max(1, input.ttlMinutes) * 60_000);
    const [created] = await db.insert(instrumentLocksTable)
      .values({
        userId,
        canonicalSymbol,
        ownerStrategy: input.strategy,
        runMode: input.runMode,
        direction: input.direction,
        externalPositionId: input.externalPositionId ?? null,
        status: input.externalPositionId ? "OPEN" : "PENDING",
        expiresAt,
        acquiredAt: new Date(),
        lastBrokerConfirmationAt: input.externalPositionId ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return { acquired: true as const, lock: created, riskControls: controls };
    const [existing] = await db.select().from(instrumentLocksTable)
      .where(and(eq(instrumentLocksTable.userId, userId), eq(instrumentLocksTable.canonicalSymbol, canonicalSymbol)))
      .limit(1);
    return {
      acquired: false as const,
      lock: existing,
      reason: existing ? `${canonicalSymbol} è già assegnato a ${existing.ownerStrategy}.` : "Lock concorrente non acquisito.",
    };
  }

  async getLock(userId: string, symbol: string, strategy?: StrategyKind) {
    const canonicalSymbol = normalizeSymbol(symbol);
    const predicates = [eq(instrumentLocksTable.userId, userId), eq(instrumentLocksTable.canonicalSymbol, canonicalSymbol)];
    if (strategy) predicates.push(eq(instrumentLocksTable.ownerStrategy, strategy));
    const [lock] = await db.select().from(instrumentLocksTable).where(and(...predicates)).limit(1);
    return lock;
  }

  async releaseLock(userId: string, symbol: string, strategy: StrategyKind, brokerConfirmsClosed: boolean) {
    if (!brokerConfirmsClosed) return { released: false as const, reason: "La chiusura deve essere confermata dal broker." };
    const canonicalSymbol = normalizeSymbol(symbol);
    const deleted = await db.delete(instrumentLocksTable)
      .where(and(
        eq(instrumentLocksTable.userId, userId),
        eq(instrumentLocksTable.canonicalSymbol, canonicalSymbol),
        eq(instrumentLocksTable.ownerStrategy, strategy),
      ))
      .returning();
    return { released: deleted.length > 0 };
  }

  async listLocks(userId: string) {
    return db.select().from(instrumentLocksTable).where(eq(instrumentLocksTable.userId, userId));
  }
}

export const strategyModeManager = new StrategyModeManager();