---
name: Axi MT5 integration boundary
description: Safety and architecture rules for the future Axi Select and MetaTrader 5 connection.
---

Treat Axi Select compatibility as a MetaTrader 5 bridge integration, not a direct dependency of the analysis engine. Exchange normalized account, quote, position, history, and order data through a broker adapter while keeping the current operating mode PAPER.

**Why:** The trading terminal normally operates in a separate Windows/VPS environment, and coupling it to the web app would expose execution and broker-specific failure modes too early.

**How to apply:** Keep credentials and the terminal bridge outside the frontend and database schemas. Start with read-only health, market, account, and position synchronization; require an explicit, independently reviewed transition before any LIVE order capability can be enabled. Preserve audit events for every connection-state or execution-mode change.