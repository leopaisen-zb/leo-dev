# C2 — Codex-first production execution seam

Date: 2026-09-09  
Status (updated 2026-09-10): bounded source regression/static review passed historically, but actual authorized Codex exercise failed workflow acceptance on expired submitted-lease recovery. Overall C2 remains incomplete; production source is unchanged. See [current live report](live-20260910/README.md).

## Delivered source scope

One existing Node/TypeScript controller and journal remain the execution authority. No upstream engine, new runtime dependency, second scheduler, model launcher, global setting or installed plugin was introduced.

1. `claim --session` records the input tree and execution-context label. `run-gates --run` separately binds the completed candidate; stale Run identity, later drift and out-of-scope changes are refused.
2. A candidate-bound rejected review is recorded as rejection, not completion. Gate failures, rejected reviews and reconciled failures share the task/revision budget: initial attempt, two remediations, then a fresh-context debug attempt. Labels remain unauthenticated metadata.
3. `route --plan` records one immutable Lite dependency plan. Tasks run serially; only accepted predecessors unlock successors. Completion of the whole plan enters integration review, not release-ready.

The user-facing workflow remains `develop`. Source guidance is in `skills/develop/references/lifecycle.md`. Generated client packages are thin skills/manifests; they do not install the controller runtime.

## Evidence and revision boundaries

| Evidence | Observed result / limit |
| --- | --- |
| Original segmented baseline | 279 Node/TypeScript tests passed; the initial combined npm invocation did not retain its terminal result, so no combined exit-0 claim is made |
| First frozen completion candidate `0f644b09…` | 137 CLI/skill + 161 core + 8 adapter = 306 Node/TypeScript checks passed; typecheck passed |
| Independent candidate regression | 10/10 passed after reproducing and fixing historical pre-registration reconciliation -> submit -> review stranding |
| Source guidance | 6 static contracts, official skill quick validation, four generated adapter packages and source-only forward retrieval passed; not actual Agent execution |
| Python compatibility | 6 doctor + 13 historical experiment tests passed; experiment invocation initially omitted required PYTHONPATH, corrected without source/assertion changes |
| Final source `f8dbd2c5…` after abandonment/recovery hardening | Build/typecheck passed; 161 core + 8 adapter + 141 CLI/skill = 310 passed, zero failed/skipped; 6 doctor + 13 historical Python tests passed; bounded independent source review accepted |
| Real controlled Codex application exercise, 2026-09-10 | Authorized and run through A implementation/Gate/submit/independent code review; workflow acceptance failed after lease expiry. Different Node launchers also caused a reproducible status conflict. B/C, injected repair and fresh-context continuation not run |

The 306-test checkpoint did not cover a safe-abandoned budget bypass found by independent review. The accepted narrow correction permits zero-cost safe abandonment only for a bound never-released `not-started` attempt; released/inconsistent receipts fail closed. The first added test failure was an invalid fixture identifier, not behavioral RED. A later controlled mutation removed only that guard and showed the corrected three cases failing; restoring it made them pass. This is post-fix mutation evidence, not a retroactively claimed TDD sequence.

Restoring positive recovery coverage exposed a further seam: a valid committed safe-abandoned reconciliation must remain resumable although its historical Gate prefix has no raw terminal. The final source requires the exact historical Run context, committed reconciliation and old lease-fence proof, without accepting unrelated or released unfinished attempts. Positive lease-fencing and crash/replay assertions were preserved, including two same-task abandonments, repeated byte-idempotent resume and increasing claim generations. These no-release prefixes are labelled synthetic histories, not actual pre-release operating-system crashes.

Detailed evidence:

- [Implementation report](implementation-report.md)
- [Final frozen-source verification](final-verification.md): [core JSON](final-core-v2.json), [adapter TAP](final-adapter-v2.tap), [CLI/skill JSON](final-cli-v2.json)
- [Candidate tests and fixture provenance](candidate-tests-report.md)
- [Initial candidate review](candidate-review.md), [plan/budget review](plan-budget-review.md), [final review](final-review.md)
- [Pre-hardening full CLI/skill JSON](final-cli-regression.json), [core JSON](core-regression.json), [adapter TAP](adapter-tests.tap)
- [Source/package checks](source-checks.md), [historical experiment rerun](experiment-regression.md)

## Controlled live exercise and approval boundary

The owned fixture is `/private/tmp/leo-dev-codex-live.Kp2bmq`, seeded from `live-seed/`. It contains quantity validation -> integer-cent cart calculation -> JSON CLI tasks, fixed public tests and a separate review oracle. Seed tests deliberately fail on behavioral assertions. It was initialized/routed using the intermediate frozen runtime `/private/tmp/leo-dev-c2-runtime.jiIyLy` and stopped in `spec-review`.

The safety reviewer rejected manufacturing a human-confirmed receipt from generic “开工吧” authorization. Main requested explicit permission for this local test specification. No receipt was written, no task claimed, no alternate approval path used. All ten seed files, Git HEAD and index presence remain unchanged: [preservation result](live-preservation.json), [boundary record](live-blocker.md), [actual CLI operations](live-cli-before-approval.json).

The preceding paragraph describes the historical 2026-09-09 stop only. On 2026-09-10 the user explicitly authorized the isolated test, so a new final-source runtime was pinned and the real CLI accepted approval. Actual A implementation and separate code review ran; expired submitted-lease recovery then blocked workflow acceptance. No passing review was manufactured and no replacement fixture hid the failure. The fixed whole-project tests now report 2 passing A tests and 4 failing unimplemented B/C tests. Current evidence, preservation and unrun cases: [live report](live-20260910/README.md). The earlier 310 source tests do not override this result.

## Not claimed

- Full v1, Standard/Full execution, composite assessed multi-task plans, automatic architectural-debt discovery, or autonomous repair of arbitrary debt.
- Actual fresh Codex installation/loading, Claude/Cursor runtime validation, Linux or Node 20 runtime validation, full-stack production validation, training quality, or Agent/RAG evaluation.
- A complete cc-sdd/BMAD/Spec Kit workflow-engine integration. C1's pinned upstream/source trial remains historical; staged resources and a consumed review checklist are not a complete engine.
- Cryptographically authenticated local users/sessions, filesystem sandboxing by allowed paths, independent CI/release readiness, deployment or publication.

The installed entry remains `/Users/leo/.codex/plugins/cache/personal/leo-dev/0.1.0+codex.20260826035617`; no install/update operation ran. Historical approval and installed entry hashes are preserved in `source-checks.md`. The repository has no HEAD and pre-existing files are untracked; review used the actual before-state snapshot `/private/tmp/leo-dev-c2-baseline.D6NyCk`, not an invented commit range. No commit, push, reset, cleanup or publication was performed.
