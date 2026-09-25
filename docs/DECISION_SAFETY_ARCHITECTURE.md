# Trading AI Platform V7 — Decision Safety Architecture

## Objective

The platform must optimize for risk-adjusted decision quality, not for trade frequency or apparent certainty. No component may represent profit as guaranteed or losses as avoidable.

The default operating mode remains PAPER. LIVE execution is a separate, explicitly reviewed capability and must never be inferred from AI confidence, broker connectivity, database state, or UI state.

## Decision pipeline

Every actionable proposal must pass these stages in order:

1. **Data integrity** — required market inputs are present, parseable, sufficiently fresh, and internally consistent.
2. **Source quality** — news/context claims retain publisher URL, publisher timestamp, instrument relevance, and corroboration state when applicable.
3. **Market regime** — classify volatility, trend, liquidity and relevant macro/event conditions before evaluating direction.
4. **Signal ensemble** — combine independent evidence categories rather than allowing one indicator, one news item, or one model output to dominate silently.
5. **Uncertainty calibration** — confidence must describe evidence strength, not expected profit. Missing or conflicting evidence lowers confidence.
6. **Risk gate** — reject proposals that violate exposure, drawdown, liquidity, stop-distance, concentration, or configured risk limits.
7. **Trade geometry** — an actionable PAPER proposal needs entry assumptions, invalidation/stop, target or exit logic, estimated reward/risk, sizing basis, and expected holding horizon.
8. **Decision state** — output BUY/SELL only when all mandatory gates pass; otherwise output WAIT or NO TRADE with machine-readable reasons.
9. **Audit** — persist the evidence snapshot, model/rule version, decision, rejection reasons and timestamps so the decision can be reproduced later.

## Mandatory guardrails

- Stale or materially incomplete mandatory data => `NO TRADE`.
- Contradictory critical inputs without sufficient resolution => `WAIT` or `NO TRADE`.
- Unknown risk inputs => no actionable proposal.
- Confidence is never a probability of profit unless a separately validated calibration model proves that interpretation.
- Position sizing is derived from risk budget and stop distance, never from confidence alone.
- A proposal without an explicit invalidation condition is non-actionable.
- Risk limits cannot be relaxed automatically by the AI.
- Drawdown protection has priority over opportunity ranking.
- Broker execution mode is authoritative server-side; frontend state cannot enable LIVE execution.
- Any degraded persistence/audit state must remain fail-safe with LIVE disabled.

## User-facing decision card

For a novice-safe interface, each asset decision should expose, in this order:

- **Decision:** BUY / SELL / WAIT / NO TRADE.
- **Evidence confidence:** Low / Medium / High plus numeric score only when calibrated consistently.
- **Data quality:** Complete / Reduced / Insufficient and last-update timestamp.
- **Risk:** Low / Medium / High plus the binding risk constraint.
- **Why:** maximum three principal evidence drivers.
- **What could invalidate it:** the most important contrary condition.
- **Trade plan (PAPER):** entry zone, stop/invalidation, target/exit logic, reward/risk, risk budget and suggested size.
- **Do not trade when:** explicit gate failures or event/liquidity restrictions.

Advanced indicators belong behind an expandable details view. The primary screen should help the user understand the decision rather than expose every model feature.

## Validation before any LIVE phase

LIVE execution must remain disabled until the platform has, at minimum:

- deterministic unit/integration tests for all risk gates;
- historical walk-forward testing with costs and slippage assumptions;
- out-of-sample evaluation separated from strategy/model tuning;
- PAPER forward-testing over multiple market regimes;
- calibration measurements for confidence versus realized outcomes;
- maximum drawdown, loss-tail and concentration analysis;
- reproducible audit records for accepted and rejected proposals;
- broker bridge authentication, allowlisting, idempotency and failure-mode tests;
- explicit human approval of LIVE activation and server-side kill switch behavior.

Backtests and PAPER results are evidence about historical/simulated behavior, not guarantees of future profitability.

## Stability rule for V7 refactoring

Refactor incrementally. Do not rewrite the 62 KB platform page in one change. Extract one bounded surface at a time, preserve existing API contracts, run typecheck/build after each extraction, and keep mock fallbacks clearly labeled. Functional changes to decision logic should be separate from visual refactors so regressions can be isolated.