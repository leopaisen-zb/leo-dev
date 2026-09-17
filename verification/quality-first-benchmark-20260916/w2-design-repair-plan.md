# W2 candidate A: repair a rejected design in the same change

Status: bounded implementation design selected from the observed DEV-F1 gap.
Production edits remain pending completion and independent disposition of W1.
Authority: existing specification v1.11.0 and authorized W2; this note does not
replace the canonical specification or routed task plan.

## Evidence and intended behavior

The old installed Leo DEV-F1 actor received an independent design rejection,
then created another change because revised design bytes could not receive a
fresh review under the original change. The read-only controller audit confirms
the missing path. Existing tests pass but do not exercise repaired-design
resubmission. Keep the full baseline and its workaround unchanged.

Add one guarded public transition:

```text
design-review -- current independent reject receipt --> spec-approved
spec-approved -- repaired design request --> design-review
design-review -- fresh independent pass receipt --> design-approved
```

Use the existing `transition --scope change --to spec-approved --receipt ...`
command for the rejection step. It records the rejected design receipt and the
state change in one controller batch. Returning to `spec-approved` retains the
same approved requirements and routed plan; it is not a new specification
approval. The manager records the rejection before editing the reviewed design,
then uses the existing design request and approval commands. No task is reopened,
no new change ID is required, and no historical record is deleted.

## Admission and compatibility requirements

- Only the exact `design-review` source state may take this new edge. Lite
  routes, missing/invalid/expired receipts, pass receipts, mismatched authority
  or design bindings, reused receipt IDs, non-independent reviewer identity,
  and changed reviewed design bytes must fail without writes.
- Reuse the existing design admission and receipt validation responsibilities.
  The new decision accepts only `reject`; passing admission remains pass-only.
  Keep current spec/plan/design source checks and actual receipt provenance
  limitations. Do not treat local session strings as authenticated identity.
- Persist rejection using the existing typed design-receipt event. Retain the
  old immutable request and rejection when a later request is recorded. A
  rejected receipt can never satisfy `task-ready` or claim admission. Fresh
  approval must bind the newly requested design and current producer session.
- Preserve specification approval fields and task revisions. Do not reuse a
  design rejection as `spec-approval` or `spec-revision` authorization. Ordinary
  task repair budgets and release/integration boundaries remain unchanged.
- Dry runs and invalid attempts are read-only. Existing controller locking and
  batch recovery remain authoritative; a crash during rejection must recover
  the rejection/state pair without partial acceptance or duplicate ingestion.
- No new command, lifecycle state, schema version, execution engine, task
  database, automatic commit, or permission/default-model change.

## Ownership and checks

One Terra/high worker will own the necessary changes in
`packages/cli/src/changes/design-admission.ts`,
`packages/cli/src/controller/controller.ts`,
`packages/cli/src/state/transition.ts`, their focused state/admission/CLI tests,
and the existing lifecycle documentation. The main thread owns integration and
benchmark control. A different reviewer checks the exact resulting candidate.
Preserve all existing work and capture before images before the first edit.

First add a public regression that reaches a real Standard design request,
records an independent rejection, edits the design, requests review again under
the same change, and reaches task-ready only after fresh independent approval.
Observe the existing failure before implementation. Add focused negatives for
the admission requirements above and a prepared-batch recovery case. Retain the
existing stale-source and substantive-spec-revision regressions. Run the
affected tests, type checking and lint; broaden only for the affected shared
state/receipt/recovery boundaries and final package acceptance.

Measure the installed repair candidate against the frozen DEV cases with the
same runtime/skill/model conditions as the W2 control except for this repair and
its minimal usage documentation. Do not combine a new upstream method treatment
into this first comparison. Later method selection remains a separate decision
using the completed W1 findings and development results; held-out cases remain
unseen by the implementer.
