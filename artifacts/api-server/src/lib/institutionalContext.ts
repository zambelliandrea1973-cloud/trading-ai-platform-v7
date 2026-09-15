export type SourceQuality = "PRIMARY" | "SECONDARY" | "UNKNOWN";
export type DataHealth = "OK" | "STALE" | "INVALID" | "INSUFFICIENT";

export type DataLineage = {
  provider: string;
  sourceUrl?: string | null;
  observedAt: string;
  releasedAt?: string | null;
  vintageAt?: string | null;
  quality: SourceQuality;
};

export type CotPositioningInput = {
  netPosition: number;
  previousNetPosition?: number | null;
  percentile52w?: number | null;
  percentile5y?: number | null;
  openInterest?: number | null;
  ageHours: number;
  lineage: DataLineage;
};

export type SeasonalityInput = {
  meanReturnPct: number;
  medianReturnPct: number;
  positiveRatePct: number;
  sampleSize: number;
  dispersionPct: number;
  maxAdversePct?: number | null;
  regimeSimilarity?: number | null;
  lineage: DataLineage;
};

export type FairValueInput = {
  model: string;
  currentPrice: number;
  fairValue: number;
  uncertaintyPct: number;
  ageHours: number;
  lineage: DataLineage;
};

export type MacroRegimeInput = {
  regime: "RISK_ON" | "RISK_OFF" | "INFLATIONARY" | "DISINFLATIONARY" | "TIGHTENING" | "EASING" | "MIXED";
  directionalScore?: number | null;
  confidence: number;
  ageHours: number;
  lineage: DataLineage[];
};

export type InstitutionalContextInput = {
  cot?: CotPositioningInput | null;
  seasonality?: SeasonalityInput | null;
  fairValue?: FairValueInput | null;
  macroRegime?: MacroRegimeInput | null;
};

export type ContextComponent = {
  score: number | null;
  confidence: number;
  health: DataHealth;
  warnings: string[];
};

export type InstitutionalContextResult = {
  score: number | null;
  confidence: number;
  direction: "BUY" | "SELL" | "NEUTRAL" | "UNAVAILABLE";
  mode: "SHADOW";
  components: {
    cot: ContextComponent;
    seasonality: ContextComponent;
    fairValue: ContextComponent;
    macroRegime: ContextComponent;
  };
  warnings: string[];
  rationale: string;
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const unavailable = (): ContextComponent => ({ score: null, confidence: 0, health: "INSUFFICIENT", warnings: [] });

function cotComponent(input?: CotPositioningInput | null): ContextComponent {
  if (!input || !valid(input.netPosition) || input.lineage.quality !== "PRIMARY") return unavailable();
  const warnings: string[] = [];
  if (input.ageHours > 192) warnings.push("COT oltre otto giorni: dato non utilizzabile.");
  else if (input.ageHours > 120) warnings.push("COT vicino alla scadenza settimanale.");
  const percentile = valid(input.percentile5y) ? input.percentile5y : input.percentile52w;
  if (!valid(percentile)) return { score: null, confidence: 0, health: "INSUFFICIENT", warnings: [...warnings, "Manca il percentile storico COT."] };
  const delta = valid(input.previousNetPosition) ? input.netPosition - input.previousNetPosition : 0;
  const oiScale = valid(input.openInterest) && input.openInterest > 0 ? Math.min(12, Math.abs(delta / input.openInterest) * 500) : 0;
  const score = clamp(percentile + Math.sign(delta) * oiScale);
  const health: DataHealth = input.ageHours > 192 ? "STALE" : "OK";
  return { score: health === "OK" ? Number(score.toFixed(1)) : null, confidence: health === "OK" ? (valid(input.percentile5y) ? 80 : 65) : 0, health, warnings };
}

function seasonalityComponent(input?: SeasonalityInput | null): ContextComponent {
  if (!input || ![input.meanReturnPct, input.medianReturnPct, input.positiveRatePct, input.dispersionPct].every(valid)) return unavailable();
  const warnings: string[] = [];
  if (input.sampleSize < 10) return { score: null, confidence: 0, health: "INSUFFICIENT", warnings: ["Campione stagionale inferiore a 10 osservazioni."] };
  const edge = (input.meanReturnPct + input.medianReturnPct) / 2;
  const noise = Math.max(0.01, input.dispersionPct);
  const signalToNoise = clamp(50 + (edge / noise) * 25);
  const hitRate = clamp(input.positiveRatePct);
  const regime = valid(input.regimeSimilarity) ? clamp(input.regimeSimilarity) : 50;
  const score = 0.45 * signalToNoise + 0.4 * hitRate + 0.15 * regime;
  const sampleConfidence = clamp(((input.sampleSize - 10) / 20) * 100);
  const confidence = Math.round(Math.min(sampleConfidence, clamp(100 - input.dispersionPct * 8)));
  if (input.sampleSize < 20) warnings.push("Stagionalità esplorativa: campione inferiore a 20.");
  if (confidence < 50) warnings.push("Stagionalità debole o dispersa: non usare come segnale isolato.");
  return { score: Number(score.toFixed(1)), confidence, health: "OK", warnings };
}

function fairValueComponent(input?: FairValueInput | null): ContextComponent {
  if (!input || !valid(input.currentPrice) || !valid(input.fairValue) || !valid(input.uncertaintyPct) || input.currentPrice <= 0 || input.fairValue <= 0 || input.uncertaintyPct <= 0) return unavailable();
  const warnings: string[] = [];
  if (input.ageHours > 168) warnings.push("Fair value oltre sette giorni.");
  const gapPct = ((input.fairValue - input.currentPrice) / input.currentPrice) * 100;
  const normalized = clamp(50 + (gapPct / input.uncertaintyPct) * 20);
  const health: DataHealth = input.ageHours > 168 ? "STALE" : "OK";
  return { score: health === "OK" ? Number(normalized.toFixed(1)) : null, confidence: health === "OK" ? Math.round(clamp(80 - input.uncertaintyPct)) : 0, health, warnings };
}

function macroComponent(input?: MacroRegimeInput | null): ContextComponent {
  if (!input || !valid(input.confidence) || !valid(input.directionalScore)) return unavailable();
  const primarySources = input.lineage.filter((x) => x.quality === "PRIMARY").length;
  const warnings: string[] = [];
  if (!primarySources) return { score: null, confidence: 0, health: "INVALID", warnings: ["Regime macro privo di fonti primarie."] };
  if (input.ageHours > 72) warnings.push("Regime macro da aggiornare.");
  const health: DataHealth = input.ageHours > 72 ? "STALE" : "OK";
  return { score: health === "OK" ? clamp(input.directionalScore) : null, confidence: health === "OK" ? Math.round(clamp(input.confidence) * Math.min(1, primarySources / 2)) : 0, health, warnings };
}

export function evaluateInstitutionalContext(input: InstitutionalContextInput): InstitutionalContextResult {
  const components = {
    cot: cotComponent(input.cot),
    seasonality: seasonalityComponent(input.seasonality),
    fairValue: fairValueComponent(input.fairValue),
    macroRegime: macroComponent(input.macroRegime),
  };
  const entries = Object.values(components).filter((x) => x.score !== null && x.confidence > 0);
  const warnings = Object.values(components).flatMap((x) => x.warnings);
  if (!entries.length) return { score: null, confidence: 0, direction: "UNAVAILABLE", mode: "SHADOW", components, warnings, rationale: "Contesto istituzionale non disponibile o non abbastanza fresco." };
  const denominator = entries.reduce((s, x) => s + x.confidence, 0);
  const score = entries.reduce((s, x) => s + (x.score ?? 50) * x.confidence, 0) / denominator;
  const coverage = entries.length / 4;
  const confidence = Math.round(clamp((denominator / entries.length) * coverage));
  return {
    score: Number(score.toFixed(1)),
    confidence,
    direction: score >= 60 ? "BUY" : score <= 40 ? "SELL" : "NEUTRAL",
    mode: "SHADOW",
    components,
    warnings,
    rationale: "COT, stagionalità, fair value e regime macro sono registrati in shadow mode: non modificano ancora decisione o size.",
  };
}
