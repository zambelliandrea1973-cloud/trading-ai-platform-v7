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
    [plan.rules.breakoutPoints, plan.rules.retestPoints, plan.rules.stopOffsetPoints, plan.rules.takeProfitOffsetPoints],
    [8, 3, 5, 30],
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

test("a correct post-15:30 Rome approach touches, then breakout and retest fill; untouched levels expire at 21:55", () => {
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

  const wrongApproach = evaluateFirstTouch(
    { price: 7_462, state: "ARMED" },
    { low: 7_461, high: 7_463, previousClose: 7_464, at: "2026-09-24T13:31:00.000Z" },
    "LONG",
  );
  assert.equal(wrongApproach.state, "DISCARDED_WRONG_APPROACH");

  const expired = evaluateFirstTouch(
    { price: 7_362, state: "ARMED" },
    { low: 7_499, high: 7_501, previousClose: 7_498, at: "2026-09-24T19:55:00.000Z" },
    "LONG",
  );
  assert.equal(expired.state, "EXPIRED");
});

test("a SHORT plan touches from above, rejects an approach from below, and builds mirrored orders", () => {
  const plan = createBertoDailyPlan(
    { open: 724, high: 737.62, low: 723.18, close: 723.99 },
    7_529.55,
  );
  assert.equal(plan.direction, "SHORT");
  assert.equal(plan.mode, "SHADOW");
  assert.equal(plan.executionEnabled, false);
  const level = plan.levels.find((candidate) => candidate.price === 7_462);
  assert(level);

  const touched = evaluateFirstTouch(
    level,
    { low: 7_461, high: 7_463, previousClose: 7_464, at: "2026-09-24T13:31:00.000Z" },
    plan.direction,
  );
  assert.equal(touched.state, "TOUCHED");
  assert.equal(touched.firstTouchedAt, "2026-09-24T13:31:00.000Z");
  assert.deepEqual(buildBertoOrders(touched.price, plan.direction), {
    direction: "SHORT",
    breakoutStop: 7_454,
    retestLimit: 7_459,
    stopLoss: 7_467,
    takeProfit: 7_432,
  });
  const breakout = markBreakoutFilled(touched, "2026-09-24T13:32:00.000Z");
  assert.equal(breakout.state, "BREAKOUT_FILLED");
  const retest = markRetestFilled(breakout, "2026-09-24T13:33:00.000Z");
  assert.equal(retest.state, "RETEST_FILLED");

  const wrongApproach = evaluateFirstTouch(
    level,
    { low: 7_461, high: 7_463, previousClose: 7_460, at: "2026-09-24T13:31:00.000Z" },
    plan.direction,
  );
  assert.equal(wrongApproach.state, "DISCARDED_WRONG_APPROACH");
  assert.equal(wrongApproach.firstTouchedAt, "2026-09-24T13:31:00.000Z");
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
      assert.equal(laterTouch.state, "TOUCHED", `${caseContext} untouched level can be touched at 15:31`);
      assert.equal(laterTouch.firstTouchedAt, minuteAfter(entry), `${caseContext} first touch is recorded at 15:31`);

      const afterEntry = evaluateFirstTouch(level, candleAt(minuteAfter(entry), direction), direction);
      assert.equal(afterEntry.state, "TOUCHED", `${caseContext} 15:31 approach`);
      assert.equal(afterEntry.firstTouchedAt, minuteAfter(entry), `${caseContext} first touch from ${direction === "SHORT" ? "above" : "below"}`);

      const beforeExit = evaluateFirstTouch(level, candleAt(minuteBefore(exit), direction), direction);
      assert.equal(beforeExit.state, "TOUCHED", `${caseContext} 21:54 approach`);
      assert.equal(beforeExit.firstTouchedAt, minuteBefore(exit), `${caseContext} 21:54 first touch`);
      assert.equal(evaluateFirstTouch(level, candleAt(exit, direction), direction).state, "EXPIRED", `${caseContext} 21:55 crossing`);
      assert.equal(evaluateFirstTouch(level, candleAt(minuteAfter(exit), direction), direction).state, "EXPIRED", `${caseContext} 21:56 crossing`);
    }
  }
});

test("BERTO stops recording breakout and retest fills at 21:55 Rome time in CET and CEST", () => {
  const sessions = [
    { date: "2026-03-27", offset: "CET", exitUtc: "20:55" },
    { date: "2026-03-30", offset: "CEST", exitUtc: "19:55" },
    { date: "2026-10-23", offset: "CEST", exitUtc: "19:55" },
    { date: "2026-10-26", offset: "CET", exitUtc: "20:55" },
  ] as const;

  for (const { date, offset, exitUtc } of sessions) {
    const exit = `${date}T${exitUtc}:00.000Z`;
    const justBefore = new Date(Date.parse(exit) - 1).toISOString();
    const after = new Date(Date.parse(exit) + 60_000).toISOString();
    const context = `${date} ${offset}`;
    const touched = { price: 7_462, state: "TOUCHED" as const, firstTouchedAt: justBefore };
    const breakout = markBreakoutFilled(touched, justBefore);
    assert.deepEqual(breakout, { ...touched, state: "BREAKOUT_FILLED", breakoutFilledAt: justBefore }, `${context} breakout before exit`);
    const retest = markRetestFilled(breakout, justBefore);
    assert.deepEqual(retest, { ...breakout, state: "RETEST_FILLED", retestFilledAt: justBefore }, `${context} retest before exit`);

    for (const at of [exit, after]) {
      assert.equal(markBreakoutFilled(touched, at), touched, `${context} breakout blocked at ${at}`);
      assert.equal(markRetestFilled(breakout, at), breakout, `${context} retest blocked at ${at}`);
    }
    const nextSession = new Date(Date.parse(exit) + 18 * 60 * 60_000).toISOString();
    assert.equal(markBreakoutFilled(touched, nextSession), touched, `${context} no next-day breakout on stale touch`);
    assert.equal(markRetestFilled(breakout, nextSession), breakout, `${context} no next-day retest on stale breakout`);
  }
});

test("BERTO does not fill legacy states without a session timestamp", () => {
  const nextSession = "2026-09-25T13:32:00.000Z"; // 15:32 Rome, before the daily cutoff
  const sameSession = "2026-09-24T13:32:00.000Z";
  const legacyTouch = { price: 7_462, state: "TOUCHED" as const };
  const legacyBreakout = { price: 7_462, state: "BREAKOUT_FILLED" as const };

  for (const at of [sameSession, nextSession]) {
    assert.equal(markBreakoutFilled(legacyTouch, at), legacyTouch, `touch without time stays unchanged at ${at}`);
    assert.equal(markRetestFilled(legacyBreakout, at), legacyBreakout, `breakout without time stays unchanged at ${at}`);
  }

  const breakoutOnly = { ...legacyBreakout, breakoutFilledAt: sameSession };
  assert.deepEqual(markRetestFilled(breakoutOnly, sameSession), {
    ...breakoutOnly,
    state: "RETEST_FILLED",
    retestFilledAt: sameSession,
  }, "a legacy breakout with a timestamp can still fill during its own session");
  assert.equal(markRetestFilled(breakoutOnly, nextSession), breakoutOnly,
    "the breakout timestamp prevents a next-day retest even without a touch timestamp");

  const touchOnly = { ...legacyBreakout, firstTouchedAt: sameSession };
  assert.deepEqual(markRetestFilled(touchOnly, sameSession), {
    ...touchOnly,
    state: "RETEST_FILLED",
    retestFilledAt: sameSession,
  }, "a legacy breakout without its own timestamp can use its touch timestamp");
  assert.equal(markRetestFilled(touchOnly, nextSession), touchOnly,
    "the touch timestamp prevents a next-day retest when the breakout timestamp is missing");
});

test("BERTO rejects backdated fills but accepts equal or later timestamps", () => {
  const touched = {
    price: 7_462,
    state: "TOUCHED" as const,
    firstTouchedAt: "2026-09-24T13:31:30.500Z",
  };
  const earlier = "2026-09-24T13:31:30.499Z";
  assert.equal(markBreakoutFilled(touched, earlier), touched, "breakout before first touch leaves state unchanged");

  const equalBreakout = markBreakoutFilled(touched, touched.firstTouchedAt);
  assert.deepEqual(equalBreakout, {
    ...touched,
    state: "BREAKOUT_FILLED",
    breakoutFilledAt: touched.firstTouchedAt,
  });
  assert.equal(markRetestFilled(equalBreakout, earlier), equalBreakout, "retest before breakout leaves state unchanged");
  assert.deepEqual(markRetestFilled(equalBreakout, touched.firstTouchedAt), {
    ...equalBreakout,
    state: "RETEST_FILLED",
    retestFilledAt: touched.firstTouchedAt,
  });

  const laterBreakout = markBreakoutFilled(touched, "2026-09-24T13:32:00.000Z");
  assert.equal(laterBreakout.state, "BREAKOUT_FILLED");
  assert.equal(markRetestFilled(laterBreakout, touched.firstTouchedAt), laterBreakout,
    "retest after touch but before breakout leaves state unchanged");
  assert.deepEqual(markRetestFilled(laterBreakout, "2026-09-24T13:32:00.001Z"), {
    ...laterBreakout,
    state: "RETEST_FILLED",
    retestFilledAt: "2026-09-24T13:32:00.001Z",
  });
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
