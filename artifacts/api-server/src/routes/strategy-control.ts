import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import { mt5BridgeAdapter } from "../lib/broker/mt5-bridge-adapter";
import { STRATEGIES, strategyModeManager, type StrategyKind, type StrategyRunMode } from "../lib/strategyModeManager";

const router: IRouter = Router();
const MODES: StrategyRunMode[] = ["OFF", "DEMO", "LIVE"];
const userId = (req: Parameters<typeof getAuth>[0]) => getAuth(req)?.sessionClaims?.userId || getAuth(req)?.userId;
async function brokerGate() {
  const status = await mt5BridgeAdapter.getStatus();
  return { connected: status.connected, executionEnabled: status.executionEnabled, persistenceHealthy: status.database.status === "healthy" };
}

router.get("/strategy-control", async (req, res) => {
  const id = userId(req);
  if (!id) return void res.status(401).json({ error: "Authentication required" });
  res.json({ profiles: await strategyModeManager.list(String(id), await brokerGate()), locks: await strategyModeManager.listLocks(String(id)) });
});

router.put("/strategy-control/:strategy/mode", async (req, res) => {
  const id = userId(req);
  const strategy = String(req.params.strategy).toUpperCase() as StrategyKind;
  const mode = String(req.body?.mode ?? "").toUpperCase() as StrategyRunMode;
  if (!id) return void res.status(401).json({ error: "Authentication required" });
  if (!STRATEGIES.includes(strategy) || !MODES.includes(mode)) return void res.status(400).json({ error: "Strategia o modalità non valida." });
  const result = await strategyModeManager.setMode(String(id), strategy, mode, await brokerGate());
  res.status(result.updated ? 200 : 409).json(result);
});

router.post("/strategy-control/locks/acquire", async (req, res) => {
  const id = userId(req);
  if (!id) return void res.status(401).json({ error: "Authentication required" });
  const strategy = String(req.body?.strategy ?? "").toUpperCase() as StrategyKind;
  const runMode = String(req.body?.runMode ?? "").toUpperCase() as "DEMO" | "LIVE";
  if (!STRATEGIES.includes(strategy) || !["DEMO", "LIVE"].includes(runMode)) return void res.status(400).json({ error: "Input lock non valido." });
  const profiles = await strategyModeManager.list(String(id), await brokerGate());
  const profile = profiles.find((item) => item.strategy === strategy)!;
  if (profile.mode !== runMode) return void res.status(409).json({ error: "La modalità richiesta non coincide con quella attiva." });
  const result = await strategyModeManager.acquireLock(String(id), { symbol: String(req.body?.symbol ?? ""), strategy, runMode, direction: req.body?.direction === "SELL" ? "SELL" : "BUY", externalPositionId: req.body?.externalPositionId, ttlMinutes: profile.maxHoldingMinutes + profile.cooldownMinutes });
  res.status(result.acquired ? 201 : 409).json(result);
});

router.post("/strategy-control/locks/release", async (req, res) => {
  const id = userId(req);
  if (!id) return void res.status(401).json({ error: "Authentication required" });
  const strategy = String(req.body?.strategy ?? "").toUpperCase() as StrategyKind;
  if (!STRATEGIES.includes(strategy)) return void res.status(400).json({ error: "Strategia non valida." });
  res.json(await strategyModeManager.releaseLock(String(id), String(req.body?.symbol ?? ""), strategy, req.body?.brokerConfirmsClosed === true));
});

export default router;
