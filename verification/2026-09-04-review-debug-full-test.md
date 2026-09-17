# Review, debug, and full-test report — 2026-09-04

## Decision

- Current implemented checkpoint (Milestone 0, Task 1.1, Tasks 2.0–2.2): **GO** after independent spec, adapter, and controller reviews.
- Complete unified-development-plugin v1: **NO-GO** because the gate runner, public controller CLI, risk router, autonomous serial DAG/task loop, contract gates, installers, CI, conformance suite, and active-install migration are not implemented yet.

## Review and debug closure

Independent review initially found exploitable or correctness-relevant failures in workspace symlink containment, crash recovery, journal locking and validation, snapshot authority, lease fencing, state guards, receipt schemas, Windows path handling, package inventory/hashes, and run reconciliation. Each was reproduced before repair. Final independent reviews reported no remaining Critical or Important issue in the implemented controller-core or static-adapter scope.

The final flaky test was not hidden by rerunning: the timing-based lock-contention setup was replaced with an explicit acquired-lock/release handshake, then the suite was rerun successfully.

## Passed evidence

| Check | Result |
|---|---|
| `npm ci` | passed |
| `npm test` | passed: 49 Vitest controller/schema tests + 8 Node adapter tests |
| Python doctor unit tests | passed: 6/6 |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| adapter build + deterministic/package verifier | passed |
| Codex official plugin validator | passed |
| Codex official Skill validator | passed |
| Claude `plugin validate --strict` | passed |
| local read-only doctor | passed |
| specification SHA-256 vs approval receipt | matched: `3daa8f3b8a0fef4e6c3f3b1009623c613276f3cd1b7e2e9e0daabd712c8636f1` |
| repository secret-shape/absolute-home scan (excluding dated research/plan text and generated/dependency trees) | no credential-shaped match |
| source symlink inventory (excluding dependencies/generated output) | no symlink found |

## Blocked or not run

- Codex real-load smoke: not run because Codex CLI 0.153.0 has no session-scoped local plugin directory; staging installation would mutate global plugin state, which was not authorized.
- Claude real-load smoke: attempted with a session-scoped plugin, read-only permissions, no tools/session persistence, and a USD 0.05 cap; blocked before any token/model turn and aborted after 122 seconds. Cost was USD 0 and the isolated workspace stayed empty.
- Cursor real-load smoke: attempted in ask/read-only mode with a session-scoped plugin; blocked before model execution by `SecItemCopyMatching failed -50` (exit 139). The isolated workspace stayed empty.
- Cursor static manifest validation: no equivalent local validator was available.
- Node 20 minimum and Windows runtime: not run locally; successful runs used Node 25.8.2 on macOS 15.7.7.
- `npm audit`: blocked. The sandbox request hit the local proxy restriction; an approved network retry returned no advisory response and was stopped rather than reported as passed.
- Browser, native-device, application business tests, and AI/RAG evals: not applicable to the implemented controller/static-packaging checkpoint.

## Side-effect boundary

No commit, remote, push, PR, marketplace publication, deployment, active-plugin replacement, destructive cleanup, or global configuration change was performed.
