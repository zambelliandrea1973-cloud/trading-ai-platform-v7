import { desc, eq } from "drizzle-orm";
import { auditEventsTable, db } from "@workspace/db";
import type { BrokerAuditEvent } from "./contract";
import { logger } from "../logger";

const MAX_PERSISTED_EVENTS = 25;

export type AuditPersistenceStatus = "healthy" | "degraded" | "unknown";

export interface AuditPersistenceState {
  status: AuditPersistenceStatus;
  message: string;
}

/**
 * PostgreSQL-backed bridge audit history.
 *
 * Writes intentionally fail soft: bridge health must remain observable when
 * PostgreSQL is unavailable, while the returned state makes the loss of
 * persistence explicit. Every subsequent write retries so recovery does not
 * require a process restart.
 */
export class BridgeAuditStore {
  private state: AuditPersistenceState = {
    status: "unknown",
    message: "Bridge audit persistence has not been checked yet.",
  };

  async list(): Promise<BrokerAuditEvent[]> {
    try {
      const rows = await db
        .select({
          event: auditEventsTable.eventType,
          actor: auditEventsTable.actor,
          detail: auditEventsTable.nextValue,
          at: auditEventsTable.createdAt,
        })
        .from(auditEventsTable)
        .where(eq(auditEventsTable.mode, "paper"))
        .orderBy(desc(auditEventsTable.createdAt))
        .limit(MAX_PERSISTED_EVENTS);

      this.markHealthy();
      return rows
        .reverse()
        .map((row) => ({
          event: row.event,
          actor: row.actor === "bridge" ? "bridge" : "system",
          at: row.at.toISOString(),
          detail: readDetail(row.detail),
        }));
    } catch (error) {
      this.markDegraded(error);
      return [];
    }
  }

  async append(event: BrokerAuditEvent): Promise<void> {
    try {
      await db.insert(auditEventsTable).values({
        eventType: event.event,
        actor: event.actor,
        mode: "paper",
        nextValue: event.detail ? { detail: event.detail } : null,
        createdAt: new Date(event.at),
      });
      this.markHealthy();
    } catch (error) {
      this.markDegraded(error);
    }
  }

  getState(): AuditPersistenceState {
    return { ...this.state };
  }

  private markHealthy(): void {
    this.state = {
      status: "healthy",
      message: "Bridge audit events are persisted in PostgreSQL.",
    };
  }

  private markDegraded(error: unknown): void {
    logger.error(
      { err: error },
      "Bridge audit persistence is unavailable; execution remains PAPER-only",
    );
    this.state = {
      status: "degraded",
      message:
        "PostgreSQL audit persistence is unavailable. LIVE execution remains disabled.",
    };
  }
}

function readDetail(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "detail" in value &&
    typeof value.detail === "string"
  ) {
    return value.detail;
  }
  return undefined;
}

export const bridgeAuditStore = new BridgeAuditStore();