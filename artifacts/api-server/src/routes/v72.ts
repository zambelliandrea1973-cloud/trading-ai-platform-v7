import { Router, type IRouter } from "express";
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
      "Decision Memory / Post-Trade Diagnosis",
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

export default router;
