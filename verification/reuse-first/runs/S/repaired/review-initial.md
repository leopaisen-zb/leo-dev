# Independent Initial Planning Review

## Verdict

**NEEDS_FIXES**

The proposal is strong on product scope, brownfield reuse, ownership, dependency direction, task ordering, and approval boundaries. It is not ready for controller acceptance because (1) required process-level cases are not literal enough to make the byte-level CLI suite unambiguous, and (2) the package does not disclose its use and adaptation of the assigned cc-sdd task-generation method.

This verdict is independent review advice only. It is not human/controller approval, a frozen checkpoint, implementation authorization, or feature acceptance.

## Mandatory findings

### M1 — Required process test vectors are still categorical rather than literal

- Authoritative requirement: `brief.md:19` requires executable commands and literal observable cases, and the review criterion specifically requires literal domain/process success, invalid, aggregate-overflow, and legacy-compatibility tests.
- The domain plan supplies concrete values for the principal arithmetic boundaries (`artifacts/design.md:270-277`), and the legacy process cases include literal argv JSON and byte-exact outcomes (`artifacts/design.md:288-293`).
- The batch process section gives a literal argv/result only for the single-item success (`artifacts/design.md:281-283`). Repeats, zero price, 50 items, all invalid categories, and unsafe aggregate are only named (`artifacts/design.md:284-286`). The executable task repeats the same gap: only the one-item expected line is literal, while the other process cases are labels (`artifacts/tasks-draft.md:28-32`).
- Why this is mandatory: the batch wire suite is the process-level proof for stdout bytes, newline, stderr, and exit code. A future implementer can choose different payloads—or omit the intended individually-safe-lines aggregate boundary—while still claiming the categorical bullet is covered.
- Required correction: add concrete batch CLI argv fixtures and exact expected stdout/status/stderr for at least repeats, zero price, 50 items, a representative strict-type invalid case, and the aggregate-overflow case. The aggregate case should explicitly use two individually safe lines such as two `{ "priceCents": 9007199254740991, "quantity": 1 }` items and expect exactly `{"error":"INVALID_INPUT"}\n`, status 2, empty stderr, and no partial success line.

### M2 — Assigned method inspection/adaptation is not disclosed in the proposal package

- `host-bindings.md:3,17-19` says the adapter does not replace the original method, binds this run to sequential planning, and requires reading the original rule rather than silently substituting it.
- The assigned rule requires coverage, executability, dependency, boundary, sizing, observable-completion, and bounded review-gate checks (`tasks-generation.md:84-98,112-140`) and normally advises tasks to avoid paths and signatures (`tasks-generation.md:5-22`). The fixture, however, explicitly requires concrete proposed paths and executable Node commands (`brief.md:19,24`), so this is an important, justified adaptation that must be disclosed.
- The proposal records sequential mode (`artifacts/tasks-draft.md:5`) and records only the omission of web research (`artifacts/research.md:30-35`). Its research source log lists the fixture inputs but not `host-bindings.md` or the assigned `tasks-generation.md` resource (`artifacts/research.md:16-28,81-85`). No artifact names the task-generation method, states which review-gate checks were applied, or explains the path/command adaptation.
- Required correction: add a concise method/adaptation record to the proposal package naming the exact assigned resource, the applied coverage/executability/order/dependency/boundary/observable-completion checks, sequential-mode handling, proposal-only `tasks-draft.md` handling, and why concrete paths/commands are retained despite the upstream natural-language default. Also state that optional test marking was inapplicable because constitution C4 makes the named suites mandatory.

## Optional preferences

None. No style-only changes are required, and extra prose or templates would not improve the verdict.

## Eight-item evidence matrix

| # | Result | Evidence and assessment |
|---|---|---|
| 1 | PASS | The five stable requirement groups and 19 acceptance IDs cover the eight brief clauses without a second ID inventory (`artifacts/requirements.md:17-69`); design traceability uses the same IDs (`artifacts/design.md:126-148`). C1 is carried by strict validation/compatibility, C2 by reuse/no dependencies, C3 by CLI/domain separation, C4 by mandatory validation, and C5 by proposal-only status (`artifacts/requirements.md:3,28-39,52-69`; `artifacts/design.md:39-51,262-299`). No invented product surface was found. |
| 2 | PASS | Existing strict arithmetic is correctly identified in `src/quantity.mjs:1-7` and `src/cart.mjs:3-15`; the proposal imports only `totalCents`, leaves all three legacy modules unchanged, and adds no dependency/engine/service/rewrite (`artifacts/design.md:39-44,84-103,167-198`). |
| 3 | PASS | Ownership and exclusions are concrete (`artifacts/design.md:24-44`), actual versus proposed files are explicit (`artifacts/design.md:84-103`), CLI/domain responsibilities are separated (`artifacts/design.md:158-232`), and revalidation triggers are change-based (`artifacts/design.md:46-51`). |
| 4 | FAIL | Proposed ESM paths and commands are executable-looking and tests are honestly unrun (`artifacts/design.md:262-299`), but literal batch process vectors are incomplete as detailed in M1 (`artifacts/design.md:281-286`; `artifacts/tasks-draft.md:28-32`). |
| 5 | PASS | The sequential graph is bounded, ordered, sized, requirement-mapped, and has observable done conditions (`artifacts/tasks-draft.md:5,9-60`). The cross-boundary CLI task declares dependencies (`artifacts/tasks-draft.md:44-52`), and validation closes the graph (`artifacts/tasks-draft.md:54-60`). The draft explicitly awaits independent review (`artifacts/tasks-draft.md:3`). |
| 6 | PASS | Requirements/design/tasks consistently say proposal/unapproved and do not claim implementation or test execution (`artifacts/requirements.md:3`; `artifacts/design.md:3,264`; `artifacts/tasks-draft.md:1-5`). No second authority, settings/state system, or upstream-native invocation claim appears. |
| 7 | FAIL | The output reflects parts of the method but does not document actual inspection or the important path/command adaptation; see M2. Merely matching sequential syntax (`artifacts/tasks-draft.md:5`) is not evidence of comprehension. |
| 8 | PASS | The package treats the brief, constitution, and existing modules as authoritative, proposes only new files, and distinguishes planning from approval/implementation (`artifacts/research.md:16-21,81-85`; `artifacts/design.md:3,101-103`; `artifacts/tasks-draft.md:3`). |

## Independent task-graph/readiness checks

- **Coverage:** all 19 IDs in `requirements.md`—1.1–1.4, 2.1–2.6, 3.1–3.4, 4.1–4.3, and 5.1–5.2—also occur in `tasks-draft.md`. No orphan requirement ID was observed.
- **Ordering/dependencies:** tests precede implementation at each boundary; batch CLI integration follows the domain boundary and both process test tasks; the final combined validation depends on all implementation/test tasks (`artifacts/tasks-draft.md:9-60`). Sequential mode makes `(P)` omission correct.
- **Boundaries:** domain, batch process, legacy compatibility, and cross-boundary validation are separately labeled. Task 2.3 is correctly treated as integration and explicitly depends on 1.2, 2.1, and 2.2 (`artifacts/tasks-draft.md:44-52`).
- **Executability/observable completion:** each executable task states a command or observable completion condition. Proposed tests/modules are absent, consistent with the declared planning-only state; therefore no nonexistent proposed test command was run.
- **Arithmetic:** a read-only Node diagnostic confirmed `Number.MAX_SAFE_INTEGER * 1` is a safe line and adding two such lines is not a safe integer, so the proposed aggregate-overflow boundary in `artifacts/design.md:277` is sound.
- **Legacy evidence:** read-only child-process diagnostics against the actual `src/cli.mjs` produced `{"totalCents":200}\n`, status 0, empty stderr for the valid case, and `{"error":"INVALID_INPUT"}\n`, status 2, empty stderr for the strict-type invalid case. This checks the current baseline only; it is not execution of proposed tests or proof of future compatibility.

## Methods selected and omitted

- **Selected:** the original cc-sdd `Task Generation Rules`, adapted through `host-bindings.md`, specifically its coverage review, executability review, ordering/dependency review, boundary review, sizing/hierarchy review, observable-completion check, requirements mapping, and bounded readiness gate.
- **Selected adaptation:** sequential mode; proposal-only `tasks-draft.md`; read-only independent review; numeric requirement IDs retained as the only traceability keys; concrete paths and commands retained because the fixture expressly requires them.
- **Skipped as inapplicable:** parallel analysis and `(P)` marking, because `host-bindings.md:17` requires sequential mode.
- **Skipped as forbidden/inapplicable:** optional marking of required test work, because constitution C4 (`constitution.md:8`) makes the invalid/overflow/process/compatibility checks mandatory.
- **Skipped as role-inappropriate:** author-side review-and-repair and writing final `tasks.md`; this reviewer is read-only and must return findings to the root coordinator (`host-bindings.md:10,25`).
- **Not loaded:** Spec Kit and unrelated authoring workflows, per the controlled review brief and host binding.

## Unresolved ambiguities

No unresolved product-semantic ambiguity was found. The two failures are repairable planning-evidence gaps and do not require a new product decision.

## Actual read and diagnostic evidence

- UTC review window: **2026-09-11T03:00:49Z to 2026-09-11T03:05:51Z**.
- Completely read: `review-initial-brief.md` (19), `brief.md` (24), `constitution.md` (11), `host-bindings.md` (25), `src/quantity.mjs` (7), `src/cart.mjs` (16), `src/cli.mjs` (28), `artifacts/requirements.md` (69), `artifacts/design.md` (299), `artifacts/research.md` (85), `artifacts/tasks-draft.md` (62), and the assigned original `tasks-generation.md` (222).
- Read-only checks run: exact requirement-ID set comparison; readability/existence checks for the four review inputs; absence checks for proposed implementation/test paths; Node safe-integer arithmetic diagnostic; Node version check (`v25.8.2`); two current legacy CLI child-process probes.
- Proposed batch tests were not run because their files do not exist and implementation is not authorized.
- Token usage: **null** (unavailable).
- Cost: **null** (unavailable).
