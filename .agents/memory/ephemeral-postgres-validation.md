---
name: Ephemeral PostgreSQL validation
description: Constraints for running isolated PostgreSQL schema and persistence checks locally.
---

An `initdb` cluster does not necessarily create the named application database used by its connection string; create that database explicitly before applying the current schema.

**Why:** Schema tools connect to the requested database, so a fresh cluster can be healthy while schema introspection still fails with “database does not exist.”

**How to apply:** Start PostgreSQL on a dynamically allocated localhost port with a temporary data and socket directory, create a dedicated database, run the existing schema-push command against its URL, and always stop and remove the cluster in cleanup.