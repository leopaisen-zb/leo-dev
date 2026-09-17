# Q1a design-event decoder evidence

Environment: macOS local workspace, `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH`.

## Baseline

- `baseline-typecheck.txt`: `npm run typecheck` — passed.
- `baseline-build.txt`: `npm run build` — passed.
- `baseline-cli-regression.txt`: requested three existing CLI files — passed, 4 discovered files / 23 tests because the repository's retained local-sync copy is also discovered by Vitest.

## Test-first evidence

- `red-decoder-and-schema.txt`: new decoder module and `validateDocumentShape` export were missing. The run failed for those intended reasons; pre-existing schema cases passed.
- `green-decoder-and-schema-expanded.txt`: decoder and schema tests passed, 3 discovered files / 30 tests.
- `green-public-status-expanded.txt`: captured the missing status receipt-consumer path: failed because status accepted a malformed newest receipt.
- `green-public-status-after-fix.txt`: passed after status began structurally decoding the latest receipt.
- `green-public-historical-recovery.txt`: prepared fresh-claim recovery passed after its receipt expired at wall-clock time.

## Final checks

- `typecheck-after-status-fix.txt`: `npm run typecheck` — passed.
- `build-after-status-fix.txt`: `npm run build` — passed.
- `final-focused-regression.txt`: `vitest run --no-file-parallelism tests/changes/design-events.test.ts tests/schema/validation.test.ts tests/cli/codex-design.test.ts tests/cli/codex-claim-continuation.test.ts tests/cli/codex-claim-continuation-integrity.test.ts` — passed, 7 discovered files / 55 tests. The two retained local-sync tests are separately reported by Vitest and were not added by Q1a.
