# C3.3 public recovery test matrix

Focused test ownership: `tests/cli/codex-review-recovery.test.ts`. This report records the matrix-only evidence; production source and final combined regression remain owned by the main thread.

Final focused command:

```sh
npx vitest run tests/cli/codex-review-recovery.test.ts --fileParallelism false
```

Result: exit 0; 1 file and 13 tests passed. Vitest reported 336.01 s test time and 336.92 s total. `npm run build` also exited 0 before the focused runs. The final test-file SHA-256 is `b537bd895ef63087d2174574d1293cb3ff8639f9a4732ed1580cf9f09a2cbe32`.

The matrix exercises compiled public recovery/review CLIs with real 15-second fixture leases. It covers immutable pre-recovery event hashes and dry-run snapshot bytes; receipt recovery IDs and timestamps; rejection/budget/generation behavior; canonical source and evidence drift; prepared/projection fault recovery; forged history; concurrent recovery and concurrent receipt consumption; a second candidate epoch; a real missing-executable Gate unknown run; and a test-only explicitly released lease.

The JSON companion contains the exact final command/result and scope detail; the [raw Vitest output](test-matrix-vitest-raw-output.txt) records the captured tool chunk and stdout. `reconciliation-only submitted without a successful Gate result` is intentionally not claimed here: main owns its dedicated addition in `tests/cli/codex-candidate.test.ts`. Physical removal of a historical lease-claim event is also not exercised; the matrix explicitly tests a released original lease instead.

During authoring, two non-production test issues were corrected (an incorrect budget state field and invalid change IDs); the second-candidate test's accidental default 300-second TTL was corrected to 15 seconds. The final run above is the only reported acceptance result.
