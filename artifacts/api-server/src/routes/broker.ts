import { Router, type IRouter } from "express";
import { mt5BridgeAdapter } from "../lib/broker/mt5-bridge-adapter";

const router: IRouter = Router();

router.get("/broker/status", async (_req, res) => {
  const status = await mt5BridgeAdapter.getStatus();
  res.json(status);
});

export default router;