"""ANDREA10: isolated, signal-only statistical prototype. NEVER submits orders."""
from dataclasses import dataclass
from math import isfinite
from typing import Sequence

BOT_ID = "andrea10"

@dataclass(frozen=True)
class Bar:
    timestamp: int
    open: float
    high: float
    low: float
    close: float

@dataclass(frozen=True)
class Decision:
    state: str
    reason: str
    direction: str = "NONE"
    entry: float = 0.0
    stop: float = 0.0
    target: float = 0.0

def evaluate(bars: Sequence[Bar], *, market_open: bool, bridge_healthy: bool,
             risk_authorized: bool = False, max_age_seconds: int = 90,
             now_timestamp: int = 0) -> Decision:
    if not market_open:
        return Decision("WAIT", "MARKET_CLOSED")
    if not bridge_healthy:
        return Decision("BLOCK", "BRIDGE_UNHEALTHY")
    if len(bars) < 21:
        return Decision("WAIT", "INSUFFICIENT_BARS")
    if any(not all(isfinite(x) and x > 0 for x in (b.open, b.high, b.low, b.close))
           or b.low > min(b.open, b.close) or b.high < max(b.open, b.close)
           or b.low > b.high for b in bars):
        return Decision("BLOCK", "INVALID_PRICE")
    if any(b.timestamp >= bars[i + 1].timestamp for i, b in enumerate(bars[:-1])):
        return Decision("BLOCK", "NON_MONOTONIC_TIMESTAMPS")
    if now_timestamp and (now_timestamp < bars[-1].timestamp or
                          now_timestamp - bars[-1].timestamp > max_age_seconds):
        return Decision("BLOCK", "STALE_OR_FUTURE_DATA")
    history = bars[-21:-1]
    last = bars[-1]
    upper = max(b.high for b in history)
    lower = min(b.low for b in history)
    if lower <= last.close <= upper:
        return Decision("WAIT", "NO_BREAKOUT")
    direction = "BUY" if last.close > upper else "SELL"
    stop = lower if direction == "BUY" else upper
    distance = abs(last.close - stop)
    if distance <= 0:
        return Decision("BLOCK", "INVALID_STOP")
    target = last.close + (distance if direction == "BUY" else -distance)
    if not risk_authorized:
        return Decision("BLOCK", "RISK_BRAIN_APPROVAL_REQUIRED", direction, last.close, stop, target)
    return Decision("SIGNAL_ONLY", "REQUIRES_EXTERNAL_ORDER_APPROVAL", direction, last.close, stop, target)
