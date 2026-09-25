# Multi-account isolation — mandatory LIVE invariant

## Security invariant
Every authenticated user owns an isolated trading-account context. Personal trading data and broker connections MUST be scoped by both `userId` and `tradingAccountId`.

The shared strategy engines (BERTO / FIVE_BRAINS) may emit common market signals. Everything after the signal is account-local: strategy selection, risk profile, sizing, positions, history, learning records, broker connection and execution.

## Required execution chain
`authenticated user -> owned trading account -> selected strategy -> account risk/sizing -> account broker connection -> order`

Any missing or mismatched ownership value MUST fail closed and reject execution. There is no fallback to a global, previous, default, or another user's account.

## Personal database rule
Every personal-data table/query must include `userId` AND `tradingAccountId`. This applies to configurations, positions, orders, history, risk state, performance and user-specific learning/outcomes.

Market data and immutable shared strategy definitions may remain shared because they contain no user financial data.

## Broker secrets
Broker/MT5 secrets must never be stored in browser state, shared strategy records, logs, Learning Memory or API responses. Application records store only `brokerConnectionId`; the actual secret is resolved server-side for the already-authorized owner/account.

## LIVE gate
LIVE execution remains disabled until automated tests prove at least:
1. A can read/write only A personal records.
2. B can read/write only B personal records.
3. A request carrying B tradingAccountId is rejected.
4. A request carrying B brokerConnectionId is rejected.
5. Strategy/risk changes for A do not affect B.
6. Concurrent A/B signals create independently sized account-local proposals.
7. Missing ownership/context rejects rather than falling back.
8. Audit events identify the non-sensitive user/account context without logging credentials.

No future learning or strategy update may remove these invariants.