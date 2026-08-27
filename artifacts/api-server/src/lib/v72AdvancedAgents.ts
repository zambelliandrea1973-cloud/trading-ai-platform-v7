export type DebateInput = {
  technicalScore?: number | null;
  macroScore?: number | null;
  fundamentalScore?: number | null;
  statisticalScore?: number | null;
  riskScore?: number | null;
  eventRisk?: number | null;
  priceExtensionAtr?: number | null;
};

const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function bullBearResearchJudge(input: DebateInput) {
  const positives = [input.technicalScore, input.macroScore, input.fundamentalScore, input.statisticalScore].filter(valid);
  const bullScore = positives.length ? positives.reduce((a, b) => a + b, 0) / positives.length : 50;
  let bearScore = valid(input.riskScore) ? input.riskScore : 50;
  const concerns: string[] = [];
  if (valid(input.eventRisk) && input.eventRisk >= 70) { bearScore += 10; concerns.push("event risk elevato"); }
  if (valid(input.priceExtensionAtr) && input.priceExtensionAtr >= 2.5) { bearScore += 12; concerns.push("prezzo molto esteso rispetto ad ATR"); }
  bearScore = clamp(bearScore);
  const edge = bullScore - bearScore;
  const verdict = edge >= 18 ? "BULL_CONFIRMED" : edge <= -18 ? "BEAR_CONFIRMED" : "MIXED";
  const sizeAdjustment = verdict === "MIXED" ? 0.7 : Math.abs(edge) >= 30 ? 1 : 0.85;
  return {
    bullScore: Number(bullScore.toFixed(1)),
    bearScore: Number(bearScore.toFixed(1)),
    edge: Number(edge.toFixed(1)),
    verdict,
    sizeAdjustment,
    concerns,
  };
}

export type DataIntegrityInput = {
  marketTimestamp?: string | null;
  receivedTimestamp?: string | null;
  sourceTimestamp?: string | null;
  fundamentalsAsOf?: string | null;
  corporateActionsApplied?: boolean | null;
  survivorshipBiasControlled?: boolean | null;
  duplicateNewsRatePct?: number | null;
  sourceQualityScore?: number | null;
};

export function evaluateDataIntegrity(input: DataIntegrityInput) {
  const warnings: string[] = [];
  let score = 100;
  const now = Date.now();
  if (input.marketTimestamp) {
    const ageMin = (now - new Date(input.marketTimestamp).getTime()) / 60000;
    if (ageMin > 15) { score -= 40; warnings.push("market data stale"); }
    else if (ageMin > 3) { score -= 15; warnings.push("market data delayed"); }
  } else { score -= 20; warnings.push("market timestamp missing"); }
  if (input.corporateActionsApplied === false) { score -= 20; warnings.push("corporate actions not applied"); }
  if (input.survivorshipBiasControlled === false) { score -= 20; warnings.push("survivorship bias not controlled"); }
  if (valid(input.duplicateNewsRatePct) && input.duplicateNewsRatePct > 25) { score -= 15; warnings.push("duplicate news rate high"); }
  if (valid(input.sourceQualityScore)) score = Math.min(score, input.sourceQualityScore + 10);
  score = clamp(score);
  return {
    score,
    status: score < 45 ? "INVALID" : score < 70 ? "DEGRADED" : "OK",
    warnings,
    pointInTimeSafe: input.survivorshipBiasControlled !== false && input.corporateActionsApplied !== false,
  };
}

export type PortfolioCandidate = {
  symbol: string;
  opportunityScore: number;
  requestedRiskPct: number;
  sector?: string | null;
  currency?: string | null;
  beta?: number | null;
  correlationToPortfolio?: number | null;
};

export function allocatePortfolio(candidates: PortfolioCandidate[], maxTotalRiskPct = 3, maxSectorRiskPct = 1.2) {
  const ordered = [...candidates].sort((a, b) => b.opportunityScore - a.opportunityScore);
  const sectorRisk = new Map<string, number>();
  let totalRisk = 0;
  const allocations = ordered.map((candidate) => {
    let allowed = Math.max(0, candidate.requestedRiskPct);
    if (valid(candidate.correlationToPortfolio) && Math.abs(candidate.correlationToPortfolio) >= 0.85) allowed *= 0.6;
    const sector = candidate.sector ?? "OTHER";
    const usedSector = sectorRisk.get(sector) ?? 0;
    allowed = Math.min(allowed, Math.max(0, maxSectorRiskPct - usedSector));
    allowed = Math.min(allowed, Math.max(0, maxTotalRiskPct - totalRisk));
    if (candidate.opportunityScore < 66) allowed = 0;
    allowed = Number(allowed.toFixed(3));
    totalRisk += allowed;
    sectorRisk.set(sector, usedSector + allowed);
    return { symbol: candidate.symbol, allocatedRiskPct: allowed, opportunityScore: candidate.opportunityScore };
  });
  return { allocations, totalRiskPct: Number(totalRisk.toFixed(3)), maxTotalRiskPct, maxSectorRiskPct };
}

export type GeopoliticalEvent = {
  severity: number;
  regions: string[];
  themes: Array<"ENERGY" | "SEMICONDUCTORS" | "SHIPPING" | "BANKING" | "MILITARY" | "CYBER" | "TRADE">;
};

export function mapGeopoliticalShock(event: GeopoliticalEvent) {
  const assets = new Map<string, number>();
  const add = (symbol: string, impact: number) => assets.set(symbol, Math.max(assets.get(symbol) ?? 0, impact));
  const s = clamp(event.severity);
  for (const theme of event.themes) {
    if (theme === "ENERGY") { add("XAU/USD", s * 0.6); add("OIL", s * 0.9); add("EUR/USD", s * 0.35); }
    if (theme === "SEMICONDUCTORS") { add("NAS100", s * 0.85); add("SOXX", s); add("USD/JPY", s * 0.4); }
    if (theme === "SHIPPING") { add("OIL", s * 0.7); add("GLOBAL_EQUITIES", s * 0.55); }
    if (theme === "BANKING") { add("BANKS", s); add("XAU/USD", s * 0.7); add("BONDS", s * 0.6); }
    if (theme === "MILITARY") { add("XAU/USD", s * 0.8); add("DEFENSE", s * 0.9); add("OIL", s * 0.65); }
    if (theme === "CYBER") { add("TECH", s * 0.65); add("CYBERSECURITY", s * 0.75); }
    if (theme === "TRADE") { add("GLOBAL_EQUITIES", s * 0.7); add("USD/CNH", s * 0.8); }
  }
  return [...assets.entries()].map(([symbol, impactScore]) => ({ symbol, impactScore: Number(clamp(impactScore).toFixed(1)) })).sort((a, b) => b.impactScore - a.impactScore);
}
