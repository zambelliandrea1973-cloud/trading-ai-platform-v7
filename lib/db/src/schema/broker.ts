import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brokerConnectionsTable = pgTable("broker_connections", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
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
  // System and bridge health events are intentionally shared operational
  // telemetry, rather than user-owned trading activity.
  clerkUserId: text("clerk_user_id"),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull().default("system"),
  mode: text("mode").notNull().default("paper"),
  previousValue: jsonb("previous_value"),
  nextValue: jsonb("next_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Singleton operational snapshot for safe broker read outcomes.
 *
 * This deliberately stores categories and timestamps only. It must never
 * contain bridge responses, endpoint URLs, credentials, or error text.
 */
export const brokerDataStatusTable = pgTable("broker_data_status", {
  mode: text("mode").primaryKey(),
  quotesStatus: text("quotes_status").notNull().default("unknown"),
  quotesLastCheckedAt: timestamp("quotes_last_checked_at", { withTimezone: true }),
  accountStatus: text("account_status").notNull().default("unknown"),
  accountLastCheckedAt: timestamp("account_last_checked_at", { withTimezone: true }),
  positionsStatus: text("positions_status").notNull().default("unknown"),
  positionsLastCheckedAt: timestamp("positions_last_checked_at", {
    withTimezone: true,
  }),
  historyStatus: text("history_status").notNull().default("unknown"),
  historyLastCheckedAt: timestamp("history_last_checked_at", {
    withTimezone: true,
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;

export const paperProposalsTable = pgTable("paper_proposals", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  clientProposalId: text("client_proposal_id").notNull().unique(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  notional: text("notional").notNull(),
  riskDecision: text("risk_decision").notNull(),
  status: text("status").notNull().default("draft"),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});