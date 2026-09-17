# Mochi M4 import-boundary baseline

This is a supplemental, independent HTTP harness for the M4 import boundaries
that the frozen acceptance oracle does not exercise: wrong Content-Type,
JSON bodies over 1 MiB, explicit foreign Origin, and the literal `Origin:
null` case. It is not M4 acceptance.

## Harness contract

[`m4-import-boundaries.mjs`](m4-import-boundaries.mjs) starts the active,
read-only application at `/private/tmp/leo-dev-mochi-OjZ5Xy` with the fixed
Node executable `/Users/leo/.nvm/versions/node/v22.22.2/bin/node`, `--port
0`, and a newly created board file under the system temporary directory. It
waits at most five seconds for the application's JSON listening line and
stops the child with SIGTERM, escalating to SIGKILL only after a five-second
shutdown timeout.

The harness first creates one valid task through the existing `POST
/api/tasks` endpoint. It sends a valid snapshot control to `POST
/api/import`, then records the board and exact data-file bytes. Each refusal
case is followed by `GET /api/board` and a byte-for-byte data-file comparison.
The expected statuses are deliberately fixed by the M4 contract:

| Case | Expected status | Required preservation |
| --- | ---: | --- |
| valid snapshot control | 200 | n/a; successful import may append activity |
| `text/plain` import | 415 | tasks, activity, disk bytes |
| JSON import over 1 MiB | 413 | tasks, activity, disk bytes |
| `Origin: https://foreign.example` | 403 | tasks, activity, disk bytes |
| `Origin: null` | 403 | tasks, activity, disk bytes |

## Baseline run, 2026-09-14

The ordinary sandbox run could not bind loopback (`listen EPERM`), so it
produced no application-level result. The authorized, bounded host-local run
started at `http://127.0.0.1:63504` and exited 1 because M4 is not implemented
in the current M3-ready source.

All five import requests returned `404 {"error":"not found"}`. The four
refusal requests nevertheless preserved tasks, activity, and exact disk bytes;
that merely demonstrates that an unhandled route made no write. It does not
establish the required 415, 413, or 403 behavior. The valid control's 404 also
shows that the requests did not reach an implemented import handler.

The exact structured outcome is in [result.json](result.json), and the
terminal host-local run is in [baseline.log](baseline.log). The current source
also has no `/api/import` or `/api/export` route in `server.mjs`, and
`BoardStore` has no import/export operation, consistent with this expected
RED baseline.

Run after the M4 writer has produced a candidate:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node \
  verification/release-2026-09-14/mochi-m4-boundary-review/m4-import-boundaries.mjs
```

Its exit code must be zero before these boundary checks can contribute to M4
acceptance. A new independent source review and the frozen oracle remain
separate checks.
