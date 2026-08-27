import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFundamentals } from "../src/lib/fundamentalBrain";

test("calculates P/E, Forward P/E and PEG", () => {
  const result = evaluateFundamentals({
    price: 100,
    epsTtm: 5,
    epsForward: 6.25,
    expectedEpsGrowthPct: 25,
    revenueGrowthPct: 18,
    operatingMarginPct: 22,
    roePct: 24,
    debtToEquity: 0.5,
    sectorPeMedian: 24,
  });

  assert.equal(result.metrics.pe.value, 20);
  assert.equal(result.metrics.forwardPe.value, 16);
  assert.equal(result.metrics.peg.value, 0.8);
  assert.ok((result.score ?? 0) > 65);
  assert.ok(result.confidence >= 95);
});

test("does not fabricate valuation ratios when earnings are non-positive", () => {
  const result = evaluateFundamentals({
    price: 50,
    epsTtm: -1,
    epsForward: 0,
    expectedEpsGrowthPct: -5,
  });

  assert.equal(result.metrics.pe.value, null);
  assert.equal(result.metrics.forwardPe.value, null);
  assert.equal(result.metrics.peg.value, null);
  assert.ok(result.warnings.length >= 3);
});

test("reduces confidence when only partial fundamental data is available", () => {
  const result = evaluateFundamentals({
    price: 80,
    epsTtm: 4,
  });

  assert.equal(result.metrics.pe.value, 20);
  assert.ok(result.confidence < 30);
  assert.ok(result.warnings.some((warning) => warning.includes("Copertura dati")));
});
