from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from typing import Any

import MetaTrader5 as mt5
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query

load_dotenv()

BRIDGE_VERSION = "0.1.0-readonly"
API_KEY = os.getenv("MT5_BRIDGE_API_KEY", "")
TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH") or None
EXECUTION_ENABLED = os.getenv("MT5_EXECUTION_ENABLED", "false").lower() == "true"

if EXECUTION_ENABLED:
    raise RuntimeError("MT5_EXECUTION_ENABLED must remain false in the PAPER bridge")

app = FastAPI(title="Trading AI MT5 Read-Only Bridge", version=BRIDGE_VERSION)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def authenticate(x_mt5_bridge_key: str | None = Header(default=None)) -> None:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Bridge API key is not configured")
    if not x_mt5_bridge_key or not secrets.compare_digest(x_mt5_bridge_key, API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")


def ensure_mt5() -> None:
    terminal = mt5.terminal_info()
    if terminal is not None:
        return
    ok = mt5.initialize(path=TERMINAL_PATH) if TERMINAL_PATH else mt5.initialize()
    if not ok:
        code, message = mt5.last_error()
        raise HTTPException(status_code=503, detail=f"MT5 initialize failed: {code} {message}")
    if mt5.terminal_info() is None:
        raise HTTPException(status_code=503, detail="MT5 terminal unavailable")


def iso_from_epoch(value: int | float | None) -> str:
    if not value:
        return now_iso()
    return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()


def timeframe_constant(value: str) -> int:
    normalized = value.strip().lower()
    mapping = {
        "1m": mt5.TIMEFRAME_M1,
        "5m": mt5.TIMEFRAME_M5,
        "15m": mt5.TIMEFRAME_M15,
        "30m": mt5.TIMEFRAME_M30,
        "1h": mt5.TIMEFRAME_H1,
        "4h": mt5.TIMEFRAME_H4,
        "1d": mt5.TIMEFRAME_D1,
        "1w": mt5.TIMEFRAME_W1,
        "1mn": mt5.TIMEFRAME_MN1,
    }
    result = mapping.get(normalized)
    if result is None:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {value}")
    return result


def classify_symbol(info: Any) -> str:
    text = f"{getattr(info, 'path', '')} {getattr(info, 'description', '')}".lower()
    if "forex" in text or "fx" in text:
        return "forex"
    if "metal" in text or "gold" in text or "silver" in text:
        return "metals"
    if "energy" in text or "oil" in text or "gas" in text:
        return "energy"
    if "crypto" in text or "bitcoin" in text or "ethereum" in text:
        return "crypto"
    if "index" in text or "indices" in text:
        return "index"
    if "stock" in text or "share" in text or "equity" in text:
        return "equity"
    if "commodity" in text or "soft" in text or "agric" in text:
        return "commodity"
    return "other"


@app.on_event("startup")
def startup() -> None:
    # Do not fail process startup when MT5 is closed; /health reports degraded.
    try:
        ensure_mt5()
    except HTTPException:
        pass


@app.on_event("shutdown")
def shutdown() -> None:
    mt5.shutdown()


@app.get("/health")
def health(_: None = Depends(authenticate)) -> dict[str, Any]:
    try:
        ensure_mt5()
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        connected = bool(terminal and getattr(terminal, "connected", False) and account)
        return {
            "bridgeVersion": BRIDGE_VERSION,
            "status": "healthy" if connected else "degraded",
            "heartbeatAt": now_iso(),
            "executionEnabled": False,
            "terminalConnected": connected,
        }
    except HTTPException as error:
        return {
            "bridgeVersion": BRIDGE_VERSION,
            "status": "degraded",
            "heartbeatAt": now_iso(),
            "executionEnabled": False,
            "terminalConnected": False,
            "message": str(error.detail),
        }


@app.get("/symbols")
def symbols(_: None = Depends(authenticate)) -> dict[str, Any]:
    ensure_mt5()
    values = mt5.symbols_get() or []
    return {
        "symbols": [
            {
                "symbol": item.name,
                "description": item.description or None,
                "assetClass": classify_symbol(item),
                "tradeEnabled": getattr(item, "trade_mode", 0) != getattr(mt5, "SYMBOL_TRADE_MODE_DISABLED", 0),
                "visible": bool(getattr(item, "visible", False)),
                "path": getattr(item, "path", None),
            }
            for item in values
        ]
    }


@app.get("/quotes")
def quotes(
    symbols: str = Query(default=""),
    _: None = Depends(authenticate),
) -> dict[str, Any]:
    ensure_mt5()
    requested = [item.strip() for item in symbols.split(",") if item.strip()]
    if not requested:
        requested = [item.name for item in (mt5.symbols_get() or []) if getattr(item, "visible", False)][:200]
    output = []
    for symbol in requested:
        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is None:
            continue
        point = getattr(info, "point", 0) if info else 0
        spread_points = ((tick.ask - tick.bid) / point) if point else None
        output.append({
            "symbol": symbol,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "timestamp": iso_from_epoch(getattr(tick, "time", None)),
            "spreadPoints": float(spread_points) if spread_points is not None else None,
        })
    return {"quotes": output}


@app.get("/account")
def account(_: None = Depends(authenticate)) -> dict[str, Any]:
    ensure_mt5()
    value = mt5.account_info()
    if value is None:
        raise HTTPException(status_code=503, detail="MT5 account unavailable")
    return {
        "account": {
            "externalAccountId": str(value.login),
            "balance": float(value.balance),
            "equity": float(value.equity),
            "margin": float(value.margin),
            "freeMargin": float(value.margin_free),
            "currency": str(value.currency),
        }
    }


@app.get("/positions")
def positions(_: None = Depends(authenticate)) -> dict[str, Any]:
    ensure_mt5()
    values = mt5.positions_get() or []
    output = []
    for item in values:
        side = "buy" if item.type == mt5.POSITION_TYPE_BUY else "sell"
        output.append({
            "externalId": str(item.ticket),
            "symbol": item.symbol,
            "side": side,
            "volume": float(item.volume),
            "openPrice": float(item.price_open),
            "stopLoss": float(item.sl) if item.sl else None,
            "takeProfit": float(item.tp) if item.tp else None,
            "openedAt": iso_from_epoch(item.time),
        })
    return {"positions": output}


@app.get("/history")
def history(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    _: None = Depends(authenticate),
) -> dict[str, Any]:
    ensure_mt5()
    start = datetime.fromisoformat(from_.replace("Z", "+00:00")) if from_ else datetime(2000, 1, 1, tzinfo=timezone.utc)
    end = datetime.fromisoformat(to.replace("Z", "+00:00")) if to else datetime.now(timezone.utc)
    deals = mt5.history_deals_get(start, end) or []
    output = []
    for item in deals:
        if not getattr(item, "symbol", ""):
            continue
        side = "buy" if item.type == mt5.DEAL_TYPE_BUY else "sell"
        output.append({
            "externalId": str(item.ticket),
            "symbol": item.symbol,
            "side": side,
            "volume": float(item.volume),
            "openPrice": float(item.price),
            "closePrice": float(item.price),
            "profit": float(item.profit),
            "currency": None,
            "openedAt": iso_from_epoch(item.time),
            "closedAt": iso_from_epoch(item.time),
            "status": "closed",
        })
    return {"history": output}


@app.get("/market/bars")
def market_bars(
    symbol: str,
    timeframe: str,
    limit: int = Query(default=10000, ge=1, le=100000),
    _: None = Depends(authenticate),
) -> dict[str, Any]:
    ensure_mt5()
    info = mt5.symbol_info(symbol)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Unknown MT5 symbol: {symbol}")
    if not info.visible:
        mt5.symbol_select(symbol, True)
    rates = mt5.copy_rates_from_pos(symbol, timeframe_constant(timeframe), 0, limit)
    if rates is None:
        code, message = mt5.last_error()
        raise HTTPException(status_code=503, detail=f"History unavailable: {code} {message}")
    bars = [
        {
            "time": iso_from_epoch(row["time"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "tickVolume": int(row["tick_volume"]),
            "realVolume": int(row["real_volume"]),
        }
        for row in rates
    ]
    return {"symbol": symbol, "timeframe": timeframe, "bars": bars}


@app.api_route("/orders", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def orders_disabled() -> None:
    raise HTTPException(status_code=405, detail="Order execution is disabled in PAPER/read-only bridge")
