import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAxiProtection, evaluateCrashSentinel, rankOpportunities, championChallengerDecision } from "../src/lib/v72PerformanceEngine";
import { bullBearResearchJudge, allocatePortfolio, evaluateDataIntegrity } from "../src/lib/v72AdvancedAgents";
import { refreshAxiRules } from "../src/lib/axiRulesSentinel";

test("Axi target reached does not stop trading: activates profit lock with non-zero size", () => {
  const result = evaluateAxiProtection({
    stage: "SEED",
    allocationStartBalance: 5000,
    allocationEquity: 5375,
    closedTrades: 25,
    stageDays: 35,
    edgeScore: 62,
    accountEquityUsd: 1200,
    monthStartEquity: 5000,
    currentEquity: 5375,
    peakMonthlyProfitPct: 7.5,
  });
  assert.equal(result.targetReached, true);
  assert.equal(result.mode, "PROFIT_LOCK_ACTIVE");
  assert.ok(result.baseSizeMultiplier > 0 && result.baseSizeMultiplier <= 0.6);
});

test("profit give-back increases prudence without forcing zero exposure", () => {
  const result = evaluateAxiProtection({
    stage: "SEED",
    allocationStartBalance: 5000,
    allocationEquity: 5350,
    closedTrades: 24,
    monthStartEquity: 5000,
    currentEquity: 5250,
    peakMonthlyProfitPct: 7.5,
  });
  assert.equal(result.mode, "CAPITAL_PRESERVATION");
  assert.ok(result.baseSizeMultiplier > 0);
  assert.ok(result.baseSizeMultiplier <= 0.25);
});

test("crash sentinel switches to crisis on broad systemic stress", () => {
  const result = evaluateCrashSentinel({
    vixZ: 3,
    realizedVolZ: 3,
    creditSpreadZ: 3,
    breadthPct: 12,
    crossAssetCorrelation: 0.92,
    liquidityStress: 90,
    spreadShockMultiple: 3.5,
    geopoliticalSeverity: 85,
    safeHavenConfirmation: 85,
  });
  assert.equal(result.regime, "CRISIS");
  assert.ok(result.score >= 82);
});

test("ranker keeps a high-quality intraday BUY alive after target with micro-size", () => {
  const [result] = rankOpportunities([
    {
      symbol: "TEST",
      expectedReturnR: 1.8,
      expectedRiskR: 0.8,
      confidence: 84,
      liquidityScore: 90,
      executionCostR: 0.04,
      portfolioCorrelation: 0.2,
      sectorConcentrationPct: 10,
      masterInput: {
        horizon: "intraday",
        technical: { score: 86, confidence: 88 },
        macroNews: { score: 78, confidence: 80 },
        statistical: { correlation: 0.8, historicalCorrelation: 0.75, zScore: 1.8, cointegrationPValue: 0.03, breadthConfirmation: 85, directionalBias: "BULLISH" },
        safety: { riskScore: 40, dataHealth: "OK", brokerConnected: true },
      },
    },
  ], {
    stage: "SEED",
    allocationStartBalance: 5000,
    allocationEquity: 5375,
    closedTrades: 25,
    monthStartEquity: 5000,
    currentEquity: 5375,
    peakMonthlyProfitPct: 7.5,
  }, { vixZ: 0.2, realizedVolZ: 0.1, breadthPct: 65, liquidityStress: 20 });
  assert.equal(result.decision, "BUY");
  assert.ok(result.sizeMultiplier > 0);
  assert.equal(result.protectionMode, "PROFIT_LOCK_ACTIVE");
});

test("bull/bear judge reduces size for mixed evidence instead of blocking", () => {
  const result = bullBearResearchJudge({ technicalScore: 80, macroScore: 70, fundamentalScore: 82, statisticalScore: 76, riskScore: 70, eventRisk: 75, priceExtensionAtr: 2.7 });
  assert.equal(result.verdict, "MIXED");
  assert.ok(result.sizeAdjustment > 0 && result.sizeAdjustment < 1);
});

test("portfolio allocation caps correlated and concentrated risk", () => {
  const result = allocatePortfolio([
    { symbol: "A", opportunityScore: 90, requestedRiskPct: 1.5, sector: "TECH", correlationToPortfolio: 0.9 },
    { symbol: "B", opportunityScore: 85, requestedRiskPct: 1.5, sector: "TECH", correlationToPortfolio: 0.8 },
    { symbol: "C", opportunityScore: 80, requestedRiskPct: 1.2, sector: "GOLD", correlationToPortfolio: 0.1 },
  ], 3, 1.2);
  assert.ok(result.totalRiskPct <= 3);
  const techRisk = result.allocations.filter((x) => x.symbol === "A" || x.symbol === "B").reduce((s, x) => s + x.allocatedRiskPct, 0);
  assert.ok(techRisk <= 1.2);
});

test("data integrity guard detects stale data and bias risks", () => {
  const result = evaluateDataIntegrity({ marketTimestamp: "2020-01-01T00:00:00Z", corporateActionsApplied: false, survivorshipBiasControlled: false });
  assert.equal(result.status, "INVALID");
  assert.equal(result.pointInTimeSafe, false);
});

test("champion challenger promotes only robust superior challenger", () => {
  const result = championChallengerDecision(
    { expectancyR: 0.2, maxDrawdownPct: 5, deflatedSharpe: 0.8, pbo: 0.2 },
    { expectancyR: 0.25, maxDrawdownPct: 4.8, deflatedSharpe: 0.9, pbo: 0.2 },
  );
  assert.equal(result.promote, true);
});

test("Axi sentinel auto-updates only on two-source consensus", async () => {
  const html = "Seed Profit Target 8% Maximum Loss -6% Trades Per Stage 22 Stage Duration 35 Pro M Profit Target 10% Maximum Loss -10%";
  const fakeFetch = (async () => new Response(html, { status: 200 })) as typeof fetch;
  const result = await refreshAxiRules(fakeFetch);
  assert.equal(result.status, "UPDATED");
  assert.equal(result.activeRules.stages.SEED.profitTargetPct, 8);
  assert.equal(result.activeRules.stages.SEED.maxLossPct, 6);
  assert.equal(result.activeRules.stages.SEED.minTrades, 22);
  assert.equal(result.activeRules.stages.SEED.minDays, 35);
});
