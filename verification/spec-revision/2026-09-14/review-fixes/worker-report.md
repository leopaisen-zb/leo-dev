# P3 review-fix worker report

Status: DONE_WITH_CONCERNS. The two confirmed public-controller defects have
focused regression coverage and scoped checks. Main owns the required full
suite and final package/relocation acceptance.

## Changed files

- `packages/cli/src/controller/controller.ts`
  - Rejects any new public receipt ingestion whose ID is already consumed by a
    committed specification-revision receipt. This guard is used by dry-run and
    by `review`, ordinary `approve`/`waive`/`resolve`, and `reconcile` before a
    batch append.
  - Counts receipt ingestion operations in any pending controller batch when
    checking the special revision-receipt reservation. Duplicate IDs that
    involve only legacy non-revision receipt kinds remain accepted.
  - Runs the existing exact pending-batch preflight before truncating an
    incomplete journal tail in `resume`; the locked recovery still validates
    again before applying projections and committing.
- `tests/cli/codex-spec-revision.test.ts`
  - Adds real compiled-CLI coverage for public `approve` collision rejection,
    zero journal/snapshot writes, and a still-readable status/resume state.
  - Adds a pending ordinary receipt-batch collision case.
  - Adds incomplete-tail source drift and third-value projection refusal cases
    for dry-run and actual recovery, asserting byte-identical journal,
    projections, and snapshot. Adds a valid incomplete-tail recovery positive.

## Commands and results

RED, before production edits:

```text
npm run build
# PASS
npx vitest run tests/cli/codex-spec-revision.test.ts --no-file-parallelism -t 'reserves a consumed revision receipt|refuses incomplete-tail revision recovery'
# FAIL: 3 failures / 54 skipped
# - public approve returned 0 instead of the new rejection expectation
# - source-drift and projection-third-value resume calls truncated the incomplete tail
```

After the minimal controller changes:

```text
npm run build && npm run typecheck
# PASS

npx vitest run tests/cli/codex-spec-revision.test.ts --no-file-parallelism -t 'incomplete-tail revision recovery|valid prepared revision with an incomplete|consumed revision receipt|pending ordinary receipt recovery'
# PASS: 5 passed / 52 skipped

npx vitest run tests/cli/codex-spec-revision.test.ts --no-file-parallelism -t 'preserves unrelated legacy duplicate|duplicate revision receipt in a pending'
# PASS: 3 passed / 54 skipped
```

I also started one file-serial run of the affected CLI test file before main
asked to avoid duplicating its full validation. The process completed, but this
worker interface yielded before returning its final exit summary, so its result
is intentionally not recorded as a pass. Main's full-suite run remains the
authoritative final regression check.

## Risk / handoff

The receipt reservation deliberately applies only when a revision receipt is
involved. It does not change duplicate behavior among legacy receipt kinds.
Recovery uses the existing preflight and retains the existing locked/CAS
validation, so it does not introduce a second recovery path. No commits,
resets, installs, or package/default changes were made.
