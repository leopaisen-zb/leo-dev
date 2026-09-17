# P3 source hardening handoff — 2026-09-11

This executes the existing approved P3 brief, not a new design or scope. Main has
not accepted P3. First implementation owner has stopped all source/test/report
writes and confirmed no live test process. Source review uses frozen copy
`/private/tmp/leo-dev-spec-revision-review.zTMiEE`; live source is still the same.
Before-P3 snapshot: `/private/tmp/leo-dev-spec-revision-before.Zjd5S0`.

New owner: one Sol/high worker, sole runtime + CLI-test writer. Main owns spec,
plan, guidance, live fixture, evidence integration and full regression/package
acceptance. Independent Sol/xhigh source reviewer remains separate. No other
writer may modify runtime/tests concurrently. Do not spawn subagents, install,
commit/index/push, clean/reset, modify old fixtures/caches, change defaults or add
dependencies. Use apply_patch; preserve all existing tests and original failures.

Read implementation-brief.md fully, preflight-review.md, implementation-report.md
(current matrix vs explicitly historical first handoff), and fencing-test-report.md.
Reuse current source, not a rewrite. New report: hardening-report.md. Existing
runtime ownership: changes/spec-revision.ts, commands/revise.ts, index.ts,
controller/controller.ts, controller/batch.ts, state/snapshot.ts. Own
tests/cli/codex-spec-revision.test.ts and necessary focused added cases; preserve
the independently authored state fencing assertions. Narrow necessary helper
integration is allowed, not a second workflow/batch engine.

## Confirmed source review findings (R1–R7)

Main inspected the same source and accepts these as real required fixes. Line
numbers below refer to the frozen controller unless noted. Reviewer may supply
additional findings; main will adjudicate them before expanding the fix list.

1. **Team uses raw source hash, not authority.** Lines 1710–1731 recompute
   `currentSpecHash` from file bytes and pass it to planTeamRecord. Verify raw
   file against `sourceHash`, but expose/pass `specHash/revisionId` as the team
   authority. Preserve meaningful stale diagnostics, including bound constitution
   drift. Test opening/binding a real-shaped new epoch with the versioned hash.
2. **Fresh-debug provenance still filters by task revision.** Failure counts are
   cumulative, but line 1779 excludes old claims. Use stable task-ID history for
   prior session/missing-provenance checks. Test 3 prior-version failures and
   refusal of reused/missing session provenance; do not reset budget.
3. **Current state still exposes old execution evidence.** Lines 1483–1517 choose
   latest claim/submission/Gate refs/recovery/reconciliation across all history.
   Filter current-facing fields to the latest validated revision epoch; expose
   history separately. Immediately after revision run/review contexts and current
   evidence refs must not advertise v1; subsequent v2 evidence remains current.
4. **Archive replays multiple teams as one.** Lines 1718–1723 project all earlier
   epochs together, so v1-open + v2-open + v3-revision throws 'already open'.
   Archive the immediately previous epoch or a proper per-epoch view, while
   old request-ID refusal still scans all prior epochs. Test at least 3 versions.
5. **Preparation can rebaseline input drift.** Bound full tree is read at 1638,
   but capture at 1687 records a newer tree without checking it matches approval.
   Batch capture must accept and verify expected full subject identity and bound
   source/constitution bytes before append, not bless whatever exists then. Pass
   that verified identity/remainder into the existing owner; test controlled
   between-check-and-preparation drift. Do not claim filesystem isolation against
   arbitrary external writers beyond the actual bounded checks/CAS.
6. **Input/projection collisions not rejected.** Source helper accepts any
   contained file. Spec pointing at this change's generated spec.yaml can be
   overwritten by its own activation. A receipt could likewise be at a generated
   revision output. Refuse collisions between source/constitution/plan/registry/
   assessment/receipt inputs and exact projection paths before writes. Do not
   impose an unnecessary global .leo-dev ban; normal same-path user Spec edits
   remain supported.
7. **Required recovery proof is optional / not closed.** batch.ts 113–116 returns
   when recovery metadata is absent, and history verifier does not require it.
   Require it on every spec-revision batch (pending and committed), reject it on
   unrelated kinds, and validate exact unique path/value/type/mode closure against
   projections, not just array length and membership. Otherwise a forged pending
   batch can fall back to generic hashes and bypass the remainder fence.

## Main-confirmed R8

Wrong supplied grants are not rejected by dry-run: controller computes
suppliedReceiptMatches but returns DRY_RUN before enforcing it, duplicate checks
and quiescence. Main actually supplied the old v1 spec-approval to the new
assessment-bearing revise preview: CLI returned exit 0 / DRY_RUN. Journal stayed
unchanged. Raw evidence: wrong-receipt-preview-red.json. Missing assessment/grant
may be previewed; wrong supplied inputs and admission barriers must fail as actual
activation would. Do not treat a supplied invalid grant as merely absent.

Also verify the explicit original requirement to capture available legacy Spec
bytes, or record their genuine unavailability (not merely omit all prior-source
capture); do not claim it fulfilled unless actual archive/history supports it.

## Current evidence and required remaining checks

Initial 16 CLI revision cases have not all been run together since additions.
Individually observed: basic proposal/activation, completed v1 → in-place v2 →
old review/B dependency refusal → fresh A/B Gate+review, reordered task plan,
both recovery points including expiry, mixed projections, drift/mode/third-value
refusal, no-op/task omission, active lease, direct forged event, constitution-only
and omitted retention/drift, and two real concurrent CLI activations (one winner).
Main independently reran all state tests: 42/42. These are not evidence against
the confirmed defects above. Full suite/package/live v2 are still pending.

Complete remaining mandatory matrix from the original brief: stale/duplicate/
rejected/future/expired grants and ABA; assessment history/nonready/sticky material
barriers; task closure/revisions, active/unknown/unfinished barriers; cumulative
budgets/provenance; team epoch/replay; forged committed/pending proof variants;
input collisions and no-write recovery. Group same-shape cases, do not turn this
into arbitrary helper-count or grep tests. Valid tests must be grounded in real
controller paths, not malformed fixtures that fail before the intended assertion.

TDD on each corrective seam: actual RED → smallest source fix → focused GREEN.
Do not rewrite history to pretend the initial corrected proposal fixture was
test-first; the first initial-only command RED limitation remains. Build/typecheck
and focused suites file-serial; use the available exec_command/write_stdin yield
mechanism for longer tests, not a guessed 30-second test ceiling. Main owns final
full npm test/package/actual source-loaded exercise. Report exact commands and
real remaining gaps. Ordinary unfinished work is not DONE_WITH_CONCERNS; continue
until these required fixes/checks are implemented or a concrete decision is needed.
