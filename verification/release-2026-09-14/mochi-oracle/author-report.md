# Mochi Board frozen HTTP acceptance oracle

**Author:** independent acceptance-test author  
**Scope:** `examples/mochi-board/tests/acceptance.test.mjs` only. No application, browser assets, or requirements were changed.

## Frozen artifact

`tests/acceptance.test.mjs` SHA-256 (2026-09-14):

```
46a98d6951f40538011a8aa3c99e3e2f195b93f085844de5d4a01dad1aeb2872
```

The oracle uses only Node built-ins (`node:test`, `assert`, `fetch`, child processes, and disposable OS temporary directories). It launches `node server.mjs --port 0 --data <temp>/board.json`, discovers the server by parsing its structured `listening` JSON line, and terminates/restarts the child process for persistence checks.

## Contract coverage

| Prefix | Covered HTTP contracts |
| --- | --- |
| M1 | Empty startup board; create defaults, trimming, exact task shape and validation; rejected creates preserve state; concurrent creates; restart persistence; corrupt-existing-file startup failure without byte changes. |
| M2 | PATCH all editable fields and immutable task identity/creation time; empty, unknown and invalid PATCH bodies; missing task IDs; DELETE 204; malformed JSON, content type, 1 MiB limit, explicit foreign Origin; invalid requests preserve state; 100-entry persisted activity window; unknown static path and no wildcard CORS. |
| M4 | Semantic export; exact text/code-looking strings through create, export and import; empty import while retaining activity; duplicate, bad ID, exact-fields, missing-field, invalid/ordered date, schema and maximum-count rejection with board/history and exact disk bytes unchanged. |

The coordinator clarified the previously unspecified history fields before freeze: activity records use nonempty unique `id`, `action`, and ISO `timestamp`; task actions additionally use `taskId` and readable `title`. Import activity may include `count`, which the oracle deliberately does not require.

M3 requires separate real-browser verification. It is intentionally not represented by source-substring checks in this HTTP oracle.

## Commands and evidence

| Check | Command | Result |
| --- | --- | --- |
| Syntax/load check | `node --check tests/acceptance.test.mjs` | Passed (exit 0). |
| Initial RED baseline, captured once | `node --test --test-name-pattern='M1 create defaults' tests/acceptance.test.mjs` | Failed as expected (exit 1): `server.mjs` does not yet exist. This is the intended pre-implementation baseline, not a production defect. |
| Full oracle | `node --test tests/acceptance.test.mjs` | Not run to green: application server is absent. |
| Phase runs | `node --test --test-name-pattern=M1 tests/acceptance.test.mjs` (and M2/M4) | Not run to green: application server is absent. |

The root evaluator must run the full and phase commands after implementation and independently preserve any failures. This author did not change requirements, application files, dependencies, Git state, or external systems.

## Harness correction before implementation

The root reviewer corrected the harness before application implementation: decode the example directory with `fileURLToPath` (portable paths with spaces), terminate an owned child if startup/readiness fails, handle process spawn errors, and bound HTTP requests to avoid an indefinitely stuck acceptance run. No product behavioral assertion or requirement limit was weakened. The original oracle is preserved as `acceptance-v1.snapshot.mjs` with the original hash above.

Current frozen oracle SHA-256: `152ab74d2ffca5632d8f75e175408cf99f97eb337e1fbcd7c39bca90e91d576e`. `node --check` passed after the correction. Application GREEN remains unrun at this checkpoint.
