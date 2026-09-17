# V2 task A expired-review recovery

Task `name-normalizer` revision 2 used fresh Run
`run-0e0af055-82f4-490b-af8d-f167ea81dafb` and a succeeded fresh Gate.
The independent reviewer returned PASS; report SHA-256:
`7b1939ba36a4173448dc5b6c664981a40e6f01f4a1b5e6f274185330c5f518cf`.
The lease expired at `2026-09-14T03:52:03.398Z` before ingestion.

A first driver ingestion attempt omitted its required `--change` argument.
It made a read-only status request for the nonexistent default change
`p3-live`, returned exit 8 `PREREQUISITE_FAILED`, and made no controller
mutation. The failed command remains in `live-evidence.jsonl`.

The coordinator then ran the relocated CLI review-recovery dry run and actual
command for `p3-live-retry1`. The dry run reported `plannedRecovery: true`
with no writes. The actual command returned `REVIEW_RECOVERED`, preserving
revision 2, lease generation 2, the original Run, candidate tree
`6045d1e71e043765f08194c9d7eee6e36859103783d529debd84af1a3a33fb5c`,
and the original Gate. Recovery ID:
`15ddddab-8020-4e7e-81a5-4f8e0cd0ce9c`.

The recovered receipt retained the independent report hash. Ingestion with
the explicit change ID succeeded; task A became `done` and task B became
`ready`. No application file, test, candidate, Run, or Gate was rewritten or
rerun. Receipt provenance remains agent asserted; the issuer is not
cryptographically authenticated.
