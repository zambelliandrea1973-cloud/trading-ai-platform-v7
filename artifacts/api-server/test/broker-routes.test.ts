import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import {
  GetBrokerAccountResponse,
  GetBrokerHistoryResponse,
  GetBrokerPositionsResponse,
  GetBrokerQuotesResponse,
  GetBrokerStatusResponse,
  SubmitMt5HeartbeatResponse,
} from "@workspace/api-zod";
import {
  BridgeAuditStore,
  type BridgeAuditRepository,
} from "../src/lib/broker/audit-store";
import type { BrokerAuditEvent } from "../src/lib/broker/contract";
import { Mt5BridgeAdapter } from "../src/lib/broker/mt5-bridge-adapter";
import { createBrokerRouter } from "../src/routes/broker";

const BRIDGE_ENV = {
  MT5_BRIDGE_URL: "https://bridge.example.test",
  MT5_BRIDGE_API_KEY: "bridge-secret",
  MT5_BRIDGE_ALLOWED_HOSTS: "bridge.example.test",
};

const READ_ENV = {
  BROKER_READ_API_KEY: "read-secret",
  BROKER_READ_ALLOWED_IPS: "127.0.0.1,::ffff:127.0.0.1",
};

const NOW = new Date("2026-08-24T12:00:00.000Z");

class MemoryAuditRepository implements BridgeAuditRepository {
  readonly events: BrokerAuditEvent[] = [];

  async list(): Promise<BrokerAuditEvent[]> {
    return this.events.slice(-25);
  }

  async append(event: BrokerAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function configuredAdapter(
  repository: BridgeAuditRepository,
  fetchImpl: typeof fetch,
): Mt5BridgeAdapter {
  return new Mt5BridgeAdapter({
    env: BRIDGE_ENV,
    auditStore: new BridgeAuditStore(repository),
    now: () => NOW,
    fetchImpl,
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

function bridgeFetch(requests: string[]): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    requests.push(`${url.pathname}${url.search}`);

    const payloadByPath: Record<string, unknown> = {
      "/health": {
        status: "healthy",
        heartbeatAt: NOW.toISOString(),
        bridgeVersion: "1.2.3",
      },
      "/quotes": {
        quotes: [
          {
            symbol: "EURUSD",
            bid: 1.0845,
            ask: 1.0847,
            timestamp: NOW.toISOString(),
            spreadPoints: 2,
          },
        ],
      },
      "/account": {
        account: {
          accountId: "987654",
          balance: 10_000,
          equity: 10_125.5,
          margin: 500,
          freeMargin: 9_625.5,
          currency: "USD",
        },
      },
      "/positions": {
        positions: [
          {
            ticket: 42,
            symbol: "EURUSD",
            type: "long",
            volume: 0.5,
            openPrice: 1.08,
            stopLoss: 1.07,
            takeProfit: 1.1,
            openTime: "2026-08-24T11:00:00.000Z",
          },
        ],
      },
      "/history": {
        history: [
          {
            id: "trade-7",
            symbol: "XAUUSD",
            type: "1",
            volume: 0.1,
            openPrice: 2_500,
            closePrice: 2_510,
            profit: 100,
            currency: "USD",
            openTime: "2026-08-23T10:00:00.000Z",
            closeTime: "2026-08-23T12:00:00.000Z",
            status: "closed",
          },
        ],
      },
    };

    if (!(url.pathname in payloadByPath)) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(payloadByPath[url.pathname]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

test("status and authenticated broker reads match generated response schemas", async () => {
  const repository = new MemoryAuditRepository();
  const requests: string[] = [];
  const adapter = configuredAdapter(repository, bridgeFetch(requests));

  await withRouter(adapter, READ_ENV, async (baseUrl) => {
    const statusResponse = await fetch(`${baseUrl}/api/broker/status`);
    assert.equal(statusResponse.status, 200);
    const status = GetBrokerStatusResponse.parse(await json(statusResponse));
    assert.equal(status.provider, "axi");
    assert.equal(status.venue, "mt5");
    assert.equal(status.connected, true);
    assert.equal(status.executionEnabled, false);
    assert.equal(status.bridgeVersion, "1.2.3");

    const headers = { "x-broker-read-key": "read-secret" };
    const quotesResponse = await fetch(
      `${baseUrl}/api/broker/quotes?symbols=EURUSD%2CXAUUSD`,
      { headers },
    );
    assert.equal(quotesResponse.status, 200);
    const quotes = GetBrokerQuotesResponse.parse(await json(quotesResponse));
    assert.deepEqual(quotes, [
      {
        symbol: "EURUSD",
        bid: 1.0845,
        ask: 1.0847,
        timestamp: new Date(NOW),
        spreadPoints: 2,
      },
    ]);

    const accountResponse = await fetch(`${baseUrl}/api/broker/account`, { headers });
    assert.equal(accountResponse.status, 200);
    const account = GetBrokerAccountResponse.parse(await json(accountResponse));
    assert.deepEqual(account, {
      externalAccountId: "987654",
      balance: 10_000,
      equity: 10_125.5,
      margin: 500,
      freeMargin: 9_625.5,
      currency: "USD",
    });

    const positionsResponse = await fetch(`${baseUrl}/api/broker/positions`, {
      headers,
    });
    assert.equal(positionsResponse.status, 200);
    const positions = GetBrokerPositionsResponse.parse(await json(positionsResponse));
    assert.deepEqual(positions, [
      {
        externalId: "42",
        symbol: "EURUSD",
        side: "buy",
        volume: 0.5,
        openPrice: 1.08,
        stopLoss: 1.07,
        takeProfit: 1.1,
        openedAt: new Date("2026-08-24T11:00:00.000Z"),
      },
    ]);

    const historyResponse = await fetch(
      `${baseUrl}/api/broker/history?from=2026-08-23T00%3A00%3A00.000Z&to=2026-08-24T00%3A00%3A00.000Z`,
      { headers },
    );
    assert.equal(historyResponse.status, 200);
    const history = GetBrokerHistoryResponse.parse(await json(historyResponse));
    assert.deepEqual(history, [
      {
        externalId: "trade-7",
        symbol: "XAUUSD",
        side: "sell",
        volume: 0.1,
        openPrice: 2_500,
        closePrice: 2_510,
        profit: 100,
        currency: "USD",
        openedAt: new Date("2026-08-23T10:00:00.000Z"),
        closedAt: new Date("2026-08-23T12:00:00.000Z"),
        status: "closed",
      },
    ]);

    assert.deepEqual(requests, [
      "/health",
      "/quotes?symbols=EURUSD%2CXAUUSD",
      "/account",
      "/positions",
      "/history?from=2026-08-23T00%3A00%3A00.000Z&to=2026-08-24T00%3A00%3A00.000Z",
    ]);
  });
});

test("broker read routes reject requests without the read key", async () => {
  const repository = new MemoryAuditRepository();
  const requests: string[] = [];
  const adapter = configuredAdapter(repository, bridgeFetch(requests));
  const readRoutes = ["quotes", "account", "positions", "history"];

  await withRouter(adapter, READ_ENV, async (baseUrl) => {
    for (const route of readRoutes) {
      const response = await fetch(`${baseUrl}/api/broker/${route}`);
      assert.equal(response.status, 401, route);
      assert.deepEqual(await json(response), {
        error: "Broker read authentication required.",
      });
    }
  });

  assert.deepEqual(requests, []);
});

test("broker read routes reject a valid key from a non-allowlisted network", async () => {
  const repository = new MemoryAuditRepository();
  const adapter = configuredAdapter(repository, bridgeFetch([]));

  await withRouter(
    adapter,
    { ...READ_ENV, BROKER_READ_ALLOWED_IPS: "10.0.0.8" },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/broker/account`, {
        headers: { "x-broker-read-key": "read-secret" },
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await json(response), {
        error: "Broker read network is not allowlisted.",
      });
    },
  );
});

test("authenticated MT5 heartbeat returns the generated void response", async () => {
  const repository = new MemoryAuditRepository();
  const adapter = configuredAdapter(repository, bridgeFetch([]));

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
          heartbeatAt: NOW.toISOString(),
          bridgeVersion: "1.2.3",
        }),
      });

      assert.equal(response.status, 204);
      SubmitMt5HeartbeatResponse.parse(undefined);
      assert.equal(await response.text(), "");
    },
  );
});