# Windows AXI/MT5 bridge — read only

This service runs on the same Windows machine as the logged-in AXI MetaTrader 5 terminal.

## Security boundary

- Read-only endpoints only.
- No order_check, order_send, trade mutation or Algo Trading activation.
- Every protected request requires x-mt5-bridge-key.
- Bind to 127.0.0.1 unless an authenticated HTTPS reverse proxy/tunnel is configured.
- Never store AXI login or password in this project.

## Install

```bat
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Copy .env.example to a local .env or set the variables in Windows. Do not commit secrets.

## Run locally

```bat
set MT5_BRIDGE_API_KEY=<secret>
set PLATFORM_HEARTBEAT_URL=<cloud-url>
.venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

## Endpoints

- GET /health
- GET /quotes?symbols=EURUSD,XAUUSD
- GET /account
- GET /positions
- GET /history?from=<ISO>&to=<ISO>

The cloud adapter expects an HTTPS base URL. Put an authenticated HTTPS reverse proxy or tunnel in front of localhost:8765 before configuring MT5_BRIDGE_URL.
