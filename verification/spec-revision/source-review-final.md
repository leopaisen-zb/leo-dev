# P3 specification/constitution revision — final source review

## Verdict

**NEEDS FIX — the frozen final source does not pass this read-only source review.**

The review found one Critical and one Important correctness defect. Both affect supported post-revision recovery paths and can turn a history that passes preflight into a durably committed history that later strict reads reject.

This verdict is limited to the frozen source at `/private/tmp/leo-dev-spec-revision-final-review.6egpRC`, compared with `/private/tmp/leo-dev-spec-revision-hardened.jc7EDt`. I did not modify or execute that source, run the test suites, inspect an installed/package copy, or perform full-v1 acceptance. `hardening-report.md` was unavailable because its writer did not persist it, so this review does not rely on or claim a prior final acceptance.

## Findings

### FR-01 — Critical: the supported thrown-indeterminate Gate path commits an unreadable post-revision history

After the first `controller.spec.revised`, the reducer requires every `controller.gate.result` payload to repeat the current `taskId`, `taskRevision`, and `leaseGeneration` (`packages/cli/src/state/snapshot.ts:43-46,143-150`). Determinate Gate handoffs satisfy that contract because `commitGateSettlementHandoff` builds a fully owned `gateRecord` (`packages/cli/src/controller/controller.ts:2068-2083`).

The separately supported thrown-indeterminate path does not. `runGates` catches `GateRunIndeterminateError` and calls `persistUnknownOutcome` with only `status`, `outcome`, and `error` (`controller/controller.ts:2187-2193`). `persistUnknownOutcome` writes the operation envelope with task/revision/generation, but its `controller.gate.result` payload is only `{ runId, ...gateRecord }` (`controller/controller.ts:2203-2244`), so the payload has none of the three owner fields required by the reducer.

This is not malformed input that should merely be rejected: the Controller's exact historical verifier explicitly recognizes this `unknown-outcome` shape. `validThrownIndeterminateResult` requires the owner only on the event envelope (`controller/controller.ts:353-361`), and `verifyStandaloneUnknown` reconstructs the exact batch with the same unchanged result payload (`controller/controller.ts:1123-1200`). Consequently the Controller can durably append the prepared and committed batch, then fail in its own `writeSnapshotStrict` call; subsequent `readEvents` calls reach `reduceJournal` and reject the committed result (`controller/controller.ts:737-780`). That bricks normal status/recovery for a legitimate indeterminate Gate execution after a spec revision and violates the required legacy behavior and recovery safety.

Required correction: make the produced and exactly verified unknown result payload carry the same current owner identity as the determinate result, or narrowly account for this exact verified `unknown-outcome` mapping in the post-revision reducer without reopening bare/stale evidence acceptance. Add a regression that drives the actual thrown-indeterminate branch after a revision through commit, snapshot, state/status, and resume.

### FR-02 — Important: pending revision recovery omits the new receipt from duplicate-identity validation before writes

`verifySpecRevisionHistory(..., allowPending = true)` derives `logicalReceipts` solely from `projectJournalEvents(rawEvents).events` (`controller/controller.ts:863-873`). A trailing prepared batch is deliberately excluded from that logical event list and returned only as `pending` (`state/snapshot.ts:92-132`). The later per-revision validation checks the pending receipt's schema, time, grant, scope, operation kind, change, wrapper, and approval context, but never compares its `receiptId` with already consumed receipt IDs (`controller/controller.ts:923-946`).

Both resume preflight and resume call this validator with pending history allowed (`controller/controller.ts:613-623,2498-2506`). Recovery then checks the filesystem proof/projections and commits the pending batch, but does not rerun the semantic history validator or receipt uniqueness check before applying projections (`controller/batch.ts:184-189,247-260`; `controller/controller.ts:2545-2550`). Therefore a hash-valid pending spec-revision batch can reuse an earlier receipt ID, pass the zero-write preflight boundary, have its projections applied and commit appended, and only then be rejected by later strict reads when the new receipt becomes logical and its count is greater than one.

The check must include the receipt operation from a validated pending spec-revision batch and compare that ID with prior logical receipts before any projection write or commit. It must continue to preserve legacy duplicates that involve only non-revision receipt kinds; the required rejection is the new spec-revision receipt colliding with any already consumed ID. Add dry-run and real-resume regressions proving rejection with zero writes (journal and projections unchanged).

## Confirmed source closures

The frozen source does contain the requested hardening for the other specifically identified residuals: a shared live/strict admission barrier including remediation and unfinished Gate phases; legacy direct-history prior projection reconstruction; nested orphan revision receipt/route/revision-file rejection; taskless/change-scoped outer revision batches; legacy non-revision duplicate receipt tolerance; archived prior-source continuity; current-version evidence selectors and post-revision event fencing; exact prepared/frame timestamp equality; semantic no-op rejection; exact input/projection separation; exact operation/projection/recovery proof closure; and a single timestamp plus pre-append strict validation under the Journal tail CAS seam. These source checks do not offset FR-01 or FR-02 and are not a test-pass claim.

## Verification status

- Source/spec/plan review: completed against the named frozen copy.
- Frozen-vs-provisional comparison: completed for the four runtime files in scope.
- Reviewer-run build, typecheck, unit/CLI suites, live/package/install acceptance: **not run** (owned by the main verifier).
- Prior hardening final verdict: **unavailable**, not treated as acceptance.

