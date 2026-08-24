---
name: OpenAPI codegen compatibility
description: Compatibility constraints between generated Zod clients and the installed workspace packages.
---

Use `type: number` for numeric API fields that do not need strict integer validation in the generated client.

**Why:** The current Orval/Zod generation path emits `zod.int()` for OpenAPI `integer`, but the installed Zod package does not expose that API, so the generated library fails to typecheck.

**How to apply:** Before declaring an OpenAPI field as `integer`, confirm that the generated Zod output typechecks; otherwise use `number` and enforce whole-number semantics at the server boundary if needed.

When endpoint query parameters are added, regenerate the clients through the package codegen command rather than invoking Orval directly.

**Why:** The generator can emit same-named Zod parameter schemas and TypeScript model types, causing a barrel-export collision.

**How to apply:** Use the repository’s codegen command, which normalizes those generated schema names before the library typecheck.