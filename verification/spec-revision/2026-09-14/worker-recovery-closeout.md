# P3 recovery findings — worker record

Scope: FR-01 and FR-02 only. This record compares the assigned source files
with `/private/tmp/leo-dev-p3-closeout-before.vhw54_iy`; `before.json` records
the broader pre-closeout snapshot.

## Root-cause RED

Command:

```sh
./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts -t 'keeps a committed thrown-indeterminate Gate outcome readable after revision|refuses a duplicate revision receipt in a pending'
```

The raw output is in [worker-red.log](worker-red.log). It failed three tests:

- FR-01 entered the real `GateRunIndeterminateError` catch using an executable
  path that cannot be launched. It durably committed the `unknown-outcome`
  batch, then strict snapshot reduction rejected the result payload and the
  command returned `BLOCKED` with `state: null`.
- FR-02 used a hash-consistent pending revision: receipt ID, manifest/spec
  approval references and hashes, batch projection hashes, and recovery desired
  bytes were changed together. Both prepared and projected recovery states
  incorrectly let `resume` return status 0, proving no earlier validation had
  masked the duplicate-receipt defect.

## Change

`packages/cli/src/controller/controller.ts` now:

- Writes thrown-indeterminate `controller.gate.result` payloads with the current
  change, task, revision, lease generation, and Gate IDs.
- Validates a modern standalone unknown-result payload against its historical
  task/Gate authority. The legacy shape with all those payload fields absent
  remains accepted.
- Includes a pending `spec-revision` batch's revision receipt in receipt-identity
  counting before recovery can write or commit. Existing non-revision receipt
  duplicates remain outside the revision uniqueness rule.

`tests/cli/codex-spec-revision.test.ts` adds an end-to-end thrown-indeterminate
path after revision plus prepared/projected zero-write duplicate receipt cases.
`packages/cli/src/state/snapshot.ts` was reviewed and remains unchanged.

## GREEN and checks

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run build` | exit 0 | [worker-build-green.log](worker-build-green.log) |
| targeted three regressions | 3/3 passed | [worker-green.log](worker-green.log) |
| complete P3 file | 52/52 passed, 148.78s | [worker-focused-full.log](worker-focused-full.log) |
| `npm run typecheck` | exit 0 | [worker-typecheck.log](worker-typecheck.log) |

No all-repository suite was run by this worker. Independent review and the
main-owned full regression remain required before final acceptance.
