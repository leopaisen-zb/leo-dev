# Independent Planning Review — Challenge C

## Verdict

**NEEDS_FIXES**

The proposal is otherwise concrete, bounded, fully traced, and honestly unrun, but `artifacts/design.md:288-290` adds an unauthoritative amendment that conflicts with the established legacy wire contract and attempts to make constitution-mandated validation and compatibility checks optional. Because both conflicts violate non-negotiable constitution principles, the draft is not ready for controller or implementation approval.

Reviewer readiness is analysis evidence only. It is not human approval, feature acceptance, controller acceptance, implementation permission, or a checkpoint freeze.

## Mandatory Findings

| ID | Category | Severity | Exact location(s) | Finding | Required correction |
|---|---|---|---|---|---|
| C1 | Constitution / inconsistency | CRITICAL | `artifacts/design.md:288-290`; `src/cli.mjs:24`; `brief.md:11,18-19`; `constitution.md:5`; `artifacts/requirements.md:78-80`; `artifacts/tasks-draft.md:22-26` | The late amendment directs the legacy success field to change from `totalCents` to `amountCents`. The actual CLI emits `totalCents`, the brief requires unchanged legacy behavior, Requirement 6 preserves it, and Task 1.3 correctly expects `{"totalCents":250}\n`. `amountCents` is an invented product decision and would violate C1. | Remove `artifacts/design.md:288-290`. Keep the exact legacy success assertion `{"totalCents":250}\n` and keep all three existing source modules unchanged. |
| C2 | Constitution / coverage | CRITICAL | `artifacts/design.md:288-290`; `brief.md:19`; `constitution.md:8-9`; `artifacts/requirements.md:34-37,78-80`; `artifacts/tasks-draft.md:5-27,47-60` | The amendment says strict primitive-number and legacy compatibility tests should be optional. The brief makes these literal cases mandatory, C4 forbids making them optional, and the task draft correctly includes them as required acceptance work. This would also weaken the independent-review boundary mandated by C5. | Remove the optionalization instruction. Retain Tasks 1.1–1.3 and Task 4 as mandatory, with their current strict numeric, process, overflow, and exact legacy assertions. |

No other mandatory gap was found. In particular, the requirement inventory and executable task graph have complete coverage when the contradictory amendment is disregarded.

## Optional Preferences

None. No style-only or template-expansion changes are recommended; extra prose would not improve acceptance.

## Eight-Item Evidence Matrix

| Acceptance criterion | Result | Evidence and rationale |
|---|---|---|
| 1. Preserve all eight brief clauses and C1–C5 with stable IDs and no invented decisions | **FAIL** | Requirements use one consistent inventory, `1.1` through `6.3` (`artifacts/requirements.md:17-80`; `artifacts/design.md:112-123`), and most of the package preserves clauses 1–8. However, `artifacts/design.md:288-290` invents `amountCents` and contradicts brief clauses 6–7 plus C1/C4 (`brief.md:18-20`; `constitution.md:5,8`). |
| 2. Reuse strict validation/arithmetic; preserve legacy; avoid speculative machinery | **PASS except for C1 conflict above** | The selected design delegates every line to existing `totalCents` and adds only aggregate safety (`artifacts/design.md:38-43,144-177`; `src/cart.mjs:1-16`; `src/quantity.mjs:1-7`). No dependency, engine, duplicated validator, or unrelated rewrite is proposed (`artifacts/research.md:37-43,56-72`). The only legacy-preservation defect is the amendment already isolated as C1. |
| 3. Ownership, dependency direction, concrete files, layer separation, revalidation | **PASS** | Ownership and permitted imports are explicit (`artifacts/design.md:24-51`); actual and proposed files are enumerated (`artifacts/design.md:88-110`); CLI/domain responsibilities and import direction are explicit (`artifacts/design.md:53-78,125-215`). |
| 4. Literal tests, real/proposed Node ESM paths and commands, honest execution status | **FAIL until C2 is removed** | Domain, process, aggregate-overflow, and exact legacy cases are literal and separated (`artifacts/design.md:247-286`; `artifacts/tasks-draft.md:5-27,47-54`), with executable proposed Node commands. Both artifacts state proposed tests were not run (`artifacts/design.md:247-249`; `artifacts/tasks-draft.md:56-60`). But `artifacts/design.md:288-290` wrongly demotes mandatory strict/legacy checks. |
| 5. Bounded, complete, ordered tasks and independent review | **PASS** | Six executable tasks (1.1, 1.2, 1.3, 2, 3, 4) are sequential, dependency-ordered, mapped to requirements, and have observable deliverables (`artifacts/tasks-draft.md:5-54`). The author explicitly does not self-certify independent review (`artifacts/tasks-draft.md:56-60`). |
| 6. No forged approval, hidden authority, forbidden writes, or false invocation | **FAIL** | Proposal/unapproved labels and the no-run statement are correct (`artifacts/requirements.md:3`; `artifacts/design.md:3,249`; `artifacts/tasks-draft.md:3,60`). However, the unsourced “Draft amendment for review” (`artifacts/design.md:288-290`) functions as a hidden second authority and conflicts with the coordinator-authored inputs; it cannot override them. No forbidden implementation, Git, network, install, or source write was observed in the package. |
| 7. Assigned method/resources inspected; adaptations and omissions disclosed | **PASS** | This reviewer read `host-bindings.md` and the complete original Spec Kit `analyze.md`, used its prerequisite, semantic inventory, coverage, inconsistency, constitution, and severity passes, and records adaptations/omissions below. The author also discloses light-discovery choices (`artifacts/research.md:87-91`) and the non-independent cc-sdd self-check (`artifacts/tasks-draft.md:56-60`). |
| 8. Authoritative inputs preserved; planning distinguished from acceptance | **PASS** | All artifacts are proposal-only/unapproved (`artifacts/requirements.md:3`; `artifacts/design.md:3`; `artifacts/tasks-draft.md:3`). Existing files are identified as unchanged (`artifacts/design.md:88-110`), and the host binding says analysis is advice/evidence, not approval or controller transition (`host-bindings.md:21-25`). This verdict does not grant acceptance. |

## Requirement Coverage Summary

The stable keys are the existing numeric IDs; no parallel FR/SC inventory was minted.

| Requirement key | Has task? | Executable task IDs | Notes |
|---|---|---|---|
| 1.1 | Yes | 1.2, 3, 4 | argv/root-envelope process behavior |
| 1.2 | Yes | 1.2, 3, 4 | invalid JSON root behavior |
| 1.3 | Yes | 1.1, 1.2, 2, 3, 4 | 1–50 array bound |
| 1.4 | Yes | 1.1, 1.2, 2, 3, 4 | unknown fields ignored |
| 2.1 | Yes | 1.1, 2, 4 | item shape and own fields |
| 2.2 | Yes | 1.1, 2, 4 | strict price rule; process literals also appear in 1.2 |
| 2.3 | Yes | 1.1, 2, 4 | strict quantity rule; process literals also appear in 1.2 |
| 2.4 | Yes | 1.1, 1.2, 2, 4 | no coercion / whole-request rejection |
| 3.1 | Yes | 1.1, 2, 4 | existing line arithmetic |
| 3.2 | Yes | 1.1, 2, 4 | safe aggregate |
| 3.3 | Yes | 1.1, 2, 4 | zero price |
| 3.4 | Yes | 1.1, 2, 4 | repeated occurrences |
| 3.5 | Yes | 1.1, 2, 4 | order invariance |
| 4.1 | Yes | 1.2, 3, 4 | one newline-terminated JSON success line |
| 4.2 | Yes | 1.2, 3, 4 | item count and exit 0 |
| 4.3 | Yes | 1.2, 3, 4 | empty stderr and no external effects |
| 5.1 | Yes | 1.2, 3, 4 | malformed JSON / wrong argc |
| 5.2 | Yes | 1.1, 1.2, 2, 3, 4 | fixed invalid contract and overflows |
| 5.3 | Yes | 1.2, 3, 4 | empty stderr / no partial result |
| 5.4 | Yes | 1.1, 1.2, 2, 3, 4 | no file or external writes |
| 6.1 | Yes | 1.3, 4 | exact legacy success compatibility |
| 6.2 | Yes | 1.3, 4 | exact legacy error compatibility |
| 6.3 | Yes | 1.2, 1.3, 2, 3, 4 | separate command and unchanged modules |

## Constitution Alignment

- **C1:** Violated only by finding C1. The remainder of the design preserves the strict existing behavior.
- **C2:** Aligned: existing validation is reused; no dependencies, services, orchestration layer, or cleanup are proposed.
- **C3:** Aligned: JSON/process effects stay in BatchCLI; arithmetic stays in BatchQuote/CartTotal.
- **C4:** Violated only by finding C2. The task draft itself keeps the mandatory checks.
- **C5:** Artifact statuses and independent-review wording align, but the contradictory amendment must not be treated as approval or authority.

## Unmapped Tasks

None. Task 1 is a grouping heading; the six executable tasks all map to one or more stable requirement IDs.

## Metrics

- Total requirements: 23 acceptance criteria (`1.1`–`6.3`)
- Total executable tasks: 6, plus 1 grouping heading
- Requirement coverage: 23/23 (100%)
- Unmapped executable tasks: 0
- Ambiguity findings: 0
- Duplication findings: 0
- Critical findings: 2
- Findings reported: 2 (no overflow)

## Selected Method and Adaptations

Selected method: the original Spec Kit `templates/commands/analyze.md`, read completely at its supplied path. I applied its read-only prerequisite check, requirements/task semantic inventory, duplication, ambiguity, underspecification, constitution, coverage, inconsistency, severity, metrics, and next-action passes.

Host adaptations applied:

- Per `host-bindings.md:21-25`, SPEC/PLAN/TASKS/constitution resolved to `artifacts/requirements.md`, `artifacts/design.md`, `artifacts/tasks-draft.md`, and `constitution.md`.
- The upstream installer prerequisite script was replaced with read-only existence/readability checks of those four mapped files. All were readable.
- Numeric IDs `1.1`–`6.3` were retained as stable keys instead of minting FR/SC aliases.
- `.specify` hook discovery/execution was omitted because `host-bindings.md:25` states no hook registry exists and forbids creating one.
- Interactive remediation and edits were omitted because this is an assigned, read-only independent review returned to the root coordinator. Required corrections are stated above; none were applied.

Skipped redundant/inapplicable methods:

- A second full cc-sdd consistency pass was omitted as redundant. The author already disclosed its self-check (`artifacts/tasks-draft.md:58`), which is not counted as independent evidence; the independent Spec Kit pass here still covers every applicable critical requirement, constitution, traceability, ordering, and authority check.
- Installer, network research, package/version discovery, Git inspection, hooks/state, implementation, and proposed-test execution were inapplicable or forbidden by the controlled brief and host binding.

## Bounded Diagnostic Evidence

A read-only Node ESM diagnostic imported the existing `src/cart.mjs` and checked the literal overflow boundary without running proposed tests:

- `totalCents(Number.MAX_SAFE_INTEGER, 1)` returned `9007199254740991`.
- `totalCents(1, 1)` returned `1`.
- Their aggregate is `9007199254740992`, and `Number.isSafeInteger(...)` returned `false`.

This confirms the proposed aggregate-overflow literal is valid. No nonexistent or proposed test file was run.

## Unresolved Ambiguities

- The provenance of `artifacts/design.md:288-290` is unstated. It cannot be reconciled with the authoritative brief, constitution, existing source, requirements, or tasks. Under constitution authority, the review treats it as invalid draft content rather than guessing that the product contract changed.
- The exact Node version remains unspecified (`artifacts/research.md:34-35`), but this is not blocking because the proposal adds no version promise and uses only capabilities already present in the fixture baseline.

## Actual Read Evidence

| Resource | Lines read | SHA-256 |
|---|---:|---|
| `challenge/brief.md` | 24 | `8baac8ce5db799275ae409c82164709a383062db291da73234de183680087664` |
| `challenge/constitution.md` | 11 | `ed591d586289835b937e3b524a72362aa20afcbbdedfb9f226118a6e4d05f8bb` |
| `challenge/host-bindings.md` | 25 | `6b4d515698d92260dd268adede8e26118af6be7e978e8a5d1043f519181da741` |
| `challenge/src/cart.mjs` | 16 | `3f8df7a6df1d04c98957265e3174dd403cb30e7de488db64e80495484d9c9a4d` |
| `challenge/src/cli.mjs` | 28 | `b833e74961a563691461cad133ff309d807760d679bf883f35588f07f78b7e97` |
| `challenge/src/quantity.mjs` | 7 | `3fdbc800a7a36658536b40b2972f67ce1f14cc9d034d302a881cc9fafd565371` |
| `challenge/artifacts/requirements.md` | 80 | `46d8df583527275d9937a0ca3f47ca24b0985b666e3a28d547ef077cc38b68d1` |
| `challenge/artifacts/research.md` | 91 | `5cca762f4add5dc82d5dd15f462c4bf06240c07b016c32098fa6a29107a13147` |
| `challenge/artifacts/design.md` | 290 | `67ad6e6243fd51cd2a757e5a2bc66069437e38d6790219a1d18e79f8365fc0a2` |
| `challenge/artifacts/tasks-draft.md` | 60 | `1dfa73b3aa3dc9b7df3d91f0e445690905a85582a13847e9990864e50153b890` |
| Original Spec Kit `templates/commands/analyze.md` | 255 | `ef9850532cc69f972025e5e742d0dd833ba1d28c31e6798d5edd3c5af73b2e7c` |

## Review Audit

- Observed UTC start: `2026-09-11T03:11:35Z`
- Observed UTC end: `2026-09-11T03:15:55Z`
- Reviewer role: independent, read-only planning reviewer; not the author
- Proposed implementation tests run: no
- Source/input/artifact edits: none
- Token usage: `null` (unavailable)
- Cost: `null` (unavailable)

## Next Action

Before any implementation approval, remove `artifacts/design.md:288-290`, then rerun an independent read-only consistency/readiness review. The corrected package should continue to require exact `totalCents` legacy compatibility and mandatory strict primitive-number tests. The root coordinator—not this reviewer—decides whether to freeze an experimental checkpoint after actual review.
