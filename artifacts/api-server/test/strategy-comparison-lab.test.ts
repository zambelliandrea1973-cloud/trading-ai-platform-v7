import assert from "node:assert/strict";
import test from "node:test";
import {
  BERTO_RULES,
  buildBertoOrders,
  buildLevels,
  calculateRiskSizedLots,
  centSuffix,
  closeBertoSession,
  createBertoDailyPlan,
  declusterSuffixes,
  evaluateBertoPositionExit,
  evaluateFirstTouch,
  fillBertoPending,
} from "../src/lib/bertoGoldenSetup";
import {
  buildComparisonSnapshot,
  calculateMetrics,
} from "../src/lib/strategyComparisonLab";

const calm = { high: 5_020, low: 4_980, close: 5_000, complete: true };
const green = { open: 724, high: 737.62, low: 724.18, close: 735 };
const red = { open: 724, high: 737.69, low: 723.61, close: 723 };

test("v4.50 keeps the existing QQQ source and SHADOW-only configuration", () => {
  assert.equal(BERTO_RULES.signalSourceUrl, "https://www.investing.com/etfs/powershares-qqqq");
  assert.equal(BERTO_RULES.qqqDataSource, "INVESTING_COM");
  assert.equal(BERTO_RULES.timezone, "America/New_York");
  assert.equal(BERTO_RULES.sessionOpen, "09:30");
  assert.equal(BERTO_RULES.regularForcedExit, "15:55");
  assert.equal(BERTO_RULES.halfDayForcedExit, "12:55");
  assert.equal(BERTO_RULES.initialStopPoints, 13);
  assert.equal(BERTO_RULES.maximumDistanceFromOpenPoints, 50);
  assert.equal(BERTO_RULES.mode, "SHADOW");
  assert.equal(BERTO_RULES.executionEnabled, false);
  assert.equal(BERTO_RULES.decisionInfluence, false);
});

test("v4.50 derives LONG, SHORT and doji suspension from the previous QQQ candle", () => {
  assert.equal(
    createBertoDailyPlan(green, 7_529.55, { previousSession: calm }).direction,
    "LONG",
  );
  assert.equal(
    createBertoDailyPlan(red, 7_529.55, { previousSession: calm }).direction,
    "SHORT",
  );
  const doji = createBertoDailyPlan({ ...green, close: green.open }, 7_529.55, {
    previousSession: calm,
  });
  assert.equal(doji.active, false);
  assert.equal(doji.suspensionReason, "QQQ_PREVIOUS_CANDLE_DOJI");
});

test("suffix extraction and direction-aware circular de-clustering match v4.50", () => {
  assert.equal(centSuffix(724.18), 18);
  assert.equal(centSuffix(737.62), 62);
  assert.deepEqual(declusterSuffixes([61, 69], "LONG"), [61]);
  assert.deepEqual(declusterSuffixes([61, 69], "SHORT"), [69]);
  assert.deepEqual(declusterSuffixes([98, 3], "LONG"), [3]);
  assert.deepEqual(declusterSuffixes([98, 3], "SHORT"), [98]);
});

test("level grid retains only levels within fifty points of the US500 open", () => {
  const levels = buildLevels(7_529.55, [18, 62]);
  assert.deepEqual(
    levels.map((x) => x.price),
    [7_518, 7_562],
  );
  assert(levels.every((x) => x.distanceFromOpen <= 50));
});

test("previous-session range is fail-closed and 1.3 percent is blocked", () => {
  const missing = createBertoDailyPlan(green, 7_529.55, {
    previousSession: { ...calm, complete: false },
  });
  assert.equal(missing.suspensionReason, "PREVIOUS_SESSION_RANGE_UNAVAILABLE");
  const threshold = createBertoDailyPlan(green, 7_529.55, {
    previousSession: { high: 5_065, low: 5_000, close: 5_000, complete: true },
  });
  assert.equal(threshold.previousSessionRangePct, 1.3);
  assert.equal(threshold.suspensionReason, "PREVIOUS_SESSION_RANGE_TOO_HIGH");
  assert.equal(
    createBertoDailyPlan(green, 7_529.55, { previousSession: calm }).active,
    true,
  );
});

test("closed and half-day sessions are explicit, without a hardcoded holiday list", () => {
  assert.equal(
    createBertoDailyPlan(green, 7_529.55, {
      previousSession: calm,
      sessionKind: "CLOSED",
    }).suspensionReason,
    "MARKET_CLOSED",
  );
  assert.equal(
    createBertoDailyPlan(green, 7_529.55, {
      previousSession: calm,
      sessionKind: "HALF_DAY",
    }).sessionClose,
    "12:55",
  );
});

test("opening-minute touch is discarded; valid approach arms breakout at plus eight", () => {
  const opening = evaluateFirstTouch(
    { price: 7_518, state: "ARMED" },
    {
      low: 7_517,
      high: 7_519,
      previousClose: 7_516,
      at: "2026-09-24T13:30:00Z",
    },
    "LONG",
  );
  assert.equal(opening.state, "DISCARDED_OPENING_MINUTE_TOUCH");
  const pending = evaluateFirstTouch(
    { price: 7_518, state: "ARMED" },
    {
      low: 7_517,
      high: 7_519,
      previousClose: 7_516,
      at: "2026-09-24T13:31:00Z",
    },
    "LONG",
  );
  assert.equal(pending.state, "PENDING_BREAKOUT");
  assert.deepEqual(pending.order, {
    direction: "LONG",
    kind: "STOP",
    entryStop: 7_526,
    stopLoss: 7_513,
    takeProfit: null,
    trailingDistancePoints: 25,
    riskPercent: 2,
  });
});

test("SHORT approach must come from above and a breakout cannot fill on the touch candle", () => {
  const touch = { low: 7_517, high: 7_519, previousClose: 7_520, at: "2026-09-24T13:31:00Z" };
  const pending = evaluateFirstTouch({ price: 7_518, state: "ARMED" }, touch, "SHORT");
  assert.equal(pending.state, "PENDING_BREAKOUT");
  assert.equal(pending.order?.entryStop, 7_510);
  assert.equal(fillBertoPending(pending, { low: 7_510, high: 7_519, at: touch.at }), pending);
  assert.equal(
    evaluateFirstTouch({ price: 7_518, state: "ARMED" }, { ...touch, previousClose: 7_516 }, "SHORT").state,
    "DISCARDED_WRONG_APPROACH",
  );
});

test("session boundaries follow New York across winter and summer DST", () => {
  for (const { date, openUtc, exitUtc } of [
    { date: "2026-01-15", openUtc: "14:30", exitUtc: "20:55" },
    { date: "2026-07-15", openUtc: "13:30", exitUtc: "19:55" },
  ]) {
    const opening = evaluateFirstTouch(
      { price: 7_518, state: "ARMED" },
      { low: 7_517, high: 7_519, previousClose: 7_516, at: `${date}T${openUtc}:00Z` },
      "LONG",
    );
    assert.equal(opening.state, "DISCARDED_OPENING_MINUTE_TOUCH");
    assert.equal(closeBertoSession([{ price: 7_518, state: "ARMED" }], `${date}T${exitUtc}:00Z`, 7_520)[0]?.state, "EXPIRED");
  }
});

test("breakout rejects excessive spread or chase and opens otherwise", () => {
  const pending = evaluateFirstTouch(
    { price: 7_518, state: "ARMED" },
    {
      low: 7_517,
      high: 7_519,
      previousClose: 7_516,
      at: "2026-09-24T13:31:00Z",
    },
    "LONG",
  );
  assert.equal(
    fillBertoPending(pending, {
      low: 7_518,
      high: 7_530,
      executionPrice: 7_526,
      spreadPoints: 2.1,
      at: "2026-09-24T13:32:00Z",
    }).state,
    "DISCARDED_SPREAD",
  );
  assert.equal(
    fillBertoPending(pending, {
      low: 7_518,
      high: 7_530,
      executionPrice: 7_528.01,
      spreadPoints: 1,
      at: "2026-09-24T13:32:00Z",
    }).state,
    "DISCARDED_CHASE",
  );
  const open = fillBertoPending(pending, {
    low: 7_518,
    high: 7_526,
    executionPrice: 7_526,
    spreadPoints: 1,
    at: "2026-09-24T13:32:00Z",
  });
  assert.equal(open.state, "POSITION_OPEN");
  assert.equal(open.currentStop, 7_513);
});

test("trailing uses closed M1 candles, activates beyond level plus twenty and has no fixed TP", () => {
  const pending = evaluateFirstTouch(
    { price: 7_518, state: "ARMED" },
    {
      low: 7_517,
      high: 7_519,
      previousClose: 7_516,
      at: "2026-09-24T13:31:00Z",
    },
    "LONG",
  );
  const open = fillBertoPending(pending, {
    low: 7_518,
    high: 7_526,
    at: "2026-09-24T13:32:00Z",
  });
  const inactive = evaluateBertoPositionExit(open, {
    low: 7_520,
    high: 7_538,
    at: "2026-09-24T13:33:00Z",
  });
  assert.equal(inactive.currentStop, 7_513);
  const trailed = evaluateBertoPositionExit(inactive, {
    low: 7_530,
    high: 7_543,
    at: "2026-09-24T13:34:00Z",
  });
  assert.equal(trailed.currentStop, 7_518);
  const stopped = evaluateBertoPositionExit(trailed, {
    low: 7_518,
    high: 7_540,
    at: "2026-09-24T13:35:00Z",
  });
  assert.equal(stopped.state, "CLOSED_STOP_LOSS");
  assert.equal(stopped.pnlPoints, -8);
});

test("risk sizing uses strategy balance, floors to lot step and rejects dangerous minimum lot", () => {
  assert.equal(
    calculateRiskSizedLots({
      balance: 5_000,
      riskPerLot: 50,
      minimumLot: 0.01,
      lotStep: 0.01,
      brokerMaximumLot: 100,
    }),
    2,
  );
  assert.equal(
    calculateRiskSizedLots({
      balance: 1_000,
      riskPerLot: 5_000,
      minimumLot: 0.1,
      lotStep: 0.1,
      brokerMaximumLot: 100,
    }),
    0,
  );
});

test("regular and half-day close are final and prevent post-session fills", () => {
  const pending = evaluateFirstTouch(
    { price: 7_518, state: "ARMED" },
    {
      low: 7_517,
      high: 7_519,
      previousClose: 7_516,
      at: "2026-09-24T13:31:00Z",
    },
    "LONG",
  );
  const open = fillBertoPending(pending, {
    low: 7_518,
    high: 7_526,
    at: "2026-09-24T13:32:00Z",
  });
  assert.deepEqual(
    closeBertoSession([pending], "2026-09-24T19:54:00Z", 7_520),
    [pending],
  );
  const closed = closeBertoSession(
    [pending, open],
    "2026-09-24T19:55:00Z",
    7_520,
  );
  assert.deepEqual(
    closed.map((x) => x.state),
    ["CANCELLED_SESSION_END", "CLOSED_FORCED"],
  );
  const half = closeBertoSession(
    [open],
    "2026-09-24T16:55:00Z",
    7_520,
    "HALF_DAY",
  );
  assert.equal(half[0]?.state, "CLOSED_FORCED");
  assert.equal(
    fillBertoPending(closed[0]!, {
      low: 7_500,
      high: 7_540,
      at: "2026-09-24T19:56:00Z",
    }),
    closed[0],
  );
});

test("comparison lab keeps equal capital, isolated metrics and SHADOW-only Berto", () => {
  const trades = [
    {
      strategy: "FIVE_BRAINS_STRATEGY" as const,
      openedAt: "2026-01-02T15:00:00Z",
      closedAt: "2026-01-02T16:00:00Z",
      initialCapital: 5_000,
      netPnl: 100,
      riskAmount: 50,
      fees: 2,
      slippage: 1,
    },
    {
      strategy: "BERTO_GOLDEN_SETUP" as const,
      openedAt: "2026-01-03T15:00:00Z",
      closedAt: "2026-01-03T16:00:00Z",
      initialCapital: 5_000,
      netPnl: -50,
      riskAmount: 50,
      fees: 2,
      slippage: 1,
    },
  ];
  const snapshot = buildComparisonSnapshot(5_000, trades);
  assert.equal(snapshot.strategies.FIVE_BRAINS_STRATEGY.finalCapital, 5_100);
  assert.equal(snapshot.strategies.BERTO_GOLDEN_SETUP.finalCapital, 4_950);
  assert.equal(snapshot.isolatedPortfolios, true);
  assert.equal(snapshot.decisionCrossInfluence, false);
  assert.equal(BERTO_RULES.executionEnabled, false);
  assert.equal(BERTO_RULES.version, "4.50.0");
  const metrics = calculateMetrics(
    5_000,
    trades.filter((x) => x.strategy === "BERTO_GOLDEN_SETUP"),
  );
  assert.equal(metrics.closedTrades, 1);
});

test("comparison metrics remain independent from BERTO rules", () => {
  const metrics = calculateMetrics(5_000, [
    { strategy: "BERTO_GOLDEN_SETUP", openedAt: "2026-09-01T14:00:00Z", closedAt: "2026-09-01T15:00:00Z", initialCapital: 5_000, netPnl: 100, riskAmount: 50, fees: 2, slippage: 1 },
    { strategy: "BERTO_GOLDEN_SETUP", openedAt: "2026-09-02T14:00:00Z", closedAt: "2026-09-02T15:00:00Z", initialCapital: 5_000, netPnl: -50, riskAmount: 50, fees: 2, slippage: 1 },
  ]);
  assert.equal(metrics.closedTrades, 2);
  assert.equal(metrics.finalCapital, 5_050);
  assert.equal(metrics.winRatePct, 50);
  assert.equal(metrics.profitFactor, 2);
});
