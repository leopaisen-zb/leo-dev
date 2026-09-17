# P3 runtime re-review — 2026-09-14

Verdict: **NEEDS FIX**. The narrow FR-01/FR-02 edits address their originally reported paths, but two adjacent public-controller paths still violate the approved admission/recovery contract. No repository source, tests, evidence or fixtures were modified. The findings below were reproduced using the current compiled CLI in fresh `/private/tmp` repositories; no history was forged for Finding 1.

## Findings

### P1 — A later ordinary approval can reuse a revision receipt ID and durably block the change

Location: `packages/cli/src/controller/controller.ts:2383-2388` (ordinary receipt admission/commit), against the cross-kind revision uniqueness invariant at `:871-883`.

After a successful `revise`, pass its consumed, still schema-valid change-scoped grant to the public `approve` command. `ingest` reads the valid prior history and checks only the receipt schema and change ID before appending `receipt.approval.ingested`. It does not check whether that ID belongs to an existing `receipt.spec-revision.ingested`. `approve --dry-run` also accepts the request. The real call returns success after appending the new batch, because its snapshot write checks the reducer rather than the revision history validator.

Every subsequent strict read counts both receipt events and rejects the previously valid revision receipt. Consequently `status` and `resume` both return `BLOCKED`; ordinary recovery cannot remove the committed duplicate. The same underlying omission is relevant to other receipt writers that only reserve IDs within their own kind. This is a reachable public admission bug, not merely detection of manually tampered history.

Reproduction command: `node /private/tmp/leo-dev-p3-runtime-repro.mjs` (case `duplicate-via-approve`). Fixture: `/private/tmp/leo-dev-p3-review-duplicate-uPjOnG`.

Observed sequence:

- Init, route, proposal, ready assessment, grant and `revise`: success.
- `approve --receipt <same revision grant> --dry-run`: exit 0, `DRY_RUN`.
- Real `approve` with that grant: exit 0, `RECEIPT_ACCEPTED_UNAUTHENTICATED`.
- Journal grows from 18,360 to 20,250 bytes.
- Both `status` and `resume`: exit 7, `Specification revision receipt identity is invalid or has been consumed more than once`.

Minimum correction: enforce the revision receipt-ID reservation in public receipt preflight and admission before any append, in both collision directions, while retaining intentional legacy duplicates involving only non-revision kinds. Pending ordinary receipt batches that collide with an already consumed revision ID must also be rejected before recovery writes. Use a focused regression through the public command; verify unchanged journal/projections and readable status after rejection.

### P2 — Real resume truncates an incomplete tail before checking revision recovery drift

Location: `packages/cli/src/controller/controller.ts:2539-2542`. The deferred validation occurs in `packages/cli/src/controller/batch.ts:257-258` via `validateSpecRevisionRecovery`; dry-run already performs it earlier at `controller.ts:631`.

For an exact prepared spec-revision batch followed by an incomplete journal frame, real `resume` first invokes `recoverJournal`, which removes the incomplete tail. Only then does `recoverControllerBatch` validate the current bound source, remainder tree and prior-or-desired projection states. If the source has drifted, the command refuses after it has already mutated the journal. The approved brief explicitly requires these checks before any recovery write **or truncation**. This also produces different zero-write behavior between dry-run and actual resume for identical invalid inputs.

Reproduction command: `node /private/tmp/leo-dev-p3-runtime-repro.mjs` (case `incomplete-tail-drift`). Fixture: `/private/tmp/leo-dev-p3-review-incomplete-cfvtEP`.

The public Controller creates a valid pending batch using `faultAt: 'after-batch-prepared'`; the fixture then appends the 12-byte partial frame `{"sequence":` to model a crash during commit and changes `spec-v2.md`. No complete committed or prepared journal frame is rewritten.

- `resume --dry-run`: exit 7, `Spec revision bound source has drifted: spec-v2.md`; journal remains 17,856 bytes.
- Real `resume`: the same exit 7/error, but journal shrinks to 17,844 bytes.
- Before SHA-256: `7062aac42b472a5c0b2f3cb4578e2825c72a48e52a9e091ca21c6f980d8ed4d5`.
- After SHA-256: `d4dd75268c8f88ded56243be132f2f73c2dbcf2edb724b2b407bc7c92a4db05a`.

Minimum correction: run the exact pending revision filesystem/projection preflight before `recoverJournal` can truncate, preserving the existing validation again under the recovery lock. Add an incomplete-tail + invalid-source/projection recovery regression asserting byte-identical journal and artifact state on both dry-run and actual refusal. The existing valid all-prior/all-desired/mixed recovery paths must remain accepted.

## FR-01 and FR-02 closure assessment

- FR-01: current `persistUnknownOutcome` now writes `runId/changeId/taskId/taskRevision/leaseGeneration/gateId` into the result payload (`controller.ts:2254-2261`). Modern unknown payload fields are checked against historical route/envelope authority (`:1165-1169`); the precise legacy ownerless result shape remains recognized (`:357-365`). The new compiled branch marker is present. I did not independently rerun its focused test, so this is source closure evidence rather than a reviewer-run PASS claim.
- FR-02: pending spec-revision receipt operations are now counted together with committed logical receipt events before recovery (`:870-883`). This closes the original pending-new-revision collision with an earlier receipt. Finding 1 is the converse direction through a later ordinary public receipt writer, which the current patch does not prevent.

## Verification limits and evidence notes

- Performed: source/spec/brief and current closeout diff review; two standalone executable reproductions using current compiled CLI and fresh temporary fixtures.
- Not run by this reviewer: build/typecheck, full or focused suites, package relocation, installed-client/live acceptance. Main owns those checks.
- The existing old-review replay acceptance check uses an already consumed receipt ID, so its rejection alone does not prove fresh-ID/stale-V1-context fencing. Source checks at `controller.ts:1504-1507` do compare current submitted/task revision and receipt binding; absent a separate failing reproduction, this is a coverage limitation, not an additional confirmed production bug.
- Active-lease revision previews are refused before dry-run return: `specRevisionAdmissionBarrier` checks leases at `controller.ts:186`; `revise` calls it at `:1817-1819` before the `:1822` return. A live consumer left at `review-required` with an unreleased lease cannot immediately obtain a proposal; it must first finish the existing reviewed recovery/review path. This is a delivery-instruction discrepancy, not a newly found runtime defect.
