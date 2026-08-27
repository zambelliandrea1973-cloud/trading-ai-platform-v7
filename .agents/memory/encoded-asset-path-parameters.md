---
name: Encoded asset path parameters
description: URL handling rule for market symbols containing slashes in generated API client calls.
---

Market symbols containing `/` must be URL-encoded both when building frontend asset links and when passed to generated asset-query hooks.

**Why:** The generated URL builder interpolates path parameters without encoding them. A symbol such as `EUR/USD` otherwise becomes two path segments and returns 404 even when the visible route was encoded correctly.

**How to apply:** Keep decoded symbols for labels and engine inputs, but pass `encodeURIComponent(symbol)` to generated path-based API calls and use encoded symbols in links.