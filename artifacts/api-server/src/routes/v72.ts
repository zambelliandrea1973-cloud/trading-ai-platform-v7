import { Router, type IRouter } from "express";
import { db, decisionMemoryTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getActiveAxiRules, refreshAxiRules } from "../lib/axiRulesSentinel";
import { evaluateAxiProtection, evaluateCrashSentinel, optimizeExecution, rankOpportunities, championChallengerDecision, postTradeDiagnosis } from "../lib/v72PerformanceEngine";
import { allocatePortfolio, bullBearResearchJudge, evaluateDataIntegrity, mapGeopoliticalShock } from "../lib/v72AdvancedAgents";

const router: IRouter = Router();

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
  if (!body.externalId || !body.symbol || !body.algorithmVersion || !body.regime || !body.decision) {
    res.status(400).json({ error: "externalId, symbol, algorithmVersion, regime and decision are required" });
    return;
  }
  const [created] = await db.insert(decisionMemoryTable).values({
    externalId: String(body.externalId),
    symbol: String(body.symbol),
    algorithmVersion: String(body.algorithmVersion),
    regime: String(body.regime),
    decision: String(body.decision),
    finalScore: body.finalScore == null ? null : String(body.finalScore),
    confidence: String(body.confidence ?? 0),
    sizeMultiplier: String(body.sizeMultiplier ?? 0),
    rationale: String(body.rationale ?? ""),
    brainSnapshot: body.brainSnapshot ?? {},
    marketSnapshot: body.marketSnapshot ?? {},
    outcomeR: null,
    maxAdverseExcursionR: null,
    maxFavourableExcursionR: null,
    exitReason: null,
    closedAt: null,
  }).returning();
  res.status(201).json(created);
});

router.patch("/decision-memory/:externalId/outcome", async (req, res) => {
  const body = req.body ?? {};
  const [updated] = await db.update(decisionMemoryTable).set({
    outcomeR: body.outcomeR == null ? null : String(body.outcomeR),
    maxAdverseExcursionR: body.maxAdverseExcursionR == null ? null : String(body.maxAdverseExcursionR),
    maxFavourableExcursionR: body.maxFavourableExcursionR == null ? null : String(body.maxFavourableExcursionR),
    exitReason: body.exitReason == null ? null : String(body.exitReason),
    closedAt: new Date(),
  }).where(eq(decisionMemoryTable.externalId, req.params.externalId)).returning();
  if (!updated) {
    res.status(404).json({ error: "decision memory record not found" });
    return;
  }
  res.json(updated);
});

router.get("/decision-memory/recent", async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50) || 50));
  const rows = await db.select().from(decisionMemoryTable).orderBy(desc(decisionMemoryTable.createdAt)).limit(limit);
  res.json(rows);
});

export default router;
