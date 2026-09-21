const AXI_MCP_ENDPOINT = "https://mcp.axi.com/mcp";
const DEFAULT_TIMEOUT_MS = 5_000;
const BLOCKED_TOOL_TOKEN = /(^|[._/-])(trade|order|open|close|modify|create|update|delete|cancel|place|submit|execute)([._/-]|$)/i;
const READ_TOOL_PREFIX = /^(get|list|search|read|fetch|market|account|position|history|price|quote|candle)[._/-]/i;

type FetchLike = typeof fetch;
type Environment = Record<string, string | undefined>;

export type AxiMcpShadowState =
  | "disabled"
  | "auth_required"
  | "healthy"
  | "degraded";

export interface AxiMcpShadowStatus {
  enabled: boolean;
  mode: "shadow";
  endpoint: typeof AXI_MCP_ENDPOINT;
  state: AxiMcpShadowState;
  connected: boolean;
  executionEnabled: false;
  decisionInfluence: false;
  checkedAt: string;
  latencyMs?: number;
  availableReadTools: string[];
  blockedTools: string[];
  error?: string;
}

export interface AxiMcpShadowAdapterOptions {
  env?: Environment;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: { code?: unknown; message?: unknown };
}

export class AxiMcpShadowAdapter {
  readonly endpoint = AXI_MCP_ENDPOINT;
  readonly mode = "shadow" as const;
  readonly executionEnabled = false as const;
  readonly decisionInfluence = false as const;

  private readonly enabled: boolean;
  private readonly accessToken?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private requestId = 0;

  constructor(options: AxiMcpShadowAdapterOptions = {}) {
    const env = options.env ?? process.env;
    this.enabled = env["AXI_MCP_ENABLED"] === "true";
    this.accessToken = env["AXI_MCP_ACCESS_TOKEN"];
    this.timeoutMs = positiveInteger(env["AXI_MCP_TIMEOUT_MS"], DEFAULT_TIMEOUT_MS);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => new Date());
  }

  async getStatus(): Promise<AxiMcpShadowStatus> {
    const checkedAt = this.now().toISOString();
    if (!this.enabled) return this.status("disabled", checkedAt);
    if (!this.accessToken) return this.status("auth_required", checkedAt);

    const startedAt = Date.now();
    try {
      const payload = await this.rpc("tools/list", {});
      const names = extractToolNames(payload);
      const availableReadTools = names.filter(isReadOnlyTool);
      const blockedTools = names.filter((name) => !isReadOnlyTool(name));
      return {
        ...this.status("healthy", checkedAt),
        connected: true,
        latencyMs: Date.now() - startedAt,
        availableReadTools,
        blockedTools,
      };
    } catch (error) {
      return {
        ...this.status("degraded", checkedAt),
        latencyMs: Date.now() - startedAt,
        error: safeMessage(error),
      };
    }
  }

  async callReadTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.enabled) throw new Error("Axi MCP is disabled.");
    if (!this.accessToken) throw new Error("Axi MCP authentication is required.");
    if (!isReadOnlyTool(name)) {
      throw new Error(`Axi MCP tool "${name}" is blocked by the read-only policy.`);
    }
    return this.rpc("tools/call", { name, arguments: args });
  }

  private status(state: AxiMcpShadowState, checkedAt: string): AxiMcpShadowStatus {
    return {
      enabled: this.enabled,
      mode: this.mode,
      endpoint: this.endpoint,
      state,
      connected: false,
      executionEnabled: this.executionEnabled,
      decisionInfluence: this.decisionInfluence,
      checkedAt,
      availableReadTools: [],
      blockedTools: [],
    };
  }

  private async rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.requestId,
        method,
        params,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Axi MCP authentication was rejected.");
    }
    if (!response.ok) throw new Error(`Axi MCP returned HTTP ${response.status}.`);

    const body = (await response.json()) as JsonRpcResponse;
    if (body.error) {
      throw new Error(
        typeof body.error.message === "string"
          ? body.error.message
          : "Axi MCP returned a JSON-RPC error.",
      );
    }
    return body.result;
  }
}

export function isReadOnlyTool(name: string): boolean {
  const normalized = name.trim();
  return (
    normalized.length > 0 &&
    !BLOCKED_TOOL_TOKEN.test(normalized) &&
    READ_TOOL_PREFIX.test(normalized)
  );
}

function extractToolNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const tools = (payload as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) return [];
  return tools.flatMap((tool) => {
    if (!tool || typeof tool !== "object") return [];
    const name = (tool as { name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  });
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Axi MCP error.";
}

export const axiMcpShadowAdapter = new AxiMcpShadowAdapter();
