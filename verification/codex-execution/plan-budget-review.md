# C2 plan and shared-budget static review

Date: 2026-09-09  
Scope: current plan, dependency, lease-owner, and shared-attempt-budget semantics in `packages/cli/src/controller/controller.ts`, `packages/cli/src/state/snapshot.ts`, and `packages/cli/src/commands/route.ts`, against sections 2/3 of `implementation-brief.md`. Candidate-handoff code was not re-reviewed. Per instruction, no build or live Controller command was run.

Observed source identities before the implementation worker's follow-up fixes:

- `controller.ts`: `3c2f6e61cefcded79ba8c2dff6d505385ae9470221d3d3dfa7b50ede24d6c033`
- `snapshot.ts`: `ef7947fda4ada339dfc75ba172e7b1d19c5db2063dd17a229631244a8536f61d`
- `route.ts`: `85e55bddf217a2e900a43b3855784bb274e249fbef31feb5a863559feee07974`

## Findings

### Important — failed unknown reconciliation bypasses the shared budget and retains the old lease

Both unknown-outcome constructors persist `retryRemaining: true` unconditionally (`controller.ts:1383` and `1486`), and `reconciliationPlan` passes that literal into `reconcileUnknown` (`controller.ts:1039`). On a receipt resolving the unknown Run as `failed`, `reconcile()` appends neither `task.attempt.failed` nor `lease.released`; only safe `abandoned` reconciliation emits `lease.abandoned` (`controller.ts:1619-1637`).

This has two concrete effects:

1. An unknown fourth/fresh-debug attempt can reconcile as failed to `remediation` instead of blocking the Task and Change, and the status counter remains at three failures.
2. An earlier unknown failure can move the Task to `remediation` while its old lease remains active. The next claim is then rejected by the serial active-lease check, so the advertised remediation path is unusable.

Derive remaining budget from the current task/revision failure count, record exactly one `task.attempt.failed` when reconciliation resolves the attempt as failed, choose remediation versus blocked from the resulting ordinal, and release the old lease in that same reconciliation batch. Crash recovery and repeated reconciliation must project that batch once.

### Important — mixed missing/present session history incorrectly certifies a fresh-debug claim

At the fourth claim, the implementation filters prior claims down to only nonempty session labels and fails closed only when the filtered list is empty (`controller.ts:1208-1212`). If three earlier attempts contain one labelled session and two claims without session provenance, a distinct fourth label passes. The unlabelled attempts make distinctness unknowable, so this does not satisfy the explicit fail-closed rule.

Require every relevant earlier `run.claimed` attempt to contain nonempty session provenance, then require the fresh-debug label to differ from every one. Keep these values described as unauthenticated metadata.

### Important — receipt-ID reuse can spend the review budget again

`failedAttemptCount` counts each `task.attempt.failed` event (`controller.ts:115-117`). Review validates the current candidate binding and then appends a new receipt/failure pair (`controller.ts:1543-1564`), but it never checks whether `receipt.receiptId` was previously ingested. Exact replay after rejection is blocked by Task state, but a later repaired candidate can present a newly bound reject payload with the same earlier receipt ID and consume another budget unit.

Treat a repeated review receipt ID as an idempotency collision: the same ID must not create another failure event, and the same ID with different payload/binding should conflict. The check and failure append must share the existing atomic batch boundary.

### Important — dry-run claim does not model plan or budget admission

The dry-run claim branch only accepts `ready` and performs no successful-path checks after that condition (`controller.ts:555-558`). Actual claim accepts `ready` or `remediation`, checks the shared budget and fresh-debug session, and rejects any active serial lease (`controller.ts:1195-1214`). Therefore:

- a valid remediation claim is falsely rejected by dry-run;
- in a multi-root plan, B can report dry-run success while A holds the sole active lease, although actual B conflicts;
- after three failures, dry-run does not validate missing, reused, or unverifiable fresh-debug session provenance;
- dry-run does not expose budget exhaustion using the same decision as actual claim.

Factor a read-only claim-admission decision used by both paths, or mirror all identity, dependency-state, serial-owner, budget, and session checks exactly.

### Important — dry-run cannot evaluate `route --plan`

The route dry-run branch still requires the legacy `--gate`, resolves that gate, and invokes single-task governance with required `--task` (`controller.ts:539-549`). Since state-changing commands are intercepted before `route()`, a proper plan-only dry-run never reaches the actual mutually exclusive plan validation at `controller.ts:1112-1164`.

Dry-run should read the contained plan, apply the same schema and DAG validation, resolve every task's gate in the selected registry, enforce the plan assessment restriction and incremental-route refusal, and report zero writes. It must not require legacy task/gate options for plan mode.

## Verified supported properties

### Plan validation and immutable routing

- `validatePlanTasks` rejects empty plans, duplicate task IDs, revisions other than 1, non-Lite risk, empty acceptance, gate counts other than one, self/missing dependencies, invalid initial root/dependent states, non-normalized allowed paths, and dependency cycles (`controller.ts:136-160`).
- Actual route parsing makes `--plan` mutually exclusive with legacy `--task/--gate`, contains the plan path in the repository, refuses plan routing with supplied or recorded assessment history, resolves each declared gate from the reviewed registry, and rejects incremental routing (`controller.ts:1109-1142`). No actual multi-task assessment bypass was found.
- All `route.selected` operations, root readiness transitions, and the identical initial task-plan projection are committed in one Controller batch (`controller.ts:1155-1164`). `projectJournalEvents` exposes batch operations only after an adjacent matching commit (`snapshot.ts:55-95`), and `readEvents` requires the projected task set and hashes to match every route (`controller.ts:688-705`).
- Change transitions consult every routed root/task and every stored gate binding rather than selecting the last route (`controller.ts:934-977`).

### Serial execution, unlocking, and completion

- Actual claim selects the route by task ID, accepts only journal-derived `ready`/`remediation`, rejects any active serial lease, allocates a monotonically newer generation, and commits remediation -> ready -> leased -> implementing with its new Run in one batch (`controller.ts:1195-1252`). In controller-produced histories, non-root tasks become ready only through dependency unlocking.
- Passing review computes completion from all routes, unlocks only pending successors whose complete dependency set is done, and calculates integration only when every routed task is complete (`controller.ts:1573-1582`). Receipt ingestion, current-task completion, current lease release, successor unlocks, final Change transition, and the optional manifest projection share one batch (`controller.ts:1583-1597`). A rejection performs no successor unlock, so downstream tasks remain pending.
- Gate failure, review rejection, and review pass each release the current lease in their own atomic outcome batch (`controller.ts:1407-1427`, `1547-1569`, `1587-1597`). The failed-unknown reconciliation exception is the first finding above.

### Shared ordinary Gate/review budget

- Determinate Gate failures and review rejections append the same `task.attempt.failed` event type and derive their next ordinal from the same per-task/revision count (`controller.ts:1407-1420`, `1547-1565`). Gate success followed by review rejection therefore spends one attempt, not a Gate failure plus a review failure.
- Ordinals 1-3 transition to remediation; ordinal 4 records a blocker, blocks Task and Change, releases the lease, and prevents a later claim. Status exposes `consumed`, `maximum: 4`, and `nextKind` per routed task (`controller.ts:115-123`, `1068-1072`).
- A new claim retains the immutable route/task hash and revision; second/incremental route is refused, so ordinary remediation cannot reset the counter by rerouting. Review identity includes Run, revision, generation, spec, task, and tree bindings, so an old candidate receipt does not apply to a repaired Run (`controller.ts:982-996`).

## Bounded verdict

Not ready for plan/budget acceptance at the observed hashes. Actual plan admission, DAG validation, serial review unlocking, and ordinary determinate Gate/review counting are structurally consistent and atomically journaled. The failed-unknown path still bypasses counting and lease release, fresh-debug provenance is not fully fail-closed, receipt-ID uniqueness is missing, and both plan route and claim dry-runs diverge materially from actual admission. Re-review must use a frozen post-fix snapshot plus focused crash/idempotency and CLI tests; this report makes no candidate-handoff verdict.

## Addendum — safe-abandoned attempt-budget adjudication

A safe abandonment is not categorically a failed attempt. The normative Task/Run tables explicitly map an `unknown -> abandoned` receipt that proves retry safety to `ready` with a new generation, whereas `unknown -> failed` alone enters remediation or blocks according to budget (`spec.md:173-174`, `189-193`). A receipt backed by the durable Gate prefix showing that argv was never released, with `sideEffectDisposition: not-started`, is therefore intentionally compatible with zero budget consumption; counting that administrative recovery as a failure would contradict the distinct abandoned transition.

The current admissible branch is broader and creates a concrete bypass of C2's four-total-attempt boundary. Reconciliation validation accepts safe `abandoned` with `sideEffectDisposition` equal to `failed`, `not-started`, or `side-effects-absent` (`validate.ts:33-38`). `reconciliationPlan` does not inspect that disposition or the bound Gate phase prefix and only recalculates budget for `resolvedRunState === 'failed'` (`controller.ts:1062-1084`); `reconcile` likewise emits no `task.attempt.failed` for any safe abandonment (`controller.ts:1692-1710`). Consequently, even after argv has a durable `gate.attempt.released`, each unknown Run can be described by a schema-valid safe-abandoned receipt, returned to `ready`, and claimed again indefinitely while `failedAttemptCount` remains unchanged. In particular, after three failures this repeatedly reopens the nominal fresh-debug/fourth attempt instead of ever reaching the fourth-failure block required by `implementation-brief.md:23,27`.

Minimal correction: preserve zero-cost safe abandonment only when the receipt says `sideEffectDisposition: not-started` **and** its already-bound durable Gate phase history proves there was no `gate.attempt.released`. Reject inconsistent `abandoned + failed`; a released attempt whose result is known to have failed should reconcile as `failed`, using the existing shared counter and fourth-failure block. If the product intends to accept `abandoned + side-effects-absent` after release, that executed attempt must consume one shared attempt and apply the same fourth-attempt blocking decision, atomically with lease fencing. This is a bounded contract guard, not a request to count proven never-started recovery. No source or test command was run for this addendum, and it is not a frozen-source acceptance verdict.
