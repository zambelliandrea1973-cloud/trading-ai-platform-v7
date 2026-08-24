# Axi / MetaTrader 5 bridge protocol

The trading platform stays in `paper` mode even when the bridge is healthy.
There is no LIVE order endpoint in this release.

## Server configuration

Set these values only in the API server's secret/environment configuration:

| Variable | Purpose |
| --- | --- |
| `MT5_BRIDGE_URL` | HTTPS base URL of the Windows/VPS bridge, for example `https://mt5-bridge.example.net/api/` |
| `MT5_BRIDGE_API_KEY` | Shared bridge key; never place it in the frontend, source code, or database |
| `MT5_BRIDGE_ALLOWED_HOSTS` | Comma-separated bridge hostname allowlist, for example `mt5-bridge.example.net` |
| `MT5_BRIDGE_ALLOWED_IPS` | Comma-separated IP allowlist allowed to call the platform heartbeat endpoint |
| `BROKER_READ_API_KEY` | Separate key for operators consuming normalized account, quote, position, and history endpoints |
| `BROKER_READ_ALLOWED_IPS` | Comma-separated operator network allowlist for broker data endpoints |
| `CORS_ALLOWED_ORIGINS` | Optional comma-separated origins permitted to make cross-origin API requests; CORS is disabled by default |
| `MT5_BRIDGE_TIMEOUT_MS` | Optional outbound request timeout; defaults to `5000` |
| `MT5_BRIDGE_HEARTBEAT_TTL_MS` | Optional freshness window; defaults to `30000` |

The adapter will not contact a bridge unless URL, key, and host allowlist are
all present. A bridge URL with embedded credentials, a non-HTTPS protocol, or a
hostname outside the allowlist is rejected. Redirects are rejected so an
allowlisted hostname cannot forward the shared key elsewhere.

## Bridge-facing endpoints

The Windows/VPS service exposes these read-only JSON endpoints below
`MT5_BRIDGE_URL`. Each request from the platform includes the
`x-mt5-bridge-key` header.

| Endpoint | Response envelope |
| --- | --- |
| `GET health` | `{ "status": "healthy", "bridgeVersion": "1.0.0", "heartbeatAt": "2026-08-24T12:00:00.000Z" }` |
| `GET quotes?symbols=EUR%2FUSD,XAU%2FUSD` | `{ "quotes": [{ "symbol": "EUR/USD", "bid": 1.08, "ask": 1.0801, "timestamp": "..." }] }` |
| `GET account` | `{ "account": { "externalAccountId": "…", "balance": 0, "equity": 0, "currency": "USD" } }` |
| `GET positions` | `{ "positions": [{ "ticket": "…", "symbol": "EUR/USD", "type": "buy", "volume": 0.01, "openPrice": 1.08, "openTime": "…" }] }` |
| `GET history?from=<ISO>&to=<ISO>` | `{ "history": [{ "ticket": "…", "symbol": "EUR/USD", "type": "sell", "volume": 0.01, "openPrice": 1.08, "openTime": "…", "status": "closed" }] }` |

The adapter accepts `externalId`, `ticket`, or `id` as the external identifier;
it accepts `side` or MT5-style `type` for direction. It rejects missing,
non-finite, or malformed values rather than silently guessing.

The normalized data endpoints are internal operator endpoints. Each needs
`x-broker-read-key` and a source address in `BROKER_READ_ALLOWED_IPS`; do not
expose this key in the web app.

## Inbound heartbeat

The bridge should also POST to:

```text
/api/broker/mt5/heartbeat
```

It must provide `x-mt5-bridge-key` and originate from an address in
`MT5_BRIDGE_ALLOWED_IPS`. The body may include:

```json
{
  "bridgeVersion": "1.0.0",
  "status": "healthy",
  "heartbeatAt": "2026-08-24T12:00:00.000Z"
}
```

The System Status page exposes the bridge health, last heartbeat, version, and
recent audit events. Authentication failures, non-allowlisted requests, and
invalid heartbeat payloads are rejected without updating that state.

## Paper validation checklist

1. Configure a dedicated Axi demo/PAPER account in the MT5 terminal.
2. Add the bridge hostname and the bridge source IP explicitly to the
   allowlists; do not use broad public ranges.
3. Confirm the system page reports a fresh heartbeat and `PAPER only`.
4. Compare normalized quotes, account totals, positions, and history with the
   terminal using a read-only session.
5. Keep `executionEnabled: false`; any transition toward LIVE execution needs a
   separate security and operational review.