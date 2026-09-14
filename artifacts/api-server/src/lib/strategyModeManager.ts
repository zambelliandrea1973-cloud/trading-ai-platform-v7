import { and, eq } from "drizzle-orm";
import { db, instrumentLocksTable, strategyModesTable } from "@workspace/db";

export type StrategyKind = "SCALP" | "INTRADAY" | "SWING";
export type StrategyRunMode = "OFF" | "DEMO" | "LIVE";
export type TradeDirection = "BUY" | "SELL";
export type LockStatus = "PENDING" | "OPEN" | "CLOSING";

export const STRATEGIES: StrategyKind[] = ["SCALP", "INTRADAY", "SWING"];

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
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  cooldownMinutes: number;
  liveEligible: boolean;
  liveBlockers: string[];
};

const defaults: Record<StrategyKind, Omit<StrategyProfile, "mode" | "experimentPassed" | "completedSamples" | "liveEligible" | "liveBlockers">> = {
  SCALP: { strategy: "SCALP", minSamples: 200, maxHoldingMinutes: 15, allowedTimeframes: ["M1", "M5"], maxSpreadMultiple: 1.35, maxSlippageR: 0.08, maxRiskPerTradePct: 0.20, maxDailyLossPct: 1.0, cooldownMinutes: 3 },
  INTRADAY: { strategy: "INTRADAY", minSamples: 100, maxHoldingMinutes: 720, allowedTimeframes: ["M5", "M15", "M30", "H1"], maxSpreadMultiple: 1.8, maxSlippageR: 0.18, maxRiskPerTradePct: 0.35, maxDailyLossPct: 1.5, cooldownMinutes: 10 },
  SWING: { strategy: "SWING", minSamples: 60, maxHoldingMinutes: 10080, allowedTimeframes: ["H1", "H4", "D1"], maxSpreadMultiple: 2.5, maxSlippageR: 0.25, maxRiskPerTradePct: 0.50, maxDailyLossPct: 2.0, cooldownMinutes: 60 },
};

export function normalizeSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase().replace("/", "").replace(/\.[A-Z0-9_-]+$/, "");
  if (!/^[A-Z0-9_-]{2,24}$/.test(normalized)) throw new Error("Simbolo non valido.");
  return normalized;
}

export function liveBlockers(input: { experimentPassed: boolean; completedSamples: number; minSamples: number; brokerConnected: boolean; brokerExecutionEnabled: boolean; persistenceHealthy: boolean; environmentEnabled: boolean }) {
  const blockers: string[] = [];
  if (!input.experimentPassed) blockers.push("Sperimentazione non approvata.");
  if (input.completedSamples < input.minSamples) blockers.push(`Campione insufficiente: ${input.completedSamples}/${input.minSamples}.`);
  if (!input.brokerConnected) blockers.push("Bridge MT5 non connesso.");
  if (!input.brokerExecutionEnabled) blockers.push("Esecuzione broker non abilitata.");
  if (!input.persistenceHealthy) blockers.push("Persistenza/audit non sana.");
  if (!input.environmentEnabled) blockers.push("LIVE_EXECUTION_ENABLED non attivo.");
  return blockers;
}

export function evaluateEngagement(profile: StrategyProfile, input: { timeframe: string; spreadMultiple: number; slippageR: number; expectedEdgeR: number; minutesToHighImpactEvent?: number | null }) {
  const reasons: string[] = [];
  if (profile.mode === "OFF") reasons.push("Strategia disattivata.");
  if (!profile.allowedTimeframes.includes(input.timeframe.toUpperCase())) reasons.push("Timeframe non ammesso.");
  if (input.spreadMultiple > profile.maxSpreadMultiple) reasons.push("Spread oltre limite.");
  if (input.slippageR > profile.maxSlippageR) reasons.push("Slippage oltre limite.");
  if (input.expectedEdgeR <= input.slippageR) reasons.push("Vantaggio atteso non superiore ai costi.");
  if (profile.strategy === "SCALP" && input.minutesToHighImpactEvent != null && input.minutesToHighImpactEvent <= 10) reasons.push("Evento macro imminente: scalp sospeso.");
  return { allowed: reasons.length === 0, reasons };
}

export class StrategyModeManager {
  async list(userId: string, broker: { connected: boolean; executionEnabled: boolean; persistenceHealthy: boolean }): Promise<StrategyProfile[]> {
    const rows = await db.select().from(strategyModesTable).where(eq(strategyModesTable.userId, userId));
    const byStrategy = new Map(rows.map((row) => [row.strategy, row]));
    return STRATEGIES.map((strategy) => {
      const base = defaults[strategy];
      const row = byStrategy.get(strategy);
      const mode = (row?.mode ?? "DEMO") as StrategyRunMode;
      const experimentPassed = row?.experimentPassed ?? false;
      const completedSamples = row?.completedSamples ?? 0;
      const blockers = liveBlockers({ experimentPassed, completedSamples, minSamples: base.minSamples, brokerConnected: broker.connected, brokerExecutionEnabled: broker.executionEnabled, persistenceHealthy: broker.persistenceHealthy, environmentEnabled: process.env.LIVE_EXECUTION_ENABLED === "true" });
      return { ...base, mode, experimentPassed, completedSamples, liveEligible: blockers.length === 0, liveBlockers: blockers };
    });
  }

  async setMode(userId: string, strategy: StrategyKind, requestedMode: StrategyRunMode, broker: { connected: boolean; executionEnabled: boolean; persistenceHealthy: boolean }) {
    if (!STRATEGIES.includes(strategy)) throw new Error("Strategia non valida.");
    const profiles = await this.list(userId, broker);
    const profile = profiles.find((item) => item.strategy === strategy)!;
    if (requestedMode === "LIVE" && !profile.liveEligible) return { updated: false, profile, error: "LIVE non autorizzato.", blockers: profile.liveBlockers };
    const [row] = await db.insert(strategyModesTable).values({ userId, strategy, mode: requestedMode, experimentPassed: profile.experimentPassed, completedSamples: profile.completedSamples, updatedAt: new Date() }).onConflictDoUpdate({ target: [strategyModesTable.userId, strategyModesTable.strategy], set: { mode: requestedMode, updatedAt: new Date() } }).returning();
    return { updated: true, row };
  }

  async acquireLock(userId: string, input: { symbol: string; strategy: StrategyKind; runMode: Exclude<StrategyRunMode, "OFF">; direction: TradeDirection; externalPositionId?: string; ttlMinutes: number }) {
    const canonicalSymbol = normalizeSymbol(input.symbol);
    const expiresAt = new Date(Date.now() + Math.max(1, input.ttlMinutes) * 60_000);
    const [created] = await db.insert(instrumentLocksTable).values({ userId, canonicalSymbol, ownerStrategy: input.strategy, runMode: input.runMode, direction: input.direction, externalPositionId: input.externalPositionId ?? null, status: input.externalPositionId ? "OPEN" : "PENDING", expiresAt, acquiredAt: new Date(), lastBrokerConfirmationAt: input.externalPositionId ? new Date() : null }).onConflictDoNothing().returning();
    if (created) return { acquired: true, lock: created };
    const [existing] = await db.select().from(instrumentLocksTable).where(and(eq(instrumentLocksTable.userId, userId), eq(instrumentLocksTable.canonicalSymbol, canonicalSymbol))).limit(1);
    return { acquired: false, lock: existing, reason: existing ? `${canonicalSymbol} è già assegnato a ${existing.ownerStrategy}.` : "Lock concorrente non acquisito." };
  }

  async releaseLock(userId: string, symbol: string, strategy: StrategyKind, brokerConfirmsClosed: boolean) {
    if (!brokerConfirmsClosed) return { released: false, reason: "La chiusura deve essere confermata dal broker." };
    const canonicalSymbol = normalizeSymbol(symbol);
    const deleted = await db.delete(instrumentLocksTable).where(and(eq(instrumentLocksTable.userId, userId), eq(instrumentLocksTable.canonicalSymbol, canonicalSymbol), eq(instrumentLocksTable.ownerStrategy, strategy))).returning();
    return { released: deleted.length > 0 };
  }

  async listLocks(userId: string) {
    return db.select().from(instrumentLocksTable).where(eq(instrumentLocksTable.userId, userId));
  }
}

export const strategyModeManager = new StrategyModeManager();
