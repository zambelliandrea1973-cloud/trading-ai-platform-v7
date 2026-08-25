import { pgTable, serial, text, numeric, timestamp, jsonb, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Canonical historical OHLCV bars. Provider payloads must be normalized before insert. */
export const historicalBarsTable = pgTable("historical_bars", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  assetClass: text("asset_class").notNull(),
  timeframe: text("timeframe").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  open: numeric("open", { precision: 20, scale: 8 }).notNull(),
  high: numeric("high", { precision: 20, scale: 8 }).notNull(),
  low: numeric("low", { precision: 20, scale: 8 }).notNull(),
  close: numeric("close", { precision: 20, scale: 8 }).notNull(),
  volume: numeric("volume", { precision: 24, scale: 8 }),
  bid: numeric("bid", { precision: 20, scale: 8 }),
  ask: numeric("ask", { precision: 20, scale: 8 }),
  source: text("source").notNull(),
  sourceTimestamp: timestamp("source_timestamp", { withTimezone: true }),
  adjusted: boolean("adjusted").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => ({
  symbolTfTimeIdx: index("historical_bars_symbol_tf_time_idx").on(table.symbol, table.timeframe, table.openedAt),
}));

/** Macro data with vintage-awareness to prevent look-ahead bias. */
export const macroObservationsTable = pgTable("macro_observations", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id").notNull(),
  observationDate: timestamp("observation_date", { withTimezone: true }).notNull(),
  value: numeric("value", { precision: 24, scale: 10 }),
  vintageDate: timestamp("vintage_date", { withTimezone: true }).notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  source: text("source").notNull().default("FRED/ALFRED"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => ({
  seriesVintageIdx: index("macro_series_vintage_idx").on(table.seriesId, table.vintageDate),
}));

/** Normalized historical events and news catalysts used by Macro Brain. */
export const historicalEventsTable = pgTable("historical_events", {
  id: serial("id").primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  category: text("category").notNull(),
  subtype: text("subtype"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  countries: jsonb("countries").$type<string[]>().notNull().default([]),
  symbols: jsonb("symbols").$type<string[]>().notNull().default([]),
  sectors: jsonb("sectors").$type<string[]>().notNull().default([]),
  directionHint: text("direction_hint"),
  severity: numeric("severity", { precision: 5, scale: 2 }),
  sourceCount: integer("source_count").notNull().default(1),
  verified: boolean("verified").notNull().default(false),
  sourceRefs: jsonb("source_refs").$type<Array<{ source: string; url?: string; publishedAt?: string }>>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => ({
  eventTimeIdx: index("historical_events_time_idx").on(table.occurredAt),
}));

/** Feature snapshot represents exactly what the three brains could know at that timestamp. */
export const historicalFeatureSnapshotsTable = pgTable("historical_feature_snapshots", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  asOf: timestamp("as_of", { withTimezone: true }).notNull(),
  timeframe: text("timeframe").notNull(),
  technicalFeatures: jsonb("technical_features").$type<Record<string, number | string | boolean | null>>().notNull(),
  macroFeatures: jsonb("macro_features").$type<Record<string, number | string | boolean | null>>().notNull(),
  riskFeatures: jsonb("risk_features").$type<Record<string, number | string | boolean | null>>().notNull(),
  regime: text("regime").notNull(),
  dataQualityScore: numeric("data_quality_score", { precision: 5, scale: 2 }).notNull(),
  featureVersion: text("feature_version").notNull(),
}, (table) => ({
  featureSymbolTimeIdx: index("historical_feature_symbol_time_idx").on(table.symbol, table.asOf),
}));

/** Episodic-memory records: compact comparable historical situations and realized outcomes. */
export const historicalEpisodesTable = pgTable("historical_episodes", {
  id: serial("id").primaryKey(),
  featureSnapshotId: integer("feature_snapshot_id").notNull(),
  symbol: text("symbol").notNull(),
  decision: text("decision").notNull(),
  technicalScore: numeric("technical_score", { precision: 5, scale: 2 }).notNull(),
  macroScore: numeric("macro_score", { precision: 5, scale: 2 }).notNull(),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).notNull(),
  evidenceScore: numeric("evidence_score", { precision: 5, scale: 2 }).notNull(),
  outcome1h: numeric("outcome_1h", { precision: 12, scale: 6 }),
  outcome4h: numeric("outcome_4h", { precision: 12, scale: 6 }),
  outcome1d: numeric("outcome_1d", { precision: 12, scale: 6 }),
  outcome5d: numeric("outcome_5d", { precision: 12, scale: 6 }),
  maxFavorableExcursion: numeric("max_favorable_excursion", { precision: 12, scale: 6 }),
  maxAdverseExcursion: numeric("max_adverse_excursion", { precision: 12, scale: 6 }),
  realizedRMultiple: numeric("realized_r_multiple", { precision: 12, scale: 6 }),
  exitReason: text("exit_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  episodeSymbolIdx: index("historical_episodes_symbol_idx").on(table.symbol),
}));

/** Statistical-memory buckets aggregate many comparable episodes, never a single anecdote. */
export const historicalPatternStatsTable = pgTable("historical_pattern_stats", {
  id: serial("id").primaryKey(),
  patternKey: text("pattern_key").notNull().unique(),
  symbolScope: text("symbol_scope").notNull(),
  regime: text("regime").notNull(),
  sampleSize: integer("sample_size").notNull(),
  positiveRate: numeric("positive_rate", { precision: 7, scale: 4 }),
  medianReturn: numeric("median_return", { precision: 12, scale: 6 }),
  meanRMultiple: numeric("mean_r_multiple", { precision: 12, scale: 6 }),
  profitFactor: numeric("profit_factor", { precision: 12, scale: 6 }),
  maxObservedDrawdown: numeric("max_observed_drawdown", { precision: 12, scale: 6 }),
  confidenceGrade: text("confidence_grade").notNull(),
  featureDefinition: jsonb("feature_definition").$type<Record<string, unknown>>().notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const historicalCoverageTable = pgTable("historical_coverage", {
  id: serial("id").primaryKey(),
  dataset: text("dataset").notNull(),
  symbolOrSeries: text("symbol_or_series").notNull(),
  timeframe: text("timeframe"),
  firstAt: timestamp("first_at", { withTimezone: true }),
  lastAt: timestamp("last_at", { withTimezone: true }),
  rowCount: integer("row_count").notNull().default(0),
  qualityStatus: text("quality_status").notNull().default("insufficient"),
  source: text("source").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertHistoricalBarSchema = createInsertSchema(historicalBarsTable).omit({ id: true });
export const insertMacroObservationSchema = createInsertSchema(macroObservationsTable).omit({ id: true });
export const insertHistoricalEventSchema = createInsertSchema(historicalEventsTable).omit({ id: true });
export const insertHistoricalFeatureSnapshotSchema = createInsertSchema(historicalFeatureSnapshotsTable).omit({ id: true });
export const insertHistoricalEpisodeSchema = createInsertSchema(historicalEpisodesTable).omit({ id: true, createdAt: true });
export const insertHistoricalPatternStatSchema = createInsertSchema(historicalPatternStatsTable).omit({ id: true, computedAt: true });
export const insertHistoricalCoverageSchema = createInsertSchema(historicalCoverageTable).omit({ id: true, updatedAt: true });

export type HistoricalBar = typeof historicalBarsTable.$inferSelect;
export type MacroObservation = typeof macroObservationsTable.$inferSelect;
export type HistoricalEvent = typeof historicalEventsTable.$inferSelect;
export type HistoricalFeatureSnapshot = typeof historicalFeatureSnapshotsTable.$inferSelect;
export type HistoricalEpisode = typeof historicalEpisodesTable.$inferSelect;
export type HistoricalPatternStat = typeof historicalPatternStatsTable.$inferSelect;
export type HistoricalCoverage = typeof historicalCoverageTable.$inferSelect;
export type InsertHistoricalBar = z.infer<typeof insertHistoricalBarSchema>;
