import {
  BrokerProtocolError,
  BrokerUnavailableError,
  type AccountSnapshot,
  type BrokerAdapter,
  type BrokerAuditEvent,
  type BrokerDataEndpoint,
  type BrokerDataReadStatus,
  type BrokerOrderRequest,
  type BrokerStatus,
  type NormalizedHistoryEntry,
  type NormalizedPosition,
  type NormalizedQuote,
} from "./contract";
import {
  bridgeAuditStore,
  type BridgeAuditStore,
  type BrokerDataStatusSnapshot,
} from "./audit-store";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_HEARTBEAT_TTL_MS = 30_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5_000;
const MAX_AUDIT_EVENTS = 25;

type FetchLike = typeof fetch;
type Environment = Record<string, string | undefined>;

export interface Mt5BridgeAdapterOptions {
  env?: Environment;
  fetchImpl?: FetchLike;
  now?: () => Date;
  auditStore?: BridgeAuditStore;
}

interface BridgeConfig {
  url: URL;
  apiKey: string;
  allowedHosts: string[];
  timeoutMs: number;
  heartbeatTtlMs: number;
}

export interface BridgeHeartbeatPayload {
  bridgeVersion?: unknown;
  status?: unknown;
  heartbeatAt?: unknown;
}

/**
 * Server-side boundary for the Windows/VPS MT5 bridge.
 *
 * The bridge is configured only through server environment variables.
 * Credentials never reach the browser or the database. Responses are
 * normalized here before they reach the rest of the application.
 */
export class Mt5BridgeAdapter implements BrokerAdapter {
  readonly provider = "axi" as const;
  readonly venue = "mt5" as const;
  readonly mode = "paper" as const;

  private readonly config: BridgeConfig | undefined;
  private readonly configurationError: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly auditStore: BridgeAuditStore;
  private lastHeartbeatAt: string | undefined;
  private lastHealthCheckAt: string | undefined;
  private bridgeVersion: string | undefined;
  private lastError: string | undefined;
  private health: BrokerStatus["health"] = "unknown";
  private dataStatus: BrokerStatus["dataStatus"] = {
    quotes: { status: "unknown" },
    account: { status: "unknown" },
    positions: { status: "unknown" },
    history: { status: "unknown" },
  };
  private auditTrail: BrokerAuditEvent[] = [];
  private lastRecordedHeartbeatAt = 0;

  constructor(options: Mt5BridgeAdapterOptions = {}) {
    const env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => new Date());
    this.auditStore = options.auditStore ?? bridgeAuditStore;

    const bridgeUrl = env["MT5_BRIDGE_URL"];
    const apiKey = env["MT5_BRIDGE_API_KEY"];
    const allowedHosts = parseList(env["MT5_BRIDGE_ALLOWED_HOSTS"]);
    const timeoutMs = parsePositiveInteger(
      env["MT5_BRIDGE_TIMEOUT_MS"],
      DEFAULT_TIMEOUT_MS,
    );
    const heartbeatTtlMs = parsePositiveInteger(
      env["MT5_BRIDGE_HEARTBEAT_TTL_MS"],
      DEFAULT_HEARTBEAT_TTL_MS,
    );

    if (!bridgeUrl && !apiKey && allowedHosts.length === 0) {
      this.configurationError = undefined;
      this.config = undefined;
      return;
    }

    if (!bridgeUrl || !apiKey || allowedHosts.length === 0) {
      this.configurationError =
        "MT5 bridge requires MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY, and MT5_BRIDGE_ALLOWED_HOSTS.";
      return;
    }

    try {
      const url = new URL(bridgeUrl);
      if (url.protocol !== "https:") {
        throw new Error("URL must use HTTPS.");
      }
      if (url.username || url.password) {
        throw new Error("URL credentials are not allowed.");
      }
      if (!hostMatchesAllowlist(url.hostname, allowedHosts)) {
        throw new Error(
          `Bridge host "${url.hostname}" is not in MT5_BRIDGE_ALLOWED_HOSTS.`,
        );
      }
      this.config = {
        url: ensureTrailingSlash(url),
        apiKey,
        allowedHosts,
        timeoutMs,
        heartbeatTtlMs,
      };
    } catch (error) {
      this.configurationError =
        error instanceof Error ? error.message : "Invalid MT5 bridge URL.";
    }
  }

  async getStatus(): Promise<BrokerStatus> {
    const [persistedAuditTrail, persistedDataStatus] = await Promise.all([
      this.auditStore.list(),
      this.auditStore.loadDataStatus(),
    ]);
    this.auditTrail = persistedAuditTrail;
    this.dataStatus = persistedDataStatus;
    if (this.configurationError) {
      return this.status("blocked", this.configurationError);
    }
    if (!this.config) {
      return this.status(
        "disconnected",
        "Axi/MT5 bridge is not configured. Paper mode remains active.",
      );
    }

    try {
      const checkedAt = this.now();
      const health = normalizeBridgeHealth(
        await this.request<unknown>("health"),
        checkedAt,
      );
      this.lastHealthCheckAt = checkedAt.toISOString();
      this.lastHeartbeatAt = health.heartbeatAt;
      this.bridgeVersion = health.bridgeVersion;
      this.lastError = undefined;
      this.health = health.status;
      await this.recordAudit(
        "heartbeat.received",
        "bridge",
        "Bridge health check",
      );
      if (!this.isHeartbeatFresh()) {
        this.health = "degraded";
        this.lastError = "Bridge heartbeat is stale.";
        await this.recordAudit("heartbeat.stale", "system", this.lastError);
        return this.status(
          "disconnected",
          "Axi/MT5 bridge heartbeat is stale. Paper mode remains active.",
        );
      }
      return this.status(
        "connected",
        this.health === "degraded"
          ? "Axi/MT5 bridge connected with degraded health. Paper mode remains active."
          : "Axi/MT5 bridge connected. Paper mode remains active; LIVE execution is disabled.",
      );
    } catch (error) {
      const message = safeErrorMessage(error);
      this.lastHealthCheckAt = this.now().toISOString();
      this.lastError = message;
      this.health = "degraded";
      await this.recordAudit("health.check_failed", "system", message);
      return this.status(
        error instanceof BrokerProtocolError ? "blocked" : "disconnected",
        `Axi/MT5 bridge health check failed. Paper mode remains active. ${message}`,
      );
    }
  }

  async getQuotes(symbols: string[]): Promise<NormalizedQuote[]> {
    const query =
      symbols.length > 0 ? `?symbols=${encodeURIComponent(symbols.join(","))}` : "";
    const payload = await this.request<unknown>(`quotes${query}`);
    return readArray(payload, "quotes").map(normalizeQuote);
  }

  async getAccountSnapshot(): Promise<AccountSnapshot> {
    const payload = await this.request<unknown>("account");
    return normalizeAccount(readObject(payload, "account"));
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    const payload = await this.request<unknown>("positions");
    return readArray(payload, "positions").map(normalizePosition);
  }

  async getHistory(
    from?: string,
    to?: string,
  ): Promise<NormalizedHistoryEntry[]> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const payload = await this.request<unknown>(`history${suffix}`);
    return readArray(payload, "history").map(normalizeHistoryEntry);
  }

  async submitOrder(_request: BrokerOrderRequest): Promise<never> {
    throw new BrokerUnavailableError(
      "Order execution is disabled. PAPER validation must complete before any separately reviewed LIVE capability can be enabled.",
    );
  }

  async receiveHeartbeat(payload: BridgeHeartbeatPayload): Promise<void> {
    if (!this.config) {
      throw new BrokerUnavailableError("MT5 bridge is not configured.");
    }
    const heartbeatAt = requireIsoDate(payload.heartbeatAt, "heartbeatAt");
    assertHeartbeatNotInFuture(heartbeatAt, this.now());
    this.lastHeartbeatAt = heartbeatAt;
    this.lastHealthCheckAt = this.now().toISOString();
    this.bridgeVersion =
      readOptionalString(payload.bridgeVersion) ?? this.bridgeVersion;
    this.health = normalizeHealthStatus(payload.status, "heartbeat.status");
    this.lastError = undefined;
    await this.recordAudit(
      "heartbeat.received",
      "bridge",
      "Authenticated bridge heartbeat",
    );
  }

  isConfigured(): boolean {
    return Boolean(this.config && !this.configurationError);
  }

  isHeartbeatFresh(): boolean {
    if (!this.lastHeartbeatAt || !this.config) return false;
    const age = this.now().getTime() - Date.parse(this.lastHeartbeatAt);
    return age >= -MAX_FUTURE_CLOCK_SKEW_MS && age <= this.config.heartbeatTtlMs;
  }

  getApiKey(): string | undefined {
    return this.config?.apiKey;
  }

  async recordSecurityEvent(event: string, detail: string): Promise<void> {
    await this.recordAudit(event, "system", detail);
  }

  async recordDataReadSuccess(endpoint: BrokerDataEndpoint): Promise<void> {
    const snapshot = {
      ...this.dataStatus,
      [endpoint]: {
        status: "available",
        lastCheckedAt: this.now().toISOString(),
      },
    } as BrokerDataStatusSnapshot;
    this.dataStatus = snapshot;
    await this.auditStore.saveDataStatus(endpoint, snapshot[endpoint]);
  }

  async recordDataReadFailure(
    endpoint: BrokerDataEndpoint,
    status: Exclude<BrokerDataReadStatus, "available" | "unknown">,
  ): Promise<void> {
    const snapshot = {
      ...this.dataStatus,
      [endpoint]: {
        status,
        lastCheckedAt: this.now().toISOString(),
      },
    } as BrokerDataStatusSnapshot;
    this.dataStatus = snapshot;
    await this.auditStore.saveDataStatus(endpoint, snapshot[endpoint]);
  }

  private async request<T>(path: string): Promise<T> {
    if (this.configurationError) {
      throw new BrokerUnavailableError(this.configurationError);
    }
    if (!this.config) {
      throw new BrokerUnavailableError("MT5 bridge is not configured.");
    }

    const endpoint = new URL(path, this.config.url);
    if (!hostMatchesAllowlist(endpoint.hostname, this.config.allowedHosts)) {
      throw new BrokerUnavailableError("MT5 bridge request blocked by network allowlist.");
    }

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-mt5-bridge-key": this.config.apiKey,
        },
        redirect: "error",
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new BrokerUnavailableError(
        `Bridge request failed: ${safeErrorMessage(error)}`,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new BrokerProtocolError("Bridge authentication was rejected.");
    }
    if (!response.ok) {
      throw new BrokerUnavailableError(`Bridge returned HTTP ${response.status}.`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BrokerProtocolError("Bridge returned invalid JSON.");
    }
    return body as T;
  }

  private status(
    status: BrokerStatus["status"],
    message: string,
  ): BrokerStatus {
    return {
      provider: this.provider,
      venue: this.venue,
      mode: this.mode,
      status,
      connected: status === "connected" && this.isHeartbeatFresh(),
      executionEnabled: false,
      bridgeRequired: true,
      capabilities: ["quotes", "account", "positions", "history"],
      message,
      health: this.health,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastHealthCheckAt: this.lastHealthCheckAt,
      bridgeVersion: this.bridgeVersion,
      lastError: this.lastError,
      auditTrail: [...this.auditTrail],
      database: this.auditStore.getState(),
      dataStatus: { ...this.dataStatus },
    };
  }

  private async recordAudit(
    event: string,
    actor: BrokerAuditEvent["actor"],
    detail?: string,
  ): Promise<void> {
    const now = this.now();
    if (
      event === "heartbeat.received" &&
      now.getTime() - this.lastRecordedHeartbeatAt < 1_000
    ) {
      return;
    }
    this.lastRecordedHeartbeatAt = now.getTime();
    const auditEvent: BrokerAuditEvent = {
      event,
      actor,
      detail,
      at: now.toISOString(),
    };
    this.auditTrail = [
      ...this.auditTrail,
      auditEvent,
    ].slice(-MAX_AUDIT_EVENTS);
    await this.auditStore.append(auditEvent);
  }
}

function parseList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureTrailingSlash(url: URL): URL {
  const normalized = new URL(url);
  if (!normalized.pathname.endsWith("/")) normalized.pathname += "/";
  return normalized;
}

function hostMatchesAllowlist(hostname: string, allowlist: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return allowlist.some((entry) => {
    const candidate = entry.toLowerCase().replace(/^\*\./, "");
    return normalized === candidate || normalized.endsWith(`.${candidate}`);
  });
}

function readArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload[key])) return payload[key];
  throw new BrokerProtocolError(`Bridge response must contain an array named "${key}".`);
}

function readObject(payload: unknown, key: string): Record<string, unknown> {
  if (isRecord(payload) && isRecord(payload[key])) return payload[key];
  if (isRecord(payload)) return payload;
  throw new BrokerProtocolError(`Bridge response must contain an object named "${key}".`);
}

function normalizeQuote(value: unknown): NormalizedQuote {
  const row = requireRecord(value, "quote");
  return {
    symbol: requireString(row.symbol, "quote.symbol"),
    bid: requireFiniteNumber(row.bid, "quote.bid"),
    ask: requireFiniteNumber(row.ask, "quote.ask"),
    timestamp: requireIsoDate(row.timestamp, "quote.timestamp"),
    spreadPoints: optionalFiniteNumber(row.spreadPoints),
  };
}

function normalizeAccount(row: Record<string, unknown>): AccountSnapshot {
  return {
    externalAccountId: optionalString(row.externalAccountId ?? row.accountId),
    balance: requireFiniteNumber(row.balance, "account.balance"),
    equity: requireFiniteNumber(row.equity, "account.equity"),
    margin: optionalFiniteNumber(row.margin),
    freeMargin: optionalFiniteNumber(row.freeMargin),
    currency: requireString(row.currency, "account.currency"),
  };
}

function normalizePosition(value: unknown): NormalizedPosition {
  const row = requireRecord(value, "position");
  return {
    externalId: requireIdentifier(
      row.externalId ?? row.ticket ?? row.id,
      "position.externalId",
    ),
    symbol: requireString(row.symbol, "position.symbol"),
    side: normalizeSide(row.side ?? row.type, "position.side"),
    volume: requireFiniteNumber(row.volume, "position.volume"),
    openPrice: requireFiniteNumber(row.openPrice, "position.openPrice"),
    stopLoss: optionalFiniteNumber(row.stopLoss),
    takeProfit: optionalFiniteNumber(row.takeProfit),
    openedAt: requireIsoDate(row.openedAt ?? row.openTime, "position.openedAt"),
  };
}

function normalizeHistoryEntry(value: unknown): NormalizedHistoryEntry {
  const row = requireRecord(value, "history entry");
  return {
    externalId: requireIdentifier(
      row.externalId ?? row.ticket ?? row.id,
      "history.externalId",
    ),
    symbol: requireString(row.symbol, "history.symbol"),
    side: normalizeSide(row.side ?? row.type, "history.side"),
    volume: requireFiniteNumber(row.volume, "history.volume"),
    openPrice: requireFiniteNumber(row.openPrice, "history.openPrice"),
    closePrice: optionalFiniteNumber(row.closePrice),
    profit: optionalFiniteNumber(row.profit),
    currency: optionalString(row.currency),
    openedAt: requireIsoDate(
      row.openedAt ?? row.openTime,
      "history.openedAt",
    ),
    closedAt: optionalIsoDate(row.closedAt ?? row.closeTime),
    status: normalizeHistoryStatus(row.status),
  };
}

function normalizeSide(value: unknown, field: string): "buy" | "sell" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "buy" || normalized === "0" || normalized === "long") {
    return "buy";
  }
  if (normalized === "sell" || normalized === "1" || normalized === "short") {
    return "sell";
  }
  throw new BrokerProtocolError(`${field} must be buy or sell.`);
}

function normalizeHistoryStatus(
  value: unknown,
): NormalizedHistoryEntry["status"] {
  const normalized = String(value ?? "closed").toLowerCase();
  if (
    normalized === "open" ||
    normalized === "closed" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  throw new BrokerProtocolError("history.status is invalid.");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new BrokerProtocolError(`${label} must be an object.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  const result = optionalString(value);
  if (!result) throw new BrokerProtocolError(`${field} must be a non-empty string.`);
  return result;
}

function requireIdentifier(value: unknown, field: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return requireString(value, field);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireFiniteNumber(value: unknown, field: string): number {
  const result = optionalFiniteNumber(value);
  if (result === undefined) {
    throw new BrokerProtocolError(`${field} must be a finite number.`);
  }
  return result;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function requireIsoDate(value: unknown, field: string): string {
  const result = optionalIsoDate(value);
  if (!result) throw new BrokerProtocolError(`${field} must be a valid ISO date.`);
  return result;
}

function optionalIsoDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readOptionalString(value: unknown): string | undefined {
  return optionalString(value);
}

function normalizeBridgeHealth(
  value: unknown,
  now: Date,
): { status: BrokerStatus["health"]; heartbeatAt: string; bridgeVersion?: string } {
  const health = requireRecord(value, "health");
  const heartbeatAt = requireIsoDate(
    health.heartbeatAt ?? health.timestamp,
    "health.heartbeatAt",
  );
  assertHeartbeatNotInFuture(heartbeatAt, now);
  return {
    status: normalizeHealthStatus(health.status, "health.status"),
    heartbeatAt,
    bridgeVersion: readOptionalString(health.bridgeVersion ?? health.version),
  };
}

function normalizeHealthStatus(
  value: unknown,
  field: string,
): Extract<BrokerStatus["health"], "healthy" | "degraded"> {
  if (value === "healthy" || value === "degraded") return value;
  throw new BrokerProtocolError(`${field} must be healthy or degraded.`);
}

function assertHeartbeatNotInFuture(heartbeatAt: string, now: Date): void {
  if (Date.parse(heartbeatAt) - now.getTime() > MAX_FUTURE_CLOCK_SKEW_MS) {
    throw new BrokerProtocolError("Bridge heartbeat is too far in the future.");
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown bridge error.";
}

export const mt5BridgeAdapter = new Mt5BridgeAdapter();