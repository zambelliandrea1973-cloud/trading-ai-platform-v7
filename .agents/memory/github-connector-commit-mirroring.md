---
name: GitHub connector commit mirroring
description: Preserve local Git history when publishing through the GitHub connector rather than Git HTTPS.
---

When the Git HTTPS remote cannot authenticate but the GitHub connector is available, the Git-data REST API can recreate local blobs, trees, and commits with matching SHAs before advancing the branch reference without force.

**Why:** The connector authenticates API calls without exposing credentials. The GitHub commit API uses the message bytes supplied: dropping the local commit message's final newline creates a different SHA even when parent, tree, author, and timestamps match. Large base64 blobs read through the sandbox shell callback may be silently clipped near its output limit despite no truncation flag, producing the wrong blob SHA.

**How to apply:** Preserve each commit's full message including its trailing newline and original metadata. Read large base64 blobs in bounded chunks and join them before uploading. Verify the SHA returned for every blob, tree, and commit against local Git, recheck the remote ref, and only then update it with `force: false`. Fetch the branch afterward to confirm its head and tree match the local branch.