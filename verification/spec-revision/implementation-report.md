# P3 runtime implementation report

Status: **IN_PROGRESS** — the activation/revalidation slice passed. The prior `DONE_WITH_CONCERNS` status is retained below as historical evidence; mandatory recovery/history/fencing hardening is now active work and not accepted as P3 completion.

## Owned changes

- Added `packages/cli/src/changes/spec-revision.ts`: semantic revision identity, exact source/constitution byte snapshots, complete Lite task-revision validation, route/Gate identity construction, and bound revision approval context.
- Added public `revise` registration and command inventory integration.
- Added controller activation/proposal flow, immutable hash-named revision projection, current-route selection, current source/constitution drift checks, revision approval admission, task reset and Lite continuation.
- Extended the batch projection allowlist only for `.leo-dev/changes/<change>/spec-revisions/<sha256>.yaml`.
- Made repair attempts cumulative by stable task ID, retained monotonic lease allocation, and scoped team projection to the latest revision epoch with old request-ID refusal/archive reporting.
- Added the focused compiled CLI test file `tests/cli/codex-spec-revision.test.ts`.

## Evidence

Initial compiled command RED (before implementation):

```text
$ npm run build && npx vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts
✓ build
FAIL ... proposes a complete next task authority without writing
expected 2 to be +0
Expected: 0
Received: 2
```

This first RED used an initialized-only fixture. Per subsequent coordinator correction, that is only an entry RED: the test fixture was then changed to genuinely route the v1 plan before proposal. That corrected routed-fixture assertion was not observed RED before the implementation and must not be represented as strict TDD evidence.

GREEN:

```text
$ npm run build && npx vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts
✓ build
✓ tests/cli/codex-spec-revision.test.ts (3 tests) 21571ms
  ✓ proposes a complete next task authority without writing
  ✓ activates a granted ready assessment by resetting every current task revision
  ✓ invalidates a completed two-task Lite authority and requires new task revisions
Test Files  1 passed (1)
Tests       3 passed (3)
```

The completed-v1 test uses the compiled public CLI to route two dependent Lite tasks, perform the normal initial approval, claim/run real local Gates/submit/independent-review both tasks to `integration-review`, then modifies the original Spec **in place**, uses proposal → ready assessment → explicit test grant → actual revision, and verifies `spec-approved`, A revision 2 `ready`, B revision 2 `pending`. It then rejects an old review receipt, proves B cannot claim before fresh A, completes fresh A/B Gates and independent reviews, and reaches `integration-review` again. The v2 task order deliberately reverses A/B and current route state preserves that authoritative order. The second test also proves a quiescent routed-but-not-yet-started plan can revise; its ready-assessment dry proposal reports `missingPrerequisites: ['approval']` until a matching grant is supplied.

Additional focused state regression:

```text
$ npx vitest run --no-file-parallelism tests/state
✓ tests/state/recovery.test.ts (20 tests)
✓ tests/state/fencing.test.ts (5 tests)
✓ tests/state/transition.test.ts (11 tests)
Test Files  3 passed (3)
Tests       36 passed (36)
```

## Active hardening milestone

New RED/GREEN recovery and history work is underway. The targeted RED was:

```text
$ npx vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts -t 'refuses pending revision recovery'
FAIL: after `after-batch-prepared`, an unrelated tree write let `resume` return status 0.
```

Batch preparation now records, only for `spec-revision`, the canonical identity of the tree remainder excluding exact projection paths and exact prior/desired raw file bytes/type/mode for every projection. Pending preflight/recovery validates the remainder plus each projection as prior-or-desired before any write, allowing all-prior, all-desired and mixed projection states while refusing unrelated/source/constitution/mode/third-value drift.

GREEN for the first recovery fence:

```text
$ npm run build && npx vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts -t 'refuses pending revision recovery'
✓ build
✓ refuses pending revision recovery after an unrelated tree change
```

The focused recovery command was then extended across both batch fault points and is GREEN for an unrelated drift after preparation and proposed-source drift after projections:

```text
$ npm run build && npx vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts -t 'recovery'
✓ build
✓ 2 recovery tests passed
```

Committed revision reads now also verify the immutable revision semantic fingerprint/source snapshots, prior chain, full existing-task revision closure, assessment binding, receipt/context binding, ordered replacement routes, reset transition, and matching immutable projections; direct non-batch revision authority events fail closed.

Reducer fencing GREEN (test authored independently):

```text
$ npm run build && npx vitest run --no-file-parallelism tests/state/spec-revision-fencing.test.ts
✓ build
✓ tests/state/spec-revision-fencing.test.ts (6 tests)
```

The reducer now preserves valid old Run history but throws for each late old-revision task, lease, or old-Run mutation after a revision epoch, including an old Run spoofed with a current task-revision envelope.

### Recovery matrix (focused, current checkpoint)

| Case | Result |
| --- | --- |
| after-prepared, unchanged exact batch | passed, including grant expiry after preparation |
| after-projection, unchanged exact batch | passed |
| mixed exact prior/desired projections | passed |
| unrelated tree drift after preparation | refused with journal unchanged |
| proposed source drift after projection | refused with journal unchanged |
| projection mode drift | refused with journal unchanged |
| projection third raw value | refused with journal unchanged |
| constitution drift | not yet directly exercised |
| concurrent activations / batch CAS | not yet directly exercised |
| forged committed revision record variants | direct non-batch event covered; broader forged committed variants still pending |
| semantic no-op / omitted-existing-task proposal | passed public dry-run refusals |
| active current lease at activation | refused with journal unchanged |
| constitution-only activation, later omission retention, then drift | passed public CLI case; retained path is reported and later status conflicts |
| concurrent identical compiled activation | passed; one winner, one refusal, one revision-2 authority |

Focused pre-existing CLI suites were attempted serially, but `codex-plan.test.ts` did not complete inside the command runner's 30-second return cap (only Vitest startup was returned); it is **not passed evidence**. Main owns the full regression/package run.

## First handoff historical gaps / main judgment

This section records the activation-only handoff state and is retained for audit; it is superseded where the active-hardening evidence and current recovery matrix above say a case is now covered.

- The required broad negative matrix is incomplete: forged/direct revision events, A→B→A stale grant, source/constitution drift combinations, non-ready disposition write-only behavior, task removal/no-op variants, old lease/run mutation fencing, and concurrency have not been covered by focused tests.
- Recovery is not yet at the required conservative standard. Generic batch recovery still validates projection hashes, not the P3-specific canonical excluded-projection remainder plus each prior/desired raw type/mode. It therefore needs dedicated pending `spec-revision` recovery validation before this can be accepted as crash-safe P3 completion.
- Revision record validation on read is currently structural/shallow; full chain/provenance/CAS validation needs hardening for forged/orphan revision contexts.
- Team epoch behavior is integrated narrowly (new epoch projection, archived team, old request refusal), but lacks focused CLI coverage.
- Old task evidence is reset from the active routes, and attempts/leases are kept cumulative/monotonic. Full stale task/lease/run mutation tests remain outstanding.
- New code is roughly 200 lines of authority/command logic plus controller integration; no dependencies, install, Git/index, commit, or external side effects were introduced.
