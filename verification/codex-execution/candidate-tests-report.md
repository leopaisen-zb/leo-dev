# C2 candidate regression report

Date: 2026-09-09  
Scope: candidate handoff/recovery regression tests only  
Test file: `tests/cli/codex-candidate.test.ts`  
Native reporter artifact: `verification/codex-execution/candidate-tests.json`

## Tested candidate

- `packages/cli/src/controller/controller.ts` SHA-256: `0f644b092d6a1e2355b396eee9225c01a77eb0de6f73a7b9e434b2ae249d7fc4`
- `packages/cli/dist/controller/controller.js` SHA-256: `3d650168ab636f022e96b9ef0e2f5615b7f342b4a083e2072e056782ccd4e50b`
- `packages/cli/dist/index.js` SHA-256: `878e8af44b86644753f5ddb7feb6a08984774cce19948dbf5f1b43ecd605d197`
- `tests/cli/codex-candidate.test.ts` SHA-256: `cfeafa26ddad0d78944b53ba106e4a7fb483f8715f326a507a8ae6c2c69fdbcf`
- `verification/codex-execution/candidate-tests.json` SHA-256: `9402aac05c9ea209efdf0620b3036c74b909bff7c090b8fad5b8b1dea8e11afc`

The test process inherited the real environment. It did not inject `CODEX_SANDBOX` or network-disabled provenance. The durable-terminal fixture used the default `GateRunner`; its direct Gate execution is a local crash-boundary fixture, while the subsequent `--dry-run resume`, `resume`, and double `resume` assertions exercise the public CLI.

Synthetic approval and reconciliation receipts are explicitly labelled `TEST-ONLY` in their `actorLabel`; they exist only in temporary directories and do not represent real authority.

## Command and result

```text
./node_modules/.bin/vitest run tests/cli/codex-candidate.test.ts --reporter=json --outputFile=verification/codex-execution/candidate-tests.json
exit 0
10 tests: 10 passed, 0 failed
```

## Passed behavior

1. A changed candidate with a durable terminal before Controller handoff can be dry-run inspected without writes, resumed, and resumed a second time without another Gate attempt, candidate registration, or result mapping.
2. A retry after atomic candidate-registration recovery still rejects missing `--run`; the matching Run succeeds and only one candidate registration and one Gate attempt exist.
3. Exact `allowedPaths: ["src/candidate.ts"]` refuses an outside addition, removal, content change, and mode change. It also refuses protected source-specification and Gate-registry changes. Every rejected mutation remains exactly as written/removed, the unrelated sentinel stays byte-identical, and no candidate/Gate attempt is recorded.
4. Dry-run and actual `run-gates` both reject the same expired lease with `CONFLICT` / `Run lease binding is stale`, without journal writes.

## RED-to-GREEN: historical pre-registration unknown Run

The test reconstructs a valid historical unchanged-input claim by removing the C2 candidate-registration batch and the claim's `inputEntries` field while remapping the journal hash chain and Gate phase references. It then uses only public commands for the compatibility flow:

```text
unknown -> successful reconciliation -> submit -> review
```

Initial RED against source SHA-256 `9e0c899691670e2e3208fa802923a358a233ea3b347a01220853a1588a3f1898` and dist-controller SHA-256 `1cc23114b48244ce205df69f1a7a3d0589367d84ef33a997e603b204492e66b3`:

- `reconcile`: exit 0, `RUN_RECONCILED_UNAUTHENTICATED`
- `submit`: exit 0, `SUBMITTED_FOR_REVIEW`
- `review`: exit 5, `CONFLICT`
- exact message: `Submitted candidate does not match the durable candidate binding`
- final task state: `review-required`
- final Run state: `succeeded`
- lease: still active

This reproduced the static-review finding: successful reconciliation and submit did not create the durable candidate binding that review unconditionally required.

Final GREEN against the current candidate hashes above:

- `review`: exit 0, `LITE_REVIEW_ACCEPTED_UNAUTHENTICATED`
- task: `done`
- change: `integration-review`
- lease: inactive
- exactly one migrated `controller.candidate.registered` event
- migrated `runId`, task revision, and generation match the historical claim
- migrated `claimInputTreeHash` and `treeHash` both equal the immutable reconciliation input hash
- migrated spec/task hashes match the submitted review context

The desired assertion remained strict; it was not weakened between the RED and GREEN runs.

## Status

- Candidate settlement recovery, registration retry identity, restrictive path coverage, and expired-lease dry-run parity: **passed** on the hashes above.
- Historical pre-registration unknown compatibility: **passed** after the bounded controller repair on the hashes above.
- Full repository regression: **not run by this candidate-test worker**; root owns final acceptance.
- Git changes, installs, network/model calls, external publication, installed-plugin replacement, and the protected live fixture: **not performed**.
