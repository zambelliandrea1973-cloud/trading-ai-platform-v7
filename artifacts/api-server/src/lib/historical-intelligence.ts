import type { EpisodicMemoryMatch, StatisticalMemory } from "./decision-engine";

export type ComparableFeatureVector = Record<string, number | null | undefined>;

export type HistoricalEpisodeCandidate = {
  episodeId: number;
  regime: string;
  features: ComparableFeatureVector;
  realizedRMultiple?: number;
  outcome1h?: number;
  outcome4h?: number;
  outcome1d?: number;
  outcome5d?: number;
};

export type PatternOutcome = {
  realizedRMultiple?: number;
  returnPercent?: number;
  drawdownPercent?: number;
};

export type HistoricalMemoryResult = {
  statistical: StatisticalMemory;
  episodic: EpisodicMemoryMatch[];
  effectiveSampleSize: number;
  warnings: string[];
};

export const HISTORICAL_MEMORY_THRESHOLDS = {
  episodicMinSimilarity: 0.68,
  episodicStrongSimilarity: 0.82,
  statisticalWeakMin: 30,
  statisticalUsableMin: 100,
  statisticalStrongMin: 300,
  preferredRegimeMin: 75,
} as const;

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Weighted normalized distance. Callers should pre-normalize features to
 * comparable ranges (normally -1..1 or 0..1). Missing features never become
 * zero: they reduce coverage instead, avoiding false similarity.
 */
export function featureSimilarity(
  current: ComparableFeatureVector,
  historical: ComparableFeatureVector,
  weights: Record<string, number> = {},
): { similarity: number; coverage: number } {
  const keys = [...new Set([...Object.keys(current), ...Object.keys(historical)])];
  let weightedDistance = 0;
  let usedWeight = 0;
  let possibleWeight = 0;

  for (const key of keys) {
    const weight = Math.max(0, weights[key] ?? 1);
    possibleWeight += weight;
    const a = current[key];
    const b = historical[key];
    if (!finite(a) || !finite(b) || weight === 0) continue;
    weightedDistance += Math.min(Math.abs(a - b), 2) / 2 * weight;
    usedWeight += weight;
  }

  if (!usedWeight || !possibleWeight) return { similarity: 0, coverage: 0 };
  const coverage = usedWeight / possibleWeight;
  const rawSimilarity = 1 - weightedDistance / usedWeight;
  // Missing features penalize the score instead of silently matching.
  return { similarity: clamp(rawSimilarity * (0.65 + coverage * 0.35), 0, 1), coverage };
}

export function selectEpisodicMemory(
  current: ComparableFeatureVector,
  candidates: HistoricalEpisodeCandidate[],
  options?: { regime?: string; limit?: number; weights?: Record<string, number> },
): EpisodicMemoryMatch[] {
  const limit = options?.limit ?? 12;
  return candidates
    .map((candidate) => {
      const similarity = featureSimilarity(current, candidate.features, options?.weights);
      const regimeMultiplier = options?.regime && candidate.regime === options.regime ? 1 : options?.regime ? 0.9 : 1;
      return {
        episodeId: candidate.episodeId,
        similarity: clamp(similarity.similarity * regimeMultiplier, 0, 1),
        coverage: similarity.coverage,
        realizedRMultiple: candidate.realizedRMultiple,
        outcome1h: candidate.outcome1h,
        outcome4h: candidate.outcome4h,
        outcome1d: candidate.outcome1d,
        outcome5d: candidate.outcome5d,
        regime: candidate.regime,
      };
    })
    .filter((candidate) => candidate.similarity >= HISTORICAL_MEMORY_THRESHOLDS.episodicMinSimilarity && candidate.coverage >= 0.65)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ coverage: _coverage, ...match }) => match);
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function confidenceGrade(sampleSize: number, regimeSampleSize = sampleSize): StatisticalMemory["confidenceGrade"] {
  if (sampleSize < HISTORICAL_MEMORY_THRESHOLDS.statisticalWeakMin) return "insufficient";
  if (sampleSize < HISTORICAL_MEMORY_THRESHOLDS.statisticalUsableMin) return "weak";
  if (sampleSize < HISTORICAL_MEMORY_THRESHOLDS.statisticalStrongMin || regimeSampleSize < HISTORICAL_MEMORY_THRESHOLDS.preferredRegimeMin) return "usable";
  return "strong";
}

export function buildStatisticalMemory(outcomes: PatternOutcome[], regimeSampleSize = outcomes.length): StatisticalMemory {
  const r = outcomes.map((item) => item.realizedRMultiple).filter(finite);
  const returns = outcomes.map((item) => item.returnPercent).filter(finite);
  const drawdowns = outcomes.map((item) => item.drawdownPercent).filter(finite);
  const positiveBase = r.length ? r : returns;
  const winners = positiveBase.filter((value) => value > 0);
  const losers = positiveBase.filter((value) => value < 0);
  const grossProfit = winners.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losers.reduce((sum, value) => sum + value, 0));

  return {
    sampleSize: outcomes.length,
    positiveRate: positiveBase.length ? winners.length / positiveBase.length : undefined,
    medianReturn: median(returns),
    meanRMultiple: r.length ? r.reduce((sum, value) => sum + value, 0) / r.length : undefined,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : undefined,
    maxObservedDrawdown: drawdowns.length ? Math.max(...drawdowns.map(Math.abs)) : undefined,
    confidenceGrade: confidenceGrade(outcomes.length, regimeSampleSize),
  };
}

export function buildHistoricalMemory(args: {
  currentFeatures: ComparableFeatureVector;
  candidates: HistoricalEpisodeCandidate[];
  patternOutcomes: PatternOutcome[];
  regime?: string;
  regimePatternSampleSize?: number;
  featureWeights?: Record<string, number>;
}): HistoricalMemoryResult {
  const statistical = buildStatisticalMemory(args.patternOutcomes, args.regimePatternSampleSize ?? args.patternOutcomes.length);
  const episodic = selectEpisodicMemory(args.currentFeatures, args.candidates, {
    regime: args.regime,
    weights: args.featureWeights,
  });
  const warnings: string[] = [];
  if (statistical.confidenceGrade === "insufficient") warnings.push("memory:statistical_sample_insufficient");
  if (statistical.confidenceGrade === "weak") warnings.push("memory:statistical_sample_weak");
  if (episodic.length < 3) warnings.push("memory:few_similar_episodes");
  if (episodic.length && episodic.every((item) => item.similarity < HISTORICAL_MEMORY_THRESHOLDS.episodicStrongSimilarity)) {
    warnings.push("memory:no_strong_episode_match");
  }

  return {
    statistical,
    episodic,
    effectiveSampleSize: statistical.sampleSize,
    warnings,
  };
}
