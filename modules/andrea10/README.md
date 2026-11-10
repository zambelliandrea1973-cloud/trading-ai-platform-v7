# ANDREA10 — statistical signal bot (prototype)

Status: **isolated / signal-only / disabled for execution**. This module does not connect to MT5, call broker APIs, place orders, register a scheduler, or change existing BERTO strategies.

## Purpose
Prototype breakout signal generation using the previous 20 completed bars. This rule is **not backtested and is not evidence of profitability**.

## Test
From `modules/andrea10`: `python -m unittest discover -p 'test_*.py' -v`.

## Integration gates for Replit
1. Confirm the running Replit deployment corresponds to this GitHub repository and branch; inspect its actual API, bridge, risk and simulation interfaces.
2. Reuse the existing shared MT5 bridge; do not add parallel polling. Validate instrument, timeframe, closed-bar status, timestamps and data freshness.
3. Add a separately identifiable bot `andrea10` with OFF / DEMO simulation modes. Default OFF. No LIVE implementation or permission.
4. Route all hypothetical orders through the existing centralized Risk Brain and account isolation; never trust the boolean `risk_authorized` from an external client.
5. Add event logs, deterministic replay, historical walk-forward backtesting, fees/spread/slippage, and tests for gaps, reconnects and duplicate bars.
6. Run demo/shadow validation before any order execution is considered. Do not modify or restart production automatically.

The Python prototype is intentionally not wired to the TypeScript application. A Replit-side adapter must be designed after inspecting actual application code.
