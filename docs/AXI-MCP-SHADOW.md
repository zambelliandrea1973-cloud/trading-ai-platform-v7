# Axi MCP shadow integration

Status: experimental, disabled by default, read-only observation only.

## Safety contract

- Fixed endpoint: `https://mcp.axi.com/mcp`.
- `AXI_MCP_ENABLED` must equal `true`; otherwise no network request is made.
- Missing authentication produces `auth_required`.
- `executionEnabled` is permanently `false`.
- `decisionInfluence` is permanently `false`.
- Tool names with write/trading verbs are rejected before the network call.
- Unknown tool names are rejected.
- Axi MCP failures never replace or disable the current MT5 bridge.
- Shadow comparisons are telemetry only and cannot change decisions, confidence,
  weights, size, vetoes, locks, or risk limits.

## Environment

```text
AXI_MCP_ENABLED=false
AXI_MCP_ACCESS_TOKEN=
AXI_MCP_TIMEOUT_MS=5000
```

Do not enable the flag until Axi supports and authorizes the application's OAuth
client. Store any access token only as a server secret and never log it.

## Authenticated diagnostic route

`GET /api/broker/axi-mcp/status`

The route is mounted after Clerk authentication. Its states are:

- `disabled`
- `auth_required`
- `healthy`
- `degraded`

It reports latency and separates discovered read tools from blocked tools.

## Migration path away from Cloudflare

The current MT5 bridge remains the authoritative read source. A future review can
consider replacing it only after an observation period confirms:

1. stable Axi MCP OAuth support for this application;
2. adequate availability and latency;
3. quote, account, and position parity within agreed tolerances;
4. complete auditability;
5. continued hard denial of all trading tools.

No automatic cutover exists in this change.
