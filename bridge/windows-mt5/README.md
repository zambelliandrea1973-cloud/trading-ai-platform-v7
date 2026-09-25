# Windows MT5 Read-Only Bridge

This component connects the locally installed Axi MetaTrader 5 terminal to Trading AI Platform V7 for PAPER-mode market data and historical ingestion.

## Safety boundary

- Read-only by design.
- No order endpoint is implemented.
- `MT5_EXECUTION_ENABLED=true` causes startup to fail.
- The service binds to `127.0.0.1` by default.
- A long API key is required on every data endpoint.
- MT5 trading credentials remain inside the locally logged-in MT5 terminal and are never stored by this bridge.

## Endpoints

- `GET /health`
- `GET /symbols`
- `GET /quotes?symbols=EURUSD,XAUUSD`
- `GET /account`
- `GET /positions`
- `GET /history?from=...&to=...`
- `GET /market/bars?symbol=...&timeframe=1h&limit=10000`

All endpoints require the `x-mt5-bridge-key` header. `/orders` is explicitly disabled.

## Local Windows setup

1. Keep Axi MetaTrader 5 installed and logged in to the intended account.
2. Install Python 3.11 or 3.12 x64 if not already installed.
3. Copy `.env.example` to `.env` and replace the placeholder with a strong random API key.
4. Run PowerShell in this directory and execute `./install-and-run.ps1`.
5. Verify locally that `/health` reports a connected terminal using an authenticated request.

## Connection to hosted V7

The hosted API must never call an unencrypted public Windows port directly. Production connection requires a separately configured HTTPS tunnel or reverse proxy with an allowlisted hostname. The V7 server then receives:

- `MT5_BRIDGE_URL=https://<bridge-host>/`
- `MT5_BRIDGE_API_KEY=<same secret>`
- `MT5_BRIDGE_ALLOWED_HOSTS=<bridge-host>`

Do not expose port 8765 directly to the Internet.

## Historical population

Once the secure bridge URL is configured, run the V7 job with:

- `AXI_HISTORY_MODE=discover` to discover and map broker symbols;
- `AXI_HISTORY_MODE=populate` to ingest normalized historical bars;
- `AXI_HISTORY_TIMEFRAMES=1d,4h,1h,15m` for the initial set.

The database stores canonical symbols separately from Axi/MT5 provider symbols, so broker naming changes do not leak into the Decision Engine.
