# P2 governance admission report — 2026-09-11

## Scope and implementation

This report covers only the assigned P2 controller/governance route seam and
focused compiled-CLI tests. It does not revise lifecycle/state machinery,
workflow documentation, package resources, historical trials, caches, or
acceptance budgets. The pre-work snapshot is
`/private/tmp/leo-dev-production-before.Y5JjLF`.

Changed P2 paths, compared directly with that snapshot (not a Git/HEAD claim):

- `packages/cli/src/controller/controller.ts`
- `tests/cli/codex-plan.test.ts`
- this report

`route --plan` now validates the plan and its gates before deriving the exact
assessment task scope: `plan:` plus `fingerprint(validatedTasks)`. The
fingerprint canonicalizes object properties while retaining the validated task
array's order and every task property. Both real and dry-run route through the
existing `governanceAdmission`, `assess`, `governanceRefusal`, history, and
atomic controller-batch seams.

Ready plan assessments are batched with all route/task projections. A refusal
batches only its normalized immutable assessment; no routes are created.
Existing cross-submission supersession/history rules therefore continue to
enforce material stickiness and predecessor links across scope changes.

## Public dry-run contract

Plan dry-runs preserve `state.assessmentContext` and add
`state.planAssessmentContext`. It repeats the current change/spec/tree
bindings and exposes the server-derived plan scope as `taskId`; callers do not
need to reproduce the fingerprint.

Actual compiled-CLI output from a fresh two-task dependent fixture:

```json
{
  "ok": true,
  "code": "DRY_RUN",
  "state": {
    "assessmentContext": {
      "changeId": "plan",
      "specHash": "faa5b4816800b8cbe1595e5533fe36c53f396c0c26a3a876dd3e4085232348a1",
      "subjectTreeHash": "b135091862585609d467506b52cc5ee44a9ffe139721806d102582eb8de4864b",
      "status": "not-assessed"
    },
    "planAssessmentContext": {
      "changeId": "plan",
      "specHash": "faa5b4816800b8cbe1595e5533fe36c53f396c0c26a3a876dd3e4085232348a1",
      "subjectTreeHash": "b135091862585609d467506b52cc5ee44a9ffe139721806d102582eb8de4864b",
      "taskId": "plan:87d8265e5fc11a0633e59b83e82877ac6f7296ea87ab3bf1da823c429d00eea8",
      "status": "not-assessed"
    },
    "command": "route",
    "planned": true,
    "writes": []
  }
}
```

With a supplied non-ready assessment, or with a recorded refusal and no
assessment option, dry-run returns the existing refusal code/status and both
contexts, without writes. Legacy unassessed plans remain `not-assessed`.

## TDD and verification evidence

| Check | Result | Evidence |
| --- | --- | --- |
| RED: `npm run build && npx vitest run tests/cli/codex-plan.test.ts` | Expected failure | Before controller implementation: 17 tests, 7 failed. The first public failure was missing `state.planAssessmentContext`; dependent assessments could not be constructed from dry-run output. |
| GREEN: `npm run build && npx vitest run tests/cli/codex-plan.test.ts` | Passed | 19/19 tests passed after the final focused cases. Covers ready dependent admission, partial/unknown/local-high/material refusals without routes, omission, stale other-plan scope, zero-write dry-run, legacy label, linked successor, and interrupted batch recovery. |
| `npm run typecheck` | Passed | Exit 0; package CLI and routing test TypeScript projects. |
| `npx vitest run tests/cli/codex-plan.test.ts tests/cli/governance.test.ts` | Failed / baseline concern | 37/38 passed. The untouched pre-existing governance test `rejects a high-finding resolution that recycles a prior resolution evidence hash` exceeded Vitest's 5000 ms timeout (observed 6472 ms). No timeout/acceptance threshold was changed. |
| Fresh public fixture command | Passed | `node /private/tmp/leo-dev-p2-public-output.mjs` produced the JSON excerpt above, exit 0; the temporary fixture and helper were removed afterward. |

## Concerns and remaining verification

- The broad affected CLI regression is intentionally left to the main
  verification pass, per task ownership. It was not claimed as passed here.
- The single focused governance timeout above is an actual failed check. The
  test and its 5000 ms budget were not changed; it needs main-thread baseline
  treatment or a separate authorized reliability investigation.
- No unresolved P2 interface question remains: the schema's existing
  `taskId` accepts the documented `plan:<sha256>` scope, so no schema/state
  expansion was needed.
