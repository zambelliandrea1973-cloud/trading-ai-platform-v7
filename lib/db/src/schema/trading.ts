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

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshotsTable);
export const insertPaperAnalysisSchema = createInsertSchema(paperAnalysesTable);
export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;
export type InsertPaperAnalysis = z.infer<typeof insertPaperAnalysisSchema>;
export type MarketSnapshot = typeof marketSnapshotsTable.$inferSelect;
export type PaperAnalysis = typeof paperAnalysesTable.$inferSelect;