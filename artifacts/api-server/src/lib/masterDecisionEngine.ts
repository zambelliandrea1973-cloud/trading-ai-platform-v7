import { evaluateFundamentals, type FundamentalInput } from "./fundamentalBrain";
import { evaluateStatistical, type StatisticalInput } from "./statisticalBrain";

export type TradingHorizon = "intraday" | "swing" | "position";

export type BrainSignal = {
  score?: number | null;
  confidence?: number | null;
};

export type SafetyContext = {
  dailyLossPct?: number | null;
  drawdownPct?: number | null;
  consecutiveLosses?: number | null;
  volatilityShockMultiple?: number | null;
  spreadMultiple?: number | null;
  slippageMultiple?: number | null;
  dataHealth?: "OK" | "DEGRADED" | "STALE" | "INVALID";
  brokerConnected?: boolean | null;
  portfolioCorrelation?: number | null;
  minutesToHighImpactEvent?: number | null;
  riskScore?: number | null; // 0 = low risk, 100 = extreme risk
};

export type MasterDecisionInput = {
  horizon: TradingHorizon;
  technical: BrainSignal;
  macroNews: BrainSignal;
  fundamentals?: FundamentalInput | null;
  statistical?: StatisticalInput | null;
  safety?: SafetyContext | null;
};

export type MasterDecisionResult = {
  finalScore: number | null;
  confidence: number;
  decision: "BUY" | "SELL" | "WAIT" | "NO_TRADE";
  sizeMultiplier: number;
  hardVeto: boolean;
  hardVetoReasons: string[];
  softGuards: string[];
  weightsUsed: Record<string, number>;
  brainScores: Record<string, number | null>;
  fundamental: ReturnType<typeof evaluateFundamentals> | null;
  statistical: ReturnType<typeof evaluateStatistical> | null;
  rationale: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const weightsByHorizon: Record<TradingHorizon, Record<"technical" | "macroNews" | "fundamental" | "statistical", number>> = {
  intraday: { technical: 0.38, macroNews: 0.22, fundamental: 0.08, statistical: 0.32 },
  swing: { technical: 0.28, macroNews: 0.22, fundamental: 0.27, statistical: 0.23 },
  position: { technical: 0.18, macroNews: 0.25, fundamental: 0.37, statistical: 0.20 },
};

function evaluateSafety(safety: SafetyContext | null | undefined) {
  const hardVetoReasons: string[] = [];
  const softGuards: string[] = [];
  let sizeMultiplier = 1;
  let scorePenalty = 0;

  if (!safety) return { hardVetoReasons, softGuards, sizeMultiplier, scorePenalty };

  // Hard vetoes are intentionally reserved for extreme operational or capital-risk states.
  if (safety.brokerConnected === false) hardVetoReasons.push("Broker disconnesso.");
  if (safety.dataHealth === "INVALID" || safety.dataHealth === "STALE") hardVetoReasons.push("Feed dati non affidabile.");
  if (valid(safety.dailyLossPct) && safety.dailyLossPct >= 4) hardVetoReasons.push("Perdita giornaliera oltre il limite hard del 4%.");
  if (valid(safety.drawdownPct) && safety.drawdownPct >= 10) hardVetoReasons.push("Drawdown oltre il limite hard del 10%.");
  if (valid(safety.volatilityShockMultiple) && safety.volatilityShockMultiple >= 4) hardVetoReasons.push("Shock di volatilità estremo.");
  if (valid(safety.spreadMultiple) && safety.spreadMultiple >= 4) hardVetoReasons.push("Spread anomalo estremo.");
  if (valid(safety.slippageMultiple) && safety.slippageMultiple >= 4) hardVetoReasons.push("Slippage anomalo estremo.");

  // Soft guards reduce risk without suppressing every opportunity.
  if (safety.dataHealth === "DEGRADED") {
    softGuards.push("Feed degradato: size ridotta.");
    sizeMultiplier *= 0.65;
    scorePenalty += 3;
  }
  if (valid(safety.dailyLossPct) && safety.dailyLossPct >= 2) {
    softGuards.push("Perdita giornaliera elevata: size ridotta.");
    sizeMultiplier *= 0.65;
    scorePenalty += 4;
  }
  if (valid(safety.drawdownPct) && safety.drawdownPct >= 5) {
    softGuards.push("Drawdown intermedio: operatività consentita con esposizione ridotta.");
    sizeMultiplier *= 0.7;
    scorePenalty += 4;
  }
  if (valid(safety.consecutiveLosses) && safety.consecutiveLosses >= 3) {
    softGuards.push("Serie negativa: richiedere qualità segnale più alta.");
    sizeMultiplier *= 0.75;
    scorePenalty += 3;
  }
  if (valid(safety.volatilityShockMultiple) && safety.volatilityShockMultiple >= 2) {
    softGuards.push("Volatilità elevata: size ridotta, non blocco automatico.");
    sizeMultiplier *= 0.7;
    scorePenalty += 4;
  }
  if (valid(safety.spreadMultiple) && safety.spreadMultiple >= 2) {
    softGuards.push("Spread elevato: penalità di esecuzione.");
    sizeMultiplier *= 0.75;
    scorePenalty += 3;
  }
  if (valid(safety.slippageMultiple) && safety.slippageMultiple >= 2) {
    softGuards.push("Slippage elevato: esposizione ridotta.");
    sizeMultiplier *= 0.8;
    scorePenalty += 2;
  }
  if (valid(safety.portfolioCorrelation) && Math.abs(safety.portfolioCorrelation) >= 0.85) {
    softGuards.push("Portafoglio molto correlato: evitare concentrazione.");
    sizeMultiplier *= 0.75;
    scorePenalty += 2;
  }
  if (valid(safety.minutesToHighImpactEvent) && safety.minutesToHighImpactEvent >= 0 && safety.minutesToHighImpactEvent <= 10) {
    softGuards.push("Evento macro ad alto impatto imminente: size minima fino alla normalizzazione.");
    sizeMultiplier *= 0.45;
    scorePenalty += 5;
  }
  if (valid(safety.riskScore)) {
    if (safety.riskScore >= 80) {
      softGuards.push("Risk Brain molto elevato: forte riduzione dell'esposizione.");
      sizeMultiplier *= 0.5;
      scorePenalty += 7;
    } else if (safety.riskScore >= 65) {
      softGuards.push("Risk Brain elevato: esposizione ridotta.");
      sizeMultiplier *= 0.75;
      scorePenalty += 4;
    }
  }

  return {
    hardVetoReasons,
    softGuards,
    sizeMultiplier: Math.max(0.15, Number(sizeMultiplier.toFixed(2))),
    scorePenalty,
  };
}

export function evaluateMasterDecision(input: MasterDecisionInput): MasterDecisionResult {
  const fundamental = input.fundamentals ? evaluateFundamentals(input.fundamentals) : null;
  const statistical = input.statistical ? evaluateStatistical(input.statistical) : null;
  const baseWeights = weightsByHorizon[input.horizon];

  const candidates = [
    { key: "technical", score: input.technical.score, confidence: input.technical.confidence, weight: baseWeights.technical },
    { key: "macroNews", score: input.macroNews.score, confidence: input.macroNews.confidence, weight: baseWeights.macroNews },
    { key: "fundamental", score: fundamental?.score, confidence: fundamental?.confidence, weight: baseWeights.fundamental },
    { key: "statistical", score: statistical?.score, confidence: statistical?.confidence, weight: baseWeights.statistical },
  ].filter((item) => valid(item.score));

  if (!candidates.length) {
    return {
      finalScore: null,
      confidence: 0,
      decision: "WAIT",
      sizeMultiplier: 0,
      hardVeto: false,
      hardVetoReasons: [],
      softGuards: ["Dati insufficienti per una decisione."],
      weightsUsed: {},
      brainScores: { technical: null, macroNews: null, fundamental: fundamental?.score ?? null, statistical: statistical?.score ?? null },
      fundamental,
      statistical,
      rationale: "Il sistema attende dati sufficienti invece di forzare un'operazione.",
    };
  }

  // Re-normalize missing brains instead of blocking the trade. This preserves opportunity flow while tracking confidence.
  const totalBaseWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
  const weightsUsed: Record<string, number> = {};
  let weightedScore = 0;
  let weightedConfidence = 0;
  for (const item of candidates) {
    const normalizedWeight = item.weight / totalBaseWeight;
    weightsUsed[item.key] = Number(normalizedWeight.toFixed(3));
    weightedScore += (item.score as number) * normalizedWeight;
    weightedConfidence += (valid(item.confidence) ? item.confidence : 60) * normalizedWeight;
  }

  const safety = evaluateSafety(input.safety);
  const scoreAfterRisk = clamp(weightedScore - safety.scorePenalty);
  const confidence = Math.round(clamp(weightedConfidence - safety.softGuards.length * 2));

  if (safety.hardVetoReasons.length) {
    return {
      finalScore: Number(scoreAfterRisk.toFixed(1)),
      confidence,
      decision: "NO_TRADE",
      sizeMultiplier: 0,
      hardVeto: true,
      hardVetoReasons: safety.hardVetoReasons,
      softGuards: safety.softGuards,
      weightsUsed,
      brainScores: {
        technical: valid(input.technical.score) ? input.technical.score : null,
        macroNews: valid(input.macroNews.score) ? input.macroNews.score : null,
        fundamental: fundamental?.score ?? null,
        statistical: statistical?.score ?? null,
      },
      fundamental,
      statistical,
      rationale: "Il segnale può essere valido, ma un limite hard di sicurezza impedisce l'esecuzione.",
    };
  }

  // Deliberately broad action bands: caution should reduce size before it eliminates opportunity.
  const decision = scoreAfterRisk >= 66 ? "BUY" : scoreAfterRisk <= 34 ? "SELL" : "WAIT";
  let sizeMultiplier = safety.sizeMultiplier;

  if (decision === "WAIT") sizeMultiplier = 0;
  else if (confidence < 55) sizeMultiplier *= 0.5;
  else if (confidence < 70) sizeMultiplier *= 0.75;

  // High-quality signals can keep a meaningful position despite soft guards, never above standard size.
  if ((decision === "BUY" || decision === "SELL") && scoreAfterRisk >= 78 && confidence >= 75) {
    sizeMultiplier = Math.max(sizeMultiplier, 0.5);
  }

  sizeMultiplier = Math.min(1, Math.max(0, Number(sizeMultiplier.toFixed(2))));

  return {
    finalScore: Number(scoreAfterRisk.toFixed(1)),
    confidence,
    decision,
    sizeMultiplier,
    hardVeto: false,
    hardVetoReasons: [],
    softGuards: safety.softGuards,
    weightsUsed,
    brainScores: {
      technical: valid(input.technical.score) ? input.technical.score : null,
      macroNews: valid(input.macroNews.score) ? input.macroNews.score : null,
      fundamental: fundamental?.score ?? null,
      statistical: statistical?.score ?? null,
    },
    fundamental,
    statistical,
    rationale: decision === "BUY"
      ? "Convergenza positiva dei cervelli disponibili; le cautele riducono la size prima di bloccare l'opportunità."
      : decision === "SELL"
        ? "Convergenza negativa dei cervelli disponibili; l'operazione resta subordinata ai limiti di rischio."
        : "Segnale non abbastanza asimmetrico: meglio attendere una convergenza più netta.",
  };
}
