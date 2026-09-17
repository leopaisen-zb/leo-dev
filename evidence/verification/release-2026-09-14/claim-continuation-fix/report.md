# Claim continuation repair — implementation evidence

Status: focused source implementation and verification complete for this owned
delta. This is **not** a release-completion statement; root owns independent
review, final-suite/package verification, and the retained M3 fixture.

## Changed files

- `packages/cli/src/commands/claim.ts`
  - exposes `--supersede <expired-run-id>` and
    `--design-review-receipt <path>`.
- `packages/cli/src/controller/controller.ts`
  - plans ordinary and bounded continuation claims through one admission path;
    fences only an explicit expired pre-Gate Run; atomically records the old
    abandonment, explicit recovery guard, optional fresh design receipt, and
    normal successor claim.
  - uses the existing controller batch/recovery proof for continuation input,
    design source, and supplied receipt source; validates exact continuation
    batch provenance during replay.
- `packages/cli/src/controller/batch.ts` and `packages/cli/src/state/snapshot.ts`
  - admit the narrowly scoped `claim-continuation` recovery proof with zero
    artifact projections and project only its explicit recovery guard to `ready`
    before the normal successor events. No scanner, runner, scheduler, or batch
    engine was added.
- `tests/cli/codex-claim-continuation.test.ts`
  - compiled public CLI coverage for expired pre-Gate fencing/source retention,
    fresh same-binding design receipt ingestion after expiry, and prepared-batch
    resume versus source drift.

`controller/types.ts` and `state/transition.ts` were preserved; no change was
needed there. Before copies of every permitted production file are under
`before/`.

## TDD and checks

- RED: built CLI then ran
  `/Users/leo/.nvm/versions/node/v22.22.2/bin/node ./node_modules/vitest/vitest.mjs run tests/cli/codex-claim-continuation.test.ts`.
  Exit 1: both public tests failed specifically because Commander rejected the
  missing `--supersede` and `--design-review-receipt` options.
- GREEN (current source):
  `/Users/leo/.nvm/versions/node/v22.22.2/bin/node ./node_modules/typescript/bin/tsc -p packages/cli/tsconfig.json`
  exited 0.
- GREEN (current source):
  `/Users/leo/.nvm/versions/node/v22.22.2/bin/node ./node_modules/vitest/vitest.mjs run tests/cli/codex-claim-continuation.test.ts --testTimeout=90000`
  exited 0: 3 tests passed in 39.165s.

The recovery test injects `after-batch-prepared` through `Controller.execute`,
then uses public `resume`; a post-prepare source change yields public
`BLOCKED` and leaves the journal bytes unchanged.

## Source hashes

| File | SHA-256 |
| --- | --- |
| `packages/cli/src/commands/claim.ts` | `b63442ddf15d6b9d4ddc165fa89bdb8378c0024cd6ba5560ce93bfaf8994ff68` |
| `packages/cli/src/controller/controller.ts` | `e6e7b25e0a2073f5441873b69ca4d3fd8312a837cb6da9f029f06db02ad47f64` |
| `packages/cli/src/controller/batch.ts` | `c1f6649c4a61769a8622922195ddb9d23271f4212fd480e57c2c01b85d49478d` |
| `packages/cli/src/state/snapshot.ts` | `346ae265b5d266c32e883b63c2dcfd6be5a127d42a1df9ecc5d95ef0661b28a3` |
| `tests/cli/codex-claim-continuation.test.ts` | `f018d97bf391db18d51f07b97f8ce4816ba1bfeb9fa61079f9e7c09db9346cfb` |

## Adaptation and limits

The existing recovery proof required projections for revision/release/archive
batches. Continuation has no artifact projection, so the small adaptation
allows zero projections only for `claim-continuation`; its recovery proof still
binds the canonical adopted tree and exact source inputs. A supplied fresh
design receipt is intentionally required to be repository-contained so that an
interrupted continuation can prove receipt-file drift before recovery. Existing
design-transition receipt handling remains unchanged.

Focused tests cover the core positive path, old-Run fence, design-refresh path,
and prepared recovery/source drift. The broader negative/concurrency matrix,
independent review, complete suite/package checks, and retained fixture exercise
remain explicitly owned by root and were not run or modified here.
