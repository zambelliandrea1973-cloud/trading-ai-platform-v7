import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request } from "express";
import { mt5BridgeAdapter } from "../lib/broker/mt5-bridge-adapter";
import {
  RUN_MODES,
  STRATEGIES,
  normalizeSymbol,
  strategyModeManager,
  type StrategyKind,
  type StrategyRunMode,
  type TradeDirection,
} from "../lib/strategyModeManager";

const router: IRouter = Router();
const userId = (req: Request): string | undefined => {
  const auth = getAuth(req);
  const claimUserId = auth?.sessionClaims?.userId;
  return typeof claimUserId === "string" ? claimUserId : auth?.userId ?? undefined;
};

async function brokerGate() {
  const status = await mt5BridgeAdapter.getStatus();
  return {
    connected: status.connected,
    executionEnabled: status.executionEnabled,
    persistenceHealthy: status.database.status === "healthy",
  };
}

router.get("/strategy-control", async (req, res): Promise<void> => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const [profiles, locks, riskControls] = await Promise.all([
    strategyModeManager.list(String(id), await brokerGate()),
    strategyModeManager.listLocks(String(id)),
    strategyModeManager.getRiskControls(String(id)),
  ]);
  res.json({ profiles, locks, riskControls });
});

router.put("/strategy-control/:strategy/mode", async (req, res): Promise<void> => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const strategy = String(req.params.strategy).toUpperCase() as StrategyKind;
  const mode = String(req.body?.mode ?? "").toUpperCase() as StrategyRunMode;
  if (!STRATEGIES.includes(strategy) || !RUN_MODES.includes(mode)) {
    res.status(400).json({ error: "Strategia o modalità non valida." });
    return;
  }
  const result = await strategyModeManager.setMode(String(id), strategy, mode, await brokerGate());
  res.status(result.updated ? 200 : 409).json(result);
});

router.post("/strategy-control/locks/acquire", async (req, res): Promise<void> => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const strategy = String(req.body?.strategy ?? "").toUpperCase() as StrategyKind;
  const runMode = String(req.body?.runMode ?? "").toUpperCase() as "DEMO" | "LIVE";
  const direction = String(req.body?.direction ?? "").toUpperCase() as TradeDirection;
  if (
    !STRATEGIES.includes(strategy)
    || !["DEMO", "LIVE"].includes(runMode)
    || !["BUY", "SELL"].includes(direction)
    || typeof req.body?.symbol !== "string"
  ) {
    res.status(400).json({ error: "Input lock non valido." });
    return;
  }
  const profiles = await strategyModeManager.list(String(id), await brokerGate());
  const profile = profiles.find((item) => item.strategy === strategy)!;
  if (profile.mode !== runMode) {
    res.status(409).json({ error: "La modalità richiesta non coincide con quella attiva." });
    return;
  }
  const result = await strategyModeManager.acquireLock(String(id), {
    symbol: req.body.symbol,
    strategy,
    runMode,
    direction,
    externalPositionId: typeof req.body.externalPositionId === "string" ? req.body.externalPositionId : undefined,
    ttlMinutes: profile.maxHoldingMinutes + profile.cooldownMinutes,
    riskPerTradePct: optionalFiniteNumber(req.body.riskPerTradePct),
    dailyLossPct: optionalFiniteNumber(req.body.dailyLossPct),
    openExposurePct: optionalFiniteNumber(req.body.openExposurePct),
    openPositionCount: optionalFiniteNumber(req.body.openPositionCount),
  });
  res.status(result.acquired ? 201 : 409).json(result);
});

router.post("/strategy-control/locks/release", async (req, res): Promise<void> => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const strategy = String(req.body?.strategy ?? "").toUpperCase() as StrategyKind;
  if (!STRATEGIES.includes(strategy) || typeof req.body?.symbol !== "string") {
    res.status(400).json({ error: "Strategia o simbolo non valido." });
    return;
  }
  const lock = await strategyModeManager.getLock(String(id), req.body.symbol, strategy);
  if (!lock) {
    res.status(404).json({ error: "Lock non trovato." });
    return;
  }

  // Never trust a browser-provided brokerConfirmsClosed flag. Ask the
  // authenticated server-side adapter for positions and release only when
  // MT5 no longer reports the owned position (or symbol).
  let positions;
  try {
    positions = await mt5BridgeAdapter.getPositions();
  } catch {
    res.status(503).json({ error: "Conferma chiusura MT5 non disponibile." });
    return;
  }
  const canonicalSymbol = normalizeSymbol(req.body.symbol);
  const stillOpen = positions.some((position) => {
    const sameExternalId = lock.externalPositionId && position.externalId === lock.externalPositionId;
    const sameSymbol = normalizeSymbolSafely(position.symbol) === canonicalSymbol;
    return Boolean(sameExternalId || (!lock.externalPositionId && sameSymbol));
  });
  if (stillOpen) {
    res.status(409).json({ released: false, reason: "MT5 conferma che la posizione è ancora aperta." });
    return;
  }
  res.json(await strategyModeManager.releaseLock(String(id), canonicalSymbol, strategy, true));
});

function optionalFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSymbolSafely(symbol: string): string | undefined {
  try {
    return normalizeSymbol(symbol);
  } catch {
    return undefined;
  }
}

export default router;