# P3 — approved all-task revalidation

Read this first. This is the exact task contract extracted from the sole plan's P3 section; normative authority is `.scratch/unified-development-plugin/spec.md` v1.7.0. The user accepted conservative all-task revalidation and continuation. No competing spec/ledger or broad framework survey.

## Ownership and boundaries

One worker owns `packages/cli/src/changes/spec-revision.ts` (new cohesive authority/proposal helpers), `commands/revise.ts`, necessary controller/index/batch/snapshot integration, and `tests/cli/codex-spec-revision.test.ts` plus focused state-reducer cases. Narrow existing public command-inventory expectations may change to include the command. Main owns the sole spec/plan, workflow references, README, isolated live acceptance and package verification. Do not edit main-owned files. You are not alone in the codebase: preserve all other edits; no cleanup/reset, commits, Git index writes, installs, process defaults, new dependencies or subagents.

Before snapshot: `/private/tmp/leo-dev-spec-revision-before.Zjd5S0`. There is no Git HEAD; use filesystem comparisons, not invented commit diffs. Prior full-suite evidence is 358 Node tests plus 6 Python tests on P1/P2; it is not evidence for this task. While iterating run focused tests only; main owns the final full run.

## Single public operation

`revise --change <id> --spec <repository-path> --plan <repository-path> [--constitution <repository-path>] [--registry <repository-path>] [--assessment <runtime-path>] [--receipt <path>] [--dry-run]`

Reuse the existing JSON envelope, error mapping, write/dry-run dispatch and finite controller batch recovery. `--spec` and `--plan` are required. Use `--registry` consistently with route; absent override must retain a uniform existing registry, or refuse ambiguous current registries rather than guessing. Constitution omission retains the active bound document, or null on legacy v1. There is no remove-constitution switch in this slice. No automatic source/config/code writes.

Read-only proposal without assessment/receipt returns `DRY_RUN` with `command: revise`, `writes: []`, and `revisionContext`: next revision, previous revision identity, normalized source/constitution identities, exact normalized tasks/routes, proposed authority hash, proposed whole-plan assessment context and missing prerequisites. A proposal with a ready supplied assessment also exposes `revisionApprovalContext`. The approval context is not fabricated from a caller's requested hashes: it is derived by the controller. Missing approval/assessment may be previewed, but actual activation requires both. Wrong supplied inputs fail in dry-run as they would on execution.

The two-pass caller sequence is proposal dry-run → create assessment in the current runtime → ready-assessment dry-run → obtain explicit grant using returned approval context → actual revise. Only one user approval is requested. A normal spec-approval receipt cannot stand in for this operation.

## Proposal, approval and authority

Represent a revision as an immutable record in `.leo-dev/changes/<change>/spec-revisions/<revisionId>.yaml`, projected by the existing batch owner. Extend the existing projection allowlist only for this exact hash-named child location. New source/constitution snapshots retain exact bytes (base64 is acceptable), file paths and SHA-256. If the initial legacy source's original bytes are still available, record them; if only its committed hash survives, explicitly record that limitation rather than inventing old content. Preserve original `controller.initialized` and its baseline.

Use a canonical fingerprint of the semantic proposal as `revisionId` and current authority `specHash`. Proposal includes schemaVersion 1, monotonic change revision (legacy=1), prior authority identity, source path/raw SHA-256, constitution path/raw SHA-256 or null, and the normalized complete routes/tasks/gate-definition identities. Do not include JSON property ordering or serialization whitespace in semantic identity. Task order is meaningful as in P2. `sourceHash` continues to mean the raw Spec file hash in existing manifest/spec artifacts; public state distinguishes sourceHash from the versioned authority hash. Including previous authority/revision prevents an A→B→A text change from reviving old evidence.

Approval reuses the existing approval schema with `scope: change`, `operationKind: spec-revision`, `decision: grant`, matching changeId and no task scope. Context binds revisionId, previous committed journal tail, current subject tree, ready assessment fingerprint, route Gate definitions, repository cwd and the existing empty argv/environment conventions. `inputFingerprint` is the proposed authority hash. Validate grant time/expiry at admission; reject missing, rejected, future, expired, duplicate or stale-context receipts. Preserve `issuerAuthenticated: false`; this is not cryptographic identity verification. Store the consumed receipt and approval binding with immutable revision evidence.

The ready assessment must bind `taskId = plan:<fingerprint(validated new tasks)>`, proposed authority hash, current subject tree and changeId. Reuse `assess`, normalized evidence validation and linked history. All previous assessment obligations remain; material/unknown/partial/local-high disposition is not reset by changing Spec. An actual valid-but-nonready assessment records only the immutable assessment/refusal, as route does, never any revision/route/approval. Subsequent approval context must reflect the new journal tail. No assessment omission bypass, even for a legacy previously unassessed plan.

Preflight clarification (normative for this brief): use `decisionFingerprint = fingerprint({operationKind: 'spec-revision', changeId, revisionId, previousJournalTailHash, subjectTreeHash, assessmentFingerprint})`, `gateDefinitionFingerprint = fingerprint(task-order route tuples {taskId, gateId, gateDefinitionHash})`, `argvFingerprint = fingerprint([])`, `cwdFingerprint = fingerprint(repositoryRoot)`, `environmentFingerprint = fingerprint([])`, `inputFingerprint = revisionId`. The semantic proposal hash excludes its own identity field, approval, assessment, raw snapshot encoding and projection/recovery metadata.

## Version activation and downstream fencing

Introduce one `controller.spec.revised` operation in a `spec-revision` batch. The immutable revision record, fresh ready assessment and approval, manifest/spec/task projections, all replacement route operations and change transition to `spec-approved` belong to one batch. Existing code is untouched. The new `spec-approved` state follows the revision grant; do not auto-approve design or run Gates. Use the implemented Lite path `spec-approved → task-ready → executing`. The current controller does not supply the inputs needed by Standard/Full design-review/design-approved edges; do not add or claim those seams in P3.

Existing IDs must all appear exactly once at prior task revision +1; new IDs may appear at revision 1. Do not silently remove/retire tasks in this slice. Reuse Lite validation, nonempty acceptance, exactly one declared Gate, normalized paths, valid dependencies and acyclic full plan. Replacement roots are `ready`, dependent tasks `pending`; no `done` is carried over. Reject non-Lite, reused/skipped task revisions, missing old IDs or precompleted plans. Ordinary route still requires task revision 1; do not weaken its contract. Reject a no-op proposal apart from incremented task revision/state bookkeeping.

Resolve current authority and current routes from the latest validated revision while retaining earlier logical history. Historical Gate/review-recovery verification must continue using the authority/routes valid in that earlier prefix, not the new active source. Candidate registration, source drift, governance, approval/review context, submit/review/recovery and dependency unlocking must bind the current version; no latest old Run/submission may appear as current evidence before a new claim. Historical evidence remains separately inspectable. Spec/constitution files are protected from implementation candidate edits like the existing Spec/registry paths.

Keep repair accounting cumulative by stable task identity across these revisions; previous failures cannot be erased by a revised Spec. Fresh-debug provenance checks must include those earlier claims. Lease generation remains monotonic. Do not permit ordinary `done → pending`; new route authority is the reset. Once a revised task is current, a late old-revision task/lease/run mutation must fail closed rather than clear its current lease or change task completion. Retain unique old Run history. Do not opportunistically restructure all legacy events or tighten unrelated legacy behavior.

Reducer test clarification: a corrupt post-revision mutation is rejected (throws), not silently ignored as a valid committed journal. Test each stale frame against an independent valid prefix, including a late transition targeting its own old Run; one first failure must not mask other event types. A reducer-only authority stub is not controller-provenance evidence. Use route replacement as reset, never invent a `revisionReset` ordinary task-transition flag or embed later claims inside the revision batch.

Team records stay immutable. Use the validated Spec revision as the team epoch boundary: current team projection/record planning sees only the new revision's team events, so a host must explicitly open/rebind a new team with the new authority hash. Old request/message/member generations cannot act as current bindings. Explicitly refuse request IDs used before the current epoch rather than replaying their historical response as a current request. Expose the last historical team separately or as archived evidence; do not fabricate replacement agents or transfer their messages automatically. No second team engine or global protocol/default change.

## Admission, replay and recovery

Reject activation on archived changes, unresolved decisions or unresolved blocked/approval-required states, active leases (including expired leases not explicitly released), running/unknown Runs, unfinished Gate lifecycle, incomplete journal tail, pending Controller batch or pending Gate handoff. Do not repair these implicitly. Already recorded material governance refusal remains blocking. Use existing barriers and CAS; two concurrent revision requests must not both activate the same old version. All tasks being done is NOT an admission requirement: an already routed but not-started ready/pending plan is quiescent and may revise. The completed-v1 happy path proves old success invalidation, not a new prerequisite for Spec convergence.

Validate revision record structure, fingerprints, prior chain, exact task revision increments/full closure, route/assessment/approval operations and batch provenance on read; direct/orphaned/duplicate/forged revision contexts fail closed. Prepared revision stays logically inactive until commit. Recovery validates the exact pending revision and its grant as of its original preparation, plus current source/constitution/tree and prior-or-desired projections, before any recovery write/truncation. An expired grant after preparation does not authorize a new proposal, but may finish that already authorized exact batch if all bound inputs are unchanged. Use original batch/tail and one commit, never regenerate authority/receipt or reset history. Wrong input drift and third-value artifacts refuse without overwrite. Validate dry-run recovery identically with zero writes. A repeat actual `revise` using a consumed receipt should refuse; recovery is through existing `resume`, not a second retry mechanism.

Recovery preflight clarification (normative): at preparation bind the ordinary full `subjectTreeHash` in the assessment/receipt AND capture the canonical tree identity of the remainder excluding only the exact projection paths. At recovery require that remainder to be unchanged and validate each excluded projection's prior-or-desired raw value, type and mode (mode participates in existing tree identity). This must support all-prior, all-desired and mixed states: `.leo-dev/changes/**` is included in the ordinary tree, so legitimate projection writes cannot be compared directly against the pre-activation full tree. Do not change the global ignore policy, store unrelated file bytes or add a recovery engine.

## Required behavioral checks

Start with compiled CLI RED for the valid behavior, not merely grep or unknown-option text. A complete approved v1 fixture has two dependent tasks with Gate/review evidence. Desired test sequence:

```ts
const before = await snapshotUserAndHistory(root);
const proposal = cli(root, 'revise', '--change', id, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
expect(proposal.status).toBe(0);
// Manually checked fixture tasks A/B: revisions 2, A ready, B pending.
const applied = await activateWithReadyAssessmentAndExplicitGrant(root, proposal);
expect(applied.state.changeState).toBe('spec-approved');
expect(applied.state.tasks.A).toMatchObject({ revision: 2, state: 'ready' });
expect(applied.state.tasks.B).toMatchObject({ revision: 2, state: 'pending' });
expect(await userBytes(root)).toEqual(before.userBytes);
expect((await journalBytes(root)).startsWith(before.journalBytes)).toBe(true);
// Old review must fail; complete both new Gates/reviews before integration.
```

Helpers here describe test responsibilities, not existing functions. Implement real controlled fixtures with literal desired identities/states, real compiled CLI, real journal and Gate; do not compute expected results with the production revision builder. A bounded synthetic grant is labelled as a test grant, not actual human issuance.

Cover: v1→v2 full revalidation and new independent review; constitution-only change and later source/constitution drift; A→B→A old-approval refusal; all task IDs/revisions/dependencies/gates; no-op rejection; missing/stale/expired/future/duplicate approval and missing/stale/nonready governance; history/repair budget/lease fencing; active/unknown/pending barriers and zero-write dry-run; direct/forged/stale journal events; both `after-batch-prepared` and `after-batch-projection` recovery, source drift/third-value refusal, two concurrent activation requests; old-team archive + explicit new-epoch opening. Group same-shape negatives; do not inflate test count for trivial getters or source text.

Run build/typecheck, focused new CLI and affected state/governance/plan/team checks file-serial. Save exact RED/GREEN commands and outputs in `implementation-report.md`; identify any later-added tests without pretending they were preimplementation RED. Main subsequently runs full regression once source/review stabilizes, verifies isolated package relocation and a bounded actual source-loaded revalidation exercise. Do not rerun the old N/S/C trial or original live fixture.

## Preflight decisions and report

Ruling: reuse batch/state/assessment/receipt ownership rather than an upstream execution engine; original methods cannot perform this repository's authority transition. Cost is a narrowly owned new command/authority helper and explicit new-epoch bindings, not a generic workflow DSL. Ruling: all old IDs stay and consumed budgets remain; task removal/selective carry-forward/material-scope override are not implicitly authorized by a normal revision. Cost is conservative extra revalidation and a visible refusal for exhausted tasks until separately scoped action. Ruling: archive newly available bytes but do not claim legacy snapshots that never existed.

Report status DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT with actual files, commands, RED/GREEN, remaining gaps, approximate added logic and any divergence needing main judgment. No self-approval, no commits. Escalate a load-bearing contract contradiction before broad code changes.
