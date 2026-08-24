---
name: Market-news verification evidence
description: Rules for keeping multi-source market-news citations and corroboration trustworthy.
---

Only expose a market-news citation when it has an HTTPS article URL from the declared publisher and a parseable publisher timestamp. Treat a source as usable only when it returns such verifiable items.

**Why:** Generic source pages, generated timestamps, or broad category matching make a contextual explanation look verified when it is not, which is especially misleading before a PAPER proposal.

**How to apply:** Require direct pairwise event evidence (shared instrument, close publication window, and strong headline similarity) before calling sources confirmed, contradicted, or duplicate. Keep unmatched items explicitly single-source, preserve every direct relationship in its source count, and show reduced coverage when a configured source has no usable item.