import { Router, type IRouter } from "express";
import { evaluateMasterDecision } from "../lib/masterDecisionEngine";
import { evaluateStatistical } from "../lib/statisticalBrain";

const router: IRouter = Router();

router.get("/decision/schema", (_req, res) => {
  res.json({
    version: "7.1",
    horizons: ["intraday", "swing", "position"],
    decisions: ["BUY", "SELL", "WAIT", "NO_TRADE"],
    philosophy: {
      performance: "Soft guards reduce size before suppressing valid opportunities.",
      safety: "Hard vetoes are reserved for extreme capital, execution or data-quality conditions.",
      missingData: "Available brain weights are re-normalized instead of forcing NO_TRADE.",
    },
    hardVetoDefaults: {
      dailyLossPct: 4,
      drawdownPct: 10,
      volatilityShockMultiple: 4,
      spreadMultiple: 4,
      slippageMultiple: 4,
      brokerDisconnected: true,
      staleOrInvalidData: true,
    },
    actionBands: {
      buyAtOrAbove: 66,
      sellAtOrBelow: 34,
      otherwise: "WAIT",
    },
  });
});

router.post("/statistical/evaluate", (req, res) => {
  try {
    res.json(evaluateStatistical(req.body ?? {}));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Input statistico non valido" });
  }
});

router.post("/decision/evaluate", (req, res) => {
  try {
    const horizon = req.body?.horizon;
    if (!(["intraday", "swing", "position"] as const).includes(horizon)) {
      res.status(400).json({ error: "horizon deve essere intraday, swing o position" });
      return;
    }
    if (!req.body?.technical || !req.body?.macroNews) {
      res.status(400).json({ error: "technical e macroNews sono obbligatori" });
      return;
    }
    res.json(evaluateMasterDecision(req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Input decisionale non valido" });
  }
});

export default router;
