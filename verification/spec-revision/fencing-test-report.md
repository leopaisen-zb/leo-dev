# P3 spec-revision reducer fencing test report

Status: NEEDS_CONTEXT — corrected test-only RED evidence is ready; the owned runtime reducer work is still required.

## Owned files

- `tests/state/spec-revision-fencing.test.ts`
- `verification/spec-revision/fencing-test-report.md`

The test builds a real hash-chained journal with a committed `spec-revision` controller batch, followed by a separate real-shape `claim` batch. The authority record is explicitly a reducer-only stub: it has the actual event shape but does not purport to satisfy Controller approval/history admission. Expected state is literal test data rather than a production authority/revision builder.

## Cases

1. **Valid new epoch (already passes before the fencing fix).** A completed v1 Run remains visible as `run-v1: succeeded`; the revision batch contains only `controller.spec.revised`, replacement `route.selected`, and `change.transition`. A separate claim batch then claims lease generation 4 after v1 generation 3 and starts `run-v2`. Expected current state is task `implementing` revision 2, active lease generation 4, and `run-v2: running`.
2. **Independently fenced late old-revision frames (corrected RED).** Each case starts from the valid prefix and appends exactly one revision-1 frame: a task transition; lease release; lease abandonment; lease claim; or a Run transition that targets the completed historical `run-v1` itself. Each must make reducer projection fail closed by throwing, so one invalid frame cannot mask another and historical Run state cannot silently change.

This intentionally does not introduce an ordinary `done -> pending` edge: the v2 start comes only from the replacement revision route. There is no invented `revisionReset` task transition, and no claim/run-start operation in the revision batch.

## First observed RED (superseded test design)

The first version used a revision-batch `done -> ready` reset and grouped all stale frames into one assertion that expected silent ignore. It produced one failing stale-frame assertion, with v1 task/lease/current-Run state overwriting v2 projection. Per review, this was superseded because it did not match the real activation boundary and silent ignore is not the required fail-closed behavior. This record is retained to avoid claiming the corrected test was the original RED.

## Corrected actual RED command and output

```text
$ npm run build && ./node_modules/.bin/vitest run tests/state/spec-revision-fencing.test.ts

> leo-dev@0.1.0 build
> tsc -p packages/cli/tsconfig.json

 RUN  v3.2.7 /Users/leo/plugins/leo-dev

 ❯ tests/state/spec-revision-fencing.test.ts (6 tests | 5 failed)
   ✓ projects a revision-route reset, a new claim, and retained completed Run history
   × fails closed for a late old-revision task transition after the new epoch
   × fails closed for a late old-revision lease release after the new epoch
   × fails closed for a late old-revision lease abandonment after the new epoch
   × fails closed for a late old-revision lease claim after the new epoch
   × fails closed for a late old-revision old Run transition after the new epoch

AssertionError: expected [Function] to throw an error

Test Files  1 failed (1)
Tests       5 failed | 1 passed (6)
```

## Required source change for the implementation owner

`reduceJournal` (and any authoritative snapshot/replay projection it relies on) must establish the current task revision from the committed `controller.spec.revised` epoch/routes and reject stale task-, lease-, and run-scoped frames whose envelope revision is older than that current task revision. A corrupt committed journal must not be silently projected. It must preserve earlier Run entries when valid, retain monotonic lease generation for the new epoch, and refuse a post-epoch mutation aimed at the old Run ID. The passing valid-epoch case means this test does not ask to tighten ordinary legacy historical replay beyond post-revision stale envelopes.

No runtime files, existing tests, Git state, or dependencies were changed by this task. No GREEN result is claimed because this worker is not authorized to implement the runtime fix.
