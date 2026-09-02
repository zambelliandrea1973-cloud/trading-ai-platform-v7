# BERTO ↔ Five-Brains Co-Learning Architecture

Status: PREPARED / WAITING FOR BERTO ENGAGEMENT PARAMETERS

## Objective

Create a controlled co-learning layer between BERTO and the existing five-brain trading architecture without allowing either system to contaminate the other's independent signal generation.

Core principle:

BERTO ↔ VALIDATED SHARED MEMORY ↔ FIVE-BRAINS SYSTEM

BERTO and the five-brain system remain independent signal producers. They exchange knowledge only through validated historical outcomes, never by directly copying each other's current signal.

## Existing five-brain side

The current architecture contains:
1. Technical analysis
2. Macro / News analysis
3. Fundamental analysis
4. Statistical / relational analysis
5. Risk / Safety control

The existing Master Decision Engine remains authoritative for its own decision path. This document does not change its current production weights or safety limits.

## BERTO adapter — placeholder contract

BERTO parameters are intentionally NOT invented. The adapter remains dormant until the real BERTO engagement parameters are supplied.

Expected normalized output contract after mapping:
- timestamp
- symbol
- timeframe / horizon
- BERTO raw signal
- BERTO normalized direction: BUY / SELL / WAIT / NO_TRADE
- BERTO score, if supplied
- BERTO confidence, if supplied
- BERTO engagement threshold(s)
- BERTO invalidation condition(s)
- BERTO risk / size indication, if supplied
- BERTO model/version identifier
- raw parameter payload for audit

All fields that BERTO does not actually provide must remain NULL rather than being estimated.

## Shared Learning Memory

Every evaluated opportunity receives an immutable observation record containing:

### Context at decision time
- observation_id
- timestamp UTC
- symbol / asset family
- timeframe / trading horizon
- market regime
- OHLCV snapshot / reference
- bid, ask, spread and volatility context when available
- macro-event context
- news-event context and source-quality state
- cross-asset / correlation regime
- data-integrity state

### BERTO snapshot
- raw BERTO parameters
- normalized BERTO decision
- score/confidence when genuinely supplied
- engagement/invalidation parameters
- BERTO version

### Five-brain snapshot
- technical score/confidence
- macro-news score/confidence
- fundamental score/confidence
- statistical score/confidence
- risk/safety state
- weights actually used
- hard vetoes / soft guards
- final decision
- final confidence
- proposed size multiplier

### Agreement state
Classify without forcing convergence:
- STRONG_AGREEMENT
- WEAK_AGREEMENT
- BERTO_ONLY
- FIVE_BRAINS_ONLY
- DIRECTIONAL_CONFLICT
- BOTH_WAIT
- INSUFFICIENT_DATA

Disagreement is data and must be preserved.

### Outcome labels
Measure results at multiple horizons rather than only final P&L:
- forward return at configured horizons
- realized P&L when a trade is executed
- unrealized path where relevant
- MFE (Maximum Favorable Excursion)
- MAE (Maximum Adverse Excursion)
- stop-loss / take-profit outcome
- time to MFE / MAE
- spread/slippage actually paid
- risk-adjusted outcome
- whether a veto avoided a subsequent adverse move
- whether a rejected opportunity would have been favorable

No outcome field may be populated using information unavailable at the corresponding historical timestamp in backtests.

## Learning objective

The learner must estimate conditional competence, not a single global winner.

Examples of questions it should eventually answer:
- In which assets and regimes does BERTO add predictive value?
- When does the technical module outperform BERTO?
- When should macro/news information dominate historical pattern similarity?
- Which statistical regimes improve or degrade BERTO's signal quality?
- Which disagreement configurations are predictive?
- When does Risk/Safety correctly prevent a loss?
- Which combinations improve expectancy, drawdown and stability out of sample?

## Meta-weighting layer

Initial state: OFF.

After sufficient validated observations, a candidate meta-model may propose conditional weights based on:
- asset / asset family
- timeframe / horizon
- volatility regime
- trend/range regime
- macro-event regime
- liquidity/spread regime
- BERTO confidence/engagement state
- five-brain confidence state
- historical performance of the same configuration

The meta-layer may PROPOSE weights but may not directly modify production parameters.

## Three-stage promotion firewall

### 1. PRODUCTION
Uses only currently approved parameters. No online self-modification.

### 2. LEARNING
Consumes immutable historical observations and proposes candidate changes. Production results cannot be rewritten.

### 3. VALIDATION
Every candidate change must pass, at minimum:
- point-in-time-safe backtest
- train/validation/test temporal separation
- walk-forward validation
- transaction-cost/spread/slippage modelling
- comparison with the current production baseline
- drawdown and tail-risk checks
- PAPER forward validation

Only validated candidates may be manually or explicitly promoted to production.

## Anti-feedback-loop rules

1. BERTO must not use the five-brain current output as if it were independent market evidence.
2. The five-brain system must not use BERTO's current output as a substitute for its underlying market inputs.
3. Shared memory stores outcomes, not circular confirmations.
4. Training and evaluation periods must be temporally separated.
5. Model/version IDs must be stored with every prediction.
6. Re-training after an outcome must never rewrite the original prediction.
7. Agreement does not automatically imply higher confidence; only validated historical evidence can justify an agreement bonus.
8. Disagreement must remain visible to the learner even if no trade is executed.

## Minimum evidence before adaptive weighting

Do not activate adaptive meta-weighting merely after a fixed global trade count. Evidence must be sufficiently populated per relevant asset/regime/timeframe cell.

Until statistically useful coverage exists:
- collect observations;
- keep current production logic unchanged;
- report uncertainty;
- do not infer missing BERTO parameters.

The exact minimum sample requirements will be defined after BERTO's engagement parameters, target horizons and signal frequency are known.

## Data-source integration

The shared memory is designed to receive:
- Axi/MT5 live and historical market data
- imported point-in-time historical OHLCV / tick data
- authoritative macroeconomic series
- verified timestamped news/events
- fundamental point-in-time data
- cross-asset statistical features
- BERTO outputs

Every external record must preserve source, source timestamp, ingestion timestamp and data-quality status where available.

## Pending BERTO specification

Before activating the BERTO adapter, obtain and document:
1. Exact BERTO entry/engagement parameters
2. Meaning and range of every BERTO score
3. BUY/SELL/WAIT rules
4. Timeframe(s)
5. Target holding period(s)
6. Stop/invalidation logic
7. Position-sizing logic, if any
8. Required market inputs
9. Required historical lookback
10. Expected signal frequency
11. Asset families supported
12. Any BERTO internal regime classification exposed externally
13. Versioning/update behaviour

Once these are supplied, map them into the adapter without changing their semantics.

## Next implementation steps

1. Receive the real BERTO engagement specification.
2. Define the BERTO adapter schema from those real fields.
3. Create database tables for observations, predictions, outcomes and model versions.
4. Connect real MT5 OHLC/quotes and historical sources.
5. Start shadow collection: BERTO and five-brain predictions are stored independently even when no trade is executed.
6. Build outcome labelling jobs.
7. Establish baseline metrics for each system separately and for agreement/disagreement cohorts.
8. Only then evaluate a meta-weighting model.

This architecture is deliberately prepared before BERTO integration while leaving all unknown BERTO-specific parameters unset.