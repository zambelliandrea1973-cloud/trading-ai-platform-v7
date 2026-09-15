---
name: Axi MT5 integration boundary
description: Safety and architecture rules for the future Axi Select and MetaTrader 5 connection.
---

Treat Axi Select compatibility as a MetaTrader 5 bridge integration, not a direct dependency of the analysis engine. Exchange normalized account, quote, position, history, and order data through a broker adapter while keeping the current operating mode PAPER.

**Why:** The trading terminal normally operates in a separate Windows/VPS environment, and coupling it to the web app would expose execution and broker-specific failure modes too early.

**How to apply:** Keep credentials and the terminal bridge outside the frontend and database schemas. Start with read-only health, market, account, and position synchronization; require an explicit, independently reviewed transition before any LIVE order capability can be enabled. Preserve audit events for every connection-state or execution-mode change.

Bridge security history is a PostgreSQL audit trail. If that persistence layer is unavailable, surface an explicit degraded state and continue retrying writes, but never infer that the bridge can execute LIVE.

**Why:** Operational auditability must survive process restarts, while a database outage must not weaken the PAPER-only execution boundary.

**How to apply:** Read recent bridge events from durable storage for operator views; record authenticated heartbeats, health failures, and rejected key or allowlist checks. Keep the broker mode PAPER and `executionEnabled` false regardless of audit-store health.

The MT5 heartbeat is machine-to-machine traffic: it may bypass the user session only when its dedicated bridge key and source-IP allowlist both pass. Every broker read remains behind the user session, with additional read-key/IP controls where defined.

**Why:** A Windows/VPS bridge cannot carry a browser Clerk session, but widening the bypass to broker reads would expose account and market data.

**How to apply:** Keep the heartbeat as the sole pre-session broker endpoint. Mount status, quotes, account, positions, and history after user authentication; test the production route order, not only isolated routers.

SCALP, INTRADAY, and SWING may have independent OFF/DEMO selections, but they share one account-wide risk budget and one per-symbol ownership lock. LIVE cannot be enabled through configuration alone.

**Why:** Independent time horizons must not multiply exposure or open competing positions on the same instrument, and an environment toggle is too weak for real-order authorization.

**How to apply:** Enforce risk and symbol ownership above individual modes. Reject every LIVE transition and LIVE lock until a separately reviewed code authorization exists; release symbol ownership only after an authoritative close confirmation.