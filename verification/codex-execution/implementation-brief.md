# C2 production execution seam — implementer brief

Date: 2026-09-09. Binding spec: `.scratch/unified-development-plugin/spec.md`, C2 authorization and normative state tables. User approved production seam + controlled real Codex verification. Existing C1 baseline remains historical.

## Ownership and boundaries

You are not alone. Own necessary production changes under `packages/cli/src/controller/` (prefer small focused helpers), `commands/route.ts`, `commands/run-gates.ts`, `commands/claim.ts`, and necessary `state/snapshot.ts` integration; own `tests/cli/codex-first-baseline.test.ts`, new `tests/cli/codex-execution.test.ts`, and necessary existing CLI crash/vertical regression adjustments. Ask before touching other files. Main owns spec, plan, skills/docs, controlled live fixture and final review. Do not edit those or C1 reports.

Preserve existing untracked/dirty files; no cleanup, Git writes, install, new dependencies, network/model APIs, engine replacement, platform/model/security defaults, nested agents or waiver of tests. Ordinary authorized Codex subagents are coordinated by main. Do not rewrite GateRunner containment/recovery or batch atomicity. Existing risk policy and unknown-effect reconciliation remain binding.

## 1. Candidate handoff

Keep immutable `Lease.inputTreeHash`. Extend new `run.claimed` payloads with their canonical input entries. Register an immutable `controller.candidate.registered` event in a committed batch before GateRunner launch, with Run/task/revision/generation, claim input hash, current output tree hash, spec hash and task hash. GateRunner's `expectedInputTreeHash` refers to this gate-input candidate, not the worker's original input. Submission and review derive from the same candidate. No second state authority.

Add optional `run-gates --run <run-id>`. If supplied, it must match the active claimed Run. If output differs from input, explicit matching Run identity is mandatory; this prevents a stale caller with a task ID from rebinding arbitrary output to a later Run. Unchanged-input legacy calls remain supported. Historical claims lacking entry baselines cannot accept changed output. Existing registered candidate drift conflicts instead of refreshing it. Current revision, active generation and unexpired lease still required; spec/tasks/registry/artifact checks remain.

Compare canonical entries by normalized path to validate additions, removals, bytes and mode changes against task.allowedPaths. Canonical symlink checks remain. Protected controller artifacts and configured gate/spec bindings cannot be changed even with a broad allowed path. Candidate refusal is not a sandbox and must not restore/delete arbitrary user edits. Atomic registration retry of the same candidate is idempotent; a new process can verify the identified written candidate without rerunning implementation. `resume` must not silently treat an unknown pre-registration implementation as unstarted and regenerate it.

## 2. Valid rejection and shared budget

Verify review identity independent of verdict. `pass` means completion; valid `reject` is ingested as a failure with its receipt/findings preserved. In one batch record `review-required -> reviewing -> remediation`, release the old lease and persist the failure. Return a truthful `REVIEW_REJECTED` success envelope (receipt accepted, task not done). Leave the observable task state `remediation`. A subsequent `claim` allocates a fresh Run/generation and transitions remediation -> ready -> leased -> implementing in that same claimed generation.

Gate and review failures share one per-task/revision budget and are counted once per failed attempt. Initial attempt + two remediation attempts + one fresh-context debug attempt = four attempts total. Third failure requires a debug attempt; fourth blocks task and change. Replays and repeated receipt IDs cannot spend budget twice; an old candidate receipt cannot accept a repaired candidate. Acceptance/task hash does not change on retry. Terminal gate success followed by review rejection is a failed task attempt, not a new failed Gate run record.

Add optional `claim --session <session-id>` for recorded execution context. The fourth/debug claim requires a nonempty session distinct from all recorded earlier attempt sessions; absent prior session provenance must fail closed for the fresh-debug requirement, not certify freshness. Expose next-attempt kind/budget in status. These are unauthenticated labels, not platform attestation. Main's actual isolated sessions provide separate host evidence. Do not add a model launcher or fake debugger.

Reuse transition predicates. Gate failure, crash-settlement mapping and unknown reconciliation must use the same remaining budget; do not retain unconditional `retryRemaining: true` where it bypasses this count. Unknown outcomes still need reconciliation before execution. Safe accepted failures release the lease so remediation can be claimed; exhausted budgets cannot be bypassed by claim/resume.

## 3. Immutable Lite plans and serial unlocking

Preserve legacy `route --task <id> --gate <id>`. Add mutually exclusive `route --plan <repository-contained-path>` (with optional existing registry). Use existing task-plan schema and semantic validation: at least one task, unique valid IDs, revision 1, nonempty acceptance, existing dependencies, no self edge/cycle, roots ready/dependents pending, risk lite, exactly one existing reviewed aggregate gate per task, valid normalized allowed paths. Do not silently normalize `done`/non-Lite input into accepted tasks.

Emit one existing `route.selected` payload per task in a single batch and project identical canonical tasks.yaml. Read routes by task ID everywhere, never globally choose the last task. Use journal-derived task transitions for runtime state. Existing single-task journal format remains readable. A second/incremental route stays rejected.

Claim only a dependency-ready task while no active serial lease/unknown Run exists. Pass review marks current task done, releases its lease and atomically unlocks pending successors whose dependencies are all done. Keep change executing until every planned task is done and all runs settled, then integration-review. Review of A must not accidentally apply B's/C's identity or gate. Existing transition command must use all planned tasks, not only the latest.

Do not bypass governance: multi-task plan plus supplied assessment or existing assessment history is explicitly unsupported in C2 (one task's assessment is not plan-wide coverage); preserve existing single-task assessment behavior. Unassessed plans remain visibly not-assessed. Do not claim Standard/Full support.

## Behavior-first verification

Convert C1's three current-gap characterizations into desired regressions while preserving `verification/codex-first/` historical results. Before production edits, run focused tests to show behavior failures, save exact RED command/output in your report or generated reporter artifact. Missing option must be distinguished from the later semantic assertions; run through to semantic failures after option registration where needed.

Required public CLI checks: changed allowed candidate succeeds with explicit Run; missing/stale Run rejected; outside-scope addition/removal/mode/content refused; post-registration/candidate/gate/spec/task drift refused; dry-run no writes; crash during registration and verified result replay no duplicate acceptance; valid reject -> remediation -> fresh claim -> corrected pass; stale/duplicate receipt rejected; combined gate/review failures consume exactly four attempts; fresh debug session enforced and exhaustion not claimable; three-task A->B->C (plus branch join if economical), predecessor not done blocks claim, B rejection keeps C pending, all done enters integration; duplicate/missing/cyclic/non-Lite/empty plan refused before route/projection; plan governance bypass refused; unrelated bytes and Git state preserved.

Example external assertions (helper names local to test):

```ts
expect(runGatesWithCurrentRun.status).toBe(0);
expect(rejectedReview.envelope.code).toBe('REVIEW_REJECTED');
expect(afterReject.tasks.b.state).toBe('remediation');
expect(afterReject.tasks.c.state).toBe('pending');
expect(afterFinalReview.changeState).toBe('integration-review');
```

Run `npm run build`, focused Vitest CLI tests, typecheck, then relevant existing CLI/crash regressions. Main runs full regression and live source-loaded Codex validation. Do not remove fault coverage or loosen security assertions to make new paths pass. If needed compatibility tests should exercise the unchanged-input legacy path rather than insist that legitimate new behavior remains a defect.

## Report and escalation

Write only `verification/codex-execution/implementation-report.md` for your report: exact changed files, roots, RED/GREEN commands and outputs, compatibility/recovery implications, remaining failures or concerns. Generated test reporter logs can be stored in that directory with distinct worker-prefixed names. Return short status and tests. Main will independently review diff against `/private/tmp/leo-dev-c2-baseline.D6NyCk/` (no HEAD exists). If a safety invariant needs redesign beyond the bounded seam, stop and send the exact issue; no unbounded retries or acceptance changes.
