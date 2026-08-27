import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMasterDecision } from "../src/lib/masterDecisionEngine";

const strongFundamentals = {
  price: 100,
  epsTtm: 5,
  epsForward: 6,
  expectedEpsGrowthPct: 20,
  revenueGrowthPct: 15,
  operatingMarginPct: 25,
  roePct: 22,
  debtToEquity: 0.5,
  sectorPeMedian: 25,
};

const strongStatistical = {
  correlation: 0.8,
  historicalCorrelation: 0.75,
  zScore: 1.8,
  cointegrationPValue: 0.03,
  leadLagStrength: 76,
  breadthConfirmation: 82,
  volatilityRatio: 1.1,
  directionalBias: "BULLISH" as const,
};

test("strong signal remains BUY under moderate soft guards", () => {
  const result = evaluateMasterDecision({
    horizon: "swing",
    technical: { score: 82, confidence: 84 },
    macroNews: { score: 74, confidence: 76 },
    fundamentals: strongFundamentals,
    statistical: strongStatistical,
    safety: { riskScore: 68, drawdownPct: 5.5, brokerConnected: true, dataHealth: "OK" },
  });

  assert.equal(result.decision, "BUY");
  assert.equal(result.hardVeto, false);
  assert.ok(result.sizeMultiplier > 0);
  assert.ok(result.sizeMultiplier < 1);
});

test("hard capital limit vetoes execution", () => {
  const result = evaluateMasterDecision({
    horizon: "intraday",
    technical: { score: 90, confidence: 90 },
    macroNews: { score: 85, confidence: 80 },
    fundamentals: strongFundamentals,
    statistical: strongStatistical,
    safety: { dailyLossPct: 4.2, brokerConnected: true, dataHealth: "OK" },
  });

  assert.equal(result.decision, "NO_TRADE");
  assert.equal(result.hardVeto, true);
  assert.equal(result.sizeMultiplier, 0);
});

test("missing optional brains are renormalized instead of blocking", () => {
  const result = evaluateMasterDecision({
    horizon: "intraday",
    technical: { score: 78, confidence: 80 },
    macroNews: { score: 72, confidence: 70 },
    safety: { brokerConnected: true, dataHealth: "OK", riskScore: 40 },
  });

  assert.equal(result.hardVeto, false);
  assert.equal(result.decision, "BUY");
  assert.ok(result.weightsUsed.technical > result.weightsUsed.macroNews);
});

test("high impact event reduces size but does not automatically veto", () => {
  const result = evaluateMasterDecision({
    horizon: "intraday",
    technical: { score: 88, confidence: 90 },
    macroNews: { score: 82, confidence: 85 },
    fundamentals: strongFundamentals,
    statistical: strongStatistical,
    safety: { minutesToHighImpactEvent: 5, brokerConnected: true, dataHealth: "OK", riskScore: 55 },
  });

  assert.equal(result.hardVeto, false);
  assert.equal(result.decision, "BUY");
  assert.ok(result.sizeMultiplier > 0);
  assert.ok(result.sizeMultiplier <= 0.5);
});
