import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brokerConnectionsTable = pgTable("broker_connections", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("axi"),
  venue: text("venue").notNull().default("mt5"),
  mode: text("mode").notNull().default("paper"),
  status: text("status").notNull().default("disconnected"),
  executionEnabled: boolean("execution_enabled").notNull().default(false),
  externalAccountId: text("external_account_id"),
  bridgeVersion: text("bridge_version"),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull().default("system"),
  mode: text("mode").notNull().default("paper"),
  previousValue: jsonb("previous_value"),
  nextValue: jsonb("next_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;

export const paperProposalsTable = pgTable("paper_proposals", {
  id: serial("id").primaryKey(),
  clientProposalId: text("client_proposal_id").notNull().unique(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  notional: text("notional").notNull(),
  riskDecision: text("risk_decision").notNull(),
  status: text("status").notNull().default("draft"),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});