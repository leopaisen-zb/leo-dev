# Q1b fix 1 — caller-CWD ordinary design receipt compatibility

Date: 2026-09-15

## Finding and repair

The Q1b review found that `acquireDesignReceipt` resolved every reference from
`--repo`.  That changed ordinary `transition --to design-approved --receipt
relative.json`: before Q1b, `readReceipt` resolved the supplied relative path
from the invoking CLI process's cwd.  Fresh claim receipt sources have a
separate existing contract: resolve from the repository root, realpath the
result, and require repository containment.

The controller now keeps these contracts separate in one acquisition path:

- ordinary transition computes the captured absolute metadata path from the
  caller cwd and passes the original reference to `readReceipt`, so its
  established resolution and single byte capture remain intact;
- fresh claim keeps `realpath(resolve(repositoryRoot, reference))`, containment
  validation, and then reads that canonical path.

No admission policy was unified or broadened.  Receipt parsing and byte
capture still occur once.

## Regression proof

`red-caller-cwd-public.txt` is a meaningful public RED.  The test places a
valid `caller/receipt.json` beside an invalid same-named
`repo/receipt.json`, invokes the built CLI from `caller` with `--repo repo`,
and expects ordinary design approval to use the caller receipt.  Before the
repair it returned exit 2 / `SCHEMA_INVALID` from the repository shadow file.

After the minimal controller repair, `green-caller-cwd-public.txt` passes the
same built-CLI test.  `build-before-target-green.txt` records the build used by
that test.

## Final checks

- `typecheck.txt`: `npm run typecheck` passed.
- `build-final.txt`: `npm run build` passed.
- `final-source-only-public-cli.txt`: source-only, no-file-parallel Vitest run
  of `codex-design`, `codex-claim-continuation`, and
  `codex-claim-continuation-integrity` passed: 3 files, 25 tests, 155.55 s.
  This includes fresh-claim receipt byte/binding, expiry, containment, and
  recovery public cases.

The first `final-source-only-public-cli-rerun.txt` invocation was accidentally
started after an execution wrapper returned before the earlier long-running
suite completed.  It is retained as raw evidence and is not used for the
result above; no further suite was launched after detecting the overlap.

## Modified source/test files

- `packages/cli/src/controller/controller.ts`
- `tests/cli/codex-design.test.ts`

No Q2 files, global schema/receipt/event migration code, or Q1a decoder code
were changed by this fix.
