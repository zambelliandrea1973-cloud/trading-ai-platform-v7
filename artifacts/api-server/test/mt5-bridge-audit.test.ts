import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import type { BrokerAuditEvent } from "../src/lib/broker/contract";
import {
  BridgeAuditStore,
  type BrokerDataStatusSnapshot,
  type BridgeAuditRepository,
} from "../src/lib/broker/audit-store";
import { Mt5BridgeAdapter } from "../src/lib/broker/mt5-bridge-adapter";
import { createBrokerRouter } from "../src/routes/broker";

const BRIDGE_ENV = {
  MT5_BRIDGE_URL: "https://bridge.example.test",
  MT5_BRIDGE_API_KEY: "bridge-secret",
  MT5_BRIDGE_ALLOWED_HOSTS: "bridge.example.test",
};

class MemoryAuditRepository implements BridgeAuditRepository {
  readonly events: BrokerAuditEvent[] = [];
  dataStatus: BrokerDataStatusSnapshot | undefined;
  unavailable = false;

  async list(): Promise<BrokerAuditEvent[]> {
    if (this.unavailable) throw new Error("database unavailable");
    return this.events.slice(-25);
  }

  async append(event: BrokerAuditEvent): Promise<void> {
    if (this.unavailable) throw new Error("database unavailable");
    this.events.push(event);
  }

  async loadDataStatus(): Promise<BrokerDataStatusSnapshot | undefined> {
    if (this.unavailable) throw new Error("database unavailable");
    return this.dataStatus;
  }

  async saveDataStatus(
    endpoint: keyof BrokerDataStatusSnapshot,
    dataStatus: BrokerDataStatusSnapshot[keyof BrokerDataStatusSnapshot],
  ): Promise<void> {
    if (this.unavailable) throw new Error("database unavailable");
    this.dataStatus = {
      ...(this.dataStatus ?? {
        quotes: { status: "unknown" },
        account: { status: "unknown" },
        positions: { status: "unknown" },
        history: { status: "unknown" },
      }),
      [endpoint]: dataStatus,
    };
  }
}

function healthFetch(now: Date): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        status: "healthy",
        heartbeatAt: now.toISOString(),
        bridgeVersion: "1.2.3",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
}

function configuredAdapter(
  repository: BridgeAuditRepository,
  options: {
    now?: () => Date;
    fetchImpl?: typeof fetch;
  } = {},
): Mt5BridgeAdapter {
  return new Mt5BridgeAdapter({
    env: BRIDGE_ENV,
    auditStore: new BridgeAuditStore(repository),
    now: options.now,
    fetchImpl: options.fetchImpl,
  });
}

async function withRouter<T>(
  adapter: Mt5BridgeAdapter,
  env: Record<string, string | undefined>,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use("/api", createBrokerRouter({ adapter, env }));

  const server = await new Promise<Server>((resolve, reject) => {
    const nextServer = createServer(app);
    nextServer.once("error", reject);
    nextServer.listen(0, "127.0.0.1", () => resolve(nextServer));
  });

  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("bridge audit events survive a new store and adapter instance", async () => {
  const repository = new MemoryAuditRepository();
  const now = new Date("2026-08-24T12:00:00.000Z");
  const firstAdapter = configuredAdapter(repository, {
    now: () => now,
    fetchImpl: healthFetch(now),
  });

  await firstAdapter.receiveHeartbeat({
    status: "healthy",
    heartbeatAt: now.toISOString(),
    bridgeVersion: "1.2.3",
  });

  const secondAdapter = configuredAdapter(repository, {
    now: () => new Date(now.getTime() + 2_000),
    fetchImpl: healthFetch(new Date(now.getTime() + 2_000)),
  });
  const status = await secondAdapter.getStatus();

  assert.equal(status.mode, "paper");
  assert.equal(status.executionEnabled, false);
  assert.equal(status.database.status, "healthy");
  assert.equal(status.auditTrail[0]?.event, "heartbeat.received");
  assert.equal(status.auditTrail[0]?.detail, "Authenticated bridge heartbeat");
  assert.equal(repository.events.length, 2);
});

test("degraded PostgreSQL keeps the bridge in PAPER with execution disabled", async () => {
  const repository = new MemoryAuditRepository();
  repository.unavailable = true;
  const now = new Date("2026-08-24T12:00:00.000Z");
  const adapter = configuredAdapter(repository, {
    now: () => now,
    fetchImpl: healthFetch(now),
  });

  const status = await adapter.getStatus();

  assert.equal(status.mode, "paper");
  assert.equal(status.executionEnabled, false);
  assert.equal(status.database.status, "degraded");
  assert.match(status.database.message, /LIVE execution remains disabled/);
});

test("health failures are degraded, audited, and remain PAPER-only", async () => {
  const repository = new MemoryAuditRepository();
  const adapter = configuredAdapter(repository, {
    now: () => new Date("2026-08-24T12:00:00.000Z"),
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });

  const status = await adapter.getStatus();

  assert.equal(status.status, "disconnected");
  assert.equal(status.health, "degraded");
  assert.equal(status.mode, "paper");
  assert.equal(status.executionEnabled, false);
  assert.match(status.lastError ?? "", /connection refused/);
  assert.equal(repository.events.at(-1)?.event, "health.check_failed");
});

test("heartbeat route rejects a wrong bridge key and records the rejection", async () => {
  const repository = new MemoryAuditRepository();
  const adapter = configuredAdapter(repository);

  await withRouter(
    adapter,
    { MT5_BRIDGE_ALLOWED_IPS: "127.0.0.1" },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/broker/mt5/heartbeat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mt5-bridge-key": "wrong-key",
        },
        body: JSON.stringify({
          status: "healthy",
          heartbeatAt: "2026-08-24T12:00:00.000Z",
        }),
      });

      assert.equal(response.status, 401);
      assert.equal(repository.events.at(-1)?.event, "heartbeat.rejected");
      assert.match(repository.events.at(-1)?.detail ?? "", /key was rejected/);
    },
  );
});

test("heartbeat route rejects a non-allowlisted network and records the rejection", async () => {
  const repository = new MemoryAuditRepository();
  const adapter = configuredAdapter(repository);

  await withRouter(
    adapter,
    { MT5_BRIDGE_ALLOWED_IPS: "10.0.0.8" },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/broker/mt5/heartbeat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mt5-bridge-key": "bridge-secret",
        },
        body: JSON.stringify({
          status: "healthy",
          heartbeatAt: "2026-08-24T12:00:00.000Z",
        }),
      });

      assert.equal(response.status, 403);
      assert.equal(repository.events.at(-1)?.event, "heartbeat.rejected");
      assert.match(repository.events.at(-1)?.detail ?? "", /not allowlisted/);
    },
  );
});

test("authenticated allowlisted heartbeat is accepted and persisted", async () => {
  const repository = new MemoryAuditRepository();
  const adapter = configuredAdapter(repository, {
    now: () => new Date("2026-08-24T12:00:00.000Z"),
  });

  await withRouter(
    adapter,
    { MT5_BRIDGE_ALLOWED_IPS: "127.0.0.1,::ffff:127.0.0.1" },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/broker/mt5/heartbeat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mt5-bridge-key": "bridge-secret",
        },
        body: JSON.stringify({
          status: "healthy",
          heartbeatAt: "2026-08-24T12:00:00.000Z",
          bridgeVersion: "1.2.3",
        }),
      });

      assert.equal(response.status, 204);
      assert.equal(repository.events.at(-1)?.event, "heartbeat.received");
    },
  );
});