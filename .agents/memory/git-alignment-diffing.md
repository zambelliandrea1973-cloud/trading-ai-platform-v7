---
name: Git alignment diffing
description: How to reliably detect and pull in real code changes when the user has edited the project directly on GitHub.
---

When asked to "align with GitHub" or similar, compare the local working tree against the remote branch by diffing recursive blob SHAs (`git ls-tree -r` locally vs the GitHub Git Trees API with `?recursive=1`), not by reading the latest commit message or comparing file counts alone.

**Why:** A commit message can undersell or omit scope, and a matching file count can hide changed content when files were both added and removed. Blob-level SHA diffing is the only check that reliably distinguishes "already in sync" from "real drift" before deciding whether to pull anything in.

**How to apply:** List local blobs with mode+sha+path, list remote blobs the same way, then compute three sets: missing locally (new remote files), missing remotely (local-only files), and changed (same path, different sha). Only files actually in the changed/missing-locally sets need to be fetched and reviewed; do not assume a new commit means widespread changes without checking. After pulling in changed files, re-run typecheck/tests/build and restart affected workflows before reporting alignment as complete.
