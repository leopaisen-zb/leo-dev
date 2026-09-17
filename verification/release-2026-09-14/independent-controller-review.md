# Independent controller release review — 2026-09-14

Verdict: **NEEDS FIX** for the reviewed source. Five bounded counterexamples are recorded below. This is the pre-fix review; it does not assess later corrections or certify the complete release.

The read-only review compared the runtime/schema release changes with `/private/tmp/leo-dev-release-before.jrvry4rk`, against the 2026-09-14 amendment in the existing specification and the R1/R2 execution contract in the sole plan. There is no useful Git HEAD comparison at this checkpoint. The source read window ended with the counterexamples observed at approximately 09:06–09:08 UTC. Their JSON evidence records the actual observation time and source/dist hashes. The first four share controller source SHA-256 `88b78a2482c03527282b0722b37cc46e7c8b6df87a9737a16008695fee11e9b3` and compiled controller SHA-256 `2380252b12388157c258286e48850507cf2a0eaf6de33a0a154adde8ea2d1d1a`.

Only this report and the adjacent `independent-controller-cases/` reproduction files were written. The generated helper modules copy the existing public CLI fixture setup, with plain Node assertions replacing the test runner; the adversarial actions and outcome checks are independently supplied. Fixture repositories remain in the temporary roots recorded in each result. These are synthetic local counterexamples, not real independent product reviews or CI runs. All provenance/session labels are unauthenticated metadata.

## Findings

### RCR-1 — High: pending archive recovery commits after source and artifact drift

`archiveRelease` validates the source and supplied evidence before preparing its batch, but the batch contains no recovery subject proof (`controller.ts:1404`, `:1425`). `preflightControllerBatchRecovery` and `recoverControllerBatch` validate non-projection source identity only for `spec-revision` (`batch.ts:133`, `:184`, `:257`). Therefore the newly introduced archive path loses its freshness checks across interruption.

Reproduction: prepare a valid release and archive, inject `after-batch-prepared`, change both `src/app.ts` and the runtime artifact named in the archive manifest, then run the public `resume` command. Observed: `RESUMED`, followed by `status` reporting `archived`; neither changed input was reviewed or rehashed into the archive. Evidence: [archive-recovery-result.json](independent-controller-cases/archive-recovery-result.json).

Bounded correction: reuse the existing exact projection snapshots, canonical remainder entries/hash and source-reference hashes for release-evidence/archive batches. Capture every runtime input actually admitted by archive, and verify current source plus these referenced bytes in ordinary preparation and both pending-batch preflight and locked recovery, before tail truncation or projection writes. Preserve third-value/no-clobber behavior and existing spec-revision proofs. The same missing proof applies structurally to a pending release-evidence batch; the recorded reproduction specifically exercises archive.

### RCR-2 — Medium: Full assessment receipts can start in the future

`fullReviewAssessments` checks that nested assessment timestamps parse, precede expiry, and have not expired, but does not reject `timestamp > now` (`controller.ts:1705–1709`). `validateReceipt('review')` applies temporal semantics only to the enclosing receipt (`schema/validate.ts:25–40`).

Reproduction: submit a Full candidate with three complete, independently labelled, candidate-bound assessment receipts whose timestamps are tomorrow and expiries are the following day. The enclosing receipt is current. Observed: exit 0, `LITE_REVIEW_ACCEPTED_UNAUTHENTICATED`, task `done`. Evidence: [full-future-result.json](independent-controller-cases/full-future-result.json).

Correction: apply the same current-time admission rule to all nested assessment receipts. Keep this refusal write-free and do not consume a repair attempt.

### RCR-3 — Medium: Gate approvals are used without preserving or reserving receipt identity

`runGates` rejects already-consumed IDs (`controller.ts:2419–2426`), but neither candidate registration nor GateRunner records the supplied approval receipt. GateRunner validates it at preflight and immediately before release, yet its prepared/released evidence omits the receipt and ID (`gates/runner.ts:577–588`, `:170–179`, `:186–190`). Consequently the new public receipt input has one-directional reuse checks: IDs previously consumed elsewhere are refused, but a Gate-consumed ID remains available elsewhere.

Reproduction: execute an approval-required gate with receipt ID X; inspect the journal; then submit a review receipt with the same ID X. Observed: `GATES_PASSED`, no X in the journal, and the review is accepted. Evidence: [gate-receipt-result.json](independent-controller-cases/gate-receipt-result.json).

This is an audit/receipt-reservation defect under the release's receipt-reuse contract. It is **not** evidence that an unchanged approval can execute arbitrary commands: current gate/argv/cwd/environment-policy/candidate/task-revision/lease fingerprints still constrain the receipt. The provenance label is not authentication.

Correction: preserve the approval value/hash and reserve its ID atomically through the existing candidate-registration or existing same-Run admission seam, after read-only approval preflight and before argv release. Preserve legitimate same-operation continuation explicitly; reject cross-scope and changed-value reuse. Do not introduce another receipt store or completion owner.

### RCR-4 — Medium: a Full composite rejection cannot enter bounded remediation

`assertReviewCandidate` always calls `fullReviewAssessments`; that helper requires every nested verdict to be `pass` even when the overall receipt verdict is `reject` (`controller.ts:1690`, `:1705`). The rejection branch occurs only afterward (`controller.ts:2564`). A complete current assessment that identifies a security failure therefore cannot be consumed as a failure outcome.

Reproduction: provide all three current, distinct-session, candidate-bound assessments, with architecture/NFR `pass`, security `reject`, and the enclosing receipt `reject`. Observed: exit 5 `CONFLICT`, task remains `review-required`; no repair is admitted. Evidence: [full-reject-result.json](independent-controller-cases/full-reject-result.json).

Correction: retain complete composite identity/freshness/provenance checks for both outcomes, require all nested verdicts to pass for an overall pass, and permit a valid rejection to record the established bounded failure/remediation outcome. A missing, stale or unbound assessment remains a policy refusal rather than a consumed failure.

### RCR-5 — Medium: review dry-run omits actual risk/provenance policy

The review dry-run calls `assertReviewCandidate` (`controller.ts:727–730`) but omits the integration and risk-specific transition admission subsequently performed by actual `review` (`controller.ts:2556–2564`, `:2589`). This yields a successful preview for a receipt the same command will refuse.

Reproduction: for a submitted Standard candidate, supply an otherwise current candidate-bound `agent-asserted` review receipt. Observed: `--dry-run` exits 0 `DRY_RUN`, whereas the unchanged actual command exits 3 `TRANSITION_FORBIDDEN`. Evidence: [standard-dry-run-result.json](independent-controller-cases/standard-dry-run-result.json).

Correction: use shared read-only review admission for both modes, including effective integration risk, independent session/provenance and valid pass/reject policy; mutation and budget updates remain actual-run-only.

## Confirmed structure and non-findings

- Standard/Full routing retains declared risk; design context captures repository-contained source bytes/hash and binds current spec authority plus normalized routed plan. Task readiness and claims recheck the current reviewed design. Conservative revision retains IDs/budgets and returns to spec-approved; the fresh plan/authority binding prevents prior design carry-forward.
- The optional integration role is restricted to a sole final task transitively covering all other tasks. Release admission requires completed tasks, a verification-only candidate equal to its claim tree, actual successful Gate settlement, independent accepted review and current authority.
- Release subject normalization removes only journal-committed projection paths. `readEvents` checks their exact committed values before the source comparison; it does not exclude an arbitrary metadata directory.
- The suspected Gate-evidence drift gap at archive was **not** a finding. Although `archiveRelease` does not directly reload Gate evidence, `readEvents → verifyGateHandoffHistory → inspectSettlement` validates the referenced successful evidence on entry (`controller.ts:776`, `:1234–1260`).
- Current release/archive dry-run paths use the actual admission methods and return before commit. The archive excludes manifest/archive/journal/snapshot paths it rewrites from its artifact inventory. Existing projection recovery checks reject a third value before applying the planned projection set. RCR-1 concerns additional source/evidence freshness across recovery, not an absence of the no-clobber projection check.
- Public Gate preflight occurs before candidate registration, and GateRunner rechecks approval immediately before argv release. Missing/wrong/expired approval admission is therefore not assumed to execute the reviewed argv. Network-deny enforcement was not relaxed by the new public option.

## Commands and limits

Each counterexample was run with Node v25.8.2 against the compiled public CLI, using:

```text
node verification/release-2026-09-14/independent-controller-cases/reproduce.mjs full-future
node verification/release-2026-09-14/independent-controller-cases/reproduce.mjs archive-recovery
node verification/release-2026-09-14/independent-controller-cases/reproduce.mjs gate-receipt
node verification/release-2026-09-14/independent-controller-cases/reproduce.mjs full-reject
node verification/release-2026-09-14/independent-controller-cases/reproduce.mjs standard-dry-run
```

All scripts completed and recorded the **undesired** outcomes above. Exit 0 from a reproduction script means the observations were collected, not that the product satisfied the invariant. No configured full suite, rebuild, installation, publication, or real browser/application acceptance was performed by this reviewer. The root owns final integrated tests and release acceptance. Re-review must use freshly built corrected source and preserve these RED results.

## Correction re-review — 2026-09-14 09:18 UTC

Verdict: **PASS for the five reported corrections and the bounded recovery paths checked here.** No unresolved finding remains from RCR-1 through RCR-5 on this source. The earlier NEEDS FIX verdict and RED evidence above remain historical and unchanged. This conclusion permits the root to proceed with the packaged example exercise; complete configured tests, package verification and final integrated release acceptance remain the root's responsibility.

The current implementation uses the existing batch recovery owner, canonical tree policy, exact projection prior/desired snapshots and referenced source hashes. Recovery proofs are required for the two new release batch kinds and are rechecked by pending-batch preflight and locked recovery before projection writes. Archive captures the admitted CI receipt, CI report, archive manifest, Gate evidence, artifacts and retrospective by repository-contained reference/hash; it also rejects self-rewritten input identities. No second scanner or completion engine was introduced. The default spec-revision proof path remains intact in the source diff.

Gate approval ingestion now shares candidate-registration atomicity. An existing candidate can ingest a newly required grant through the same batch owner; an exact already-recorded receipt for the same Run/task/revision/lease can continue without another receipt event. A different value or binding is refused. The Full temporal check and reject policy operate on the actual composite, and both dry and actual review use the same risk/provenance admission helper.

All seven independent assertion scripts completed with exit 0 against one unchanged source/dist pair. [Machine-readable verification summary](independent-controller-cases/fix-verification-summary.json) includes exact observation times and hashes.

| Finding/check | Observed corrected behavior | Evidence |
| --- | --- | --- |
| RCR-1, archive recovery | Source + artifact drift refuses; after restoring source alone, remaining runtime artifact drift still refuses. Both refusals preserve journal bytes. Restoring the exact artifact permits `RESUMED` to `archived`. | [archive recovery](independent-controller-cases/archive-recovery-green-result.json) |
| RCR-1, release recovery | After `after-batch-projection`, changed source refuses with unchanged journal; exact restoration permits recovery to `release-evidence`. | [release recovery](independent-controller-cases/release-recovery-green-result.json) |
| RCR-2 | Future-start nested Full assessments return `CONFLICT`, retaining `review-required`. | [Full future](independent-controller-cases/full-future-green-result.json) |
| RCR-3 | Successful Gate records its approval ID; a subsequent review using that ID returns `CONFLICT`. | [Gate receipt](independent-controller-cases/gate-receipt-green-result.json) |
| RCR-3, continuation | Pending candidate/approval preparation recovers; changed-value same-ID grant is refused without journal writes; the original exact grant executes successfully with exactly one receipt ingestion. | [Gate recovery](independent-controller-cases/gate-recovery-green-result.json) |
| RCR-4 | A complete current Full rejection returns `REVIEW_REJECTED`, enters `remediation`, and consumes exactly one failure. | [Full reject](independent-controller-cases/full-reject-green-result.json) |
| RCR-5 | The same prohibited Standard provenance returns `TRANSITION_FORBIDDEN` in both dry-run and actual execution. | [review dry-run](independent-controller-cases/standard-dry-run-green-result.json) |

Commands were `node verification/release-2026-09-14/independent-controller-cases/verify-fixes.mjs <case>`, with case names `full-future`, `archive-recovery`, `gate-receipt`, `full-reject`, `standard-dry-run`, `gate-recovery`, and `release-recovery`. `verify-fixes.mjs` adds explicit desired-outcome assertions and GREEN output names while preserving `reproduce.mjs` and all original RED files. The initial narrower archive GREEN observation is also retained separately.

Reviewed and exercised hashes:

```text
controller.ts       e595ed548bbbd66a15352c74243b2b709698ea9803d4ceee4bd463da9d96c3f2
batch.ts            af64de27dc941daac7e2793988665c20ae77c278ec01b8154d40802e4bd9f01b
state/snapshot.ts   bab0a2952e02c911fe15b9fef4cc569d67d6b9209eecb124a14262f5117656a3
dist/controller.js  ba35340a3083d6065cbd7ae73f8cc8ed1977351da822d2454966d2843f58186e
```

Limits: this reviewer did not rerun the full configured suite, independently rebuild, install, publish or perform browser/application acceptance. The root reported a successful fresh build/typecheck before dispatch; the independent public CLI observations above establish behavior of the recorded compiled artifact. Permanent regression results from the separate test author are not counted as this reviewer's evidence. This remains a bounded local protocol check with unauthenticated labels, not proof of external identity or broad reliability.
