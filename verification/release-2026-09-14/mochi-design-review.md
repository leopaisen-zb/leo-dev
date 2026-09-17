# Mochi Board preimplementation design review

**Verdict: NEEDS_FIXES.** The v1 scope is implementable, but two executable-contract contradictions and the missing M3 evidence gate must be repaired before a milestone can be accepted. This is a read-only review; it makes no claim that an upstream engine or a Spec Kit command ran.

## Binding and source consumption

The host binding is `docs/method-binding.md`: requirements are `docs/spec-v1.md` until the controller records the v2 revise activation, then `docs/spec-v2.md`; design is `docs/design.md`; routed tasks are `plan-v1.json` or `plan-v2.json`; constitution/project rules are `AGENTS.md`; the fixed HTTP oracle is `tests/acceptance.test.mjs`; gates are `core/gates/default.yaml`. The fixture already has `.gitignore` for `.data/`.

I consumed these pinned source resources:

- `references/upstream-methods.md`.
- cc-sdd requirements `kiro-spec-requirements/RESOURCE.md`, `ears-format.md`, `requirements-review-gate.md`, and `templates/specs/requirements.md`.
- cc-sdd design `kiro-spec-design/RESOURCE.md`, `design-principles.md`, `design-discovery-light.md`, `design-synthesis.md`, `design-review-gate.md`, and `templates/specs/{design,research}.md`.
- cc-sdd tasks `kiro-spec-tasks/RESOURCE.md`, `tasks-generation.md`, and `templates/specs/tasks.md`.
- Spec Kit `templates/commands/analyze.md`.

The binding deliberately replaces upstream metadata, task files, commands, and hooks with existing canonical files and controller gates. No `.kiro`, `.specify`, upstream command, engine, hook, or approval automation was created or run. The fixture inventory contains no `.specify/extensions.yml`.

## Findings

| ID | Kind | Severity | Contract / source | Finding | Necessary fix |
| --- | --- | --- | --- | --- | --- |
| F1 | contradicts | HIGH | `docs/spec-v2.md:26`; `tests/acceptance.test.mjs:293-295` | Requirement 2.4 says mutation requests without `application/json` return 415. The frozen oracle sends a headerless `DELETE` and requires 204. Both cannot hold. | State that the media-type rule applies only to mutations with JSON bodies, or change the oracle/request contract so delete supplies and requires the chosen media type. Keep the repaired rule in both v1 and v2. |
| F2 | contradicts | HIGH | `docs/spec-v2.md:50,58`; `plan-v1.json:94-99`; `plan-v2.json:94-99` | M5 is explicitly verification-only with no implementation changes, while both plans give M5 write authority for `public/app.js`. | Set M5 `allowedPaths` to an empty list (or use a controller-level verification-only representation). A post-M5 source edit must require a new implementation task and another full verification run. |
| F3 | partial | HIGH | `docs/spec-v2.md:36,50,56`; `plan-v2.json:53-58`; `core/gates/default.yaml:38-51` | M3 requires real-browser screenshot and interaction evidence; the M3 plan calls for independent browser acceptance, but its only configured gate is `node --check public/app.js`. No configured M3 acceptance step makes keyboard/dialog/filter/mobile evidence a required receipt. | Add a controller-owned M3 browser-evidence gate or an explicit mandatory receipt contract with the named flows and 390px check. Do not accept M3 from the syntax gate alone. |
| F4 | contradicts | MEDIUM | `docs/spec-v2.md:56`; `plan-v1.json:47-51`; `plan-v2.json:47-51` | The task ownership text assigns `public/mochi.svg`, while M3 and M4 authorize `public/favicon.svg`. A worker obeying allowed paths cannot create the named art asset. | Replace `public/favicon.svg` with `public/mochi.svg` in M3. Remove the unrequested favicon from M4 unless M4 actually owns a pre-existing asset update. |
| F5 | partial | MEDIUM | `docs/method-binding.md:5`; `docs/spec-v2.md:34,60`; `plan-v2.json:5-105`; `core/gates/default.yaml:4-84` | v2 changes the required search predicate to title-or-notes and says every task needs fresh evidence. The v2 plan changes only `revision`; M3 still says only “current specification search semantics”, and its executable gate remains syntax-only. There is no explicit revise receipt that invalidates v1 evidence, names the title/notes search scenario, and records the rerun set. | At v2 activation, have the controller record the exact v2 approval/activation receipt, mark all v1 task evidence stale, require the M1/M2/M4 HTTP reruns plus the M3 browser scenario with notes-only match, and only then permit M5. This is a controller record, not a fabricated new user decision. |
| F6 | partial | MEDIUM | `docs/design.md:9-13,36-38`; `plan-v1.json:13-104`; `plan-v2.json:13-104` | The design requires graceful SIGTERM/SIGINT handling that settles in-flight writes, but no milestone acceptance statement or configured check owns it. The design also only refers to exact API contracts rather than mapping requirements to server/store/browser and their validation evidence. | Add an M1/M5 source-and-runtime verification item for shutdown behavior and a concise traceability/evidence map. This supplies the design-review gate’s required interface, failure-mode, and validation linkage without adding a second specification system. |
| F7 | partial | MEDIUM | `docs/spec-v2.md:13-17,23-26,42-44`; `tests/acceptance.test.mjs:199-365`; `core/gates/default.yaml:4-84` | The frozen HTTP suite is useful but does not itself cover several declared contracts, including default port/data startup, invalid-but-parseable persisted data, and the 415/413/foreign-Origin cases for import. It also cannot prove M3 browser behavior. Passing it must therefore not be reported as complete API/UI conformance. | Preserve the immutable oracle. Add explicit supplemental checks or a source-review checklist to the relevant milestone evidence, and report the frozen suite as one input rather than the complete contract. |

## Coverage and task graph

| Requirement area | Routed task | Review result |
| --- | --- | --- |
| M1 persistence and creation | M1 | Covered; F6 and F7 add missing verification linkage. |
| M2 update, history, request boundary | M2 | Covered; F1 is a blocking contract conflict. |
| M3 board and accessibility | M3 | Covered in intent; F3, F4, and F5 make execution/evidence incomplete. |
| M4 snapshots | M4 | Covered in intent; F4 removes an unrequested path and F7 identifies supplemental evidence needed. |
| M5 aggregate verification | M5 | Dependency graph is correct; F2 must make it truly verification-only. |

The sequential graph `M1 -> M2 -> M3 -> M4 -> M5` is coherent for the declared shared server/UI ownership. M4 crosses store, server, and browser boundaries, so it is an explicit integration milestone in practice and must preserve the earlier task paths. No independent parallel execution claim appears in the plans.

## Approval boundaries

- The user-delegated local exercise and private release scope are recorded in `docs/method-binding.md`; this is sufficient scope for the coordinator to prepare and repair the local example.
- The coordinator, not a worker or this review, owns controller routing, the immutable acceptance oracle, milestone acceptance, defect injection/rejection/repair evidence, and the planned interrupted-M3 continuation (`AGENTS.md:3`, `docs/spec-v2.md:50,55-60`). Those exercises are workflow evidence, not product claims.
- v2 must remain a candidate until the controller records its dedicated revise activation after M1/M2. A text review PASS and a task `revision: 2` field are not that activation and do not supply fresh evidence.
- This review authorizes neither external publication nor any edit. It does not request a new human product decision; F1, F2, F3, and F4 are local consistency repairs within the already delegated scope.

## Optional improvements

- The requirements are concrete and mostly use `shall`, but they are not uniformly normalized to the upstream EARS form. Under `upstream-methods.md`, preserve their existing IDs and meaning; normalize only if the coordinator wants documentation consistency.
- Record whether a normal 204 delete intentionally has no JSON response body. The oracle already checks this and it removes a likely future ambiguity.

Repair F1-F4, record the v2 activation/evidence rule in F5 when the controller reaches that point, then repeat this read-only consistency review before implementation acceptance. F6-F7 may be repaired through the controller’s evidence contract; they do not require app code.

## 2026-09-14 re-review addendum — prior verdict preserved

The prior **NEEDS_FIXES** verdict records the pre-repair state. The repaired fixtures resolve F1-F7; there is no remaining design, task-plan, or oracle-contract finding that blocks implementation under the stated host evidence contract.

| Prior finding | Re-review result | Evidence |
| --- | --- | --- |
| F1 | Resolved | Both specs now distinguish JSON-body POST/PATCH media-type enforcement from a bodyless DELETE, which requires no `Content-Type` and returns 204 with no body. This matches the immutable oracle’s headerless DELETE at `tests/acceptance.test.mjs:293-295`. |
| F2 | Resolved | `schemas/task.schema.json:12` requires a nonempty `allowedPaths` list. M5 now permits only `.leo-dev/runtime/mochi-board/evidence`, explicitly excludes application-source writes, and remains subject to the controller’s verification-only candidate fence (`packages/cli/src/controller/controller.ts:1350-1354`). |
| F3 | Resolved | Both specs, both plans, and `docs/design.md:40-50` require an independent, candidate-bound, platform-labelled browser report with screenshots and the named create/edit/status/delete, Escape/focus restoration, combined filter, text-injection, failure-recovery, and 390px checks. The syntax gate is explicitly insufficient. This is a mandatory evidence receipt, not a claim that a screenshot parser ran. |
| F4 | Resolved | M3 and M4 now authorize `public/mochi.svg`, matching the stated asset ownership. |
| F5 | Resolved as a future activation contract | v2 M3 names a notes-only, case-insensitive match; the design requires public revise to preserve v1 evidence and demand fresh M1/M2/M3/M4/M5 results. This remains a future controller action and is not presented as a current approval record. |
| F6 | Resolved | The traceability table assigns M1’s default-path, parseable-invalid-state, and shutdown review, while preserving the fixed oracle as the main HTTP check. |
| F7 | Resolved | M4 now requires independent import 415/413/foreign-Origin boundary checks; the design separates frozen HTTP, browser, source, and runtime evidence rather than treating one suite as complete conformance. |

The current frozen oracle SHA-256 is `152ab74d2ffca5632d8f75e175408cf99f97eb337e1fbcd7c39bca90e91d576e`, matching its author report. No test, application source, controller, or specification file was changed by this re-review.

This is only a preimplementation consistency result. M3 still cannot be accepted until its independent browser receipt exists and is candidate-bound; M5 and any private release still require their actual gates, reviews, revision fencing when v2 is activated, and controller admission. Those are scheduled evidence requirements, not remaining design blockers.
