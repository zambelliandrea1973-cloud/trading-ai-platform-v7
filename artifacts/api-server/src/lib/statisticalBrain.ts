export type StatisticalInput = {
  correlation?: number | null;
  historicalCorrelation?: number | null;
  zScore?: number | null;
  cointegrationPValue?: number | null;
  leadLagStrength?: number | null;
  breadthConfirmation?: number | null;
  volatilityRatio?: number | null;
  correlationBreakdown?: boolean | null;
  directionalBias?: "BULLISH" | "BEARISH" | "NEUTRAL";
};

export type StatisticalBrainResult = {
  score: number | null;
  confidence: number;
  direction: "BUY" | "SELL" | "NEUTRAL" | "UNAVAILABLE";
  regime: "STABLE" | "DIVERGENCE" | "BREAKDOWN" | "INSUFFICIENT";
  rationale: string;
  warnings: string[];
  metrics: Record<string, number | boolean | string | null | undefined>;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function evaluateStatistical(input: StatisticalInput): StatisticalBrainResult {
  const warnings: string[] = [];
  const values: Array<[number, number]> = [];

  if (valid(input.correlation)) {
    const abs = Math.abs(input.correlation);
    values.push([clamp(50 + abs * 40), 0.15]);
  }

  if (valid(input.historicalCorrelation) && valid(input.correlation)) {
    const delta = Math.abs(input.correlation - input.historicalCorrelation);
    values.push([clamp(90 - delta * 80), 0.15]);
    if (delta > 0.45) warnings.push("Correlazione corrente molto diversa dal regime storico.");
  }

  if (valid(input.cointegrationPValue)) {
    const p = Math.max(0, input.cointegrationPValue);
    values.push([p <= 0.05 ? 90 : p <= 0.1 ? 72 : p <= 0.2 ? 52 : 30, 0.2]);
  }

  if (valid(input.zScore)) {
    const magnitude = Math.abs(input.zScore);
    values.push([magnitude >= 1.5 && magnitude <= 3.2 ? 82 : magnitude < 1.5 ? 55 : 38, 0.2]);
  }

  if (valid(input.leadLagStrength)) values.push([clamp(input.leadLagStrength), 0.1]);
  if (valid(input.breadthConfirmation)) values.push([clamp(input.breadthConfirmation), 0.15]);
  if (valid(input.volatilityRatio)) {
    const ratio = input.volatilityRatio;
    values.push([ratio <= 1.35 ? 80 : ratio <= 2 ? 58 : ratio <= 3 ? 38 : 20, 0.05]);
  }

  if (!values.length) {
    return {
      score: null,
      confidence: 0,
      direction: "UNAVAILABLE",
      regime: "INSUFFICIENT",
      rationale: "Dati statistici insufficienti.",
      warnings,
      metrics: { ...input },
    };
  }

  const totalWeight = values.reduce((sum, [, weight]) => sum + weight, 0);
  let score = values.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;

  const breakdown = input.correlationBreakdown === true;
  if (breakdown) {
    score = Math.min(score, 42);
    warnings.push("Correlation breakdown attivo: ridurre la size e richiedere conferme aggiuntive.");
  }

  const bias = input.directionalBias ?? "NEUTRAL";
  const direction = bias === "BULLISH" ? "BUY" : bias === "BEARISH" ? "SELL" : "NEUTRAL";
  const confidence = Math.round(clamp(totalWeight * 100));
  const regime = breakdown ? "BREAKDOWN" : valid(input.zScore) && Math.abs(input.zScore) >= 1.5 ? "DIVERGENCE" : "STABLE";

  return {
    score: Number(score.toFixed(1)),
    confidence,
    direction,
    regime,
    rationale: regime === "DIVERGENCE"
      ? "È presente una divergenza statisticamente interessante, da usare come conferma e non come segnale isolato."
      : regime === "BREAKDOWN"
        ? "Le relazioni storiche sono deteriorate: il segnale resta utilizzabile solo con size ridotta."
        : "Le relazioni statistiche risultano sufficientemente stabili per contribuire al punteggio finale.",
    warnings,
    metrics: { ...input },
  };
}
