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
  type BrokerDataEndpoint,
} from "../lib/broker/contract";
import {
  Mt5BridgeAdapter,
  mt5BridgeAdapter,
} from "../lib/broker/mt5-bridge-adapter";

export interface BrokerRouterOptions {
  adapter?: Mt5BridgeAdapter;
  env?: Record<string, string | undefined>;
}

export function createBrokerRouter({
  adapter = mt5BridgeAdapter,
  env = process.env,
}: BrokerRouterOptions = {}): IRouter {
  const router: IRouter = Router();

  router.get("/broker/status", async (_req, res): Promise<void> => {
    await respondWithBrokerData(res, undefined, undefined, () =>
      adapter.getStatus().then((status) => GetBrokerStatusResponse.parse(status)),
    );
  });

  router.get("/broker/quotes", async (req, res): Promise<void> => {
    if (
      !(await requireBrokerReadAccess(
        req.ip,
        req.header("x-broker-read-key"),
        res,
        adapter,
        env,
      ))
    ) return;
    const symbols = typeof req.query.symbols === "string"
      ? req.query.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean)
      : [];
    await respondWithBrokerData(res, adapter, "quotes", () =>
      adapter.getQuotes(symbols).then((data) => GetBrokerQuotesResponse.parse(data)),
    );
  });

  router.get("/broker/account", async (_req, res): Promise<void> => {
    if (
      !(await requireBrokerReadAccess(
        _req.ip,
        _req.header("x-broker-read-key"),
        res,
        adapter,
        env,
      ))
    ) return;
    await respondWithBrokerData(res, adapter, "account", () =>
      adapter.getAccountSnapshot().then((data) => GetBrokerAccountResponse.parse(data)),
    );
  });

  router.get("/broker/positions", async (_req, res): Promise<void> => {
    if (
      !(await requireBrokerReadAccess(
        _req.ip,
        _req.header("x-broker-read-key"),
        res,
        adapter,
        env,
      ))
    ) return;
    await respondWithBrokerData(res, adapter, "positions", () =>
      adapter.getPositions().then((data) => GetBrokerPositionsResponse.parse(data)),
    );
  });

  router.get("/broker/history", async (req, res): Promise<void> => {
    if (
      !(await requireBrokerReadAccess(
        req.ip,
        req.header("x-broker-read-key"),
        res,
        adapter,
        env,
      ))
    ) return;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    await respondWithBrokerData(res, adapter, "history", () =>
      adapter.getHistory(from, to).then((data) => GetBrokerHistoryResponse.parse(data)),
    );
  });

  router.post("/broker/mt5/heartbeat", async (req, res): Promise<void> => {
    const presentedKey = req.header("x-mt5-bridge-key");
    const configuredKey = adapter.getApiKey();
    if (!presentedKey || !configuredKey || !secureCompare(presentedKey, configuredKey)) {
      await adapter.recordSecurityEvent(
        "heartbeat.rejected",
        "Bridge authentication failed; bridge key was rejected.",
      );
      res.status(401).json({ error: "Bridge authentication required." });
      return;
    }
    if (!isAllowedIp(req.ip, env["MT5_BRIDGE_ALLOWED_IPS"])) {
      await adapter.recordSecurityEvent(
        "heartbeat.rejected",
        "Bridge network was not allowlisted.",
      );
      res.status(403).json({ error: "Bridge network is not allowlisted." });
      return;
    }
    const body = SubmitMt5HeartbeatBody.safeParse(req.body);
    if (!body.success) {
      await adapter.recordSecurityEvent(
        "heartbeat.rejected",
        "Bridge heartbeat payload was invalid.",
      );
      res.status(400).json({ error: body.error.message });
      return;
    }

    try {
      await adapter.receiveHeartbeat(body.data);
      res.status(204).send();
    } catch (error: unknown) {
      await adapter.recordSecurityEvent(
        "heartbeat.rejected",
        error instanceof Error ? error.message : "Heartbeat rejected.",
      );
      res.status(error instanceof BrokerProtocolError ? 400 : 503).json({
        error: error instanceof Error ? error.message : "Heartbeat rejected.",
      });
    }
  });

  return router;
}

async function respondWithBrokerData(
  res: Response,
  adapter: Mt5BridgeAdapter | undefined,
  endpoint: BrokerDataEndpoint | undefined,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    const data = await operation();
    if (adapter && endpoint) await adapter.recordDataReadSuccess(endpoint);
    res.json(data);
  } catch (error) {
    if (error instanceof BrokerProtocolError) {
      if (adapter && endpoint) await adapter.recordDataReadFailure(endpoint, "malformed");
      res.status(502).json({ error: error.message });
      return;
    }
    if (error instanceof BrokerUnavailableError) {
      if (adapter && endpoint) await adapter.recordDataReadFailure(endpoint, "unavailable");
      res.status(503).json({ error: error.message });
      return;
    }
    if (adapter && endpoint) await adapter.recordDataReadFailure(endpoint, "error");
    res.status(500).json({ error: "Unexpected broker adapter error." });
  }
}

function isAllowedIp(ip: string | undefined, allowlist: string | undefined): boolean {
  return isIpInAllowlist(ip, allowlist);
}

async function requireBrokerReadAccess(
  ip: string | undefined,
  presentedKey: string | undefined,
  res: Response,
  adapter: Mt5BridgeAdapter,
  env: Record<string, string | undefined>,
): Promise<boolean> {
  const key = env["BROKER_READ_API_KEY"];
  if (!key) {
    await adapter.recordSecurityEvent(
      "broker_read.rejected",
      "Broker read access is not configured.",
    );
    res.status(503).json({ error: "Broker read access is not configured." });
    return false;
  }
  if (!presentedKey || !secureCompare(presentedKey, key)) {
    await adapter.recordSecurityEvent(
      "broker_read.rejected",
      "Broker read key was rejected.",
    );
    res.status(401).json({ error: "Broker read authentication required." });
    return false;
  }
  if (!isIpInAllowlist(ip, env["BROKER_READ_ALLOWED_IPS"])) {
    await adapter.recordSecurityEvent(
      "broker_read.rejected",
      "Broker read network was not allowlisted.",
    );
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

export default createBrokerRouter();