---
name: Localization approach
description: Durable language and translation rules for the Trading AI Platform.
---

Use the central localization provider and its message dictionary for every user-facing string. Italian is the default; English is a fully supported peer locale and the selection is persisted in the browser.

**Why:** Parallel language support must remain maintainable as the product grows; duplicated routes or ad-hoc conditions create translation drift and make a third locale unnecessarily expensive.

**How to apply:** Add complete key pairs for every new surface, consume translated labels through the localization hook, and preserve domain-standard market signals such as BUY, SELL, WAIT, and NO TRADE when clarity benefits from the international convention.