---
name: BERTO session-close behavior
description: User-confirmed treatment of already-started BERTO setups at the Rome forced-exit boundary.
---

Already-started BERTO setups must not record new breakout or retest fills from 21:55 Europe/Rome onward, but their existing recorded state stays unchanged. Do not convert these states to CLOSED or EXPIRED merely because a late fill is reported.

**Why:** The user explicitly chose “block new fills and leave the current state” when asked how already-started orders should behave at the forced-exit boundary.

**How to apply:** Preserve the existing state and fill timestamps when rejecting post-close transitions. Treat order cancellation or position liquidation as separate concerns from this state transition rule.