export type TradeDecision = "BUY" | "SELL" | "WAIT" | "NO_TRADE";
export type DataQuality = "complete" | "reduced" | "insufficient";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type BrainEvidence = {
  score: number;
  direction: -1 | 0 | 1;
  quality: number;
  reasons: string[];
  warnings: string[];
};

export type TechnicalBrainInput = {
  trendScore: number;
  momentumScore: number;
  structureScore: number;
  volatilityScore: number;
  timeframeAgreement: number;
  liquidityScore?: number;
};

export type MacroBrainInput = {
  eventImpact: number;
  newsSentiment: number;
  sourceReliability: number;
  sourceAgreement: number;
  macroRegimeAlignment: number;
  eventFreshness: number;
};

export type RiskBrainInput = {
  drawdownPercent: number;
  exposurePercent: number;
  concentrationPercent: number;
  volatilityRisk: number;
  liquidityRisk: number;
  correlationRisk: number;
  marketStressScore: number;
  stopDistancePercent?: number;
  maxAllowedDrawdownPercent: number;
  maxAllowedExposurePercent: number;
  maxAllowedConcentrationPercent: number;
};

export type StatisticalMemory = {
  sampleSize: number;
  positiveRate?: number;
  medianReturn?: number;
  meanRMultiple?: number;
  profitFactor?: number;
  maxObservedDrawdown?: number;
  confidenceGrade: "insufficient" | "weak" | "usable" | "strong";
};

export type EpisodicMemoryMatch = {
  episodeId: number;
  similarity: number;
  realizedRMultiple?: number;
  outcome1h?: number;
  outcome4h?: number;
  outcome1d?: number;
  outcome5d?: number;
  regime: string;
};

export type DualMemoryInput = {
  statistical?: StatisticalMemory;
  episodic?: EpisodicMemoryMatch[];
};

export type DecisionEngineInput = {
  technical: TechnicalBrainInput;
  macro: MacroBrainInput;
  risk: RiskBrainInput;
  memory?: DualMemoryInput;
  dataQuality: DataQuality;
  technicalWeight?: number;
  macroWeight?: number;
  riskWeight?: number;
};

export type DecisionEngineResult = {
  decision: TradeDecision;
  evidenceScore: number;
  directionalScore: number;
  technical: BrainEvidence;
  macro: BrainEvidence;
  risk: BrainEvidence;
  memoryAdjustment: number;
  memorySummary: {
    statistical: StatisticalMemory | null;
    episodicCount: number;
    episodicWeightedR: number | null;
  };
  riskLevel: RiskLevel;
  gateFailures: string[];
  reasons: string[];
  warnings: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function signedDirection(value: number, deadZone = 8): -1 | 0 | 1 {
  return value > deadZone ? 1 : value < -deadZone ? -1 : 0;
}

export function runTechnicalBrain(input: TechnicalBrainInput): BrainEvidence {
  const trend = clamp(input.trendScore, -100, 100);
  const momentum = clamp(input.momentumScore, -100, 100);
  const structure = clamp(input.structureScore, -100, 100);
  const volatility = clamp(input.volatilityScore);
  const timeframeAgreement = clamp(input.timeframeAgreement);
  const liquidity = clamp(input.liquidityScore ?? 70);

  const directionalRaw = trend * 0.34 + momentum * 0.24 + structure * 0.24;
  const confirmation = timeframeAgreement * 0.12 + liquidity * 0.06;
  const volatilityPenalty = Math.max(0, volatility - 70) * 0.22;
  const score = clamp(Math.abs(directionalRaw) * 0.78 + confirmation - volatilityPenalty);
  const direction = signedDirection(directionalRaw);

  const reasons = [
    `trend=${trend.toFixed(1)}`,
    `momentum=${momentum.toFixed(1)}`,
    `structure=${structure.toFixed(1)}`,
    `timeframeAgreement=${timeframeAgreement.toFixed(1)}`,
  ];
  const warnings = [] as string[];
  if (volatility > 80) warnings.push("technical:volatility_extreme");
  if (timeframeAgreement < 45) warnings.push("technical:timeframes_conflict");
  if (liquidity < 45) warnings.push("technical:liquidity_weak");

  return { score, direction, quality: clamp((timeframeAgreement + liquidity) / 2), reasons, warnings };
}

export function runMacroBrain(input: MacroBrainInput): BrainEvidence {
  const impact = clamp(input.eventImpact, -100, 100);
  const sentiment = clamp(input.newsSentiment, -100, 100);
  const reliability = clamp(input.sourceReliability);
  const agreement = clamp(input.sourceAgreement);
  const regime = clamp(input.macroRegimeAlignment, -100, 100);
  const freshness = clamp(input.eventFreshness);

  const directionalRaw = impact * 0.38 + sentiment * 0.26 + regime * 0.36;
  const evidenceQuality = reliability * 0.42 + agreement * 0.34 + freshness * 0.24;
  const score = clamp(Math.abs(directionalRaw) * 0.72 + evidenceQuality * 0.28);
  const direction = signedDirection(directionalRaw);

  const warnings = [] as string[];
  if (reliability < 55) warnings.push("macro:source_reliability_low");
  if (agreement < 45) warnings.push("macro:sources_conflict");
  if (freshness < 40) warnings.push("macro:event_stale");

  return {
    score,
    direction,
    quality: clamp(evidenceQuality),
    reasons: [
      `eventImpact=${impact.toFixed(1)}`,
      `newsSentiment=${sentiment.toFixed(1)}`,
      `sourceAgreement=${agreement.toFixed(1)}`,
      `regimeAlignment=${regime.toFixed(1)}`,
    ],
    warnings,
  };
}

export function runRiskBrain(input: RiskBrainInput): BrainEvidence {
  const hardFailures: string[] = [];
  if (input.drawdownPercent >= input.maxAllowedDrawdownPercent) hardFailures.push("risk:max_drawdown_reached");
  if (input.exposurePercent >= input.maxAllowedExposurePercent) hardFailures.push("risk:max_exposure_reached");
  if (input.concentrationPercent >= input.maxAllowedConcentrationPercent) hardFailures.push("risk:max_concentration_reached");
  if (input.marketStressScore >= 90) hardFailures.push("risk:market_stress_halt");
  if (input.liquidityRisk >= 90) hardFailures.push("risk:liquidity_unacceptable");
  if (input.stopDistancePercent !== undefined && input.stopDistancePercent <= 0) hardFailures.push("risk:invalid_stop_distance");

  const normalizedDrawdown = clamp((input.drawdownPercent / Math.max(input.maxAllowedDrawdownPercent, 0.01)) * 100);
  const normalizedExposure = clamp((input.exposurePercent / Math.max(input.maxAllowedExposurePercent, 0.01)) * 100);
  const normalizedConcentration = clamp((input.concentrationPercent / Math.max(input.maxAllowedConcentrationPercent, 0.01)) * 100);
  const riskPressure =
    normalizedDrawdown * 0.22 +
    normalizedExposure * 0.16 +
    normalizedConcentration * 0.14 +
    clamp(input.volatilityRisk) * 0.16 +
    clamp(input.liquidityRisk) * 0.12 +
    clamp(input.correlationRisk) * 0.1 +
    clamp(input.marketStressScore) * 0.1;
  const safetyScore = clamp(100 - riskPressure);

  return {
    score: safetyScore,
    direction: hardFailures.length ? 0 : 1,
    quality: 100,
    reasons: [
      `drawdown=${input.drawdownPercent.toFixed(2)}%`,
      `exposure=${input.exposurePercent.toFixed(2)}%`,
      `concentration=${input.concentrationPercent.toFixed(2)}%`,
      `marketStress=${input.marketStressScore.toFixed(1)}`,
    ],
    warnings: hardFailures,
  };
}

function memoryAdjustment(memory?: DualMemoryInput) {
  if (!memory) return { adjustment: 0, episodicWeightedR: null as number | null };
  let adjustment = 0;
  const stat = memory.statistical;
  if (stat && stat.confidenceGrade !== "insufficient") {
    const sampleTrust = clamp(Math.log10(Math.max(stat.sampleSize, 1)) / 3 * 100) / 100;
    if (stat.meanRMultiple !== undefined) adjustment += clamp(stat.meanRMultiple * 8, -12, 12) * sampleTrust;
    if (stat.profitFactor !== undefined) adjustment += clamp((stat.profitFactor - 1) * 8, -8, 8) * sampleTrust;
  }

  const matches = (memory.episodic ?? []).filter((match) => match.similarity >= 0.65 && match.realizedRMultiple !== undefined);
  const totalWeight = matches.reduce((sum, match) => sum + match.similarity, 0);
  const weightedR = totalWeight
    ? matches.reduce((sum, match) => sum + (match.realizedRMultiple ?? 0) * match.similarity, 0) / totalWeight
    : null;
  if (weightedR !== null) adjustment += clamp(weightedR * 5, -8, 8);

  return { adjustment: clamp(adjustment, -15, 15), episodicWeightedR: weightedR };
}

function riskLevelFrom(score: number): RiskLevel {
  if (score < 25) return "critical";
  if (score < 50) return "high";
  if (score < 72) return "medium";
  return "low";
}

export function runDecisionEngine(input: DecisionEngineInput): DecisionEngineResult {
  const technical = runTechnicalBrain(input.technical);
  const macro = runMacroBrain(input.macro);
  const risk = runRiskBrain(input.risk);
  const gateFailures = [...risk.warnings];

  if (input.dataQuality === "insufficient") gateFailures.push("data:insufficient");
  if (technical.quality < 35) gateFailures.push("technical:evidence_quality_insufficient");
  if (macro.quality < 30) gateFailures.push("macro:evidence_quality_insufficient");

  const technicalWeight = input.technicalWeight ?? 0.4;
  const macroWeight = input.macroWeight ?? 0.25;
  const riskWeight = input.riskWeight ?? 0.35;
  const totalWeight = Math.max(technicalWeight + macroWeight + riskWeight, 0.0001);

  const directionalAgreement = technical.direction !== 0 && technical.direction === macro.direction;
  const direction = directionalAgreement ? technical.direction : technical.score >= 72 && macro.direction === 0 ? technical.direction : 0;
  if (technical.direction !== 0 && macro.direction !== 0 && technical.direction !== macro.direction) {
    gateFailures.push("decision:technical_macro_conflict");
  }

  const memory = memoryAdjustment(input.memory);
  const baseEvidence = (
    technical.score * technicalWeight +
    macro.score * macroWeight +
    risk.score * riskWeight
  ) / totalWeight;
  const evidenceScore = clamp(baseEvidence + memory.adjustment);
  const directionalScore = clamp((technical.score * technicalWeight + macro.score * macroWeight) / Math.max(technicalWeight + macroWeight, 0.0001));

  let decision: TradeDecision = "WAIT";
  const hasHardRiskFailure = risk.warnings.length > 0;
  if (hasHardRiskFailure || input.dataQuality === "insufficient") decision = "NO_TRADE";
  else if (gateFailures.includes("decision:technical_macro_conflict") || evidenceScore < 62 || direction === 0) decision = "WAIT";
  else if (risk.score < 45) decision = "NO_TRADE";
  else if (evidenceScore >= 70 && directionalScore >= 65) decision = direction === 1 ? "BUY" : "SELL";

  return {
    decision,
    evidenceScore,
    directionalScore,
    technical,
    macro,
    risk,
    memoryAdjustment: memory.adjustment,
    memorySummary: {
      statistical: input.memory?.statistical ?? null,
      episodicCount: input.memory?.episodic?.length ?? 0,
      episodicWeightedR: memory.episodicWeightedR,
    },
    riskLevel: riskLevelFrom(risk.score),
    gateFailures,
    reasons: [...technical.reasons, ...macro.reasons, ...risk.reasons],
    warnings: [...technical.warnings, ...macro.warnings, ...risk.warnings],
  };
}
