import { evaluateMasterDecision, type MasterDecisionInput } from "./masterDecisionEngine";
import { getActiveAxiRules, type AxiStageName } from "./axiRulesSentinel";

export type MarketRegime = "GROWTH" | "BALANCED" | "DEFENSIVE" | "CRISIS";
export type ProtectionMode = "NORMAL" | "PROFIT_LOCK_ACTIVE" | "RECOVERY" | "CAPITAL_PRESERVATION";

export type AxiProgressState = {
  stage: AxiStageName;
  allocationStartBalance?: number | null;
  allocationEquity?: number | null;
  accountEquityUsd?: number | null;
  edgeScore?: number | null;
  closedTrades?: number | null;
  stageDays?: number | null;
  monthStartEquity?: number | null;
  currentEquity?: number | null;
  peakMonthlyProfitPct?: number | null;
};

export type CrashInputs = {
  vixZ?: number | null;
  realizedVolZ?: number | null;
  creditSpreadZ?: number | null;
  breadthPct?: number | null;
  crossAssetCorrelation?: number | null;
  liquidityStress?: number | null; // 0..100
  spreadShockMultiple?: number | null;
  safeHavenConfirmation?: number | null; // 0..100
  geopoliticalSeverity?: number | null; // 0..100
};

export type OpportunityCandidate = {
  symbol: string;
  expectedReturnR?: number | null;
  expectedRiskR?: number | null;
  confidence?: number | null;
  liquidityScore?: number | null;
  executionCostR?: number | null;
  portfolioCorrelation?: number | null;
  sectorConcentrationPct?: number | null;
  masterInput: MasterDecisionInput;
};

export type RankedOpportunity = {
  symbol: string;
  decision: "BUY" | "SELL" | "WAIT" | "NO_TRADE";
  finalScore: number | null;
  opportunityScore: number;
  expectancyR: number | null;
  sizeMultiplier: number;
  protectionMode: ProtectionMode;
  marketRegime: MarketRegime;
  reasons: string[];
};

const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function evaluateCrashSentinel(input: CrashInputs): { score: number; regime: MarketRegime; reasons: string[] } {
  const parts: Array<[number, number, string]> = [];
  if (valid(input.vixZ)) parts.push([clamp(50 + input.vixZ * 16), 0.16, "volatilità implicita"]);
  if (valid(input.realizedVolZ)) parts.push([clamp(50 + input.realizedVolZ * 16), 0.14, "volatilità realizzata"]);
  if (valid(input.creditSpreadZ)) parts.push([clamp(50 + input.creditSpreadZ * 18), 0.16, "credit spread"]);
  if (valid(input.breadthPct)) parts.push([clamp(100 - input.breadthPct), 0.12, "breadth"]);
  if (valid(input.crossAssetCorrelation)) parts.push([clamp(Math.abs(input.crossAssetCorrelation) * 100), 0.12, "correlazione cross-asset"]);
  if (valid(input.liquidityStress)) parts.push([clamp(input.liquidityStress), 0.12, "liquidità"]);
  if (valid(input.spreadShockMultiple)) parts.push([clamp((input.spreadShockMultiple - 1) * 35), 0.08, "spread"]);
  if (valid(input.geopoliticalSeverity)) parts.push([clamp(input.geopoliticalSeverity), 0.10, "geopolitica"]);

  if (!parts.length) return { score: 50, regime: "BALANCED", reasons: ["Dati sistemici insufficienti: regime neutrale prudente."] };
  const total = parts.reduce((sum, [, weight]) => sum + weight, 0);
  let score = parts.reduce((sum, [value, weight]) => sum + value * weight, 0) / total;
  if (valid(input.safeHavenConfirmation) && input.safeHavenConfirmation >= 70) score = Math.max(score, 72);
  const regime: MarketRegime = score >= 82 ? "CRISIS" : score >= 67 ? "DEFENSIVE" : score >= 45 ? "BALANCED" : "GROWTH";
  return { score: Number(score.toFixed(1)), regime, reasons: parts.filter(([value]) => value >= 70).map(([, , label]) => `${label} in stress`) };
}

export function evaluateAxiProtection(state: AxiProgressState) {
  const rules = getActiveAxiRules().stages[state.stage];
  const monthlyProfitPct = valid(state.monthStartEquity) && valid(state.currentEquity) && state.monthStartEquity > 0
    ? ((state.currentEquity - state.monthStartEquity) / state.monthStartEquity) * 100 : null;
  const stageProfitPct = valid(state.allocationStartBalance) && valid(state.allocationEquity) && state.allocationStartBalance > 0
    ? ((state.allocationEquity - state.allocationStartBalance) / state.allocationStartBalance) * 100 : null;
  const drawdownPct = valid(state.currentEquity) && valid(state.monthStartEquity) && state.monthStartEquity > 0
    ? Math.max(0, ((state.monthStartEquity - state.currentEquity) / state.monthStartEquity) * 100) : 0;

  const targetReached = rules.profitTargetPct !== null && valid(stageProfitPct) && stageProfitPct >= rules.profitTargetPct;
  const tradesReached = rules.minTrades === null || (valid(state.closedTrades) && state.closedTrades >= rules.minTrades);
  const daysReached = rules.minDays === null || (valid(state.stageDays) && state.stageDays >= rules.minDays);
  const edgeReached = !valid(state.edgeScore) || state.edgeScore >= rules.minEdgeScore;
  const equityReached = !valid(state.accountEquityUsd) || state.accountEquityUsd >= rules.minEquityUsd;

  let mode: ProtectionMode = "NORMAL";
  let baseSizeMultiplier = 1;
  const reasons: string[] = [];

  // Active profit protection: continue trading after target, but smaller and shorter.
  if (targetReached && tradesReached) {
    mode = "PROFIT_LOCK_ACTIVE";
    baseSizeMultiplier = 0.55;
    reasons.push("Target Axi raggiunto: trading continua in modalità active profit protection.");
  }

  const peak = valid(state.peakMonthlyProfitPct) ? state.peakMonthlyProfitPct : monthlyProfitPct;
  if (valid(peak) && valid(monthlyProfitPct) && peak > 0) {
    const giveBackRatio = (peak - monthlyProfitPct) / peak;
    if (giveBackRatio >= 0.25) {
      mode = "CAPITAL_PRESERVATION";
      baseSizeMultiplier = Math.min(baseSizeMultiplier, 0.25);
      reasons.push("Restituito almeno il 25% del profitto mensile di picco: protezione capitale.");
    } else if (giveBackRatio >= 0.15) {
      baseSizeMultiplier = Math.min(baseSizeMultiplier, 0.4);
      reasons.push("Profit give-back superiore al 15%: size ulteriormente ridotta.");
    }
  }

  if (drawdownPct >= 3.5) {
    mode = "CAPITAL_PRESERVATION";
    baseSizeMultiplier = Math.min(baseSizeMultiplier, 0.3);
    reasons.push("Drawdown operativo >=3.5%: capital preservation.");
  } else if (drawdownPct >= 2) {
    mode = "RECOVERY";
    baseSizeMultiplier = Math.min(baseSizeMultiplier, 0.55);
    reasons.push("Drawdown >=2%: recovery mode senza martingala.");
  } else if (drawdownPct >= 1) {
    baseSizeMultiplier = Math.min(baseSizeMultiplier, 0.8);
    reasons.push("Drawdown >=1%: size ridotta.");
  }

  const progressionReady = targetReached && tradesReached && daysReached && edgeReached && equityReached;
  return {
    mode,
    baseSizeMultiplier,
    monthlyProfitPct: valid(monthlyProfitPct) ? Number(monthlyProfitPct.toFixed(2)) : null,
    stageProfitPct: valid(stageProfitPct) ? Number(stageProfitPct.toFixed(2)) : null,
    targetReached,
    tradesReached,
    daysReached,
    edgeReached,
    equityReached,
    progressionReady,
    rules,
    reasons,
  };
}

function portfolioPenalty(candidate: OpportunityCandidate) {
  let multiplier = 1;
  const reasons: string[] = [];
  if (valid(candidate.portfolioCorrelation) && Math.abs(candidate.portfolioCorrelation) >= 0.85) {
    multiplier *= 0.65;
    reasons.push("Alta correlazione con portafoglio esistente.");
  }
  if (valid(candidate.sectorConcentrationPct) && candidate.sectorConcentrationPct >= 35) {
    multiplier *= 0.7;
    reasons.push("Concentrazione settoriale elevata.");
  }
  return { multiplier, reasons };
}

export function rankOpportunities(candidates: OpportunityCandidate[], axi: AxiProgressState, crash: CrashInputs): RankedOpportunity[] {
  const protection = evaluateAxiProtection(axi);
  const systemic = evaluateCrashSentinel(crash);

  return candidates.map((candidate) => {
    const master = evaluateMasterDecision(candidate.masterInput);
    const expectedReturnR = valid(candidate.expectedReturnR) ? candidate.expectedReturnR : null;
    const expectedRiskR = valid(candidate.expectedRiskR) && candidate.expectedRiskR > 0 ? candidate.expectedRiskR : null;
    const expectancyR = expectedReturnR !== null && expectedRiskR !== null ? expectedReturnR - expectedRiskR : null;
    const rr = expectedReturnR !== null && expectedRiskR !== null ? expectedReturnR / expectedRiskR : 1;
    const confidence = valid(candidate.confidence) ? candidate.confidence : master.confidence;
    const liquidity = valid(candidate.liquidityScore) ? candidate.liquidityScore : 65;
    const executionCostPenalty = valid(candidate.executionCostR) ? Math.min(25, candidate.executionCostR * 20) : 0;
    const portfolio = portfolioPenalty(candidate);

    let opportunityScore = clamp((master.finalScore ?? 50) * 0.45 + clamp(rr * 25) * 0.2 + confidence * 0.2 + liquidity * 0.15 - executionCostPenalty);
    let sizeMultiplier = master.sizeMultiplier * protection.baseSizeMultiplier * portfolio.multiplier;
    const reasons = [...protection.reasons, ...portfolio.reasons];

    if (systemic.regime === "DEFENSIVE") {
      sizeMultiplier *= 0.55;
      opportunityScore -= 4;
      reasons.push("Crash Sentinel DEFENSIVE: size ridotta, non blocco automatico.");
    } else if (systemic.regime === "CRISIS") {
      sizeMultiplier *= 0.25;
      opportunityScore -= 8;
      reasons.push("Crash Sentinel CRISIS: solo micro-size/hedge/short selettivi.");
    } else if (systemic.regime === "GROWTH") {
      opportunityScore += 2;
    }

    if (protection.mode === "PROFIT_LOCK_ACTIVE") {
      // Keep trading after reaching target, favoring short high-quality trades.
      if (candidate.masterInput.horizon === "intraday") opportunityScore += 3;
      if (candidate.masterInput.horizon === "position") opportunityScore -= 5;
    }

    if (master.decision === "WAIT" || master.decision === "NO_TRADE") sizeMultiplier = 0;
    sizeMultiplier = Math.max(0, Math.min(1, Number(sizeMultiplier.toFixed(2))));

    return {
      symbol: candidate.symbol,
      decision: master.decision,
      finalScore: master.finalScore,
      opportunityScore: Number(clamp(opportunityScore).toFixed(1)),
      expectancyR: expectancyR === null ? null : Number(expectancyR.toFixed(2)),
      sizeMultiplier,
      protectionMode: protection.mode,
      marketRegime: systemic.regime,
      reasons,
    };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export type ExecutionPlanInput = {
  spreadMultiple?: number | null;
  slippageEstimateR?: number | null;
  liquidityScore?: number | null;
  volatilityShockMultiple?: number | null;
  desiredSizeMultiplier: number;
};

export function optimizeExecution(input: ExecutionPlanInput) {
  const spread = valid(input.spreadMultiple) ? input.spreadMultiple : 1;
  const slippage = valid(input.slippageEstimateR) ? input.slippageEstimateR : 0;
  const liquidity = valid(input.liquidityScore) ? input.liquidityScore : 60;
  const vol = valid(input.volatilityShockMultiple) ? input.volatilityShockMultiple : 1;
  const useLimit = spread > 1.5 || slippage > 0.12 || liquidity < 55;
  const splitOrders = input.desiredSizeMultiplier >= 0.7 && (liquidity < 70 || vol > 1.7);
  const maxSizeMultiplier = vol >= 3 ? Math.min(input.desiredSizeMultiplier, 0.25) : spread >= 2.5 ? Math.min(input.desiredSizeMultiplier, 0.35) : input.desiredSizeMultiplier;
  return {
    orderType: useLimit ? "LIMIT" : "MARKETABLE_LIMIT",
    splitOrders,
    maxSizeMultiplier: Number(Math.max(0, Math.min(1, maxSizeMultiplier)).toFixed(2)),
    cancelIfSpreadMultipleAbove: 3,
    cancelIfSlippageRAbove: 0.35,
  };
}

export type DecisionMemoryRecord = {
  id: string;
  timestamp: string;
  symbol: string;
  algorithmVersion: string;
  regime: MarketRegime;
  decision: string;
  finalScore: number | null;
  confidence: number;
  sizeMultiplier: number;
  rationale: string;
  outcomeR?: number | null;
  maxAdverseExcursionR?: number | null;
  maxFavourableExcursionR?: number | null;
  exitReason?: string | null;
};

export function postTradeDiagnosis(record: DecisionMemoryRecord) {
  if (!valid(record.outcomeR)) return { category: "PENDING", lessonWeight: 0, note: "Trade non ancora chiuso." };
  if (record.outcomeR >= 0) return { category: "VALID", lessonWeight: 0.25, note: "Esito positivo: evitare overfitting sul singolo trade." };
  if (valid(record.maxFavourableExcursionR) && record.maxFavourableExcursionR > 1 && record.outcomeR < 0) return { category: "EXIT_MANAGEMENT", lessonWeight: 0.7, note: "Il trade è stato profittevole prima di invertire: rivedere trailing/exit." };
  if (record.regime === "CRISIS" || record.regime === "DEFENSIVE") return { category: "REGIME_RISK", lessonWeight: 0.8, note: "Perdita in regime stressato: verificare size e timing del Crash Sentinel." };
  return { category: "FORECAST_ERROR", lessonWeight: 0.6, note: "Segnale non confermato dal mercato: usare il caso nel challenger, non cambiare il champion direttamente." };
}

export function championChallengerDecision(champion: { expectancyR: number; maxDrawdownPct: number; deflatedSharpe?: number | null; pbo?: number | null }, challenger: { expectancyR: number; maxDrawdownPct: number; deflatedSharpe?: number | null; pbo?: number | null }) {
  const robust = (!valid(challenger.deflatedSharpe) || challenger.deflatedSharpe > 0.6) && (!valid(challenger.pbo) || challenger.pbo < 0.35);
  const superior = challenger.expectancyR > champion.expectancyR * 1.08 && challenger.maxDrawdownPct <= champion.maxDrawdownPct * 1.05;
  return { promote: robust && superior, robust, superior, rationale: robust && superior ? "Challenger supera il champion con robustezza sufficiente." : "Mantieni il champion; il challenger resta in shadow mode." };
}
