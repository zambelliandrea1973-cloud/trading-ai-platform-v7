import assert from "node:assert/strict";
import test from "node:test";
import {
  BERTO_RULES,
  buildBertoOrders,
  buildLevels,
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

test("a red QQQ candle creates an active SHORT shadow plan; a doji suspends it", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 723.18, close: 723.99 },
    7_529.55,
  );
  assert.equal(plan.active, true);
  assert.equal(plan.direction, "SHORT");
  assert.equal(plan.qqqCandleGreen, false);
  assert.equal(plan.suspensionReason, undefined);
  assert(plan.levels.length > 0);
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.decisionInfluence, false);

  const doji = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 723.18, close: 724 },
    7_529.55,
  );
  assert.equal(doji.active, false);
  assert.equal(doji.direction, "NONE");
  assert.equal(doji.suspensionReason, "QQQ_PREVIOUS_CANDLE_DOJI");
});

test("QQQ suffix extraction and circular de-clustering follow the fixed rules", () => {
  assert.equal(centSuffix(724.18), 18);
  assert.equal(centSuffix(737.62), 62);
  assert.deepEqual(declusterSuffixes([61, 69]), [61]);
  assert.deepEqual(declusterSuffixes([98, 3]), [3]);
  assert.deepEqual(declusterSuffixes([18, 62]), [18, 62]);
});

test("level grid includes levels on both sides of the session open without a distance cutoff", () => {
  const levels = buildLevels(7_529.55, [18, 62], 3);
  assert.deepEqual(
    levels.map((level) => level.price),
    [7_218, 7_262, 7_318, 7_362, 7_418, 7_462, 7_518, 7_562, 7_618, 7_662, 7_718, 7_762, 7_818, 7_862],
  );
  assert(levels.some((level) => level.price < 7_529.55));
  assert(levels.some((level) => level.price > 7_529.55));
  assert(levels.every((level) => level.distanceFromOpen === Number(Math.abs(level.price - 7_529.55).toFixed(6))));
  assert.equal(levels.find((level) => level.price === 7_518)?.distanceFromOpen, 11.55);
});

test("green QQQ candle creates a LONG shadow-only Berto plan with Rome session rules", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 724.18, close: 735 },
    7_529.55,
    2,
  );

  assert.equal(plan.active, true);
  assert.equal(plan.direction, "LONG");
  assert.deepEqual(plan.rawSuffixes, [18, 62]);
  assert.deepEqual(plan.validSuffixes, [18, 62]);
  assert.deepEqual(
    [plan.rules.contracts, plan.rules.breakoutPoints, plan.rules.stopOffsetPoints, plan.rules.takeProfitOffsetPoints],
    [1, 8, 5, 30],
  );
  assert.equal(plan.rules.timezone, "Europe/Rome");
  assert.equal(plan.rules.entryWindowStart, "15:30");
  assert.equal(plan.rules.forcedExit, "21:55");
  assert.equal(plan.mode, "SHADOW");
  assert.equal(plan.executionEnabled, false);
});

test("a pre-window crossing leaves a level armed, while a 15:30 Rome crossing discards it", () => {
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
  assert.equal(discarded.firstTouchedAt, "2026-09-24T13:30:00.000Z");
  assert.equal(
    evaluateFirstTouch(discarded, { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" }, "LONG"),
    discarded,
  );
});

test("a valid LONG first touch creates a linked one-contract BUY STOP immediately", () => {
  const pending = evaluateFirstTouch(
    { price: 7_462, state: "ARMED" },
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" },
    "LONG",
  );
  assert.equal(pending.state, "PENDING_STOP");
  assert.equal(pending.firstTouchedAt, "2026-09-24T13:31:00.000Z");
  assert.deepEqual(pending.order, {
    direction: "LONG",
    kind: "STOP",
    contracts: 1,
    entryStop: 7_470,
    stopLoss: 7_457,
    takeProfit: 7_492,
  });
  assert.equal(fillBertoPending(pending, { low: 7_461, high: 7_470, at: "2026-09-24T13:31:00.000Z" }), pending);
  const open = fillBertoPending(pending, { low: 7_463, high: 7_470, at: "2026-09-24T13:32:00.000Z" });
  assert.equal(open.state, "POSITION_OPEN");
  assert.equal(open.positionOpenedAt, "2026-09-24T13:32:00.000Z");
  assert.equal(evaluateFirstTouch(open, { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:33:00.000Z" }, "LONG"), open);

  const wrongApproach = evaluateFirstTouch(
    { price: 7_462, state: "ARMED" },
    { low: 7_461, high: 7_463, previousClose: 7_464, at: "2026-09-24T13:31:00.000Z" },
    "LONG",
  );
  assert.equal(wrongApproach.state, "DISCARDED_WRONG_APPROACH");
  assert.equal(wrongApproach.order, undefined);

  const expired = evaluateFirstTouch(
    { price: 7_362, state: "ARMED" },
    { low: 7_499, high: 7_501, previousClose: 7_498, at: "2026-09-24T19:55:00.000Z" },
    "LONG",
  );
  assert.equal(expired.state, "EXPIRED");
});

test("a SHORT plan creates a one-contract SELL STOP from above and rejects an approach from below", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 723.18, close: 723.99 },
    7_529.55,
  );
  assert.equal(plan.direction, "SHORT");
  assert.equal(plan.mode, "SHADOW");
  assert.equal(plan.executionEnabled, false);
  const level = plan.levels.find((candidate) => candidate.price === 7_462);
  assert(level);

  const pending = evaluateFirstTouch(
    level,
    { low: 7_461, high: 7_463, previousClose: 7_464, at: "2026-09-24T13:31:00.000Z" },
    plan.direction,
  );
  assert.equal(pending.state, "PENDING_STOP");
  assert.equal(pending.firstTouchedAt, "2026-09-24T13:31:00.000Z");
  assert.deepEqual(pending.order, {
    direction: "SHORT",
    kind: "STOP",
    contracts: 1,
    entryStop: 7_454,
    stopLoss: 7_467,
    takeProfit: 7_432,
  });
  assert.deepEqual(buildBertoOrders(pending.price, plan.direction), pending.order);
  assert.equal(fillBertoPending(pending, { low: 7_455, high: 7_464, at: "2026-09-24T13:32:00.000Z" }), pending);
  const open = fillBertoPending(pending, { low: 7_454, high: 7_464, at: "2026-09-24T13:33:00.000Z" });
  assert.equal(open.state, "POSITION_OPEN");
  assert.equal(open.positionOpenedAt, "2026-09-24T13:33:00.000Z");

  const wrongApproach = evaluateFirstTouch(
    level,
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" },
    plan.direction,
  );
  assert.equal(wrongApproach.state, "DISCARDED_WRONG_APPROACH");
  assert.equal(wrongApproach.firstTouchedAt, "2026-09-24T13:31:00.000Z");
  assert.equal(wrongApproach.order, undefined);
});

test("BERTO entry and expiry follow Rome daylight saving time across both clock changes", () => {
  // Weekdays immediately before and after the 2026 spring and autumn clock changes.
  const sessions = [
    { date: "2026-03-27", offset: "CET (UTC+1)", entryUtc: "14:30", exitUtc: "20:55" },
    { date: "2026-03-30", offset: "CEST (UTC+2)", entryUtc: "13:30", exitUtc: "19:55" },
    { date: "2026-10-23", offset: "CEST (UTC+2)", entryUtc: "13:30", exitUtc: "19:55" },
    { date: "2026-10-26", offset: "CET (UTC+1)", entryUtc: "14:30", exitUtc: "20:55" },
  ] as const;
  const level = { price: 7_462, state: "ARMED" as const };
  const candleAt = (at: string, direction: "LONG" | "SHORT") => ({
    low: 7_461,
    high: 7_463,
    previousClose: direction === "SHORT" ? 7_464 : 7_460,
    at,
  });
  const minuteBefore = (iso: string) => new Date(Date.parse(iso) - 60_000).toISOString();
  const minuteAfter = (iso: string) => new Date(Date.parse(iso) + 60_000).toISOString();

  for (const { date, offset, entryUtc, exitUtc } of sessions) {
    const entry = `${date}T${entryUtc}:00.000Z`;
    const exit = `${date}T${exitUtc}:00.000Z`;
    const context = `${date} ${offset}`;
    const romeTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    assert.equal(romeTime.format(new Date(entry)), "15:30", `${context} entry UTC mapping`);
    assert.equal(romeTime.format(new Date(exit)), "21:55", `${context} exit UTC mapping`);

    for (const direction of ["LONG", "SHORT"] as const) {
      const caseContext = `${context} ${direction}`;
      const beforeEntry = evaluateFirstTouch(level, candleAt(minuteBefore(entry), direction), direction);
      assert.equal(beforeEntry.state, "ARMED", `${caseContext} 15:29 crossing`);
      const atEntry = evaluateFirstTouch(beforeEntry, candleAt(entry, direction), direction);
      assert.equal(atEntry.state, "DISCARDED_1530_TOUCH", `${caseContext} 15:30 crossing`);
      assert.equal(atEntry.firstTouchedAt, entry, `${caseContext} discarded at 15:30`);
      assert.equal(evaluateFirstTouch(atEntry, candleAt(minuteAfter(entry), direction), direction), atEntry);

      const outsideAtEntry = direction === "LONG"
        ? { low: 7_459, high: 7_461, previousClose: 7_460, at: entry }
        : { low: 7_463, high: 7_465, previousClose: 7_464, at: entry };
      const stillArmed = evaluateFirstTouch(level, outsideAtEntry, direction);
      assert.deepEqual(stillArmed, level, `${caseContext} 15:30 candle outside level stays ARMED without a touch timestamp`);
      const laterTouch = evaluateFirstTouch(stillArmed, candleAt(minuteAfter(entry), direction), direction);
      assert.equal(laterTouch.state, "PENDING_STOP", `${caseContext} untouched level can be touched at 15:31`);
      assert.equal(laterTouch.firstTouchedAt, minuteAfter(entry), `${caseContext} first touch is recorded at 15:31`);
      assert.equal(laterTouch.order?.direction, direction, `${caseContext} correct pending STOP direction`);

      const afterEntry = evaluateFirstTouch(level, candleAt(minuteAfter(entry), direction), direction);
      assert.equal(afterEntry.state, "PENDING_STOP", `${caseContext} 15:31 approach`);
      assert.equal(afterEntry.firstTouchedAt, minuteAfter(entry), `${caseContext} first touch from ${direction === "SHORT" ? "above" : "below"}`);

      const beforeExit = evaluateFirstTouch(level, candleAt(minuteBefore(exit), direction), direction);
      assert.equal(beforeExit.state, "PENDING_STOP", `${caseContext} 21:54 approach`);
      assert.equal(beforeExit.firstTouchedAt, minuteBefore(exit), `${caseContext} 21:54 first touch`);
      assert.equal(evaluateFirstTouch(level, candleAt(exit, direction), direction).state, "EXPIRED", `${caseContext} 21:55 crossing`);
      assert.equal(evaluateFirstTouch(level, candleAt(minuteAfter(exit), direction), direction).state, "EXPIRED", `${caseContext} 21:56 crossing`);
    }
  }
});

test("LONG and SHORT positions close at their linked SL or TP; simultaneous barriers count as SL", () => {
  for (const direction of ["LONG", "SHORT"] as const) {
    const pending = evaluateFirstTouch(
      { price: 7_462, state: "ARMED" },
      { low: 7_461, high: 7_463, previousClose: direction === "LONG" ? 7_460 : 7_464, at: "2026-09-24T13:31:00.000Z" },
      direction,
    );
    const open = fillBertoPending(pending, {
      low: direction === "LONG" ? 7_463 : 7_454,
      high: direction === "LONG" ? 7_470 : 7_461,
      at: "2026-09-24T13:32:00.000Z",
    });
    assert.equal(open.state, "POSITION_OPEN");
    assert.equal(evaluateBertoPositionExit(open, { low: 7_430, high: 7_495, at: "2026-09-24T13:32:00.000Z" }), open, "no same-candle exit");
    assert(open.order);
    const stop = evaluateBertoPositionExit(open, {
      low: direction === "LONG" ? open.order.stopLoss : 7_440,
      high: direction === "SHORT" ? open.order.stopLoss : 7_460,
      at: "2026-09-24T13:33:00.000Z",
    });
    assert.equal(stop.state, "CLOSED_STOP_LOSS");
    assert.equal(stop.pnlPoints, -13);
    assert.equal(stop.exitPrice, open.order.stopLoss);
    const profit = evaluateBertoPositionExit(open, {
      low: direction === "SHORT" ? open.order.takeProfit : 7_470,
      high: direction === "LONG" ? open.order.takeProfit : 7_454,
      at: "2026-09-24T13:33:00.000Z",
    });
    assert.equal(profit.state, "CLOSED_TAKE_PROFIT");
    assert.equal(profit.pnlPoints, 22);
    assert.equal(profit.exitPrice, open.order.takeProfit);
    assert.equal(evaluateBertoPositionExit(open, { low: 7_430, high: 7_495, at: "2026-09-24T13:33:00.000Z" }).state, "CLOSED_STOP_LOSS");
    assert.equal(evaluateBertoPositionExit(stop, { low: 7_430, high: 7_495, at: "2026-09-24T13:34:00.000Z" }), stop);
  }
});

test("unfilled pending orders are cancelled and open positions are closed at market at 21:55 Rome", () => {
  const at = "2026-09-24T19:55:00.000Z";
  const pending = evaluateFirstTouch(
    { price: 7_462, state: "ARMED" },
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" },
    "LONG",
  );
  assert.equal(fillBertoPending(pending, { low: 7_463, high: 7_469, at: "2026-09-24T13:32:00.000Z" }), pending);
  const shortPending = evaluateFirstTouch(
    { price: 7_562, state: "ARMED" },
    { low: 7_561, high: 7_563, previousClose: 7_564, at: "2026-09-24T13:31:00.000Z" },
    "SHORT",
  );
  const open = fillBertoPending(shortPending, { low: 7_554, high: 7_560, at: "2026-09-24T13:32:00.000Z" });
  assert.equal(open.state, "POSITION_OPEN");
  const levels = [pending, open, { price: 7_662, state: "ARMED" as const }];
  assert.equal(closeBertoSession(levels, "2026-09-24T19:54:00.000Z", 7_550), levels);
  const closed = closeBertoSession(levels, at, 7_550);
  assert.deepEqual(closed.map((level) => level.state), ["CANCELLED_2155", "CLOSED_FORCED", "EXPIRED"]);
  assert.equal(closed[0]?.closedAt, at);
  assert.equal(closed[1]?.exitPrice, 7_550);
  assert.equal(closed[1]?.pnlPoints, 4);
  assert.deepEqual(closeBertoSession(closed, at, 7_550), closed, "session close is idempotent");
  assert.equal(fillBertoPending(closed[0]!, { low: 7_460, high: 7_480, at }), closed[0], "cancelled pending cannot reopen");
  assert.equal(evaluateBertoPositionExit(closed[1]!, { low: 7_430, high: 7_580, at }), closed[1], "forced close is final");
});

test("no pending STOP fills or SL/TP exits at or after 21:55 in CET and CEST", () => {
  const sessions = [
    { date: "2026-03-27", exitUtc: "20:55" },
    { date: "2026-03-30", exitUtc: "19:55" },
    { date: "2026-10-23", exitUtc: "19:55" },
    { date: "2026-10-26", exitUtc: "20:55" },
  ] as const;
  for (const { date, exitUtc } of sessions) {
    const at = `${date}T${exitUtc}:00.000Z`;
    const firstTouchedAt = new Date(Date.parse(at) - 120_000).toISOString();
    const filledAt = new Date(Date.parse(at) - 60_000).toISOString();
    const pending = {
      price: 7_462, state: "PENDING_STOP" as const, firstTouchedAt,
      order: buildBertoOrders(7_462, "LONG"),
    };
    const open = fillBertoPending(pending, { low: 7_463, high: 7_470, at: filledAt });
    assert.equal(open.state, "POSITION_OPEN");
    for (const blockedAt of [at, new Date(Date.parse(at) + 60_000).toISOString(), new Date(Date.parse(at) + 18 * 60 * 60_000).toISOString()]) {
      assert.equal(fillBertoPending(pending, { low: 7_450, high: 7_490, at: blockedAt }), pending);
      assert.equal(evaluateBertoPositionExit(open, { low: 7_450, high: 7_495, at: blockedAt }), open);
    }
    assert.deepEqual(closeBertoSession([pending, open], at, 7_468).map((level) => level.state), ["CANCELLED_2155", "CLOSED_FORCED"]);
  }
});

test("BERTO refuses fills without a session anchor or before the first touch", () => {
  const at = "2026-09-24T13:32:00.000Z";
  const unanchored = { price: 7_462, state: "PENDING_STOP" as const, order: buildBertoOrders(7_462, "LONG") };
  assert.equal(fillBertoPending(unanchored, { low: 7_463, high: 7_470, at }), unanchored);
  const pending = { ...unanchored, firstTouchedAt: "2026-09-24T13:33:00.000Z" };
  assert.equal(fillBertoPending(pending, { low: 7_463, high: 7_470, at }), pending);
  assert.equal(fillBertoPending(pending, { low: 7_463, high: 7_470, at: "2026-09-25T13:34:00.000Z" }), pending);
  const openWithoutTime = { ...unanchored, state: "POSITION_OPEN" as const };
  assert.equal(evaluateBertoPositionExit(openWithoutTime, { low: 7_457, high: 7_492, at }), openWithoutTime);
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
