import { pgTable, serial, text, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradingAccountsTable = pgTable("trading_accounts", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  displayName: text("display_name").notNull(),
  strategy: text("strategy").notNull().default("FIVE_BRAINS"),
  riskProfileId: text("risk_profile_id").notNull().default("default"),
  mode: text("mode").notNull().default("paper"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => ({ ownerAccountUnique: uniqueIndex("trading_accounts_owner_account_uq").on(t.clerkUserId, t.id), ownerIdx: index("trading_accounts_owner_idx").on(t.clerkUserId) }));

export const brokerConnectionsTable = pgTable("broker_connections", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  tradingAccountId: text("trading_account_id").notNull(),
  connectionKey: text("connection_key").notNull(),
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
}, (t) => ({ ownerAccountConnectionUnique: uniqueIndex("broker_connections_owner_account_key_uq").on(t.clerkUserId, t.tradingAccountId, t.connectionKey), ownerAccountIdx: index("broker_connections_owner_account_idx").on(t.clerkUserId, t.tradingAccountId) }));

export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  tradingAccountId: text("trading_account_id"),
  eventType: text("event_type").notNull(), actor: text("actor").notNull().default("system"), mode: text("mode").notNull().default("paper"), previousValue: jsonb("previous_value"), nextValue: jsonb("next_value"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ ownerAccountIdx: index("audit_events_owner_account_idx").on(t.clerkUserId, t.tradingAccountId) }));

export const brokerDataStatusTable = pgTable("broker_data_status", {
  scopeKey: text("scope_key").primaryKey(), clerkUserId: text("clerk_user_id"), tradingAccountId: text("trading_account_id"), mode: text("mode").notNull(),
  quotesStatus: text("quotes_status").notNull().default("unknown"), quotesLastCheckedAt: timestamp("quotes_last_checked_at", { withTimezone: true }), accountStatus: text("account_status").notNull().default("unknown"), accountLastCheckedAt: timestamp("account_last_checked_at", { withTimezone: true }), positionsStatus: text("positions_status").notNull().default("unknown"), positionsLastCheckedAt: timestamp("positions_last_checked_at", { withTimezone: true }), historyStatus: text("history_status").notNull().default("unknown"), historyLastCheckedAt: timestamp("history_last_checked_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const paperProposalsTable = pgTable("paper_proposals", {
  id: serial("id").primaryKey(), clerkUserId: text("clerk_user_id").notNull(), tradingAccountId: text("trading_account_id").notNull(), strategy: text("strategy").notNull(), clientProposalId: text("client_proposal_id").notNull(), symbol: text("symbol").notNull(), side: text("side").notNull(), notional: text("notional").notNull(), riskDecision: text("risk_decision").notNull(), status: text("status").notNull().default("draft"), explanation: text("explanation").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ ownerProposalUnique: uniqueIndex("paper_proposals_owner_proposal_uq").on(t.clerkUserId, t.tradingAccountId, t.clientProposalId), ownerAccountIdx: index("paper_proposals_owner_account_idx").on(t.clerkUserId, t.tradingAccountId) }));

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({ id: true, createdAt: true });
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
