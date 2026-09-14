import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEngagement, liveBlockers, normalizeSymbol, type StrategyProfile } from "../src/lib/strategyModeManager";

const scalp: StrategyProfile = { strategy: "SCALP", mode: "DEMO", experimentPassed: false, minSamples: 200, completedSamples: 0, maxHoldingMinutes: 15, allowedTimeframes: ["M1", "M5"], maxSpreadMultiple: 1.35, maxSlippageR: 0.08, maxRiskPerTradePct: 0.2, maxDailyLossPct: 1, cooldownMinutes: 3, liveEligible: false, liveBlockers: [] };

test("normalizza i suffissi broker e impedisce simboli non validi", () => {
  assert.equal(normalizeSymbol("EUR/USD.a"), "EURUSD");
  assert.throws(() => normalizeSymbol("../EURUSD"));
});

test("scalp rifiutato con costi o evento imminente", () => {
  assert.equal(evaluateEngagement(scalp, { timeframe: "M1", spreadMultiple: 1.1, slippageR: 0.1, expectedEdgeR: 0.08, minutesToHighImpactEvent: 5 }).allowed, false);
});

test("LIVE richiede tutti i gate", () => {
  const blockers = liveBlockers({ experimentPassed: true, completedSamples: 200, minSamples: 200, brokerConnected: true, brokerExecutionEnabled: false, persistenceHealthy: true, environmentEnabled: true });
  assert.deepEqual(blockers, ["Esecuzione broker non abilitata."]);
});
