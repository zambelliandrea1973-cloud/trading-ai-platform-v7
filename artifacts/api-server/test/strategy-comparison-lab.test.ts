import assert from "node:assert/strict";
import test from "node:test";
import {
  BERTO_RULES,
  buildLevels,
  centSuffix,
  createBertoDailyPlan,
  declusterSuffixes,
  evaluateLevelTouch,
} from "../src/lib/bertoGoldenSetup";
import {
  buildComparisonSnapshot,
  calculateMetrics,
} from "../src/lib/strategyComparisonLab";

test("Berto setup suspends the next session unless previous QQQ candle is green", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 724.18, close: 723.99 },
    7_529.55,
  );
  assert.equal(plan.active, false);
  assert.equal(plan.suspensionReason, "QQQ_PREVIOUS_CANDLE_NOT_GREEN");
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.decisionInfluence, false);
});

test("QQQ suffix extraction and circular de-clustering follow the fixed rules", () => {
  assert.equal(centSuffix(724.18), 18);
  assert.equal(centSuffix(737.62), 62);
  assert.deepEqual(declusterSuffixes([61, 69]), [61]);
  assert.deepEqual(declusterSuffixes([98, 3]), [3]);
  assert.deepEqual(declusterSuffixes([18, 62]), [18, 62]);
});

test("level grid keeps only levels below open and at least twenty points away", () => {
  const levels = buildLevels(7_529.55, [18, 62], 3);
  assert.deepEqual(
    levels.map((level) => level.price),
    [7_462, 7_418, 7_362, 7_318, 7_262],
  );
  assert(levels.every((level) => level.price < 7_529.55));
  assert(levels.every((level) => level.distanceFromOpen >= 20));
});

test("green QQQ candle creates an immutable shadow-only Berto plan", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 724.18, close: 735 },
    7_529.55,
    2,
  );
  assert.equal(plan.active, true);
  assert.deepEqual(plan.rawSuffixes, [18, 62]);
  assert.deepEqual(plan.validSuffixes, [18, 62]);
  assert.equal(plan.rules.stopLossPoints, 31);
  assert.equal(plan.rules.takeProfitPoints, 89);
  assert.equal(plan.rules.timezone, "America/New_York");
  assert.equal(plan.mode, "SHADOW");
  assert.equal(plan.executionEnabled, false);
});

test("a pre-window first touch invalidates the level for the whole day", () => {
  const invalidated = evaluateLevelTouch(
    { price: 7_462, state: "ARMED" },
    { ask: 7_461.9, at: "2026-09-24T13:45:00.000Z" },
  );
  assert.equal(invalidated.state, "INVALIDATED_PRE_WINDOW");

  const unchanged = evaluateLevelTouch(
    invalidated,
    { ask: 7_461.8, at: "2026-09-24T14:05:00.000Z" },
  );
  assert.equal(unchanged.state, "INVALIDATED_PRE_WINDOW");
});

test("first touch after 10:00 New York enters once and 15:55 expires untouched levels", () => {
  const entered = evaluateLevelTouch(
    { price: 7_462, state: "ARMED" },
    { ask: 7_462, at: "2026-09-24T14:00:00.000Z" },
  );
  assert.equal(entered.state, "ENTERED");

  const expired = evaluateLevelTouch(
    { price: 7_362, state: "ARMED" },
    { ask: 7_500, at: "2026-09-24T19:55:00.000Z" },
  );
  assert.equal(expired.state, "EXPIRED");
});

test("comparison lab keeps equal capital and isolated metrics", () => {
  const snapshot = buildComparisonSnapshot(5_000, [
    {
      strategy: "FIVE_BRAINS_STRATEGY",
      openedAt: "2026-01-02T15:00:00Z",
      closedAt: "2026-01-02T16:00:00Z",
      initialCapital: 5_000,
      netPnl: 100,
      riskAmount: 50,
      fees: 2,
      slippage: 1,
    },
    {
      strategy: "BERTO_GOLDEN_SETUP",
      openedAt: "2026-01-03T15:00:00Z",
      closedAt: "2026-01-03T16:00:00Z",
      initialCapital: 5_000,
      netPnl: -50,
      riskAmount: 50,
      fees: 2,
      slippage: 1,
    },
  ]);
  assert.equal(snapshot.initialCapital, 5_000);
  assert.equal(snapshot.isolatedPortfolios, true);
  assert.equal(snapshot.decisionCrossInfluence, false);
  assert.equal(snapshot.executionEnabled, false);
  assert.equal(snapshot.strategies.FIVE_BRAINS_STRATEGY.finalCapital, 5_100);
  assert.equal(snapshot.strategies.BERTO_GOLDEN_SETUP.finalCapital, 4_950);
});

test("performance metrics include net return, profit factor, expectancy and drawdown", () => {
  const metrics = calculateMetrics(1_000, [
    {
      strategy: "BERTO_GOLDEN_SETUP",
      openedAt: "2026-01-02T15:00:00Z",
      closedAt: "2026-01-02T16:00:00Z",
      initialCapital: 1_000,
      netPnl: 100,
      riskAmount: 50,
      fees: 2,
      slippage: 1,
    },
    {
      strategy: "BERTO_GOLDEN_SETUP",
      openedAt: "2026-01-03T15:00:00Z",
      closedAt: "2026-01-03T16:00:00Z",
      initialCapital: 1_000,
      netPnl: -50,
      riskAmount: 50,
      fees: 2,
      slippage: 1,
    },
  ]);
  assert.equal(metrics.finalCapital, 1_050);
  assert.equal(metrics.netReturnPct, 5);
  assert.equal(metrics.winRatePct, 50);
  assert.equal(metrics.profitFactor, 2);
  assert.equal(metrics.expectancyR, 0.5);
  assert.equal(metrics.totalCosts, 6);
  assert(metrics.maxDrawdownPct > 0);
  assert.equal(BERTO_RULES.executionEnabled, false);
});
