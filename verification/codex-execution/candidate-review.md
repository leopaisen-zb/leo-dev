# C2 candidate-handoff static review

Date: 2026-09-09  
Scope: section 1 candidate identity only, using the frozen files under `candidate-review-input/` and the C2 baseline at `/private/tmp/leo-dev-c2-baseline.D6NyCk/`. Sections 2/3 are work in progress and are not given a completion verdict here. Per instruction, this review did not build the moving production tree or run Controller commands.

## Findings

### Important — changed candidate settlement cannot be resumed after the Gate terminal is durable

The normal path registers the candidate and inspects the Gate with `candidate.treeHash` (`controller.ts:1404-1417`). Historical handoff verification also correctly calls `candidateForRun(...)` (`controller.ts:874-900`). However, all three pending-handoff recovery calls construct a settlement request without the candidate (`controller.ts:518-520`, `1635`, and `1651`). `gateSettlementRequest` therefore falls back to `claimed.lease.inputTreeHash` (`controller.ts:1225-1231`). `GateRunner.inspectPreparedAttempt` requires the prepared attempt input to equal that expected hash, so a legitimate changed-output attempt is rejected during `resume` even though its terminal and candidate were just verified correctly.

This fails closed and does not refresh stale evidence, but it breaks the required crash/replay seam. Pass the uniquely validated registered candidate into dry-run and actual pending-handoff inspections, including the incomplete-tail branch. Add regressions for a changed candidate that crashes after Gate settlement and before Controller handoff, covering dry-run, ordinary resume, incomplete-tail resume, and double resume.

### Important — a registered changed candidate no longer requires explicit `--run` on retry

`registerCandidate` returns an existing binding at `controller.ts:1260-1266`; the missing-Run check is only reached for first registration at `controller.ts:1268-1270`. Consequently, after registration succeeds but the process stops before Gate launch, `run-gates --task ...` without `--run` can launch the changed candidate. The dry-run path has the same behavior (`controller.ts:552-565`). This conflicts with the explicit rule that changed output requires matching Run identity. Idempotent registration need not duplicate the event, but the retry should still identify the Run.

The current missing-Run test covers only the pre-registration case. Add a registration-fault/retry regression: retry without `--run` must conflict; retry with the same Run must reuse exactly one registration and proceed.

### Important — successful reconciliation can submit a pre-registration candidate that review can never accept

For reconciled success, `assertSubmitCandidate` chooses `unknownContext.inputTreeHash` even when no durable candidate exists (`controller.ts:992-1009`). It can therefore commit `controller.submit.accepted` and move an unchanged historical, pre-C2 unknown Run to `review-required`. `assertReviewCandidate` then unconditionally requires a matching `controller.candidate.registered` event (`controller.ts:976-979`), so every review receipt conflicts and the task is stranded after a one-way transition.

This is especially relevant to the stated pre-registration unknown compatibility boundary: it does not regenerate implementation or accept stale completion, but it cannot finish the supported unchanged-input legacy case. Require the same durable candidate before submit, and provide a bounded recovery/migration that registers only the exact unchanged lease/context tree without refreshing it. Exercise unknown -> successful reconciliation -> submit -> review with a historical claim lacking entry baselines.

### Important — `--dry-run run-gates` omits actual lease fencing checks

Dry-run checks task/Run states but not the projected active lease, current generation, or `claimed.lease.expiresAt` (`controller.ts:549-565`). Actual execution checks all three before candidate registration (`controller.ts:1397-1404`). An expired lease can therefore report `DRY_RUN` even though the corresponding command returns `CONFLICT`; a malformed/inactive generation has the same parity issue. Dry-run also checks only an existing candidate's tree, whereas actual registration revalidates its revision, generation, claim input, spec, and task binding (`controller.ts:1260-1265`). Mirror the non-writing identity/fencing validations in dry-run.

### WIP snapshot blocker — the copied source has a duplicate declaration

The fixed WIP copy declares `const routes` twice in the same scope (`controller.ts:676-677`). That copy cannot compile as-is. This does not invalidate GREEN results reported from an earlier implementation phase, and it is not a section 2/3 verdict; it means the eventual frozen completion candidate needs a fresh build/typecheck before its results can evidence the final source.

## Confirmed properties in this snapshot

- New claims capture the immutable Lease hash and canonical entry baseline in one claim batch (`controller.ts:1193-1219`). Entry comparison detects additions, removals, content changes, and mode changes because it compares the complete canonical entry value by normalized path (`controller.ts:1240-1253`). Protected spec, registry, and `.leo-dev` paths are checked before allowed-path matching.
- First registration checks supplied Run identity, historical changed-output baselines, current spec/task authority, and current candidate scope, then commits the immutable candidate before Gate launch (`controller.ts:1256-1289`, `1392-1409`). A later tree change conflicts rather than replacing the candidate.
- The ordinary Gate request binds the candidate output hash, and submit/review require the current tree plus current active, unexpired lease (`controller.ts:1404-1417`, `988-1010`, `971-985`). Review receipts bind Run/task/revision/generation/spec/task/tree via the submitted record independently of pass versus reject.
- No forward-path code reviewed here refreshes a registered candidate or rewrites user files to satisfy the hash. The principal recovery defect above is fail-closed availability, not stale-evidence acceptance.

## Verification gap in the supplied focused tests

The five supplied tests establish first-registration changed-output success, missing/stale Run refusal before registration, valid reject routing, and basic plan projection. The candidate success uses legacy `allowedPaths: ['.']`, so it does not exercise a restrictive scope. There is no supplied regression for protected/out-of-scope additions, removals, content or mode changes; registered-candidate drift; registration crash/idempotence; changed-candidate settlement resume/reconciliation; expired/fenced dry-run parity; or changed-candidate submit/review identity.

## Bounded verdict

Not ready for section 1 candidate-handoff acceptance on this snapshot. The forward Gate/submit/review chain retains the main stale-tree and scope guards, and no evidence-refresh path was found, but changed-output recovery and mandatory Run identification have Important gaps. Re-review should use a newly frozen, buildable snapshot and targeted fault/recovery tests; no conclusion is made here about the unfinished shared-budget or multi-task work.
