# Historical Intelligence — Minimum Effective Baseline

## Purpose

Historical memory is evidence, not a guarantee. The platform must refuse to treat a pattern as statistically useful when its sample is too small, too concentrated in one market regime, or built with information that was unavailable at the historical decision timestamp.

## Minimum price history

For core cross-asset comparison, target at least **15 years of daily data** and never label coverage adequate below **10 years**, where instrument history permits. This is intended to span multiple materially different regimes rather than maximize row count.

For intraday pattern learning, target **5 years** and treat less than **2 years** as insufficient for production weighting. Intraday history must include spread/slippage assumptions and should not be mixed across materially different market microstructure without a regime/version marker.

Initial long-history proxy universe:

- SPY — US large-cap / broad risk proxy
- QQQ — Nasdaq / growth proxy
- GLD — gold proxy
- TLT — long-duration US rates proxy
- SOXX — semiconductor proxy

Broker-native FX, index, commodity and crypto series should be added when a provider with adequate history and licensing is configured.

## Macro baseline

Initial FRED/ALFRED core:

- VIXCLS — volatility/stress
- DGS10 — US 10Y nominal yield
- DFII10 — US 10Y real yield
- FEDFUNDS — policy rate
- CPIAUCSL — CPI
- UNRATE — unemployment

Revised macro series must be stored by vintage. A historical decision can only access the vintage that existed at the simulated timestamp. This prevents look-ahead bias from later revisions.

## Minimum pattern sample

The engine uses these conservative operational grades:

- **< 30 comparable episodes:** insufficient; memory cannot materially support a trade.
- **30–99:** weak; contextual evidence only.
- **100–299:** usable; may adjust evidence modestly.
- **>= 300:** strong only if regime diversity is also adequate.
- For a regime-specific conclusion, prefer **>= 75** examples from the same regime.
- Episodic memory should surface at least **3** genuinely similar cases before presenting a recurring-case narrative.

These are engineering guardrails, not universal statistical laws. They should be tightened when outcomes are noisy, highly correlated, or produced by overlapping windows.

## Regime diversity

A "solid" database should include at least four materially different environments where available:

1. sustained risk-on / low volatility;
2. tightening / rising-yield conditions;
3. recession or acute risk-off / volatility shock;
4. recovery / easing or post-shock normalization.

For US-centric assets, history should deliberately include the 2008–09 crisis when instrument availability permits, the 2020 shock/recovery, the 2022 inflation/rate shock, and non-crisis expansion periods. These periods are used as coverage regimes, not as hand-picked proof of a strategy.

## Two memories

### Statistical memory

Aggregates many comparable episodes and stores sample size, positive rate, median return, mean R multiple, profit factor and observed drawdown. Statistical memory receives more weight only as sample size and regime coverage improve.

### Episodic memory

Finds the most similar historical feature vectors. Similarity must penalize missing features. A few highly similar episodes can explain context but cannot override weak aggregate statistics or any Risk Brain veto.

## Three-brain interaction

- Technical Brain: trend, momentum, structure, volatility, multi-timeframe agreement, liquidity.
- Macro Brain: event impact, news sentiment, source reliability/agreement, macro regime alignment, freshness.
- Risk Brain: drawdown, exposure, concentration, volatility, liquidity, correlation and market stress.

Risk has veto power. Historical memory may adjust evidence within bounded limits but cannot relax risk limits.

## Data quality rules

- Never silently fill missing historical features with zero.
- Store source and timestamp for every dataset.
- Use idempotent ingestion keys so refreshes do not duplicate history.
- Separate adjusted and raw prices where corporate actions matter.
- Keep backtest TRAIN / VALIDATION / TEST periods separated.
- Use walk-forward evaluation before accepting changes to weights.
- Account for commissions, spread and slippage in simulated performance.
- Persist rejected WAIT/NO_TRADE decisions, not only trades.

## Source policy

FRED/ALFRED is the initial macro source because it supports historical observations and vintage dates. The initial price bootstrap supports Alpha Vantage long-history daily adjusted series when an appropriate API plan/key is configured. Provider licensing and API entitlement must be checked before bulk or production use.
