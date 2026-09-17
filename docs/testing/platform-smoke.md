# Platform smoke protocol

Run each client independently against a temporary/staging package. Do not replace the active Leo Dev installation during development.

Record:

- client version and OS;
- exact package path and invocation;
- manifest discovery and the single visible product workflow;
- whether the Skill body and required references loaded;
- a read-only request that must not create `.leo-dev/` state;
- a fixture development request that must create only the expected local state;
- absence of unexpected hooks, MCP servers, commands, installs, Git mutations, network writes, and deployment;
- cleanup result.

A static manifest check is not a platform smoke. One client’s result cannot substitute for another.

## Current status (2026-09-04)

- Codex: static official validators passed; real load is blocked because this client version has no session-scoped local plugin directory and global staging installation is not authorized. See `verification/platform-smoke/codex.md`.
- Claude Code: strict manifest validation passed; real load was attempted and blocked before any token/model turn. See `verification/platform-smoke/claude-code.md`.
- Cursor Agent: real load was attempted and blocked at local keychain startup. See `verification/platform-smoke/cursor.md`.

No client is marked as having passed a real-load smoke.
