import { sql } from "drizzle-orm";
import { pgTable, serial, text, numeric, timestamp, jsonb, boolean, integer, primaryKey, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketSnapshotsTable = pgTable("market_snapshots", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  assetClass: text("asset_class").notNull(),
  price: numeric("price", { precision: 18, scale: 6 }).notNull(),
  change: numeric("change", { precision: 18, scale: 6 }).notNull(),
  changePercent: numeric("change_percent", { precision: 8, scale: 4 }).notNull(),
  sparkline: jsonb("sparkline").$type<number[]>().notNull(),
  status: text("status").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paperAnalysesTable = pgTable("paper_analyses", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  decision: text("decision").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  riskLevel: text("risk_level").notNull(),
  explanation: text("explanation").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const decisionMemoryTable = pgTable("decision_memory", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  symbol: text("symbol").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  regime: text("regime").notNull(),
  decision: text("decision").notNull(),
  finalScore: numeric("final_score", { precision: 6, scale: 2 }),
  confidence: numeric("confidence", { precision: 6, scale: 2 }).notNull(),
  sizeMultiplier: numeric("size_multiplier", { precision: 6, scale: 3 }).notNull(),
  rationale: text("rationale").notNull(),
  brainSnapshot: jsonb("brain_snapshot").$type<Record<string, unknown>>().notNull(),
  marketSnapshot: jsonb("market_snapshot").$type<Record<string, unknown>>().notNull(),
  outcomeR: numeric("outcome_r", { precision: 10, scale: 4 }),
  maxAdverseExcursionR: numeric("max_adverse_excursion_r", { precision: 10, scale: 4 }),
  maxFavourableExcursionR: numeric("max_favourable_excursion_r", { precision: 10, scale: 4 }),
  exitReason: text("exit_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshotsTable);
export const insertPaperAnalysisSchema = createInsertSchema(paperAnalysesTable);
export const insertDecisionMemorySchema = createInsertSchema(decisionMemoryTable).omit({ id: true, createdAt: true });
export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;
export type InsertPaperAnalysis = z.infer<typeof insertPaperAnalysisSchema>;
export type InsertDecisionMemory = z.infer<typeof insertDecisionMemorySchema>;
export type MarketSnapshot = typeof marketSnapshotsTable.$inferSelect;
export type PaperAnalysis = typeof paperAnalysesTable.$inferSelect;
export type DecisionMemory = typeof decisionMemoryTable.$inferSelect;

/**
 * Per-user controls are deliberately separate from strategy modes.  A user
 * can turn a strategy off or on without changing the account-wide risk
 * budget.  Consumers must apply this same row to every strategy and mode.
 */
export const userRiskControlsTable = pgTable("user_risk_controls", {
  userId: text("user_id").notNull(),
  maxRiskPerTradePct: numeric("max_risk_per_trade_pct", { precision: 6, scale: 3 }).notNull().default("0.50"),
  maxDailyLossPct: numeric("max_daily_loss_pct", { precision: 6, scale: 3 }).notNull().default("2.00"),
  maxOpenExposurePct: numeric("max_open_exposure_pct", { precision: 6, scale: 3 }).notNull().default("5.00"),
  maxConcurrentPositions: integer("max_concurrent_positions").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId] }),
  check("user_risk_controls_positive", sql`max_risk_per_trade_pct > 0 AND max_daily_loss_pct > 0 AND max_open_exposure_pct > 0 AND max_concurrent_positions > 0`),
]);

export const strategyModesTable = pgTable("strategy_modes", {
  userId: text("user_id").notNull(),
  strategy: text("strategy").notNull(),
  mode: text("mode").notNull().default("DEMO"),
  experimentPassed: boolean("experiment_passed").notNull().default(false),
  completedSamples: integer("completed_samples").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.strategy] }),
  check("strategy_modes_strategy_valid", sql`strategy IN ('SCALP', 'INTRADAY', 'SWING')`),
  check("strategy_modes_mode_valid", sql`mode IN ('OFF', 'DEMO', 'LIVE')`),
]);

/**
 * This is a user-level lock, not a strategy-level lock.  The composite key
 * prevents SCALP, INTRADAY, and SWING from claiming the same normalized
 * instrument, including under concurrent requests.
 */
export const instrumentLocksTable = pgTable("instrument_locks", {
  userId: text("user_id").notNull(),
  canonicalSymbol: text("canonical_symbol").notNull(),
  ownerStrategy: text("owner_strategy").notNull(),
  runMode: text("run_mode").notNull(),
  direction: text("direction").notNull(),
  externalPositionId: text("external_position_id"),
  status: text("status").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastBrokerConfirmationAt: timestamp("last_broker_confirmation_at", { withTimezone: true }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.canonicalSymbol] }),
  check("instrument_locks_strategy_valid", sql`owner_strategy IN ('SCALP', 'INTRADAY', 'SWING')`),
  check("instrument_locks_mode_valid", sql`run_mode IN ('DEMO', 'LIVE')`),
  check("instrument_locks_direction_valid", sql`direction IN ('BUY', 'SELL')`),
  check("instrument_locks_status_valid", sql`status IN ('PENDING', 'OPEN', 'CLOSING')`),
]);

export const insertUserRiskControlsSchema = createInsertSchema(userRiskControlsTable).omit({ updatedAt: true });
export const insertStrategyModeSchema = createInsertSchema(strategyModesTable).omit({ updatedAt: true });
export const insertInstrumentLockSchema = createInsertSchema(instrumentLocksTable).omit({ acquiredAt: true, lastBrokerConfirmationAt: true });
export type InsertUserRiskControls = z.infer<typeof insertUserRiskControlsSchema>;
export type InsertStrategyMode = z.infer<typeof insertStrategyModeSchema>;
export type InsertInstrumentLock = z.infer<typeof insertInstrumentLockSchema>;


/**
 * Immutable PAPER outcomes for the Strategy Comparison Lab.  The composite
 * primary key and mandatory strategy id prevent results from the two engines
 * being merged or counted twice.
 */
export const strategyComparisonTradesTable = pgTable("strategy_comparison_trades", {
  userId: text("user_id").notNull(),
  experimentId: text("experiment_id").notNull().default("five-vs-berto-v1"),
  strategy: text("strategy").notNull(),
  externalTradeId: text("external_trade_id").notNull(),
  symbol: text("symbol").notNull(),
  initialCapital: numeric("initial_capital", { precision: 18, scale: 2 }).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
  netPnl: numeric("net_pnl", { precision: 18, scale: 4 }).notNull(),
  riskAmount: numeric("risk_amount", { precision: 18, scale: 4 }).notNull(),
  fees: numeric("fees", { precision: 18, scale: 4 }).notNull().default("0"),
  slippage: numeric("slippage", { precision: 18, scale: 4 }).notNull().default("0"),
  exitReason: text("exit_reason").notNull(),
  sourceSnapshot: jsonb("source_snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({
    columns: [
      table.userId,
      table.experimentId,
      table.strategy,
      table.externalTradeId,
    ],
  }),
  check(
    "strategy_comparison_trades_strategy_valid",
    sql`strategy IN ('FIVE_BRAINS_STRATEGY', 'BERTO_GOLDEN_SETUP')`,
  ),
  check(
    "strategy_comparison_trades_values_valid",
    sql`initial_capital > 0 AND risk_amount >= 0 AND fees >= 0 AND slippage >= 0 AND closed_at >= opened_at`,
  ),
]);

export const insertStrategyComparisonTradeSchema =
  createInsertSchema(strategyComparisonTradesTable).omit({ createdAt: true });
export type InsertStrategyComparisonTrade =
  z.infer<typeof insertStrategyComparisonTradeSchema>;
export type StrategyComparisonTrade =
  typeof strategyComparisonTradesTable.$inferSelect;
