import { pgTable, serial, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
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
