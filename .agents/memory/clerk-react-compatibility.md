---
name: Clerk React compatibility
description: Prevent runtime invalid-hook failures caused by an unsupported React patch release.
---

Keep the shared React and React DOM catalog versions within the peer dependency range declared by the installed Clerk React SDK.

**Why:** An otherwise minor React patch mismatch can pass TypeScript checks yet cause browser-side invalid hook calls in Clerk-enabled pages.

**How to apply:** After changing React, React DOM, or Clerk packages, inspect Clerk's peer range, install a compatible pair, restart both frontend and API workflows, and verify an authenticated route in a real browser.