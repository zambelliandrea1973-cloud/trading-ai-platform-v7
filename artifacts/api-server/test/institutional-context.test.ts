import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInstitutionalContext } from "../src/lib/institutionalContext";

const primary = { provider: "CFTC", observedAt: "2026-09-14T00:00:00Z", quality: "PRIMARY" as const };

test("combina solo componenti validi e resta shadow", () => {
  const result = evaluateInstitutionalContext({
    cot: { netPosition: 120, previousNetPosition: 100, percentile52w: 75, percentile5y: 70, openInterest: 1000, ageHours: 48, lineage: primary },
    seasonality: { meanReturnPct: 1.2, medianReturnPct: 0.9, positiveRatePct: 68, sampleSize: 20, dispersionPct: 2, regimeSimilarity: 70, lineage: { ...primary, provider: "MT5_HISTORY" } },
    fairValue: { model: "PPP_REAL_RATE", currentPrice: 100, fairValue: 105, uncertaintyPct: 8, ageHours: 24, lineage: { ...primary, provider: "FRED_ECB" } },
    macroRegime: { regime: "EASING", directionalScore: 65, confidence: 80, ageHours: 12, lineage: [{ ...primary, provider: "FRED" }, { ...primary, provider: "ECB" }] },
  });
  assert.equal(result.mode, "SHADOW");
  assert.ok(result.score !== null);
  assert.ok(result.confidence > 0);
});

test("rifiuta COT vecchio e stagionalita con campione insufficiente", () => {
  const result = evaluateInstitutionalContext({
    cot: { netPosition: 120, percentile52w: 80, ageHours: 250, lineage: primary },
    seasonality: { meanReturnPct: 2, medianReturnPct: 2, positiveRatePct: 90, sampleSize: 7, dispersionPct: 1, lineage: primary },
  });
  assert.equal(result.score, null);
  assert.equal(result.direction, "UNAVAILABLE");
});
