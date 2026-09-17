# P3 initial source review — frozen implementation

Status: **DONE_WITH_CONCERNS — not acceptable for final source acceptance until the Critical and Important findings below are corrected and independently re-reviewed.**

## Review identity and method

- Normative contract: `verification/spec-revision/implementation-brief.md` and `.scratch/unified-development-plugin/spec.md` v1.7.0, Conservative revision authorization.
- Reviewed implementation: `/private/tmp/leo-dev-spec-revision-review.zTMiEE`.
- Comparison baseline: `/private/tmp/leo-dev-spec-revision-before.Zjd5S0`.
- This was a read-only source and contract review. I did not modify source or tests, use Git history, install dependencies, or run the suite. Line references below are to the frozen review copy, not the subsequently changing live checkout.
- Unless explicitly labelled as a probe, counterexamples below are source-derived. One independently reproduced probe was supplied by the main reviewer: `wrong-receipt-preview-red.json` demonstrates SR-04.

## Findings

### SR-01 — Critical — the revision batch is not an exact state replacement and can carry success into the new revision

Locations: `packages/cli/src/controller/controller.ts:847-909`, especially `:875-900`; `packages/cli/src/state/snapshot.ts:130-157`.

`verifySpecRevisionHistory` counts the required assessment, receipt, route, and change-transition operation types, but never requires the complete operation array to equal the one authorized sequence. The reducer accepts any additional current-revision task transition. It also accepts a later `route.selected` at the same revision because it rejects only a revision lower than the prior route.

Source-derived counterexample: add `{taskId: A, taskRevision: 2, type: 'task.transition', payload: {to: 'done'}}` to an otherwise valid spec-revision batch. All required-operation counts still pass, then the reducer installs A revision 2 as `done`, defeating mandatory all-task revalidation. A direct equal-revision route can similarly overwrite projected task state outside the revision batch.

Minimal correction: derive and compare the exact ordered operation sequence and envelopes for a revision; reject all revision-scoped operations outside that batch; require route revisions to advance rather than merely not regress, with the exact revision batch as the sole reset exception. Re-derive the prefix lifecycle/barriers so a forged batch cannot revise an archived/blocked/approval-required authority or one with an active lease/Run.

### SR-02 — Critical — repository-contained revision inputs may overlap projections and activation can overwrite its own authority input

Locations: `packages/cli/src/changes/spec-revision.ts:47-52`; `packages/cli/src/controller/controller.ts:1679-1687`; `packages/cli/src/controller/batch.ts:62-81,103-125`.

Input admission requires only repository containment. It does not reject a Spec, constitution, plan, or registry path equal to one of this activation's manifest/spec/tasks/revision/assessment projection paths. Recovery deliberately excludes those exact paths from the remainder.

Source-derived counterexample: point `--spec` at `.leo-dev/changes/<id>/spec.yaml`. The proposal hashes that file, then activation rewrites the same path as the projected spec artifact. Recovery considers the overwrite authorized, but the committed current source no longer hashes to `authority.sourceHash`; the next strict read blocks the just-committed authority. Constitution and Gate-registry overlaps have the analogous problem.

Minimal correction: after resolving all proposal inputs and exact projection paths, reject only actual input/projection overlaps. A broad `.leo-dev` ban or global ignore-policy change is unnecessary.

### SR-03 — Critical — activation/recovery can rebaseline onto a tree different from the approved assessment tree

Locations: `packages/cli/src/controller/controller.ts:1638-1647,1682-1692`; `packages/cli/src/controller/batch.ts:103-125,165-181`.

The assessment and approval bind the tree read at `controller.ts:1638`. Recovery metadata is captured later from whatever tree exists at `:1687`, and the exclusive commit validates that newly captured remainder against itself. It never proves that the pre-projection tree reconstructed from recovery equals the assessment's `subjectTreeHash`. `validateSpecRevisionRecovery` also treats missing recovery as valid and verifies only path membership/current prior-or-desired states, not that stored prior/desired raw type/mode values are exactly derived from the batch projections.

Source-derived counterexample: an unrelated tracked file or the proposed source changes after assessment validation but before recovery capture. The journal tail CAS still succeeds; recovery metadata simply blesses the changed tree. For a source change this may commit an authority that immediately fails its own source-drift check.

Minimal correction: require recovery for every spec-revision batch; bind it to the assessment/receipt context; reconstruct/verify the exact pre-projection full tree equals `subjectTreeHash`; compare each recovery snapshot's exact path, prior state and serialized desired raw/type/mode to its projection; perform this check under the exclusive append precondition. Pending recovery must validate the same binding before any write.

### SR-04 — Important — dry-run accepts supplied inputs and blocked states that execution rejects

Location: `packages/cli/src/controller/controller.ts:1649-1678`.

The `DRY_RUN` return at `:1660` precedes receipt-context mismatch, duplicate-consumption, and quiescence checks. Consequently a well-shaped rejected/stale/wrong-context or consumed receipt is reported as a successful proposal, and an active lease/running Run/blocked state can also preview success instead of failing as execution would.

Actual probe: the main reviewer reproduced the wrong-receipt case in `wrong-receipt-preview-red.json`.

Minimal correction: distinguish absent optional proposal prerequisites from supplied-invalid values. Run all non-writing validation and barriers before returning dry-run; continue to allow a preview only when the assessment/receipt is genuinely omitted.

### SR-05 — Important — historic revision provenance and approval/projection closure are incomplete

Locations: `packages/cli/src/changes/spec-revision.ts:99-126`; `packages/cli/src/controller/controller.ts:847-909`; `packages/cli/src/controller/controller.ts:769-837`.

Historic validation checks only two immutable projections and required operation counts. It does not require the exact five projections, their unique paths, or exact derived manifest/spec/tasks approval and task values. Because `readEvents` skips legacy unresolved/approval coherence whenever a committed projection exists, an otherwise valid forged revision may split activation across batches or project approval fields unrelated to its revision receipt. Historic plan validation also does not reuse Lite/path/dependency validation; schema-valid Standard tasks, non-normalized paths, or cycles can survive the record validator. Duplicate receipt IDs, receipt `taskId`, exact `issuerAuthenticated: false`, and a pending assessment's linked sticky history are not verified at this boundary.

Minimal correction: use the existing plan validation as one source of truth with revision-policy parameters; require the exact unique projection set and values derived from the revision/receipt/current artifacts; require exact receipt envelope/no task scope/non-duplication; validate the assessment against the complete prior assessment chain before recovery as well as after commit.

### SR-06 — Important — an orphan revision receipt can authorize an ordinary lifecycle transition

Locations: `packages/cli/src/controller/controller.ts:847-909,1135-1155`.

Strict revision verification rejects a direct `controller.spec.revised` event but does not reject a direct/orphan `receipt.spec-revision.ingested`. `planChangeTransition` then accepts the latest such receipt as an approval fallback without proving it belongs to the validated current revision batch.

Source-derived counterexample: append a standalone, internally matching spec-revision receipt operation before the `spec-review -> spec-approved` transition. No revision authority is required for that fallback, so the orphan receipt can substitute for normal approval.

Minimal correction: reject revision-scoped receipt/assessment/route authority operations outside the exact revision batch, and select a revision grant only through the validated current revision record/batch association.

### SR-07 — Important — receipt admission has expiry and scope/duplicate gaps

Locations: `schemas/approval.schema.json:14-25`; `packages/cli/src/controller/controller.ts:1649-1652,1675-1692`; historic checks at `:888-895`.

The grant is time-validated when read, then projection/recovery work occurs before `controller.batch.prepared` is appended. Historic validation correctly tests validity at the prepared timestamp, so a grant expiring in that interval can be committed and make subsequent reads reject the journal. Change-scope receipts may also carry an optional `taskId`; activation and historic verification do not enforce the contract's no-task-scope requirement. Historic duplicate receipt IDs are not rejected.

Minimal correction: revalidate the exact receipt under the exclusive transaction at the timestamp used for preparation; reject `taskId` for this operation and duplicate consumption in both live admission and strict replay. Preserve preparation-time validity for recovery of that exact pending batch.

### SR-08 — Important — proposal identity/no-op logic drops semantic fields and revision plan validation drifts from ordinary Lite validation

Locations: `packages/cli/src/changes/spec-revision.ts:20-44,68-83`; `packages/cli/src/controller/controller.ts:205-229,1631-1636`.

The revision validator duplicates most of ordinary plan validation but omits the normalized `allowedPaths` check. The no-op comparator ignores meaningful task order, Spec/constitution path changes, registry path and Gate-definition hash. It can therefore reject a task reorder or Gate-only revision even though those fields are part of `revisionId`, while accepting validation behavior different from ordinary Lite routing.

Minimal correction: reuse one common validated-plan routine and compare the exact ordered semantic proposal after removing only task revision and reset-state bookkeeping.

### SR-09 — Important — constitution retention/protection and legacy source archival do not meet the authority contract

Locations: `packages/cli/src/changes/spec-revision.ts:10,55-62,84-88`; `packages/cli/src/controller/controller.ts:1626-1629,1851-1865`.

When `--constitution` is omitted, the implementation rereads `previousConstitutionPath`; if those bytes drifted, omission silently incorporates the drift into the new authority instead of retaining and verifying the active binding. Candidate path protection covers the Spec, registry and controller paths but not the current constitution. Finally, the revision record contains only new snapshots and has no legacy-source snapshot or explicit `bytes-unavailable` limitation even when the legacy source is still readable.

Minimal correction: omission must reuse the prior path/hash/snapshot after verifying current bytes; only an explicit flag may change it. Add the active constitution path to candidate protection. On the first revision, archive the initial source bytes if they still match, otherwise record the specified limitation without fabricating content.

### SR-10 — Important — current status aliases historical Run/review/Gate evidence, and revised review recovery binds legacy authority

Locations: `packages/cli/src/controller/controller.ts:1190-1258,1477-1522`.

`state()` selects the latest claim and submission and every Gate evidence reference from the entire journal, not the current revision epoch. Immediately after revision it therefore exposes the old Run, review context, recovery context and evidence as current. Historical evidence is not separately labelled. In addition, review-recovery verification uses `controller.initialized.specHash` at `:1209,1237,1256`, so a valid submission under revision 2 is compared with the legacy raw authority and cannot be recovered after expiry.

Minimal correction: derive current diagnostics from current task revision/current authority, expose historical evidence separately, and make review recovery resolve the authority valid at the submitted event's historical prefix (current for a new recovery, historical for replay).

### SR-11 — Important — cumulative repair accounting is only partially cumulative and generation fencing is incomplete

Locations: `packages/cli/src/controller/controller.ts:183-191,1768-1783`; `packages/cli/src/state/snapshot.ts:138-164`.

Failure counts are correctly cumulative by stable task ID, but the mandatory fresh-debug session check filters previous claims to the current revision. With three earlier failures, the first revision-2 claim is classified `fresh-debug` yet may reuse an earlier session because the earlier claims are absent from `previousSessions`. The reducer also does not require lease generation to increase and lets a current-revision stale `lease.claimed` or `lease.released` overwrite/clear a newer generation; Run transitions may omit a generation and bypass the owner-generation comparison.

Minimal correction: gather prior claim sessions across all revisions of the stable task, and enforce type-specific monotonic/current lease-generation and Run-owner bindings during replay.

### SR-12 — Important — team epochs bind raw mutable bytes, and the historical projection breaks after a second revision

Locations: `packages/cli/src/controller/controller.ts:1709-1732`; `packages/cli/src/team/protocol.ts:211-225`.

Team status/record recomputes `currentSpecHash` from mutable source bytes rather than using the validated semantic authority hash. Because reads explicitly allow source drift, a host can open a team against unapproved drift; an A→B→A source cycle also revives the same team hash instead of the new authority identity. For history, `archivedEvents = events.slice(0, latestEpoch)` and `projectTeam` filters all team events without epoch boundaries. After teams were opened in both v1 and v2, a second revision makes archived projection replay two `open` operations and throw `team is already open` instead of exposing the last historical team.

Minimal correction: use `currentAuthority.specHash` for the current epoch, refuse mutation if its raw source commitment has drifted, and project only the immediately preceding team epoch for `archivedTeam` while retaining the full immutable journal as history.

### SR-13 — Important — public status does not expose the current versioned authority distinction

Location: `packages/cli/src/controller/controller.ts:1477-1522`.

The proposal response distinguishes raw source hash from authority hash, but normal `status` does not expose a current authority object. Consumers therefore cannot reliably distinguish `sourceHash` from the semantic revision `specHash` after reload; the team bug in SR-12 is one consequence.

Minimal correction: add a stable current-authority summary to public state with revision/revisionId, semantic specHash, raw source path/hash and constitution path/hash. This is an additive state projection, not a second authority engine.

## Covered areas and positive observations

The review covered command/authority derivation, semantic identity and no-op handling, assessment supersession, approval derivation, strict journal replay, batch/projection recovery, reducer fencing, current versus historical evidence, review recovery, repair budgets/leases, source/constitution protection, and team epoch consumers.

The implementation does correctly derive the documented decision and Gate fingerprints (`changes/spec-revision.ts:91-96`), keeps source raw hash distinct inside the revision record, advances all existing task IDs by one in live proposal validation, computes cumulative failure counts, increments live lease generations from all historical claims, uses current revision authority for candidate/submit bindings, and verifies historical Gate authority from the relevant prefix. Cryptographic issuer authenticity was not expected and was not reported as a defect.

## Known uncertainty and re-review boundary

- No final hardened source was available for this report. Each finding needs re-review against a newly frozen post-fix copy; live-checkout line numbers are expected to move.
- I did not execute the suite or create additional repro fixtures under the read-only assignment. Except SR-04, exploitability statements are bounded source counterexamples, not claims of an executed end-to-end corruption fixture.
- The copied source has no repository-root dependency installation. No unavailable module resolution or unrun broad test was classified as a product defect.
- Standard/Full lifecycle support, installation, packaging, documentation, whole-v1 completion, and final regression are outside this source-acceptance report. The supported lifecycle remains the existing Lite `spec-approved -> task-ready -> executing` path.
