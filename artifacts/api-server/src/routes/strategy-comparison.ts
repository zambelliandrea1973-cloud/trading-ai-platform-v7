import { Router, type IRouter } from "express";
import {
  createBertoDailyPlan,
  type QqqDailyCandle,
} from "../lib/bertoGoldenSetup";
import { buildComparisonSnapshot } from "../lib/strategyComparisonLab";

const router: IRouter = Router();

router.get("/strategy-comparison", (_req, res): void => {
  const configured = Number(process.env["STRATEGY_LAB_INITIAL_CAPITAL"]);
  const initialCapital = Number.isFinite(configured) && configured > 0 ? configured : 5_000;
  res.json(buildComparisonSnapshot(initialCapital));
});

router.post("/strategy-comparison/berto/plan", (req, res): void => {
  try {
    const qqq = readCandle(req.body?.qqq);
    const sessionOpen = finiteNumber(req.body?.sp500SessionOpen, "sp500SessionOpen");
    const depth = req.body?.depth === undefined
      ? 8
      : finiteInteger(req.body.depth, "depth");
    res.json(createBertoDailyPlan(qqq, sessionOpen, depth));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid Berto plan input.",
    });
  }
});

function readCandle(value: unknown): QqqDailyCandle {
  if (!value || typeof value !== "object") throw new Error("qqq candle is required.");
  const row = value as Record<string, unknown>;
  return {
    open: finiteNumber(row.open, "qqq.open"),
    high: finiteNumber(row.high, "qqq.high"),
    low: finiteNumber(row.low, "qqq.low"),
    close: finiteNumber(row.close, "qqq.close"),
  };
}

function finiteNumber(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be finite.`);
  return parsed;
}

function finiteInteger(value: unknown, label: string): number {
  const parsed = finiteNumber(value, label);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be an integer.`);
  return parsed;
}

export default router;
