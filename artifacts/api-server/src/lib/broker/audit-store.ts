import { desc, eq } from "drizzle-orm";
import { auditEventsTable, brokerDataStatusTable, db } from "@workspace/db";
import type {
  BrokerAuditEvent,
  BrokerDataEndpoint,
  BrokerDataStatus,
  BrokerDataReadStatus,
} from "./contract";
import { logger } from "../logger";

const MAX_PERSISTED_EVENTS = 25;
const DATA_STATUS_MODE = "paper";
const DATA_ENDPOINTS: BrokerDataEndpoint[] = [
  "quotes",
  "account",
  "positions",
  "history",
];
const DATA_READ_STATUSES: BrokerDataReadStatus[] = [
  "available",
  "unavailable",
  "malformed",
  "error",
  "unknown",
];

export type AuditPersistenceStatus = "healthy" | "degraded" | "unknown";

export interface AuditPersistenceState {
  status: AuditPersistenceStatus;
  message: string;
}

export type BrokerDataStatusSnapshot = Record<
  BrokerDataEndpoint,
  BrokerDataStatus
>;

export interface BridgeAuditRepository {
  list(): Promise<BrokerAuditEvent[]>;
  append(event: BrokerAuditEvent): Promise<void>;
  loadDataStatus(): Promise<BrokerDataStatusSnapshot | undefined>;
  saveDataStatus(
    endpoint: BrokerDataEndpoint,
    dataStatus: BrokerDataStatus,
  ): Promise<void>;
}

const postgresAuditRepository: BridgeAuditRepository = {
  async list(): Promise<BrokerAuditEvent[]> {
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

    return rows
      .reverse()
      .map((row) => ({
        event: row.event,
        actor: row.actor === "bridge" ? "bridge" : "system",
        at: row.at.toISOString(),
        detail: readDetail(row.detail),
      }));
  },

  async append(event: BrokerAuditEvent): Promise<void> {
    await db.insert(auditEventsTable).values({
      eventType: event.event,
      actor: event.actor,
      mode: "paper",
      nextValue: event.detail ? { detail: event.detail } : null,
      createdAt: new Date(event.at),
    });
  },

  async loadDataStatus(): Promise<BrokerDataStatusSnapshot | undefined> {
    const rows = await db
      .select()
      .from(brokerDataStatusTable)
      .where(eq(brokerDataStatusTable.mode, DATA_STATUS_MODE))
      .limit(1);

    return rows[0] ? parseDataStatusSnapshot(rows[0]) : undefined;
  },

  async saveDataStatus(
    endpoint: BrokerDataEndpoint,
    dataStatus: BrokerDataStatus,
  ): Promise<void> {
    const lastCheckedAt = dataStatus.lastCheckedAt
      ? new Date(dataStatus.lastCheckedAt)
      : null;
    const updatedAt = new Date();

    switch (endpoint) {
      case "quotes":
        await db
          .insert(brokerDataStatusTable)
          .values({
            mode: DATA_STATUS_MODE,
            quotesStatus: dataStatus.status,
            quotesLastCheckedAt: lastCheckedAt,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: brokerDataStatusTable.mode,
            set: {
              quotesStatus: dataStatus.status,
              quotesLastCheckedAt: lastCheckedAt,
              updatedAt,
            },
          });
        return;
      case "account":
        await db
          .insert(brokerDataStatusTable)
          .values({
            mode: DATA_STATUS_MODE,
            accountStatus: dataStatus.status,
            accountLastCheckedAt: lastCheckedAt,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: brokerDataStatusTable.mode,
            set: {
              accountStatus: dataStatus.status,
              accountLastCheckedAt: lastCheckedAt,
              updatedAt,
            },
          });
        return;
      case "positions":
        await db
          .insert(brokerDataStatusTable)
          .values({
            mode: DATA_STATUS_MODE,
            positionsStatus: dataStatus.status,
            positionsLastCheckedAt: lastCheckedAt,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: brokerDataStatusTable.mode,
            set: {
              positionsStatus: dataStatus.status,
              positionsLastCheckedAt: lastCheckedAt,
              updatedAt,
            },
          });
        return;
      case "history":
        await db
          .insert(brokerDataStatusTable)
          .values({
            mode: DATA_STATUS_MODE,
            historyStatus: dataStatus.status,
            historyLastCheckedAt: lastCheckedAt,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: brokerDataStatusTable.mode,
            set: {
              historyStatus: dataStatus.status,
              historyLastCheckedAt: lastCheckedAt,
              updatedAt,
            },
          });
    }
  },
};

/**
 * PostgreSQL-backed bridge audit history.
 *
 * Writes intentionally fail soft: bridge health must remain observable when
 * PostgreSQL is unavailable, while the returned state makes the loss of
 * persistence explicit. Every subsequent write retries so recovery does not
 * require a process restart.
 */
export class BridgeAuditStore {
  private readonly repository: BridgeAuditRepository;
  private dataStatus = createUnknownDataStatusSnapshot();
  private state: AuditPersistenceState = {
    status: "unknown",
    message: "Bridge audit persistence has not been checked yet.",
  };

  constructor(repository: BridgeAuditRepository = postgresAuditRepository) {
    this.repository = repository;
  }

  async list(): Promise<BrokerAuditEvent[]> {
    try {
      const events = await this.repository.list();
      this.markHealthy();
      return events;
    } catch (error) {
      this.markDegraded(error);
      return [];
    }
  }

  async append(event: BrokerAuditEvent): Promise<void> {
    try {
      await this.repository.append(event);
      this.markHealthy();
    } catch (error) {
      this.markDegraded(error);
    }
  }

  async loadDataStatus(): Promise<BrokerDataStatusSnapshot> {
    try {
      const snapshot = await this.repository.loadDataStatus();
      if (!snapshot) this.resetDataStatus();
      else this.dataStatus = snapshot;
      this.markHealthy();
      return cloneDataStatusSnapshot(this.dataStatus);
    } catch (error) {
      this.markDegraded(error);
      return cloneDataStatusSnapshot(this.dataStatus);
    }
  }

  async saveDataStatus(
    endpoint: BrokerDataEndpoint,
    dataStatus: BrokerDataStatus,
  ): Promise<void> {
    this.dataStatus = {
      ...this.dataStatus,
      [endpoint]: { ...dataStatus },
    };
    try {
      await this.repository.saveDataStatus(endpoint, dataStatus);
      this.markHealthy();
    } catch (error) {
      this.markDegraded(error);
    }
  }

  /**
   * A missing or invalid persisted snapshot intentionally resets every
   * endpoint to unknown. Data-read state is operational context, not a
   * substitute for a fresh protected read.
   */
  resetDataStatus(): BrokerDataStatusSnapshot {
    this.dataStatus = createUnknownDataStatusSnapshot();
    return cloneDataStatusSnapshot(this.dataStatus);
  }

  getDataStatus(): BrokerDataStatusSnapshot {
    return cloneDataStatusSnapshot(this.dataStatus);
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

function createUnknownDataStatusSnapshot(): BrokerDataStatusSnapshot {
  return {
    quotes: { status: "unknown" },
    account: { status: "unknown" },
    positions: { status: "unknown" },
    history: { status: "unknown" },
  };
}

function cloneDataStatusSnapshot(
  snapshot: BrokerDataStatusSnapshot,
): BrokerDataStatusSnapshot {
  return {
    quotes: { ...snapshot.quotes },
    account: { ...snapshot.account },
    positions: { ...snapshot.positions },
    history: { ...snapshot.history },
  };
}

function parseDataStatusSnapshot(value: unknown): BrokerDataStatusSnapshot | undefined {
  if (!isRecord(value)) return undefined;

  return {
    quotes: readDataStatus(value.quotesStatus, value.quotesLastCheckedAt),
    account: readDataStatus(value.accountStatus, value.accountLastCheckedAt),
    positions: readDataStatus(value.positionsStatus, value.positionsLastCheckedAt),
    history: readDataStatus(value.historyStatus, value.historyLastCheckedAt),
  };
}

function readDataStatus(
  status: unknown,
  lastCheckedAt: unknown,
): BrokerDataStatus {
  if (!isDataReadStatus(status)) {
    return { status: "unknown" };
  }
  const timestamp = readIsoDate(lastCheckedAt);
  return {
    status,
    ...(timestamp ? { lastCheckedAt: timestamp } : {}),
  };
}

function isDataReadStatus(value: unknown): value is BrokerDataReadStatus {
  return (
    typeof value === "string" &&
    DATA_READ_STATUSES.includes(value as BrokerDataReadStatus)
  );
}

function readIsoDate(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (!(value instanceof Date) && typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}