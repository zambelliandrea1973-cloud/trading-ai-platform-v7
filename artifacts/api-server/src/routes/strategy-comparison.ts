import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request } from "express";
import {
  createBertoDailyPlan,
  type BertoSessionKind,
  type PreviousUsSession,
  type QqqDailyCandle,
} from "../lib/bertoGoldenSetup";
import { buildComparisonSnapshot } from "../lib/strategyComparisonLab";
import { strategyComparisonStore } from "../lib/strategyComparisonStore";

const router: IRouter = Router();

router.get("/strategy-comparison", async (req, res): Promise<void> => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const configured = Number(process.env["STRATEGY_LAB_INITIAL_CAPITAL"]);
  const initialCapital =
    Number.isFinite(configured) && configured > 0 ? configured : 5_000;
  try {
    const trades = await strategyComparisonStore.list(id);
    const timestamps = trades
      .flatMap((trade) => [trade.openedAt, trade.closedAt])
      .sort();
    res.json({
      ...buildComparisonSnapshot(initialCapital, trades, {
        from: timestamps[0],
        to: timestamps.length ? timestamps[timestamps.length - 1] : undefined,
      }),
      persistence: { status: "healthy" },
    });
  } catch {
    res.json({
      ...buildComparisonSnapshot(initialCapital),
      persistence: {
        status: "degraded",
        message: "Migration 0002 non applicata o database non disponibile.",
      },
    });
  }
});

router.post("/strategy-comparison/berto/plan", (req, res): void => {
  if (!userId(req)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const qqq = readCandle(req.body?.qqq);
    const sessionOpen = finiteNumber(
      req.body?.sp500SessionOpen,
      "sp500SessionOpen",
    );
    const previousSession = readPreviousSession(req.body?.previousSession);
    const sessionKind = readSessionKind(req.body?.sessionKind);
    const depth =
      req.body?.depth === undefined
        ? 10
        : finiteInteger(req.body.depth, "depth");
    res.json(
      createBertoDailyPlan(qqq, sessionOpen, {
        previousSession,
        sessionKind,
        depth,
      }),
    );
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Invalid Berto plan input.",
    });
  }
});

function userId(req: Request): string | undefined {
  const auth = getAuth(req);
  const claimUserId = auth?.sessionClaims?.userId;
  return typeof claimUserId === "string"
    ? claimUserId
    : (auth?.userId ?? undefined);
}

function readPreviousSession(value: unknown): PreviousUsSession {
  if (!value || typeof value !== "object")
    throw new Error("previousSession is required.");
  const row = value as Record<string, unknown>;
  return {
    high: finiteNumber(row.high, "previousSession.high"),
    low: finiteNumber(row.low, "previousSession.low"),
    close: finiteNumber(row.close, "previousSession.close"),
    complete: row.complete === true,
  };
}

function readSessionKind(value: unknown): BertoSessionKind {
  if (value === undefined) return "REGULAR";
  if (value === "REGULAR" || value === "HALF_DAY" || value === "CLOSED")
    return value;
  throw new Error("sessionKind must be REGULAR, HALF_DAY or CLOSED.");
}

function readCandle(value: unknown): QqqDailyCandle {
  if (!value || typeof value !== "object")
    throw new Error("qqq candle is required.");
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
  if (!Number.isInteger(parsed))
    throw new Error(`${label} must be an integer.`);
  return parsed;
}

export default router;
