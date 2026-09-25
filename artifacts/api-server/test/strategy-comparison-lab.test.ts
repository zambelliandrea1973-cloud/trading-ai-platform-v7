import assert from "node:assert/strict";
import test from "node:test";
import {
  BERTO_RULES, buildBertoOrders, buildLevels, centSuffix, closeBertoSession,
  createBertoDailyPlan, declusterSuffixes, evaluateBertoPositionExit,
  evaluateFirstTouch, fillBertoPending, getUsMarketSession,
} from "../src/lib/bertoGoldenSetup";
import { buildComparisonSnapshot, calculateMetrics } from "../src/lib/strategyComparisonLab";

const LEVEL = 7_518;
const LONG_TOUCH = (at: string) => ({ low: LEVEL - 1, high: LEVEL + 1, previousClose: LEVEL - 2, at });
const SHORT_TOUCH = (at: string) => ({ low: LEVEL - 1, high: LEVEL + 1, previousClose: LEVEL + 2, at });

test("latest BERTO configuration matches the confirmed rebuild", () => {
  assert.equal(BERTO_RULES.signalSourceUrl, "https://www.investing.com/etfs/powershares-qqqq");
  assert.equal(BERTO_RULES.marketTimezone, "America/New_York");
  assert.equal(BERTO_RULES.regularOpen, "09:30");
  assert.equal(BERTO_RULES.regularForcedExit, "15:55");
  assert.equal(BERTO_RULES.earlyCloseForcedExit, "12:55");
  assert.equal(BERTO_RULES.stopLossPointsFromEntry, 13);
  assert.equal(BERTO_RULES.takeProfitPointsFromEntry, 22);
  assert.equal(BERTO_RULES.maxLevelDistanceFromOpen, 50);
  assert.equal(BERTO_RULES.mode, "SHADOW");
  assert.equal(BERTO_RULES.executionEnabled, false);
  assert.equal(BERTO_RULES.decisionInfluence, false);
});

test("QQQ previous-day candle determines direction and doji suspends", () => {
  assert.equal(createBertoDailyPlan({ open: 724, high: 737.62, low: 724.18, close: 735 }, 7_529.55).direction, "LONG");
  assert.equal(createBertoDailyPlan({ open: 724, high: 737.62, low: 723.18, close: 723.99 }, 7_529.55).direction, "SHORT");
  const doji = createBertoDailyPlan({ open: 724, high: 737.62, low: 723.18, close: 724 }, 7_529.55);
  assert.equal(doji.active, false);
  assert.equal(doji.suspensionReason, "QQQ_PREVIOUS_CANDLE_DOJI");
});

test("QQQ suffix extraction and de-clustering remain deterministic", () => {
  assert.equal(centSuffix(724.18), 18);
  assert.equal(centSuffix(737.62), 62);
  assert.deepEqual(declusterSuffixes([61, 69]), [61]);
  assert.deepEqual(declusterSuffixes([98, 3]), [3]);
  assert.deepEqual(declusterSuffixes([18, 62]), [18, 62]);
});

test("levels farther than 50 points from US500 open are removed", () => {
  const levels = buildLevels(7_529.55, [18, 62], 3);
  assert(levels.length > 0);
  assert(levels.every((level) => level.distanceFromOpen <= 50));
  assert(levels.some((level) => level.price === 7_518));
  assert(levels.some((level) => level.price === 7_562));
  assert(!levels.some((level) => level.price === 7_462));
});

test("SL 13 and TP 22 are measured from breakout entry", () => {
  assert.deepEqual(buildBertoOrders(LEVEL, "LONG"), { direction: "LONG", kind: "STOP", contracts: 1, entryStop: 7_526, stopLoss: 7_513, takeProfit: 7_548 });
  assert.deepEqual(buildBertoOrders(LEVEL, "SHORT"), { direction: "SHORT", kind: "STOP", contracts: 1, entryStop: 7_510, stopLoss: 7_523, takeProfit: 7_488 });
});

test("US session stays anchored to New York across DST", () => {
  for (const at of ["2026-01-15T15:00:00.000Z", "2026-07-15T15:00:00.000Z"]) {
    const session = getUsMarketSession(at);
    assert.equal(session.closed, false);
    assert.equal(session.openMinute, 570);
    assert.equal(session.forcedExitMinute, 955);
  }
});

test("US holidays close BERTO and early-close sessions exit at 12:55 ET", () => {
  assert.equal(getUsMarketSession("2026-07-03T15:00:00.000Z").closed, true);
  assert.equal(getUsMarketSession("2026-12-25T15:00:00.000Z").closed, true);
  for (const at of ["2026-11-27T16:00:00.000Z", "2026-12-24T16:00:00.000Z"]) {
    const session = getUsMarketSession(at);
    assert.equal(session.earlyClose, true);
    assert.equal(session.forcedExitMinute, 775);
  }
});

test("opening candle touch is discarded and later correct LONG approach can arm", () => {
  const atOpen = evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, LONG_TOUCH("2026-09-24T13:30:00.000Z"), "LONG");
  assert.equal(atOpen.state, "DISCARDED_OPENING_CANDLE_TOUCH");
  const later = evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, LONG_TOUCH("2026-09-24T13:31:00.000Z"), "LONG");
  assert.equal(later.state, "PENDING_STOP");
  assert.equal(later.order?.entryStop, 7_526);
});

test("SHORT approach must come from above", () => {
  assert.equal(evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, SHORT_TOUCH("2026-09-24T13:31:00.000Z"), "SHORT").state, "PENDING_STOP");
  assert.equal(evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, LONG_TOUCH("2026-09-24T13:31:00.000Z"), "SHORT").state, "DISCARDED_WRONG_APPROACH");
});

test("pending order cannot fill on touch candle but can fill later", () => {
  const pending = evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, LONG_TOUCH("2026-09-24T13:31:00.000Z"), "LONG");
  assert.equal(fillBertoPending(pending, { low: LEVEL, high: 7_526, at: "2026-09-24T13:31:00.000Z" }), pending);
  assert.equal(fillBertoPending(pending, { low: LEVEL, high: 7_526, at: "2026-09-24T13:32:00.000Z" }).state, "POSITION_OPEN");
});

test("new SL/TP exits work and ambiguous candle is conservatively SL", () => {
  const pending = evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, LONG_TOUCH("2026-09-24T13:31:00.000Z"), "LONG");
  const opened = fillBertoPending(pending, { low: LEVEL, high: 7_526, at: "2026-09-24T13:32:00.000Z" });
  const tp = evaluateBertoPositionExit(opened, { low: 7_520, high: 7_548, at: "2026-09-24T13:33:00.000Z" });
  assert.equal(tp.state, "CLOSED_TAKE_PROFIT");
  assert.equal(tp.pnlPoints, 22);
  const ambiguous = evaluateBertoPositionExit(opened, { low: 7_513, high: 7_548, at: "2026-09-24T13:33:00.000Z" });
  assert.equal(ambiguous.state, "CLOSED_STOP_LOSS");
  assert.equal(ambiguous.pnlPoints, -13);
});

test("15:55 ET expires armed, cancels pending and force-closes open positions", () => {
  const pending = evaluateFirstTouch({ price: LEVEL, state: "ARMED" }, LONG_TOUCH("2026-09-24T13:31:00.000Z"), "LONG");
  const opened = fillBertoPending(pending, { low: LEVEL, high: 7_526, at: "2026-09-24T13:32:00.000Z" });
  const closed = closeBertoSession([{ price: LEVEL - 20, state: "ARMED" }, pending, opened], "2026-09-24T19:55:00.000Z", 7_530);
  assert.equal(closed[0].state, "EXPIRED");
  assert.equal(closed[1].state, "CANCELLED_SESSION_END");
  assert.equal(closed[2].state, "CLOSED_FORCED");
});

test("comparison remains isolated and shadow-only", () => {
  const snapshot = buildComparisonSnapshot(5_000, []);
  assert.equal(snapshot.mode, "SHADOW");
  assert.equal(snapshot.executionEnabled, false);
  assert.equal(snapshot.isolatedPortfolios, true);
  assert.equal(snapshot.decisionCrossInfluence, false);
  assert.equal(snapshot.bertoRules.version, BERTO_RULES.version);
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
