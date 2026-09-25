import { pgTable, serial, text, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Canonical instrument registry. The AI and historical store use canonical
 * symbols; broker-specific symbols are resolved only at the provider boundary.
 */
export const instrumentUniverseTable = pgTable("instrument_universe", {
  id: serial("id").primaryKey(),
  canonicalSymbol: text("canonical_symbol").notNull(),
  family: text("family").notNull(),
  subfamily: text("subfamily").notNull(),
  displayName: text("display_name").notNull(),
  currency: text("currency"),
  tradable: boolean("tradable").notNull().default(false),
  comparisonInput: boolean("comparison_input").notNull().default(true),
  historicalPriority: text("historical_priority").notNull().default("core"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  canonicalSymbolUq: uniqueIndex("instrument_universe_canonical_uq").on(table.canonicalSymbol),
  familyIdx: index("instrument_universe_family_idx").on(table.family, table.subfamily),
}));

/**
 * Provider mapping is deliberately separate because Axi/MT5 symbol names can
 * differ by account/server. Discovery must populate this table from Market
 * Watch / bridge symbol discovery rather than assuming a broker symbol string.
 */
export const providerInstrumentMappingsTable = pgTable("provider_instrument_mappings", {
  id: serial("id").primaryKey(),
  canonicalSymbol: text("canonical_symbol").notNull(),
  provider: text("provider").notNull(),
  venue: text("venue").notNull(),
  providerSymbol: text("provider_symbol"),
  discoveryStatus: text("discovery_status").notNull().default("pending"),
  brokerTradable: boolean("broker_tradable").notNull().default(false),
  allocationEligible: boolean("allocation_eligible").notNull().default(false),
  historyAvailable: boolean("history_available").notNull().default(false),
  firstHistoryAt: timestamp("first_history_at", { withTimezone: true }),
  lastHistoryAt: timestamp("last_history_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  lastDiscoveredAt: timestamp("last_discovered_at", { withTimezone: true }),
}, (table) => ({
  canonicalProviderUq: uniqueIndex("provider_instrument_mapping_uq").on(table.canonicalSymbol, table.provider, table.venue),
  providerSymbolIdx: index("provider_instrument_symbol_idx").on(table.provider, table.venue, table.providerSymbol),
}));

export const insertInstrumentUniverseSchema = createInsertSchema(instrumentUniverseTable).omit({ id: true, createdAt: true });
export const insertProviderInstrumentMappingSchema = createInsertSchema(providerInstrumentMappingsTable).omit({ id: true });
export type InsertInstrumentUniverse = z.infer<typeof insertInstrumentUniverseSchema>;
export type InsertProviderInstrumentMapping = z.infer<typeof insertProviderInstrumentMappingSchema>;
export type InstrumentUniverse = typeof instrumentUniverseTable.$inferSelect;
export type ProviderInstrumentMapping = typeof providerInstrumentMappingsTable.$inferSelect;
