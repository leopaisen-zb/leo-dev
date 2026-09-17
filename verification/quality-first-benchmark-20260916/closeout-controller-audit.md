# Timing of requirements closeout

Read-only source/test audit by a Terra/high explorer, accepted as interface
evidence by root on 2026-09-16. No model benchmark or new behavior test was run
for this note. It does not select the final W2 method change before W1 ends.

The controller can repair a current unaccepted implementation task through a
candidate-bound review rejection, remediation and a fresh claim/Gate/review.
An unfinished later implementation task can also change an earlier task's
files when its already approved `allowedPaths` includes them. Neither path
reopens the earlier done task or changes its historical evidence.

A done task has no ordinary backward transition. `route` cannot add repair work
during execution. The final `role: integration` task must retain its claim
input tree for release evidence, so it cannot double as an implementation
repair task. Rejecting its review permits another verification attempt, not a
publishable source change inside that verification-only task.

Once implementation tasks are done, or after `integration-review`, the public
way to activate another implementation plan is `revise`. It requires a quiet
execution lane, a complete successor plan retaining all old task IDs with
incremented revisions, a fresh assessment, and a dedicated candidate/context-
bound `spec-revision` approval. An initial `spec-approval` is not interchangeable
with that decision. Existing source and history remain; old success evidence
does not certify the successor revision.

Source anchors:

- `packages/cli/src/state/transition.ts`: task remediation and change transitions.
- `packages/cli/src/controller/controller.ts`: revision admission near line 208;
  verification-only integration proof near 1521; revision approval near 2227;
  claim/candidate boundaries near 2577 and 2744; review rejection near 3063.
- `packages/cli/src/changes/spec-revision.ts`: successor task constraints.
- `tests/cli/codex-first-baseline.test.ts`: current-task review rejection.
- `tests/cli/codex-spec-revision.test.ts`: all-task revision reset and approval
  context/refusal cases.

A method-only closeout binding should therefore inspect the complete approved
intent while an authorized implementation task can still repair its candidate,
before its acceptance is recorded. It must check actual allowed paths. If a
late finding falls outside the remaining authorized implementation tasks,
report that boundary and prepare the real revision proposal; do not invent a
reopen command, edit generated state, reuse an old approval or promise unlimited
automatic recovery. Final integration remains an independent verification step.
