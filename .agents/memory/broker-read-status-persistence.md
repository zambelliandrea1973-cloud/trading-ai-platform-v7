---
name: Broker read-status persistence
description: Concurrency and safety rules for persisted operational broker-read outcomes.
---

Persist broker data-read outcomes as one schema-enforced operational row per mode, with an atomic write for only the endpoint that just completed. Do not replace an entire in-memory snapshot in storage.

**Why:** Separate API processes can complete protected broker reads at the same time. A whole-snapshot replacement can silently reset another endpoint's newer outcome to `unknown`, making outage context disappear after restart.

**How to apply:** Keep only safe status categories and timestamps in the persistent record, update the relevant endpoint through an upsert, and load a missing record as all-unknown. Any later mode expansion must preserve one singleton record per mode and the same endpoint-specific update rule.