# P3 recovery correctness — independent source review

## Verdict

**PASS — no Critical or Important findings in the frozen recovery patch.**

The two previously reported defects are closed at the production writer and strict replay/recovery boundaries. The changes preserve current-revision ownership fencing, the complete ownerless legacy thrown-indeterminate shape, unrelated duplicate legacy receipt IDs, and the existing prior-or-desired recovery proof.

This is a source-review verdict for FR-01 and FR-02 only. It is not a P3, v1, package, installation, or live-acceptance completion claim.

## Reviewed inputs

- Frozen after snapshot: /private/tmp/leo-dev-p3-source-review.6bd94coc
- Frozen before snapshot: /private/tmp/leo-dev-p3-closeout-before.vhw54_iy
- Normative contract: .scratch/unified-development-plugin/spec.md v1.7.0 and verification/spec-revision/implementation-brief.md
- Prior findings: verification/spec-revision/source-review-final.md
- Worker record: verification/spec-revision/2026-09-14/worker-recovery-closeout.md
- Exact changed files: packages/cli/src/controller/controller.ts and tests/cli/codex-spec-revision.test.ts

The before/after SHA-256 values match source-review-input.json: controller f69687a5… → f5d91079… and test 30c5743f… → 3c6dfc6b…. No other production or test file is represented by the supplied diff.

## Findings

No Critical or Important findings.

## FR-01 closure: thrown-indeterminate Gate result after revision

The supported writer now emits changeId, taskId, taskRevision, leaseGeneration, and gateId in the controller.gate.result payload, while retaining the same values on the operation envelope (packages/cli/src/controller/controller.ts:2251-2262). This satisfies the post-revision reducer rule that compares result payload ownership with the current task authority and event envelope (packages/cli/src/state/snapshot.ts:143-150), so a successfully committed unknown-outcome batch remains reducible and snapshot-readable.

Replay validation remains narrow. Classification accepts either the complete historical ownerless shape or owner fields matching the event envelope; it rejects partial/mismatched task ownership before treating the result as a valid standalone unknown (controller.ts:355-365). For the modern shape, the historical verifier additionally checks all five fields, including gateId, against the unique historical route, Run claim, revision, and lease generation (controller.ts:1087-1122, 1137-1170). The exact batch mapping and Gate phase proof remain enforced afterward (controller.ts:1171-1214). Thus the patch does not let a stale revision, lease generation, Run, or Gate masquerade as the caught result. The all-absent legacy form remains accepted by these controller checks; when it predates the first revision, the reducer processes it before the revised epoch begins.

The new regression drives the compiled CLI through an executable launch failure after a v2 activation, reaches the real GateRunIndeterminateError catch, confirms the committed result carries revision-2 ownership, and then exercises state returned by run-gates plus status, resume, and status again (tests/cli/codex-spec-revision.test.ts:326-358). This is controller-path coverage rather than a reducer-only fixture or mocked error.

## FR-02 closure: duplicate receipt in pending revision recovery

verifySpecRevisionHistory now projects the journal once, adds receipt.spec-revision.ingested operations from a trailing pending spec-revision batch, and counts their IDs together with every committed logical receipt kind (controller.ts:868-884). Rejection is still applied only to revision receipts. Consequently a pending revision receipt that collides with an earlier approval, review, or other consumed receipt is rejected, while a history whose duplicates are exclusively non-revision receipt kinds remains tolerated.

The check precedes recovery writes on both public paths. Dry-run resume calls it before recovery preflight (controller.ts:613-631), and actual resume calls it before either incomplete-tail repair or recoverControllerBatch (controller.ts:2520-2543, 2569-2574). New revision creation also validates a simulated committed form from the single prepared timestamp inside the journal tail-checked preparation callback (controller.ts:1845-1853), so the ordinary write path cannot introduce the same duplicate.

The regression constructs a structurally and hash-consistent pending revision: it changes the receipt ID, dependent approval references and hashes, projection desired hashes, recovery desired bytes, and prepared timestamp together (tests/cli/codex-spec-revision.test.ts:133-171). It covers both after-batch-prepared and after-batch-projection states, then runs dry-run and actual resume against each. After every refusal it compares the exact journal bytes and every pending projection's bytes/type/mode with the pre-resume state (tests/cli/codex-spec-revision.test.ts:678-701). This demonstrates the required prepared/projected and dry-run/actual zero-write barrier for the durable targets recovery could otherwise change.

## Adjacent invariant check

- Pending revision semantic validation still requires exact batch provenance, one assessment, one revision receipt, one revision record, exact replacement routes and transition, exact projections, and a valid recovery proof (controller.ts:885-1034).
- recoverControllerBatch still requires the same pending event hash under the journal lock, validates source/remainder/projection state, accepts only prior or desired projection values, and appends one adjacent commit (packages/cli/src/controller/batch.ts:161-189, 247-261). The patch does not bypass those checks.
- Existing ownerless thrown-indeterminate history remains a narrowly identified unknown-outcome batch with unique claim, route, prepared attempt, context, active lease, and exact operation sequence. The new compatibility branch does not admit mixed ownership fields.
- Existing duplicates involving only non-revision receipt kinds remain outside the revision uniqueness rule (controller.ts:875-884).

## Residual coverage gaps

These are test-depth gaps, not source findings:

1. The new FR-01 test proves the valid modern caught path but does not mutate each newly added payload owner field or gateId. The source has two independent fail-closed checks for those mutations, and generic post-revision fencing tests exist, but a standalone-unknown-specific negative would make the contract more explicit.
2. The suite has pre-revision ownerless thrown-indeterminate coverage and separate revision history coverage, but the new file does not build an ownerless legacy unknown, reconcile it, then activate a later revision and reread the archived history.
3. The legacy duplicate-receipt regression checks a clean history containing two unrelated non-revision receipts. It does not combine that history with a distinct, valid pending revision recovery to demonstrate compatibility end to end.
4. The FR-02 zero-write assertions cover the journal and all pending projections, not the snapshot cache or a whole-tree digest. Source order rejects before any recovery or snapshot write, so this does not change the verdict.

## Verification limits

I reviewed the frozen files and their exact before/after diff read-only. I did not run build, typecheck, focused tests, broad suites, package/install checks, or live acceptance. The worker's RED 3 failures, GREEN 3/3, full P3 52/52, build, and typecheck results were treated as supplied inputs rather than independent acceptance evidence. Final execution and package/live evidence remain owned by the root verifier.
