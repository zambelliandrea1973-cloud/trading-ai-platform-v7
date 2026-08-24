import { pgTable, serial, text, numeric, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Immutable decision snapshot used to evaluate the strategy later without
 * rewriting history. WAIT/NO_TRADE decisions are persisted too so selectivity
 * can be measured rather than only counting executed paper trades.
 */
export const paperDecisionEventsTable = pgTable("paper_decision_events", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  symbol: text("symbol").notNull(),
  decision: text("decision").notNull(), // BUY | SELL | WAIT | NO_TRADE
  evidenceConfidence: numeric("evidence_confidence", { precision: 5, scale: 2 }),
  dataQuality: text("data_quality").notNull(), // complete | reduced | insufficient
  riskLevel: text("risk_level").notNull(),
  marketRegime: text("market_regime"),
  referencePrice: numeric("reference_price", { precision: 18, scale: 6 }),
  rationale: jsonb("rationale").$type<string[]>().notNull(),
  invalidationConditions: jsonb("invalidation_conditions").$type<string[]>().notNull(),
  gateFailures: jsonb("gate_failures").$type<string[]>().notNull(),
  evidenceSnapshot: jsonb("evidence_snapshot").$type<Record<string, unknown>>().notNull(),
  strategyVersion: text("strategy_version").notNull(),
  modelVersion: text("model_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * One PAPER position from simulated entry to simulated exit. Monetary fields
 * deliberately preserve gross result, friction and net result separately so
 * performance cannot look better by silently ignoring trading costs.
 */
export const paperTradesTable = pgTable("paper_trades", {
  id: serial("id").primaryKey(),
  decisionEventId: text("decision_event_id").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // long | short
  status: text("status").notNull().default("open"), // open | closed | cancelled
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  stopPrice: numeric("stop_price", { precision: 18, scale: 6 }).notNull(),
  targetPrice: numeric("target_price", { precision: 18, scale: 6 }),
  riskBudgetAmount: numeric("risk_budget_amount", { precision: 18, scale: 2 }).notNull(),
  plannedRewardRisk: numeric("planned_reward_risk", { precision: 10, scale: 4 }),
  expectedHoldingMinutes: numeric("expected_holding_minutes", { precision: 12, scale: 0 }),
  entrySpreadCost: numeric("entry_spread_cost", { precision: 18, scale: 6 }).notNull().default("0"),
  entryCommission: numeric("entry_commission", { precision: 18, scale: 6 }).notNull().default("0"),
  assumedEntrySlippage: numeric("assumed_entry_slippage", { precision: 18, scale: 6 }).notNull().default("0"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 6 }),
  exitReason: text("exit_reason"), // target | stop | invalidation | timeout | manual-paper | strategy-exit
  exitSpreadCost: numeric("exit_spread_cost", { precision: 18, scale: 6 }),
  exitCommission: numeric("exit_commission", { precision: 18, scale: 6 }),
  assumedExitSlippage: numeric("assumed_exit_slippage", { precision: 18, scale: 6 }),
  grossPnl: numeric("gross_pnl", { precision: 18, scale: 6 }),
  totalFrictionCost: numeric("total_friction_cost", { precision: 18, scale: 6 }),
  netPnl: numeric("net_pnl", { precision: 18, scale: 6 }),
  returnPercent: numeric("return_percent", { precision: 10, scale: 4 }),
  realizedRMultiple: numeric("realized_r_multiple", { precision: 10, scale: 4 }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  isSynthetic: boolean("is_synthetic").notNull().default(true),
});

/**
 * Mark-to-market samples make drawdown, adverse excursion and favorable
 * excursion reproducible instead of relying only on entry/exit prices.
 */
export const paperTradeMarksTable = pgTable("paper_trade_marks", {
  id: serial("id").primaryKey(),
  paperTradeId: text("paper_trade_id").notNull(),
  marketPrice: numeric("market_price", { precision: 18, scale: 6 }).notNull(),
  unrealizedPnl: numeric("unrealized_pnl", { precision: 18, scale: 6 }).notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPaperDecisionEventSchema = createInsertSchema(paperDecisionEventsTable).omit({ id: true, createdAt: true });
export const insertPaperTradeSchema = createInsertSchema(paperTradesTable).omit({ id: true });
export const insertPaperTradeMarkSchema = createInsertSchema(paperTradeMarksTable).omit({ id: true, capturedAt: true });

export type InsertPaperDecisionEvent = z.infer<typeof insertPaperDecisionEventSchema>;
export type InsertPaperTrade = z.infer<typeof insertPaperTradeSchema>;
export type InsertPaperTradeMark = z.infer<typeof insertPaperTradeMarkSchema>;
export type PaperDecisionEvent = typeof paperDecisionEventsTable.$inferSelect;
export type PaperTrade = typeof paperTradesTable.$inferSelect;
export type PaperTradeMark = typeof paperTradeMarksTable.$inferSelect;
