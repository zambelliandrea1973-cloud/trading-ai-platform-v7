import assert from "node:assert/strict";
import test from "node:test";
import {
  AxiMcpShadowAdapter,
  isReadOnlyTool,
} from "../src/lib/broker/axi-mcp-shadow-adapter";
import {
  compareAccountSnapshots,
  comparePositionSnapshots,
  compareQuoteSnapshots,
} from "../src/lib/broker/axi-mcp-shadow-comparator";

const NOW = new Date("2026-09-21T10:00:00.000Z");

test("Axi MCP is disabled by default and can never execute", async () => {
  let called = false;
  const adapter = new AxiMcpShadowAdapter({
    env: {},
    now: () => NOW,
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  const status = await adapter.getStatus();
  assert.equal(status.state, "disabled");
  assert.equal(status.enabled, false);
  assert.equal(status.executionEnabled, false);
  assert.equal(status.decisionInfluence, false);
  assert.equal(status.endpoint, "https://mcp.axi.com/mcp");
  assert.equal(called, false);
});

test("enabled Axi MCP reports auth_required without leaking or calling the network", async () => {
  let called = false;
  const adapter = new AxiMcpShadowAdapter({
    env: { AXI_MCP_ENABLED: "true" },
    now: () => NOW,
    fetchImpl: async () => {
      called = true;
      return new Response();
    },
  });

  const status = await adapter.getStatus();
  assert.equal(status.state, "auth_required");
  assert.equal(status.connected, false);
  assert.equal(status.executionEnabled, false);
  assert.equal(called, false);
});

test("tool discovery exposes only allowlisted read shapes and records blocked tools", async () => {
  const adapter = new AxiMcpShadowAdapter({
    env: {
      AXI_MCP_ENABLED: "true",
      AXI_MCP_ACCESS_TOKEN: "test-token",
    },
    now: () => NOW,
    fetchImpl: async (_url, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(
        (init?.headers as Record<string, string>).authorization,
        "Bearer test-token",
      );
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: [
              { name: "get.account" },
              { name: "list.positions" },
              { name: "place.order" },
              { name: "close.position" },
              { name: "untrusted" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const status = await adapter.getStatus();
  assert.equal(status.state, "healthy");
  assert.equal(status.connected, true);
  assert.deepEqual(status.availableReadTools, ["get.account", "list.positions"]);
  assert.deepEqual(status.blockedTools, [
    "place.order",
    "close.position",
    "untrusted",
  ]);
});

test("write-like and unknown MCP tools are rejected before any network call", async () => {
  let calls = 0;
  const adapter = new AxiMcpShadowAdapter({
    env: {
      AXI_MCP_ENABLED: "true",
      AXI_MCP_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response();
    },
  });

  for (const name of [
    "place.order",
    "open-position",
    "modify/trade",
    "delete.account",
    "untrusted",
  ]) {
    await assert.rejects(
      adapter.callReadTool(name, {}),
      /blocked by the read-only policy/,
    );
  }
  assert.equal(calls, 0);
  assert.equal(isReadOnlyTool("get.quotes"), true);
  assert.equal(isReadOnlyTool("list.positions"), true);
});

test("shadow comparisons report discrepancies without decision influence", () => {
  const quotes = compareQuoteSnapshots(
    [{ symbol: "EURUSD", bid: 1.1, ask: 1.2, timestamp: NOW.toISOString() }],
    [{ symbol: "EURUSD", bid: 1.11, ask: 1.2, timestamp: NOW.toISOString() }],
    0.001,
    NOW,
  );
  assert.equal(quotes.matches, false);
  assert.equal(quotes.decisionInfluence, false);
  assert.equal(quotes.differences[0]?.field, "quotes.EURUSD.bid");

  const account = compareAccountSnapshots(
    { balance: 100, equity: 100, currency: "EUR" },
    { balance: 100, equity: 100, currency: "EUR" },
    0.01,
    NOW,
  );
  assert.equal(account.matches, true);
  assert.equal(account.decisionInfluence, false);

  const positions = comparePositionSnapshots(
    [{
      externalId: "1",
      symbol: "EURUSD",
      side: "buy",
      volume: 0.1,
      openPrice: 1.1,
      openedAt: NOW.toISOString(),
    }],
    [],
    NOW,
  );
  assert.equal(positions.matches, false);
  assert.equal(positions.decisionInfluence, false);
});
