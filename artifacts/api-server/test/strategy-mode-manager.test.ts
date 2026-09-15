import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateEngagement,
  evaluateRiskBudget,
  liveBlockers,
  normalizeSymbol,
  type StrategyProfile,
} from "../src/lib/strategyModeManager";

const controls = {
  maxRiskPerTradePct: 0.5,
  maxDailyLossPct: 2,
  maxOpenExposurePct: 5,
  maxConcurrentPositions: 3,
};

const scalp: StrategyProfile = {
  strategy: "SCALP",
  mode: "DEMO",
  experimentPassed: false,
  minSamples: 200,
  completedSamples: 0,
  maxHoldingMinutes: 15,
  allowedTimeframes: ["M1", "M5"],
  maxSpreadMultiple: 1.35,
  maxSlippageR: 0.08,
  maxRiskPerTradePct: controls.maxRiskPerTradePct,
  maxDailyLossPct: controls.maxDailyLossPct,
  cooldownMinutes: 3,
  riskControls: controls,
  liveEligible: false,
  liveBlockers: [],
};

test("normalizes broker suffixes and rejects unsafe symbols", () => {
  assert.equal(normalizeSymbol(" eur/usd.a "), "EURUSD");
  assert.equal(normalizeSymbol("XAU/USD-RAW"), "XAUUSD-RAW");
  assert.throws(() => normalizeSymbol("../EURUSD"));
});

test("LIVE always has a hard authorization blocker", () => {
  const blockers = liveBlockers({
    experimentPassed: true,
    completedSamples: 200,
    minSamples: 200,
    brokerConnected: true,
    brokerExecutionEnabled: true,
    persistenceHealthy: true,
    environmentEnabled: true,
  });
  assert.ok(blockers.some((blocker) => blocker.includes("futura autorizzazione")));
});

test("risk budget is shared and rejects limits independent of strategy", () => {
  assert.deepEqual(evaluateRiskBudget(controls, { riskPerTradePct: 0.51 }), {
    allowed: false,
    reasons: ["Rischio per trade oltre il limite account-wide."],
  });
  assert.equal(evaluateRiskBudget(controls, { dailyLossPct: 2 }).allowed, false);
  assert.equal(evaluateRiskBudget(controls, { openExposurePct: 5 }).allowed, true);
  assert.equal(evaluateRiskBudget(controls, { openPositionCount: 3 }).allowed, false);
});

test("engagement blocks disabled scalp around high-impact events", () => {
  const result = evaluateEngagement(scalp, {
    timeframe: "M1",
    spreadMultiple: 1.1,
    slippageR: 0.04,
    expectedEdgeR: 0.2,
    minutesToHighImpactEvent: 5,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((reason) => reason.includes("Evento macro")));
});