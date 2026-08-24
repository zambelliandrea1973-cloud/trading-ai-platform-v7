import { Router, type IRouter, type Response } from "express";
import {
  GetBrokerAccountResponse,
  GetBrokerHistoryResponse,
  GetBrokerPositionsResponse,
  GetBrokerQuotesResponse,
  GetBrokerStatusResponse,
  SubmitMt5HeartbeatBody,
} from "@workspace/api-zod";
import {
  BrokerProtocolError,
  BrokerUnavailableError,
} from "../lib/broker/contract";
import { mt5BridgeAdapter } from "../lib/broker/mt5-bridge-adapter";

const router: IRouter = Router();

router.get("/broker/status", async (_req, res): Promise<void> => {
  const status = await mt5BridgeAdapter.getStatus();
  res.json(GetBrokerStatusResponse.parse(status));
});

router.get("/broker/quotes", async (req, res): Promise<void> => {
  if (!requireBrokerReadAccess(req.ip, req.header("x-broker-read-key"), res)) return;
  const symbols = typeof req.query.symbols === "string"
    ? req.query.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean)
    : [];
  await respondWithBrokerData(res, () =>
    mt5BridgeAdapter.getQuotes(symbols).then((data) => GetBrokerQuotesResponse.parse(data)),
  );
});

router.get("/broker/account", async (_req, res): Promise<void> => {
  if (!requireBrokerReadAccess(_req.ip, _req.header("x-broker-read-key"), res)) return;
  await respondWithBrokerData(res, () =>
    mt5BridgeAdapter.getAccountSnapshot().then((data) => GetBrokerAccountResponse.parse(data)),
  );
});

router.get("/broker/positions", async (_req, res): Promise<void> => {
  if (!requireBrokerReadAccess(_req.ip, _req.header("x-broker-read-key"), res)) return;
  await respondWithBrokerData(res, () =>
    mt5BridgeAdapter.getPositions().then((data) => GetBrokerPositionsResponse.parse(data)),
  );
});

router.get("/broker/history", async (req, res): Promise<void> => {
  if (!requireBrokerReadAccess(req.ip, req.header("x-broker-read-key"), res)) return;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  await respondWithBrokerData(res, () =>
    mt5BridgeAdapter.getHistory(from, to).then((data) => GetBrokerHistoryResponse.parse(data)),
  );
});

router.post("/broker/mt5/heartbeat", (req, res): void => {
  const presentedKey = req.header("x-mt5-bridge-key");
  const configuredKey = mt5BridgeAdapter.getApiKey();
  if (!presentedKey || !configuredKey || !secureCompare(presentedKey, configuredKey)) {
    mt5BridgeAdapter.recordSecurityEvent("heartbeat.rejected", "Bridge authentication failed.");
    res.status(401).json({ error: "Bridge authentication required." });
    return;
  }
  if (!isAllowedIp(req.ip)) {
    mt5BridgeAdapter.recordSecurityEvent("heartbeat.rejected", "Bridge network was not allowlisted.");
    res.status(403).json({ error: "Bridge network is not allowlisted." });
    return;
  }
  const body = SubmitMt5HeartbeatBody.safeParse(req.body);
  if (!body.success) {
    mt5BridgeAdapter.recordSecurityEvent("heartbeat.rejected", "Bridge heartbeat payload was invalid.");
    res.status(400).json({ error: body.error.message });
    return;
  }

  void mt5BridgeAdapter.receiveHeartbeat(body.data)
    .then(() => res.status(204).send())
    .catch((error: unknown) => {
      res.status(error instanceof BrokerProtocolError ? 400 : 503).json({
        error: error instanceof Error ? error.message : "Heartbeat rejected.",
      });
    });
});

async function respondWithBrokerData(
  res: Response,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    res.json(await operation());
  } catch (error) {
    if (error instanceof BrokerProtocolError) {
      res.status(502).json({ error: error.message });
      return;
    }
    if (error instanceof BrokerUnavailableError) {
      res.status(503).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Unexpected broker adapter error." });
  }
}

function isAllowedIp(ip: string | undefined): boolean {
  return isIpInAllowlist(ip, process.env["MT5_BRIDGE_ALLOWED_IPS"]);
}

function requireBrokerReadAccess(
  ip: string | undefined,
  presentedKey: string | undefined,
  res: Response,
): boolean {
  const key = process.env["BROKER_READ_API_KEY"];
  if (!key) {
    res.status(503).json({ error: "Broker read access is not configured." });
    return false;
  }
  if (!presentedKey || !secureCompare(presentedKey, key)) {
    res.status(401).json({ error: "Broker read authentication required." });
    return false;
  }
  if (!isIpInAllowlist(ip, process.env["BROKER_READ_ALLOWED_IPS"])) {
    res.status(403).json({ error: "Broker read network is not allowlisted." });
    return false;
  }
  return true;
}

function isIpInAllowlist(
  ip: string | undefined,
  allowlist: string | undefined,
): boolean {
  const allowed = allowlist
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  if (!ip || allowed.length === 0) return false;
  const normalized = ip.replace(/^::ffff:/, "");
  return allowed.some((entry) => entry === ip || entry === normalized);
}

function secureCompare(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return different === 0;
}

export default router;