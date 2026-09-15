from __future__ import annotations

import os
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

import httpx
import MetaTrader5 as mt5
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel

BRIDGE_VERSION = "1.0.0-read-only"
API_KEY = os.environ.get("MT5_BRIDGE_API_KEY", "")
PLATFORM_HEARTBEAT_URL = os.environ.get("PLATFORM_HEARTBEAT_URL", "")
HEARTBEAT_SECONDS = max(10, int(os.environ.get("HEARTBEAT_SECONDS", "20")))
_stop = threading.Event()


def iso_from_epoch(value: int | float) -> str:
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


def require_mt5() -> None:
    if not mt5.initialize():
        raise HTTPException(status_code=503, detail=f"MT5 unavailable: {mt5.last_error()}")


def require_key(x_mt5_bridge_key: Annotated[str | None, Header()] = None) -> None:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Bridge API key is not configured")
    if not x_mt5_bridge_key or not __import__("hmac").compare_digest(x_mt5_bridge_key, API_KEY):
        raise HTTPException(status_code=401, detail="Bridge authentication required")


def heartbeat_loop() -> None:
    while not _stop.wait(HEARTBEAT_SECONDS):
        if not PLATFORM_HEARTBEAT_URL or not API_KEY:
            continue
        initialized = mt5.initialize()
        payload = {
            "bridgeVersion": BRIDGE_VERSION,
            "status": "healthy" if initialized and mt5.terminal_info() else "degraded",
            "heartbeatAt": datetime.now(timezone.utc).isoformat(),
        }
        if initialized:
            mt5.shutdown()
        try:
            with httpx.Client(timeout=5.0, follow_redirects=False) as client:
                client.post(
                    PLATFORM_HEARTBEAT_URL,
                    headers={"x-mt5-bridge-key": API_KEY},
                    json=payload,
                )
        except Exception:
            # The cloud side records heartbeat freshness. Never weaken local read-only mode.
            pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    thread = threading.Thread(target=heartbeat_loop, name="mt5-heartbeat", daemon=True)
    thread.start()
    yield
    _stop.set()
    mt5.shutdown()


app = FastAPI(title="AXI MT5 Read-only Bridge", version=BRIDGE_VERSION, lifespan=lifespan)


@app.get("/health", dependencies=[Depends(require_key)])
def health():
    require_mt5()
    terminal = mt5.terminal_info()
    account = mt5.account_info()
    if terminal is None or account is None:
        mt5.shutdown()
        raise HTTPException(status_code=503, detail="MT5 terminal or account unavailable")
    response = {
        "status": "healthy" if terminal.connected else "degraded",
        "bridgeVersion": BRIDGE_VERSION,
        "heartbeatAt": datetime.now(timezone.utc).isoformat(),
    }
    mt5.shutdown()
    return response


@app.get("/quotes", dependencies=[Depends(require_key)])
def quotes(symbols: str = Query(default="EURUSD")):
    require_mt5()
    result = []
    for raw in symbols.split(","):
        symbol = raw.strip().replace("/", "")
        if not symbol:
            continue
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            continue
        point = mt5.symbol_info(symbol).point if mt5.symbol_info(symbol) else 0
        result.append({
            "symbol": symbol,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "timestamp": iso_from_epoch(tick.time),
            "spreadPoints": float((tick.ask - tick.bid) / point) if point else None,
        })
    mt5.shutdown()
    return {"quotes": result}


@app.get("/account", dependencies=[Depends(require_key)])
def account():
    require_mt5()
    info = mt5.account_info()
    if info is None:
        mt5.shutdown()
        raise HTTPException(status_code=503, detail="Account unavailable")
    result = {
        "externalAccountId": str(info.login),
        "balance": float(info.balance),
        "equity": float(info.equity),
        "margin": float(info.margin),
        "freeMargin": float(info.margin_free),
        "currency": str(info.currency),
    }
    mt5.shutdown()
    return {"account": result}


@app.get("/positions", dependencies=[Depends(require_key)])
def positions():
    require_mt5()
    rows = mt5.positions_get() or []
    result = [{
        "ticket": str(row.ticket),
        "symbol": row.symbol,
        "type": "buy" if row.type == mt5.POSITION_TYPE_BUY else "sell",
        "volume": float(row.volume),
        "openPrice": float(row.price_open),
        "stopLoss": float(row.sl) if row.sl else None,
        "takeProfit": float(row.tp) if row.tp else None,
        "openTime": iso_from_epoch(row.time),
    } for row in rows]
    mt5.shutdown()
    return {"positions": result}


@app.get("/history", dependencies=[Depends(require_key)])
def history(from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = Query(default=None)):
    require_mt5()
    end = to or datetime.now(timezone.utc)
    start = from_ or datetime.fromtimestamp(end.timestamp() - 30 * 86400, tz=timezone.utc)
    deals = mt5.history_deals_get(start, end) or []
    result = [{
        "ticket": str(row.ticket),
        "symbol": row.symbol,
        "type": "buy" if row.type in (mt5.DEAL_TYPE_BUY,) else "sell",
        "volume": float(row.volume),
        "openPrice": float(row.price),
        "closePrice": float(row.price),
        "profit": float(row.profit),
        "currency": mt5.account_info().currency if mt5.account_info() else "EUR",
        "openTime": iso_from_epoch(row.time),
        "closedAt": iso_from_epoch(row.time),
        "status": "closed",
    } for row in deals if row.type in (mt5.DEAL_TYPE_BUY, mt5.DEAL_TYPE_SELL)]
    mt5.shutdown()
    return {"history": result}


@app.get("/")
def root():
    return {"service": "AXI MT5 bridge", "mode": "READ_ONLY", "version": BRIDGE_VERSION}
