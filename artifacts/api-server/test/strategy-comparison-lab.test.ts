import assert from "node:assert/strict";
import test from "node:test";
import {
  BERTO_RULES,
  buildBertoOrders,
  buildLevels,
  centSuffix,
  createBertoDailyPlan,
  declusterSuffixes,
  evaluateFirstTouch,
  markBreakoutFilled,
  markRetestFilled,
} from "../src/lib/bertoGoldenSetup";
import {
  buildComparisonSnapshot,
  calculateMetrics,
} from "../src/lib/strategyComparisonLab";

test("a red QQQ candle creates a SHORT shadow plan; a doji suspends it", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 724.18, close: 723.99 },
    7_529.55,
  );
  assert.equal(plan.active, true);
  assert.equal(plan.direction, "SHORT");
  assert.equal(plan.suspensionReason, undefined);
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.decisionInfluence, false);

  const doji = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 724.18, close: 724 },
    7_529.55,
  );
  assert.equal(doji.active, false);
  assert.equal(doji.suspensionReason, "QQQ_PREVIOUS_CANDLE_DOJI");
});

test("QQQ suffix extraction and circular de-clustering follow the fixed rules", () => {
  assert.equal(centSuffix(724.18), 18);
  assert.equal(centSuffix(737.62), 62);
  assert.deepEqual(declusterSuffixes([61, 69]), [61]);
  assert.deepEqual(declusterSuffixes([98, 3]), [3]);
  assert.deepEqual(declusterSuffixes([18, 62]), [18, 62]);
});

test("level grid spans both sides of the open at the configured depth", () => {
  const levels = buildLevels(7_529.55, [18, 62], 3);
  assert.deepEqual(
    levels.map((level) => level.price),
    [7_218, 7_262, 7_318, 7_362, 7_418, 7_462, 7_518, 7_562, 7_618, 7_662, 7_718, 7_762, 7_818, 7_862],
  );
  assert(levels.some((level) => level.price < 7_529.55));
  assert(levels.some((level) => level.price > 7_529.55));
  assert(levels.every((level) => level.distanceFromOpen === Number(Math.abs(level.price - 7_529.55).toFixed(6))));
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
  assert.deepEqual(
    [plan.rules.breakoutPoints, plan.rules.retestPoints, plan.rules.stopOffsetPoints, plan.rules.takeProfitOffsetPoints],
    [8, 3, 5, 30],
  );
  assert.equal(plan.rules.timezone, "Europe/Rome");
  assert.equal(plan.rules.entryWindowStart, "15:30");
  assert.equal(plan.rules.forcedExit, "21:55");
  assert.equal(plan.mode, "SHADOW");
  assert.equal(plan.executionEnabled, false);
});

test("a pre-window touch stays armed and a 15:30 Rome touch is discarded for the day", () => {
  const armed = evaluateFirstTouch(
    { price: 7_462, state: "ARMED" },
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:29:00.000Z" },
    "LONG",
  );
  assert.equal(armed.state, "ARMED");

  const discarded = evaluateFirstTouch(
    armed,
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:30:00.000Z" },
    "LONG",
  );
  assert.equal(discarded.state, "DISCARDED_1530_TOUCH");

  const unchanged = evaluateFirstTouch(
    discarded,
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" },
    "LONG",
  );
  assert.equal(unchanged.state, "DISCARDED_1530_TOUCH");
});

test("first touch after 15:30 Rome precedes breakout and retest; untouched levels expire at 21:55", () => {
  const touched = evaluateFirstTouch(
    { price: 7_462, state: "ARMED" },
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" },
    "LONG",
  );
  assert.equal(touched.state, "TOUCHED");
  const orders = buildBertoOrders(touched.price, "LONG");
  assert.deepEqual(orders, {
    direction: "LONG",
    breakoutStop: 7_470,
    retestLimit: 7_465,
    stopLoss: 7_457,
    takeProfit: 7_492,
  });
  const breakout = markBreakoutFilled(touched, "2026-09-24T13:32:00.000Z");
  assert.equal(breakout.state, "BREAKOUT_FILLED");
  const retest = markRetestFilled(breakout, "2026-09-24T13:33:00.000Z");
  assert.equal(retest.state, "RETEST_FILLED");

  const expired = evaluateFirstTouch(
    { price: 7_362, state: "ARMED" },
    { low: 7_500, high: 7_501, previousClose: 7_500, at: "2026-09-24T19:55:00.000Z" },
    "LONG",
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
