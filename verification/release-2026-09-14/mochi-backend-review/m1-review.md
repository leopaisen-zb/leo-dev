# M1 independent backend review — NEEDS_FIXES

Reviewed at 2026-09-14 against `docs/spec-v1.md`, `docs/design.md`, `plan-v1.json` M1, `server.mjs`, and `lib/store.mjs`. This review did not change the candidate, application documentation, tests, or controller state.

## Candidate and context

| Item | Value |
| --- | --- |
| Submission record | `mochi-m1-submit.json`, SHA-256 `d392b79ad8792910d95e960731c12dd9d0526d1e9e19b1507cb1fd5e993f1d27` |
| Candidate review tree | `2a94a38547cf3d56acf112cee08bc6f952d9d47d16bfa5d9645b6f2f13679713` |
| Candidate input tree | `3067db1f425808d28e52a2b4a0f0739372e7633b8d473eff5072c2407ce01523` |
| M1 task hash | `3d9ed6d5572d48145e2046af14074f9896f13eff3298d5da55fd4aec9f44ae91` |
| Approved v1 spec hash | `a30e650e40f8228f88555d92c940b7071a452293e9c27657a1b322f2824c350d` |
| Current `server.mjs` SHA-256 | `6551df752410b568c35998115085a3c7383420e72c5868940606c6043494b950` |
| Current `lib/store.mjs` SHA-256 | `010550a2da6e1565ebe26619730673cf930bff295f8d90513022eb4999afbeba` |
| Current design hash | `d029f9253c9899ab602fe696b0d48de8a06d2f820de5f2c9ae65e87eddff5a53` |
| Current plan-v1 hash | `877bff1af0cf307874a8f70b6347295308408b1b62636b5ea72935927086b753` |
| Producer context | The supplied context identifies installed Codex thread `01a09f45-cb7d-7822-a78b-91b082b34542`; the submit record identifies logical producer session `installed-cli-m1`. |

## Reproduced defects

1. **M1 invalid supplied field values are silently accepted.** `server.mjs:58-60` uses nullish coalescing for optional fields. A supplied `null` is not an omitted field, but the implementation replaces it with a default. In an isolated copied app, each request returned HTTP 201 and changed the board:

   - `POST /api/tasks` `{ "title": "null notes", "notes": null }`
   - `POST /api/tasks` `{ "title": "null status", "status": null }`
   - `POST /api/tasks` `{ "title": "null priority", "priority": null }`

   Requirement 1.4 requires invalid types to return HTTP 400 without changing state. This defect alone requires M1 rejection.

2. **Persisted timestamp validation accepts an impossible calendar date.** `lib/store.mjs:18-20` accepts `2026-02-30T00:00:00.000Z` because `Date.parse` normalizes it to a later date. A separate parseable board containing this value for both task timestamps started successfully. It is not a valid ISO date-time and should make startup fail without changing the file. The initial probe also showed that a persisted title with surrounding whitespace is accepted; that behavior is not recorded as a defect because the snapshot contract preserves task values exactly and the specification does not explicitly invalidate it.

3. **Shared request-boundary issue for the subsequent M2 contract.** `server.mjs:67-70` explicitly exempts `Origin: null`. An isolated `POST /api/tasks` with `Origin: null` returned HTTP 201. Requirement 2.4 says a mutation with an explicit foreign Origin returns 403. This is not a separate reason to reject missing M2 work, but it should be corrected with the M1 remediation because it is in the same handler.

## Checks that passed

The private harness was run from the report directory:

```sh
node /Users/leo/plugins/leo-dev/verification/release-2026-09-14/mochi-backend-review/m1-supplemental.mjs
```

It needed the authorized loopback execution context because sandboxed `127.0.0.1` binding returned `EPERM`. The final run exited 1 solely to report the reproduced contract failures above. Its successful checks were:

- An isolated copy launched without arguments at `http://127.0.0.1:4173`. After one create, it wrote `.data/board.json` relative to that copied example directory.
- A parseable but structurally invalid persisted board (`tasks` as an object) failed startup and retained exactly the original file bytes.
- A POST whose headers were sent, followed by SIGTERM before its body was sent, completed with HTTP 201 and left one persisted task. This exercises an already-established request through shutdown; it does not instrument private handler state.

Source inspection also found a sound base for the portions it implements: `BoardStore.#enqueue` serializes mutations, a failed transaction does not publish `#board`, and `#persist` writes a unique temporary file in the destination directory before `rename`.

## Scope and limitations

M2 PATCH/DELETE/history, M3 UI, and M4 import/export were not assessed as missing features. The coordinator reported the frozen M1 HTTP suite as 3/3 passing and the real controller Gate as passing; this review did not rerun those evidence items. No broad performance test was run because the approved scope is a local single-process application.
