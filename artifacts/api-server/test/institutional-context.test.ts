import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateInstitutionalContext,
  type InstitutionalContextInput,
} from "../src/lib/institutionalContext";
import { evaluateMasterDecision } from "../src/lib/masterDecisionEngine";

const primaryLineage = {
  provider: "test-primary",
  observedAt: "2026-01-01T00:00:00.000Z",
  quality: "PRIMARY" as const,
};

const validContext: InstitutionalContextInput = {
  cot: {
    netPosition: 100,
    previousNetPosition: 50,
    percentile5y: 70,
    openInterest: 1_000,
    ageHours: 24,
    lineage: primaryLineage,
  },
  seasonality: {
    meanReturnPct: 2,
    medianReturnPct: 1,
    positiveRatePct: 65,
    sampleSize: 40,
    dispersionPct: 4,
    regimeSimilarity: 70,
    lineage: primaryLineage,
  },
  fairValue: {
    model: "test-fair-value",
    currentPrice: 100,
    fairValue: 110,
    uncertaintyPct: 8,
    ageHours: 12,
    lineage: primaryLineage,
  },
  macroRegime: {
    regime: "RISK_ON",
    directionalScore: 75,
    confidence: 80,
    ageHours: 12,
    lineage: [primaryLineage],
  },
};

const staleContext: InstitutionalContextInput = {
  ...validContext,
  cot: { ...validContext.cot!, ageHours: 240 },
  fairValue: { ...validContext.fairValue!, ageHours: 200 },
  macroRegime: { ...validContext.macroRegime!, ageHours: 100 },
};

const extremeContext: InstitutionalContextInput = {
  cot: {
    netPosition: Number.MAX_VALUE,
    previousNetPosition: -Number.MAX_VALUE,
    percentile5y: Number.MAX_VALUE,
    openInterest: Number.MIN_VALUE,
    ageHours: 0,
    lineage: primaryLineage,
  },
  seasonality: {
    meanReturnPct: Number.MAX_VALUE,
    medianReturnPct: -Number.MAX_VALUE,
    positiveRatePct: Number.MAX_VALUE,
    sampleSize: Number.MAX_SAFE_INTEGER,
    dispersionPct: Number.MIN_VALUE,
    regimeSimilarity: -Number.MAX_VALUE,
    lineage: primaryLineage,
  },
  fairValue: {
    model: "test-extreme",
    currentPrice: Number.MIN_VALUE,
    fairValue: Number.MAX_VALUE,
    uncertaintyPct: Number.MIN_VALUE,
    ageHours: 0,
    lineage: primaryLineage,
  },
  macroRegime: {
    regime: "MIXED",
    directionalScore: -Number.MAX_VALUE,
    confidence: Number.MAX_VALUE,
    ageHours: 0,
    lineage: [primaryLineage],
  },
};

test("institutional evaluator returns SHADOW output and component health", () => {
  const result = evaluateInstitutionalContext(validContext);

  assert.equal(result.mode, "SHADOW");
  assert.notEqual(result.score, null);
  assert.ok(result.confidence > 0);
  assert.equal(result.components.cot.health, "OK");
  assert.equal(result.components.seasonality.health, "OK");
  assert.equal(result.components.fairValue.health, "OK");
  assert.equal(result.components.macroRegime.health, "OK");
});

test("institutional evaluator marks stale dated sources unavailable", () => {
  const result = evaluateInstitutionalContext(staleContext);

  assert.equal(result.mode, "SHADOW");
  assert.equal(result.components.cot.health, "STALE");
  assert.equal(result.components.cot.score, null);
  assert.equal(result.components.fairValue.health, "STALE");
  assert.equal(result.components.fairValue.score, null);
  assert.equal(result.components.macroRegime.health, "STALE");
  assert.equal(result.components.macroRegime.score, null);
  assert.equal(result.components.seasonality.health, "OK");
  assert.ok(result.warnings.length > 0);
});

test("institutional evaluator clamps extreme finite observations", () => {
  const result = evaluateInstitutionalContext(extremeContext);

  assert.equal(result.mode, "SHADOW");
  assert.ok(result.score !== null && result.score >= 0 && result.score <= 100);
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
  for (const component of Object.values(result.components)) {
    if (component.score !== null) assert.ok(component.score >= 0 && component.score <= 100);
    assert.ok(component.confidence >= 0 && component.confidence <= 100);
  }
});

test("institutional context is observational for ordinary and vetoed decisions", () => {
  const cases = [
    {
      horizon: "swing" as const,
      technical: { score: 84, confidence: 86 },
      macroNews: { score: 76, confidence: 78 },
      safety: { brokerConnected: true, dataHealth: "OK" as const },
    },
    {
      horizon: "intraday" as const,
      technical: { score: 90, confidence: 90 },
      macroNews: { score: 85, confidence: 80 },
      safety: { dailyLossPct: 4.2, brokerConnected: true, dataHealth: "OK" as const },
    },
  ];

  for (const baseInput of cases) {
    const absent = evaluateMasterDecision(baseInput);
    for (const context of [validContext, staleContext, extremeContext]) {
      const observed = evaluateMasterDecision({ ...baseInput, institutionalContext: context });
      const { institutionalContext: _absentContext, ...withoutContext } = absent;
      const { institutionalContext: _observedContext, ...withContext } = observed;
      assert.deepEqual(withContext, withoutContext);
      assert.equal(observed.institutionalContext?.mode, "SHADOW");
    }
  }
});