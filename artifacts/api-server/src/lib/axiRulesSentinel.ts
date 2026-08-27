export type AxiStageName = "PRE_SEED" | "SEED" | "INCUBATION" | "ACCELERATION" | "PRO" | "PRO_500" | "PRO_M";

export type AxiStageRules = {
  stage: AxiStageName;
  minEquityUsd: number;
  minEdgeScore: number;
  profitTargetPct: number | null;
  minDays: number | null;
  minTrades: number | null;
  maxLossPct: number;
  leverage: number | null;
};

export type AxiRulesSnapshot = {
  version: string;
  verifiedAt: string;
  sources: string[];
  stages: Record<AxiStageName, AxiStageRules>;
};

export const AXI_RULE_SOURCES = [
  "https://www.axi.com/int/funded-trader-program",
  "https://www.axi.com/it-ch/funded-trader-program",
  "https://svgsupport.axi.com/en-US/axisvg--axicorp-prod/article/g9t1fAl3-what-is-the-profit-target-to-advance-to-the-next-axi-select-stage",
];

// Verified against Axi primary/support pages on 2026-08-27.
export const DEFAULT_AXI_RULES: AxiRulesSnapshot = {
  version: "2026-08-27",
  verifiedAt: "2026-08-27T00:00:00Z",
  sources: AXI_RULE_SOURCES,
  stages: {
    PRE_SEED: { stage: "PRE_SEED", minEquityUsd: 500, minEdgeScore: 50, profitTargetPct: null, minDays: null, minTrades: 20, maxLossPct: 7, leverage: null },
    SEED: { stage: "SEED", minEquityUsd: 500, minEdgeScore: 50, profitTargetPct: 7, minDays: 30, minTrades: 20, maxLossPct: 7, leverage: 1000 },
    INCUBATION: { stage: "INCUBATION", minEquityUsd: 1000, minEdgeScore: 60, profitTargetPct: 7, minDays: 60, minTrades: 40, maxLossPct: 7, leverage: 100 },
    ACCELERATION: { stage: "ACCELERATION", minEquityUsd: 2000, minEdgeScore: 70, profitTargetPct: 7, minDays: 60, minTrades: 50, maxLossPct: 7, leverage: 100 },
    PRO: { stage: "PRO", minEquityUsd: 5000, minEdgeScore: 90, profitTargetPct: 7, minDays: 60, minTrades: 50, maxLossPct: 7, leverage: 100 },
    PRO_500: { stage: "PRO_500", minEquityUsd: 10000, minEdgeScore: 90, profitTargetPct: 7, minDays: 60, minTrades: 50, maxLossPct: 7, leverage: 100 },
    PRO_M: { stage: "PRO_M", minEquityUsd: 20000, minEdgeScore: 90, profitTargetPct: 10, minDays: null, minTrades: null, maxLossPct: 10, leverage: 100 },
  },
};

let activeRules = structuredClone(DEFAULT_AXI_RULES);

function normalizeText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function findNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1].replace(/,/g, "."));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function extractCommon(text: string) {
  return {
    standardProfitTargetPct: findNumber(text, [
      /profit target(?: \(allocation account\))?[^0-9]{0,100}(\d+(?:[.,]\d+)?)\s*%/i,
      /obiettivo di profitto(?: \(account di allocazione\))?[^0-9]{0,100}(\d+(?:[.,]\d+)?)\s*%/i,
    ]),
    standardMaxLossPct: findNumber(text, [
      /maximum loss[^0-9]{0,100}-?(\d+(?:[.,]\d+)?)\s*%/i,
      /perdita massima[^0-9]{0,100}-?(\d+(?:[.,]\d+)?)\s*%/i,
    ]),
    seedTrades: findNumber(text, [
      /Seed[\s\S]{0,900}?Trades(?: Per Stage)?[^0-9]{0,80}(\d+)/i,
      /Seme[\s\S]{0,900}?Operazioni per fase[^0-9]{0,80}(\d+)/i,
    ]),
    seedMinDays: findNumber(text, [
      /Seed[\s\S]{0,900}?(?:Stage Duration|minimum stage duration)[^0-9]{0,80}(\d+)/i,
      /Seme[\s\S]{0,900}?Durata(?: della fase)?[^0-9]{0,80}(\d+)/i,
    ]),
    proMProfitTargetPct: findNumber(text, [
      /Pro M[\s\S]{0,1000}?profit target[^0-9]{0,100}(\d+(?:[.,]\d+)?)\s*%/i,
      /Pro M[\s\S]{0,1000}?obiettivo di profitto[^0-9]{0,100}(\d+(?:[.,]\d+)?)\s*%/i,
    ]),
    proMMaxLossPct: findNumber(text, [
      /Pro M[\s\S]{0,1200}?maximum loss[^0-9]{0,100}-?(\d+(?:[.,]\d+)?)\s*%/i,
      /Pro M[\s\S]{0,1200}?perdita massima[^0-9]{0,100}-?(\d+(?:[.,]\d+)?)\s*%/i,
    ]),
  };
}

export type AxiSentinelResult = {
  checkedAt: string;
  status: "UNCHANGED" | "UPDATED" | "DEGRADED" | "CONFLICT";
  activeRules: AxiRulesSnapshot;
  changes: string[];
  sourceResults: Array<{ url: string; ok: boolean; extracted: Record<string, number | null> }>;
};

export async function refreshAxiRules(fetcher: typeof fetch = fetch): Promise<AxiSentinelResult> {
  const sourceResults: AxiSentinelResult["sourceResults"] = [];
  const observations: Array<Record<string, number | null>> = [];

  for (const url of AXI_RULE_SOURCES) {
    try {
      const response = await fetcher(url, { headers: { "user-agent": "TradingAI-AxiSentinel/1.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const extracted = extractCommon(normalizeText(await response.text()));
      observations.push(extracted);
      sourceResults.push({ url, ok: true, extracted });
    } catch {
      sourceResults.push({ url, ok: false, extracted: {} });
    }
  }

  if (observations.length < 2) {
    return { checkedAt: new Date().toISOString(), status: "DEGRADED", activeRules, changes: [], sourceResults };
  }

  const consensus = (key: string, current: number | null): number | null => {
    const values = observations.map((item) => item[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length < 2) return current;
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length || ranked[0][1] < 2) return null;
    return ranked[0][0];
  };

  const standardProfitTargetPct = consensus("standardProfitTargetPct", activeRules.stages.SEED.profitTargetPct);
  const standardMaxLossPct = consensus("standardMaxLossPct", activeRules.stages.SEED.maxLossPct);
  const seedTrades = consensus("seedTrades", activeRules.stages.SEED.minTrades);
  const seedMinDays = consensus("seedMinDays", activeRules.stages.SEED.minDays);
  const proMProfitTargetPct = consensus("proMProfitTargetPct", activeRules.stages.PRO_M.profitTargetPct);
  const proMMaxLossPct = consensus("proMMaxLossPct", activeRules.stages.PRO_M.maxLossPct);

  if ([standardProfitTargetPct, standardMaxLossPct, seedTrades, seedMinDays, proMProfitTargetPct, proMMaxLossPct].some((value) => value === null)) {
    return { checkedAt: new Date().toISOString(), status: "CONFLICT", activeRules, changes: [], sourceResults };
  }

  const changes: string[] = [];
  const next = structuredClone(activeRules);
  for (const stage of ["SEED", "INCUBATION", "ACCELERATION", "PRO", "PRO_500"] as const) {
    if (next.stages[stage].profitTargetPct !== standardProfitTargetPct) changes.push(`${stage}: profit target ${next.stages[stage].profitTargetPct}% -> ${standardProfitTargetPct}%`);
    if (next.stages[stage].maxLossPct !== standardMaxLossPct) changes.push(`${stage}: max loss ${next.stages[stage].maxLossPct}% -> ${standardMaxLossPct}%`);
    next.stages[stage].profitTargetPct = standardProfitTargetPct;
    next.stages[stage].maxLossPct = standardMaxLossPct as number;
  }
  if (next.stages.SEED.minTrades !== seedTrades) changes.push(`SEED: trades ${next.stages.SEED.minTrades} -> ${seedTrades}`);
  if (next.stages.SEED.minDays !== seedMinDays) changes.push(`SEED: min days ${next.stages.SEED.minDays} -> ${seedMinDays}`);
  if (next.stages.PRO_M.profitTargetPct !== proMProfitTargetPct) changes.push(`PRO_M: profit target ${next.stages.PRO_M.profitTargetPct}% -> ${proMProfitTargetPct}%`);
  if (next.stages.PRO_M.maxLossPct !== proMMaxLossPct) changes.push(`PRO_M: max loss ${next.stages.PRO_M.maxLossPct}% -> ${proMMaxLossPct}%`);
  next.stages.SEED.minTrades = seedTrades;
  next.stages.SEED.minDays = seedMinDays;
  next.stages.PRO_M.profitTargetPct = proMProfitTargetPct;
  next.stages.PRO_M.maxLossPct = proMMaxLossPct as number;

  if (changes.length) {
    next.version = `remote-${new Date().toISOString()}`;
    next.verifiedAt = new Date().toISOString();
    activeRules = next;
  }

  return { checkedAt: new Date().toISOString(), status: changes.length ? "UPDATED" : "UNCHANGED", activeRules, changes, sourceResults };
}

export function getActiveAxiRules() {
  return activeRules;
}
