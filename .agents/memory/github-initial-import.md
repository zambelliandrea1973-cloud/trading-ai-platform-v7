---
name: GitHub initial import
description: Reliable source-tree imports to a new GitHub repository through the Replit GitHub connector.
---

For a new empty GitHub repository, create an initial commit before using Git-data operations; transfer a source tree with a small number of atomic API requests instead of parallel per-file blob uploads.

**Why:** GitHub can reject Git-data requests for an empty repository, and burst blob uploads through the connector proxy may receive temporary rate limits even for a modest source tree.

**How to apply:** Create the repository, initialize its default branch, then create the final tree and commit with the initialization commit as parent. Verify the branch head and recursive tree after updating the reference.