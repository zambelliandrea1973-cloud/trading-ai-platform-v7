import { Router, type IRouter } from "express";
import { db, decisionMemoryTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { getActiveAxiRules, refreshAxiRules } from "../lib/axiRulesSentinel";
import { evaluateAxiProtection, evaluateCrashSentinel, optimizeExecution, rankOpportunities, championChallengerDecision, postTradeDiagnosis } from "../lib/v72PerformanceEngine";
import { allocatePortfolio, bullBearResearchJudge, evaluateDataIntegrity, mapGeopoliticalShock } from "../lib/v72AdvancedAgents";
import { PAPER_BASELINE_AXI, PAPER_BASELINE_CRASH, PAPER_OPPORTUNITY_CANDIDATES } from "../lib/paperBaseline";

const router: IRouter = Router();

function authenticatedUserId(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  return String(auth?.sessionClaims?.userId || auth?.userId || "");
}

function publicDecisionMemory<T extends { userId?: string | null }>(row: T) {
  const { userId: _userId, ...record } = row;
  return record;
}

function englishDecisionText(value: string) {
  const translations: Array<[string, string]> = [
    ["Target Axi raggiunto: trading continua in modalità active profit protection.", "Axi target reached: trading continues in active profit protection mode."],
    ["Alta correlazione con portafoglio esistente.", "High correlation with the existing portfolio."],
    ["Concentrazione settoriale elevata.", "High sector concentration."],
    ["Crash Sentinel DEFENSIVE: size ridotta, non blocco automatico.", "Crash Sentinel DEFENSIVE: reduced size, not an automatic block."],
    ["Crash Sentinel CRISIS: solo micro-size/hedge/short selettivi.", "Crash Sentinel CRISIS: selective micro-size, hedge, or short exposure only."],
  ];
  return translations.find(([source]) => source === value)?.[1] ?? value;
}

router.get("/v72/schema", (_req, res) => {
  res.json({
    version: "7.2",
    modules: [
      "Axi Rules Sentinel",
      "Active Profit Protection",
      "Adaptive Drawdown / Recovery",
      "Universe Opportunity Ranking",
      "Portfolio Allocation",
      "Systemic Crash Sentinel",
      "Correlation Breakdown integration",
      "Geopolitical Shock Mapper",
      "Execution Optimizer",
      "Bull/Bear Research Judge",
      "Point-in-Time Data Integrity Guard",
      "Persistent Decision Memory / Post-Trade Diagnosis",
      "Champion / Challenger",
    ],
    principle: "Protect capital by reducing size before blocking valid opportunities; continue micro-size trading after Axi targets are reached.",
  });
});

router.get("/axi/rules", (_req, res) => res.json(getActiveAxiRules()));
router.get("/axi/progress", (_req, res) => {
  const axi = evaluateAxiProtection(PAPER_BASELINE_AXI);
  const crash = evaluateCrashSentinel(PAPER_BASELINE_CRASH);
  res.json({
    stage: PAPER_BASELINE_AXI.stage,
    protectionMode: axi.mode,
    marketRegime: crash.regime,
    edgeScore: PAPER_BASELINE_AXI.edgeScore,
    closedTrades: PAPER_BASELINE_AXI.closedTrades,
    stageDays: PAPER_BASELINE_AXI.stageDays,
    currentEquity: PAPER_BASELINE_AXI.currentEquity,
    allocationEquity: PAPER_BASELINE_AXI.allocationEquity,
    monthlyProfitPct: axi.monthlyProfitPct,
    stageProfitPct: axi.stageProfitPct,
    progressionReady: axi.progressionReady,
    baseSizeMultiplier: axi.baseSizeMultiplier,
    reasons: [...axi.reasons, ...crash.reasons],
    rules: axi.rules,
  });
});
router.get("/v72/opportunities-style", (req, res) => {
  const ranked = rankOpportunities(PAPER_OPPORTUNITY_CANDIDATES, PAPER_BASELINE_AXI, PAPER_BASELINE_CRASH);
  res.json(req.query.locale === "en" ? ranked.map((item) => ({ ...item, reasons: item.reasons.map(englishDecisionText) })) : ranked);
});
router.post("/axi/rules/refresh", async (_req, res) => res.json(await refreshAxiRules()));
router.post("/axi/protection/evaluate", (req, res) => res.json(evaluateAxiProtection(req.body)));
router.post("/crash/evaluate", (req, res) => res.json(evaluateCrashSentinel(req.body)));
router.post("/opportunities/rank", (req, res) => res.json(rankOpportunities(req.body?.candidates ?? [], req.body?.axi ?? {}, req.body?.crash ?? {})));
router.post("/portfolio/allocate", (req, res) => res.json(allocatePortfolio(req.body?.candidates ?? [], req.body?.maxTotalRiskPct, req.body?.maxSectorRiskPct)));
router.post("/execution/optimize", (req, res) => res.json(optimizeExecution(req.body)));
router.post("/research/debate", (req, res) => res.json(bullBearResearchJudge(req.body)));
router.post("/data-integrity/evaluate", (req, res) => res.json(evaluateDataIntegrity(req.body)));
router.post("/geopolitical/map", (req, res) => res.json(mapGeopoliticalShock(req.body)));
router.post("/post-trade/diagnose", (req, res) => res.json(postTradeDiagnosis(req.body)));
router.post("/validation/champion-challenger", (req, res) => res.json(championChallengerDecision(req.body?.champion, req.body?.challenger)));

router.post("/decision-memory", async (req, res) => {
  const body = req.body ?? {};
  const userId = authenticatedUserId(req);
  if (!body.externalId || !body.symbol || !body.algorithmVersion || !body.regime || !body.decision) {
    res.status(400).json({ error: "externalId, symbol, algorithmVersion, regime and decision are required" });
    return;
  }
  if (body.regime !== "PAPER") {
    res.status(400).json({ error: "Only PAPER decision-memory records are accepted" });
    return;
  }
  const [created] = await db.insert(decisionMemoryTable).values({
    userId,
    externalId: String(body.externalId),
    symbol: String(body.symbol),
    algorithmVersion: String(body.algorithmVersion),
    regime: String(body.regime),
    decision: String(body.decision),
    finalScore: body.finalScore == null ? null : Number(body.finalScore),
    confidence: Number(body.confidence ?? 0),
    sizeMultiplier: Number(body.sizeMultiplier ?? 0),
    rationale: String(body.rationale ?? ""),
    brainSnapshot: body.brainSnapshot ?? {},
    marketSnapshot: body.marketSnapshot ?? {},
    outcomeR: null,
    maxAdverseExcursionR: null,
    maxFavourableExcursionR: null,
    exitReason: null,
    closedAt: null,
  }).returning();
  res.status(201).json(publicDecisionMemory(created));
});

router.patch("/decision-memory/:externalId/outcome", async (req, res) => {
  const body = req.body ?? {};
  const userId = authenticatedUserId(req);
  const [updated] = await db.update(decisionMemoryTable).set({
    outcomeR: body.outcomeR == null ? null : Number(body.outcomeR),
    maxAdverseExcursionR: body.maxAdverseExcursionR == null ? null : Number(body.maxAdverseExcursionR),
    maxFavourableExcursionR: body.maxFavourableExcursionR == null ? null : Number(body.maxFavourableExcursionR),
    exitReason: body.exitReason == null ? null : String(body.exitReason),
    closedAt: new Date(),
  }).where(and(eq(decisionMemoryTable.userId, userId), eq(decisionMemoryTable.externalId, req.params.externalId))).returning();
  if (!updated) {
    res.status(404).json({ error: "decision memory record not found" });
    return;
  }
  res.json(publicDecisionMemory(updated));
});

router.get("/decision-memory/recent", async (req, res) => {
  const userId = authenticatedUserId(req);
  const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50) || 50));
  const rows = await db.select().from(decisionMemoryTable).where(and(eq(decisionMemoryTable.userId, userId), eq(decisionMemoryTable.regime, "PAPER"))).orderBy(desc(decisionMemoryTable.createdAt)).limit(limit);
  res.json(rows.map(publicDecisionMemory));
});

export default router;
