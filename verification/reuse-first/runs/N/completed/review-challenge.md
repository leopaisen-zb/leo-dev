# Independent planning review — challenge package N

## Verdict

**NEEDS_FIXES**

Reviewer readiness is not human approval, implementation authorization, controller acceptance, or an experimental checkpoint freeze. The package is otherwise unusually complete, but one mandatory, internally contradictory amendment prevents a PASS.

## Mandatory findings

### F-001 — The design invents and weakens a product decision fixed by the authoritative inputs

`artifacts/design.md:101-103` proposes changing the established legacy success property from `totalCents` to `amountCents` and making strict primitive-number and legacy compatibility tests optional. Both instructions contradict the controlled brief and the rest of the package:

- The feature must preserve the legacy CLI contract: `brief.md:11`, `constitution.md:5`, `artifacts/requirements.md:11-13`, and `artifacts/tasks-draft.md:47-53`.
- Strict validation and exact legacy compatibility checks are mandatory: `brief.md:19`, `constitution.md:8`, `artifacts/requirements.md:43-45`, and `artifacts/tasks-draft.md:11,55-70`.
- The literal required legacy success case is `{"totalCents":250}\n`: `artifacts/requirements.md:71`; the existing implementation actually serializes that key at `src/cli.mjs:24`.

Impact: the package contains two incompatible implementation authorities. Following the final amendment would break the established wire contract and weaken mandatory acceptance, so the plan is not unambiguously executable or acceptance-complete.

Required correction: remove `artifacts/design.md:101-103`, or replace it with an explicit note that this amendment was rejected because it conflicts with the fixed brief and C1/C4. Keep AC-019/AC-020 and strict primitive-number checks mandatory. This is a planning-artifact correction only; it does not authorize implementation.

## Optional preferences

None. No optional style or template preference affects the verdict.

## Eight-item evidence matrix

| # | Result | Evidence and assessment |
|---|---|---|
| 1 | **NEEDS_FIXES** | REQ-001–REQ-009 and AC-001–AC-020 consistently trace the eight brief clauses and C1–C5 (`artifacts/requirements.md:9-45,47-72`; `artifacts/tasks-draft.md:5-11,80-88`), but the invented amendment at `artifacts/design.md:101-103` contradicts brief clauses 6–7 (`brief.md:18-20`) and C1/C4 (`constitution.md:5,8`). |
| 2 | **NEEDS_FIXES** | The main design correctly reuses `totalCents` and `quantity` (`artifacts/design.md:42-50,64`; `src/cart.mjs:1-15`; `src/quantity.mjs:1-7`) and avoids dependencies/engines, but `artifacts/design.md:101-103` would change legacy behavior and downgrade strict validation checks. |
| 3 | **PASS** | Ownership, dependency direction, actual versus proposed files, CLI/domain separation, and concrete revalidation triggers are explicit at `artifacts/design.md:9-17,21-32,42-48,52-70,87-99`. Existing modules are named compatibility baselines rather than edit targets at `artifacts/tasks-draft.md:7-10`. |
| 4 | **NEEDS_FIXES** | Literal success, invalid, line/aggregate overflow, order, unknown-field, and legacy cases are defined at `artifacts/requirements.md:47-72`; real/proposed ESM paths and executable commands appear at `artifacts/design.md:21-32,72-85` and `artifacts/tasks-draft.md:59-70`; unrun status is honest. However, `artifacts/design.md:101-103` directly makes two mandatory test families optional. |
| 5 | **NEEDS_FIXES** | TASK-001–TASK-007 have owners, dependencies, deliverables, commands, and exit criteria (`artifacts/tasks-draft.md:13-78`), and self-check is distinguished from independent review (`artifacts/tasks-draft.md:90-92`). The conflicting amendment at `artifacts/design.md:101-103` makes the ordered package ambiguous about mandatory acceptance. |
| 6 | **NEEDS_FIXES** | Proposal/unapproved status and lack of run claims are correctly stated (`artifacts/requirements.md:1-3,74-76`; `artifacts/design.md:1-3`; `artifacts/tasks-draft.md:1-3,90-92`). Nonetheless, `artifacts/design.md:101-103` acts as an unauthorized second policy source contradicting the coordinator-fixed brief; it cannot amend those inputs. No forbidden execution, Git, network, install, or implementation write was observed in the reviewed artifacts. |
| 7 | **PASS** | The assigned method was ordinary native read-only review; the challenge brief explicitly assigned no additional experiment workflow resource. The review applied source inspection, clause/constitution traceability, literal CLI observation, and safe-integer boundary diagnostics. Redundant implementation, interview, network, Git, and nonexistent-test execution methods were omitted for disclosed scope reasons below. |
| 8 | **NEEDS_FIXES** | Planning/controller boundaries are explicit (`brief.md:22-24`; `constitution.md:11`; `artifacts/requirements.md:74-76`; `artifacts/tasks-draft.md:90-92`), but authoritative input preservation fails because `artifacts/design.md:101-103` contradicts the fixed legacy and mandatory-test requirements. |

## Selected method and disclosed omissions

Selected methods:

- Ordinary native, independent, read-only review, as assigned.
- Line-by-line traceability across the brief, constitution, actual source, requirements, design, and tasks.
- Read-only observation of the existing legacy CLI success/error process contract.
- Read-only Node safe-integer diagnostics for line overflow, aggregate overflow, and the order example.

Skipped methods and reasons:

- No additional experiment workflow resource: none was assigned.
- No interview, grilling, specification publication, development workflow, implementation, or code review of implemented changes: this is a fully specified proposal and implementation is forbidden.
- No Git, network, install, external approval, or settings operation: forbidden and unnecessary.
- No proposed test command was run: the proposed source/tests do not exist, and the brief forbids running nonexistent tests. Existing CLI invocations were diagnostics, not claims that proposed tests passed.

## Unresolved ambiguities

The authoritative brief and constitution contain no semantic ambiguity requiring a product decision. The only unresolved issue is the artifact-authored contradiction in F-001; it must be corrected against the fixed inputs, not escalated as a new product choice.

## Actual read and diagnostic evidence

Observed review interval (UTC): `2026-09-11T02:59:52Z` to `2026-09-11T03:02:16Z`.

Permitted files read, with SHA-256 captured after inspection:

| Path | SHA-256 |
|---|---|
| `brief.md` | `8baac8ce5db799275ae409c82164709a383062db291da73234de183680087664` |
| `constitution.md` | `ed591d586289835b937e3b524a72362aa20afcbbdedfb9f226118a6e4d05f8bb` |
| `src/cart.mjs` | `3f8df7a6df1d04c98957265e3174dd403cb30e7de488db64e80495484d9c9a4d` |
| `src/cli.mjs` | `b833e74961a563691461cad133ff309d807760d679bf883f35588f07f78b7e97` |
| `src/quantity.mjs` | `3fdbc800a7a36658536b40b2972f67ce1f14cc9d034d302a881cc9fafd565371` |
| `artifacts/requirements.md` | `ee2901a2b240f1dcf7e1358d384f2195d49f267aa394bffdbe781b9425aebbf5` |
| `artifacts/design.md` | `1e3ea8108e75c3910b7c77d1804192433c77fad7d8e7758deb31e5971cfe34b7` |
| `artifacts/tasks-draft.md` | `470b787fca9d90ba9d6bc6acd5e9d894e637642b031bbcfe2e971544ed3ca0c3` |

Observed legacy diagnostics from the assigned project root:

- Success: status `0`, stdout exactly `{"totalCents":250}\n`, stderr empty.
- Invalid string quantity: status `2`, stdout exactly `{"error":"INVALID_INPUT"}\n`, stderr empty.
- `Number.MAX_SAFE_INTEGER * 1` is safe; `Number.MAX_SAFE_INTEGER * 2` and `Number.MAX_SAFE_INTEGER + Number.MAX_SAFE_INTEGER` are unsafe; the order example evaluates to `275`.

No proposed implementation tests were run. Token usage: `null` (unavailable). Cost: `null` (unavailable).
