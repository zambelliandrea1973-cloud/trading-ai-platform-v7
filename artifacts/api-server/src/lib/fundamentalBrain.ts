export type FundamentalInput = {
  price: number;
  epsTtm?: number | null;
  epsForward?: number | null;
  expectedEpsGrowthPct?: number | null;
  revenueGrowthPct?: number | null;
  operatingMarginPct?: number | null;
  roePct?: number | null;
  debtToEquity?: number | null;
  sectorPeMedian?: number | null;
};

export type FundamentalMetric = {
  value: number | null;
  score: number | null;
  label: "attractive" | "fair" | "expensive" | "strong" | "neutral" | "weak" | "unavailable";
};

export type FundamentalBrainResult = {
  score: number | null;
  confidence: number;
  direction: "BUY" | "NEUTRAL" | "CAUTION" | "UNAVAILABLE";
  metrics: {
    pe: FundamentalMetric;
    forwardPe: FundamentalMetric;
    peg: FundamentalMetric;
    epsGrowth: FundamentalMetric;
    revenueGrowth: FundamentalMetric;
    operatingMargin: FundamentalMetric;
    roe: FundamentalMetric;
    debtToEquity: FundamentalMetric;
  };
  rationale: string;
  warnings: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

function metricUnavailable(): FundamentalMetric {
  return { value: null, score: null, label: "unavailable" };
}

function metric(value: number | null, score: number | null, positiveLabels = false): FundamentalMetric {
  if (value === null || score === null || !Number.isFinite(value) || !Number.isFinite(score)) return metricUnavailable();
  const normalized = clamp(score);
  const label = positiveLabels
    ? normalized >= 70 ? "strong" : normalized >= 45 ? "neutral" : "weak"
    : normalized >= 70 ? "attractive" : normalized >= 45 ? "fair" : "expensive";
  return { value: round(value), score: round(normalized, 1), label };
}

function validPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function peScore(pe: number, sectorPeMedian?: number | null) {
  // A P/E is meaningful only in context. When a sector median is supplied,
  // relative valuation dominates; otherwise use a deliberately broad fallback.
  if (validPositive(sectorPeMedian)) {
    const ratio = pe / sectorPeMedian;
    return clamp(100 - (ratio - 0.55) * 90);
  }
  if (pe <= 12) return 85;
  if (pe <= 20) return 72;
  if (pe <= 30) return 58;
  if (pe <= 45) return 42;
  if (pe <= 70) return 28;
  return 15;
}

function pegScore(peg: number) {
  // PEG is not a universal valuation law; these bands intentionally mirror
  // the intuitive scale used in the UI while avoiding a binary verdict.
  if (peg <= 0) return 20;
  if (peg < 0.75) return 90;
  if (peg < 1.0) return 82;
  if (peg < 1.5) return 66;
  if (peg < 2.0) return 48;
  if (peg < 3.0) return 30;
  return 15;
}

function growthScore(value: number) {
  if (value >= 30) return 92;
  if (value >= 20) return 82;
  if (value >= 10) return 70;
  if (value >= 5) return 58;
  if (value >= 0) return 45;
  if (value >= -10) return 28;
  return 15;
}

function marginScore(value: number) {
  if (value >= 30) return 90;
  if (value >= 20) return 80;
  if (value >= 12) return 68;
  if (value >= 5) return 52;
  if (value >= 0) return 38;
  return 18;
}

function roeScore(value: number) {
  if (value >= 30) return 90;
  if (value >= 20) return 80;
  if (value >= 15) return 70;
  if (value >= 10) return 58;
  if (value >= 0) return 42;
  return 18;
}

function debtScore(value: number) {
  if (value < 0) return 20;
  if (value <= 0.3) return 90;
  if (value <= 0.7) return 78;
  if (value <= 1.2) return 62;
  if (value <= 2.0) return 42;
  return 22;
}

export function evaluateFundamentals(input: FundamentalInput): FundamentalBrainResult {
  const warnings: string[] = [];
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      score: null,
      confidence: 0,
      direction: "UNAVAILABLE",
      metrics: {
        pe: metricUnavailable(), forwardPe: metricUnavailable(), peg: metricUnavailable(),
        epsGrowth: metricUnavailable(), revenueGrowth: metricUnavailable(), operatingMargin: metricUnavailable(),
        roe: metricUnavailable(), debtToEquity: metricUnavailable(),
      },
      rationale: "Prezzo non valido: il Fundamental Brain non può calcolare la valutazione.",
      warnings: ["Serve un prezzo positivo e finito."],
    };
  }

  const pe = validPositive(input.epsTtm) ? price / input.epsTtm : null;
  const forwardPe = validPositive(input.epsForward) ? price / input.epsForward : null;
  const peg = pe !== null && validPositive(input.expectedEpsGrowthPct) ? pe / input.expectedEpsGrowthPct : null;

  if (input.epsTtm !== undefined && input.epsTtm !== null && input.epsTtm <= 0) warnings.push("EPS TTM non positivo: P/E non significativo.");
  if (input.epsForward !== undefined && input.epsForward !== null && input.epsForward <= 0) warnings.push("EPS forward non positivo: Forward P/E non significativo.");
  if (input.expectedEpsGrowthPct !== undefined && input.expectedEpsGrowthPct !== null && input.expectedEpsGrowthPct <= 0) warnings.push("Crescita EPS attesa non positiva: PEG non significativo.");

  const metrics = {
    pe: pe === null ? metricUnavailable() : metric(pe, peScore(pe, input.sectorPeMedian)),
    forwardPe: forwardPe === null ? metricUnavailable() : metric(forwardPe, peScore(forwardPe, input.sectorPeMedian)),
    peg: peg === null ? metricUnavailable() : metric(peg, pegScore(peg)),
    epsGrowth: typeof input.expectedEpsGrowthPct === "number" && Number.isFinite(input.expectedEpsGrowthPct)
      ? metric(input.expectedEpsGrowthPct, growthScore(input.expectedEpsGrowthPct), true) : metricUnavailable(),
    revenueGrowth: typeof input.revenueGrowthPct === "number" && Number.isFinite(input.revenueGrowthPct)
      ? metric(input.revenueGrowthPct, growthScore(input.revenueGrowthPct), true) : metricUnavailable(),
    operatingMargin: typeof input.operatingMarginPct === "number" && Number.isFinite(input.operatingMarginPct)
      ? metric(input.operatingMarginPct, marginScore(input.operatingMarginPct), true) : metricUnavailable(),
    roe: typeof input.roePct === "number" && Number.isFinite(input.roePct)
      ? metric(input.roePct, roeScore(input.roePct), true) : metricUnavailable(),
    debtToEquity: typeof input.debtToEquity === "number" && Number.isFinite(input.debtToEquity)
      ? metric(input.debtToEquity, debtScore(input.debtToEquity), true) : metricUnavailable(),
  };

  const weighted: Array<[FundamentalMetric, number]> = [
    [metrics.pe, 0.15],
    [metrics.forwardPe, 0.20],
    [metrics.peg, 0.25],
    [metrics.epsGrowth, 0.12],
    [metrics.revenueGrowth, 0.08],
    [metrics.operatingMargin, 0.08],
    [metrics.roe, 0.07],
    [metrics.debtToEquity, 0.05],
  ];

  const available = weighted.filter(([item]) => item.score !== null);
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const score = totalWeight > 0
    ? available.reduce((sum, [item, weight]) => sum + (item.score ?? 0) * weight, 0) / totalWeight
    : null;
  const confidence = round(clamp((totalWeight / 1.0) * 100), 0);

  if (score === null) {
    return { score: null, confidence: 0, direction: "UNAVAILABLE", metrics, rationale: "Dati fondamentali insufficienti.", warnings };
  }

  const normalizedScore = round(score, 1);
  const direction = normalizedScore >= 70 ? "BUY" : normalizedScore >= 45 ? "NEUTRAL" : "CAUTION";
  const rationale = direction === "BUY"
    ? "Valutazione e crescita risultano complessivamente favorevoli sui dati disponibili."
    : direction === "NEUTRAL"
      ? "Valutazione e crescita sono miste: serve conferma dagli altri cervelli e dal contesto settoriale."
      : "La valutazione appare tirata o la qualità/crescita non compensa il prezzo sui dati disponibili.";

  if (!validPositive(input.sectorPeMedian)) warnings.push("P/E valutato senza mediana settoriale: confronto meno robusto.");
  if (confidence < 70) warnings.push("Copertura dati fondamentali incompleta: ridurre il peso del segnale nel Master Decision Engine.");

  return { score: normalizedScore, confidence, direction, metrics, rationale, warnings };
}
