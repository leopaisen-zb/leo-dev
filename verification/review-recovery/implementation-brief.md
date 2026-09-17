# C3.3 expired submitted-review recovery — execution brief

Approved scope: existing specification C3 and the user's continuation instruction. Repository: `/Users/leo/plugins/leo-dev`. Before snapshot: `/private/tmp/leo-dev-review-recovery-before.5OZhSJ`. Existing plan remains the only progress ledger: `docs/superpowers/plans/2026-09-04-unified-development-plugin.md`.

## Deliverable and ownership

Implement a **review-only recovery epoch** for an expired, otherwise valid submitted candidate. Reuse the existing journal/controller batches and `resume` command. Do not create another scheduler, lease kind, task state or execution engine. You are not alone: preserve all existing changes; do not edit files outside your ownership or revert others.

Own `packages/cli/src/commands/resume.ts`, focused changes to `packages/cli/src/controller/controller.ts`, optional focused `packages/cli/src/controller/review-recovery.ts`, `schemas/review.schema.json`, new `tests/cli/codex-review-recovery.test.ts`, necessary additive schema test changes, and `verification/review-recovery/implementation-report.md` plus evidence JSON files in that same directory. Main owns specs/plan/skill guidance/live fixtures/final verification. Do not modify GateRunner, state/lease, state/transition, state/snapshot, acceptance thresholds, dependencies or existing unrelated tests; escalate a demonstrated dependency before broadening scope.

No Git writes, worktree switching/cleanup, installs, global settings, network, paid services, hidden daemon, source fetching, live-fixture mutations or child agents. Use apply_patch. Generated CLI dist may be rebuilt for tests; signal when source/testing is stable so main can verify. Follow TDD and systematic debugging; distinguish invalid fixture/prerequisite errors from valid behavioral RED. Preserve old failed evidence.

## Exact public contract

Ownership handoff, 2026-09-10: the initial worker released production and subsequently all test ownership with no pending patch/subprocess; its handoff report/RED evidence is preserved. Main owns production (including the narrow `controller/types.ts` parsed-option addition, disclosed in that report) and final build coordination. Separate Terra/high worker `/root/review_recovery_test_matrix` now owns the recovery test matrix and its report; it may run focused tests when main's shared regression is finished. All protocol/authority restrictions below remain unchanged. Final independent reviewer must be distinct from all implementation contexts.

`resume --change ID --task TASK --recover-review [--dry-run] [--json]`.

- `--task` and `--recover-review` must appear together; malformed combinations fail before writes. Plain `resume` retains its current behavior and does not silently readmit expired reviews.
- Normal recovery returns `REVIEW_RECOVERED`; an exact already recovered current submission returns `REVIEW_RECOVERY_REPLAYED` with the same ID and no new event. `--dry-run` performs the same read-only checks and returns `DRY_RUN` without repairing history, touching snapshots or allocating/publishing a recovery ID. Its state may describe the current valid prior recovery.
- `state.reviewContext` retains all original submitted fields and adds only optional `recoveryId` after recovery. Add optional nonempty-string `recoveryId` to review receipt schema. **Do not put recoveredAt or other non-receipt fields into reviewContext**, because callers spread this object into strict-schema receipts. Expose recovery metadata separately as `state.reviewRecovery` (null or its bound ID/time/evidence description).
- Before recovery, review receipts carrying recoveryId are rejected. After recovery, absent/wrong ID is rejected even when timestamp/other hashes are fresh. The new receipt timestamp must not precede the committed recovery event timestamp. Normal receipt freshness/provenance policy still applies. Neither a token nor a local timestamp authenticates a host/user.

## Invariants and history binding

Admission requires a validated journal, current Change `executing`, target Task `review-required`, the original Run `succeeded`, original unreleased projected lease at the same generation, and expiry actually reached. Verify unique matching claim, candidate registration, successful Gate result and accepted submission for that Run; same task/revision/generation/spec/task/candidate tree and Gate identity. Reject unknown Runs, in-flight Gate phases, released/abandoned ownership, stale Spec/task/registry/source/evidence or malformed/ambiguous history. Current canonical tree must equal the submitted candidate. Reuse existing readEvents/GateRunner inspection to verify durable settlement and evidence without running the Gate again. A reconciliation-derived submission without the exact required successful Gate result is outside this first recovery path: refuse explicitly, not infer proof.

Append one `controller.review.recovered` operation in one `expired-review-recovery` controller batch. Payload records schemaVersion 1, random `recoveryId`, original submitted fields, claim/candidate/Gate-result/submit event hashes, and exact Gate terminal/attempt identity (as available from the existing verified history). The committed operation event timestamp is recoveredAt; do not rewrite old events. The raw history verifier must prove the operation belongs to exactly one fully committed batch of this kind with exactly this single operation. Reject orphan/direct-append contexts, duplicated contexts, invented bindings and recovery events accepted only by type name. Validate historical recovery at its prefix so later legitimate pass/reject/new attempts do not invalidate old recovered history. Context may be reused only for its exact submission; never rotate its ID on repeated resume.

Keep the original implementation lease payload and active/unreleased projection unchanged until ordinary review pass/reject releases it. Its expired time and original generation stay intact; this reserves the shared serial writer lane without granting the old writer execution rights. No new Run, Gate execution, candidate registration, task transition, attempt failure or budget change occurs on recovery. Original `run.claimed`, candidate, Gate, submit and their fingerprints remain byte-for-byte/event-hash identical. Pass/reject uses existing task/budget/unlock logic with the original lease identity. Old worker run-gates/submit and independent ready-task claim remain refused.

On already clean valid history, invalid recovery requests must fail before any writes (including snapshot writes); do not unconditionally call the full ordinary resume first. When journal/batch recovery is actually needed, actual recovery completes only the existing supported path, then rereads and revalidates before appending its own batch. A retry after interruption must finish the prepared original recovery ID, never allocate a second one. Dry-run must refuse pending/incomplete history without fixing it. Existing expected-tail CAS handles concurrent appends; map a recovery CAS loser locally to `CONFLICT` (exit 5), without changing other commands globally. Review and recovery must not interleave into an uncommitted batch.

## Tests: observe RED, implement, GREEN

Use compiled public CLI fixtures and literal behavioral expectations; synthetic history, real Gate execution and process interruption must be labelled accurately. Reuse existing test utilities/patterns where possible; keep helper setup out of production APIs. Time expiry through bounded fixture TTL/clock boundaries; do not edit production leases or weaken the time guard. Avoid root-level receipt/input writes after claim; runtime-contained files are excluded from candidate hashing. A missing dependency or invalid receipt-path setup is not the feature RED.

The initial new desired regression must reach a real submitted candidate with expired lease, then fail because the recovery capability does not exist. Mutation targets and required cases:

1. Expired ordinary review rejects without writes; recover dry-run writes nothing; actual recovery leaves task review-required and Run succeeded, preserves claim/candidate/Gate/submit hashes and budget, and keeps the lane occupied. Exact new receipt pass reaches done and unlocks only correct successors.
2. Old receipt with no ID, wrong ID, predating timestamp; recoveryId on unrecovered submission: reject with no journal/budget/snapshot mutation. Correct recovered reject enters remediation once, counts one failure, releases old lease; retry claim gets the next generation and cannot reset prior failures.
3. Repeated recovery returns same ID and no additional event; repeat after rejected/done or a different current candidate does not reuse obsolete recovery. Unknown Run, active/nonterminal Gate, unexpired lease, wrong Task state, missing/released original lease, candidate/Spec/task/Gate-registry/evidence drift and forged/orphan/duplicate recovery history refuse. Do not weaken pre-existing readEvents barriers to construct a test.
4. Actual interrupted recovery batch at existing after-prepared/projection fault hooks: dry-run refuses without repair; normal resume/recover retry finishes the same prepared ID once; late old receipts still reject. Concurrent recoveries yield one durable context (other outcome conflict or already-recovered if its preflight happened after commit); converged retry reads same ID. New receipt/repeated recovery cannot double-consume budget or unlock twice.
5. Separate ready task remains unclaimable while recovery awaits review; expired original owner cannot run gates or submit. Recovery never starts an executable. Inspect gate-event identities/counts and source bytes, not just status text.

Example primary assertion contract:

```ts
expectCode(recoverDryRun, 0, 'DRY_RUN');
expect(journalAfterDryRun).toBe(journalBeforeDryRun);
expectCode(recover, 0, 'REVIEW_RECOVERED');
expect(recovered.state.reviewContext).toMatchObject(originalSubmitted);
expect(recovered.state.tasks[taskId].state).toBe('review-required');
expect(recovered.state.run.lease).toEqual(originalLease);
expect(recovered.state.reviewContext.recoveryId).toEqual(expect.any(String));
expect(gateEventHashesAfter).toEqual(gateEventHashesBefore);
expectCode(oldReview, 5, 'CONFLICT');
expectCode(newReview, 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
```

Run `npm run build`, then `npx vitest run tests/cli/codex-review-recovery.test.ts --fileParallelism false`; use focused test selection during edits. Run `npm run typecheck` and relevant existing candidate/expiry/crash cases after GREEN. Main owns final serial combined regression and real fixture continuation, so do not run all repository suites repeatedly or concurrently with main.

## Report and handoff

Write implementation report with files, public contract, exact RED/GREEN commands/exits and source snapshot, invalid preliminary fixtures separately, named concurrency/forgery checks, unresolved issues and test provenance. No fabricated commit ranges: repo has no HEAD and original files are untracked; compare to the retained before directory. Return concise result and whether any process/edit remains active. Main sends a separate Sol/xhigh reviewer after your self-review; implementation self-report is not final acceptance.
