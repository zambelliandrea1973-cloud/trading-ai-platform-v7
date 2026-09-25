---
name: BERTO strategy identifier
description: Why BERTO's historical strategy identifier remains stable despite replacement of the breakout-retest sequence.
---

Keep the existing BERTO strategy identifier stable when changing its trading rules; distinguish the new behavior using the rules version rather than changing the identifier.

**Why:** The identifier is exposed in plan responses and could be used by existing consumers. Renaming it just because its historical wording mentions a superseded entry sequence would introduce an unrelated compatibility break.

**How to apply:** For future BERTO rule updates, check consumers before changing the identifier; use the version to convey a changed contract. Do not mistake the identifier's old wording for active retest behavior.