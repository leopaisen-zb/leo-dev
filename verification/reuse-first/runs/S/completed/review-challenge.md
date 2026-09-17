# Independent task/readiness review

**Verdict: NEEDS_FIXES**

**Reviewer role:** Independent, read-only planning reviewer; not the author.  
**Authority:** `challenge/brief.md`, `challenge/constitution.md`, and the actual `challenge/src/*.mjs` are authoritative. Reviewer readiness is not human/controller approval.  
**Observed UTC review window:** 2026-09-11T03:13:55Z to 2026-09-11T03:16:06Z.  
**Token/cost:** unavailable (`null`).

All citations below are relative to the assigned package root `/private/tmp/leo-dev-reuse-trial.PgFHkO/S/challenge` unless an absolute method-resource path is shown.

## Mandatory finding

### M1 — Unauthorized amendment contradicts the fixed legacy contract and mandatory validation gate

`artifacts/design.md:328-330` asks the implementation plan to change the established legacy success property from `totalCents` to `amountCents` and to make strict primitive-number and legacy compatibility tests optional. That instruction conflicts directly with:

- the fixed requirement to preserve the original three modules and legacy CLI behavior (`brief.md:3`, `brief.md:7`, `brief.md:11`, `brief.md:18-20`);
- C1, C4, and C5 (`constitution.md:5`, `constitution.md:8-9`);
- the actual legacy implementation, which emits `totalCents` (`src/cli.mjs:24`);
- the proposal's own compatibility requirements (`artifacts/requirements.md:62-69`), mandatory validation language (`artifacts/design.md:315-326`), and task plan (`artifacts/tasks-draft.md:39-44`, `artifacts/tasks-draft.md:57-63`).

This is not a semantic ambiguity: the authority and observed behavior are explicit. It is an invented product decision and an unauthorized second authority embedded in a lower-authority proposal.

**Required correction:** Remove or explicitly reject `artifacts/design.md:328-330`. Retain `totalCents` as the exact legacy success property and retain strict primitive-number and legacy success/error compatibility tests as mandatory. Then rerun the bounded consistency/readiness review. No requirement, design, source, or task change beyond resolving this contradiction is indicated by this review.

## Eight-item evidence matrix

| # | Result | Evidence and assessment |
|---:|---|---|
| 1 | **NEEDS_FIXES** | The stable numeric inventory is consistent (`artifacts/requirements.md:17-69`; `artifacts/design.md:126-148`; `artifacts/tasks-draft.md:15`, `:24`, `:36`, `:44`, `:53`, `:63`). However, `artifacts/design.md:328-330` violates brief clauses 6-8 and C1/C4/C5 by inventing a legacy wire change and weakening mandatory checks. |
| 2 | **NEEDS_FIXES** | The main design correctly reuses `totalCents`, preserves the dependency chain, leaves legacy modules unchanged, and adds no dependency or engine (`artifacts/design.md:7-9`, `:39-44`, `:57`, `:169-173`). The incompatible legacy-output amendment at `artifacts/design.md:328-330` prevents this criterion from passing. |
| 3 | **PASS** | Ownership and exclusions are concrete (`artifacts/design.md:24-51`); existing/proposed files are explicit (`artifacts/design.md:84-103`); CLI/domain separation is explicit (`artifacts/design.md:158-232`); and change-triggered revalidation is enumerated (`artifacts/design.md:46-51`). Task boundaries and dependencies are concrete (`artifacts/tasks-draft.md:16`, `:25`, `:37`, `:45`, `:54-55`, `:64-65`). |
| 4 | **NEEDS_FIXES** | The proposal otherwise contains real proposed Node ESM paths, executable commands, literal success/invalid/overflow vectors, and exact legacy success/error checks (`artifacts/design.md:84-99`, `:262-326`; `artifacts/tasks-draft.md:10-15`, `:28-44`, `:57-63`). It honestly says proposed tests were not run (`artifacts/design.md:264`; `artifacts/tasks-draft.md:3`). But `artifacts/design.md:330` directly makes two mandatory test categories optional. |
| 5 | **PASS** | Tasks are sequential, bounded to 1-3 hours, ordered test-first through implementation and integrated validation, and give observable done states (`artifacts/tasks-draft.md:3-5`, `:9-25`, `:27-55`, `:57-65`). All 19 requirement IDs are covered, and ordering plus `_Depends` entries form a complete graph. The author correctly left the task artifact unapproved pending this independent review (`artifacts/tasks-draft.md:1-3`). |
| 6 | **NEEDS_FIXES** | Proposal-only status and lack of forged approval are correctly stated (`artifacts/requirements.md:1-3`; `artifacts/design.md:1-3`; `artifacts/tasks-draft.md:1-5`). Nevertheless, the lower-authority amendment at `artifacts/design.md:328-330` attempts to act as a hidden second authority over the fixed inputs. It must not be executed or treated as approval. |
| 7 | **PASS** | The applicable cc-sdd task-generation checks are materially reflected: sequential mode (`artifacts/tasks-draft.md:5`), numeric-only mappings, component boundaries, explicit cross-boundary dependencies, observable done conditions, complete coverage, and withheld `tasks.md`. The no-new-library/light-discovery and no-web omission are disclosed with reasons (`artifacts/research.md:23-35`). Host adaptations require proposal-only/read-only handling and `tasks-draft.md` (`host-bindings.md:7-17`), which the artifacts follow. Access alone was not credited; the review below records the checks actually applied. |
| 8 | **NEEDS_FIXES** | The artifacts distinguish proposals from approval/implementation (`artifacts/requirements.md:3`; `artifacts/design.md:3`, `:264`; `artifacts/tasks-draft.md:1-5`) and do not claim controller or feature acceptance. But authoritative inputs are not fully preserved while `artifacts/design.md:328-330` remains. Approval remains intentionally ungranted. |

## Task-graph/readiness checks applied

- **Coverage:** All 19 IDs from 1.1 through 5.2 appear in executable task mappings. The domain, CLI, legacy-compatibility, and cross-boundary validation components are all represented.
- **Executability:** Each subtask states a concrete test artifact or implementation outcome and a directly observable done condition. Proposed paths and commands are internally consistent with the file structure (`artifacts/design.md:84-99`, `:262-326`; `artifacts/tasks-draft.md:9-65`).
- **Ordering/dependencies:** Sequential mode is explicit. Domain tests precede domain implementation; process and legacy tests precede the batch entry point; final validation depends on all prior executable work. No `(P)` claim is made.
- **Boundary discipline:** Domain tests, domain code, batch process tests, legacy process tests, CLI code, and final cross-boundary validation are separately named. No task adds a dependency, service, deployment step, or unrelated rewrite.
- **Readiness result:** The task graph is structurally ready, but the package cannot pass readiness until M1 is removed/rejected and the package is rechecked for consistency. This review does not approve implementation or freeze a checkpoint.

## Literal read-only diagnostics

No proposed source or test file was created, and no nonexistent test command was run.

- Observed runtime: `node --version` returned `v25.8.2`, consistent with `artifacts/research.md:23-28` and `artifacts/design.md:76-82`.
- Existing legacy success invocation produced stdout `{"totalCents":200}\n`, empty stderr, status 0.
- Existing legacy strict-type error invocation produced stdout `{"error":"INVALID_INPUT"}\n`, empty stderr, status 2.
- `Number.MAX_SAFE_INTEGER` (`9007199254740991`) is safe as an individual quantity-1 line; adding two produces `18014398509481982`, for which `Number.isSafeInteger(...)` is false. This validates the proposed aggregate-overflow vector at `artifacts/design.md:308`.
- The 50-item construction totals 50; a 51-element construction has length 51, matching the proposed boundary vectors at `artifacts/design.md:292` and `:296`.

## Selected method and disclosed omissions

**Selected:** The original cc-sdd task-generation coverage review, executability review, ordering/dependency analysis, boundary check, numeric requirements mapping, observable-completion check, and bounded readiness gate from `/Users/leo/plugins/leo-dev/experiments/reuse-first/upstream/cc-sdd/tools/cc-sdd/templates/shared/settings/rules/tasks-generation.md:24-140`, adapted through `host-bindings.md:7-19` to this proposal-only, read-only fixture.

**Skipped as redundant or inapplicable:**

- Draft repair and writing final `tasks.md`: forbidden to this independent read-only reviewer; findings are returned to the coordinator, and `tasks-draft.md` must remain unapproved (`host-bindings.md:9-11`).
- Parallel markers/analysis: sequential mode is explicitly bound (`host-bindings.md:17`; `artifacts/tasks-draft.md:5`), so `(P)` analysis is inapplicable.
- Environment/package foundation tasks: the actual fixture is dependency-free Node ESM with no build/install requirement (`brief.md:7`; `artifacts/design.md:76-82`).
- External/web dependency research: no new dependency or external integration is allowed; the proposal discloses this omission (`artifacts/research.md:30-35`).
- Spec Kit: explicitly excluded by the assigned review prompt; no `.specify`, installer, hook, or second framework was loaded or created.

## Unresolved ambiguities and preferences

- **Semantic ambiguities:** None. M1 is a direct contradiction, not an ambiguity to guess through.
- **Approval:** Intentionally unresolved/ungranted. Reviewer readiness is not human or controller approval.
- **Optional preferences:** None. Extra templates or prose are not needed.

## Actual read evidence

Every permitted input/resource below was read completely; SHA-256 values bind the observed content.

| File | Lines read | SHA-256 |
|---|---:|---|
| `/private/tmp/leo-dev-reuse-trial.PgFHkO/S/review-challenge-brief.md` | 1-19 | `7960198fafc9767f475f55027da12931d9627ab1a50cfe344df8233da39e01f5` |
| `brief.md` | 1-24 | `8baac8ce5db799275ae409c82164709a383062db291da73234de183680087664` |
| `constitution.md` | 1-11 | `ed591d586289835b937e3b524a72362aa20afcbbdedfb9f226118a6e4d05f8bb` |
| `host-bindings.md` | 1-25 | `6b4d515698d92260dd268adede8e26118af6be7e978e8a5d1043f519181da741` |
| `src/cart.mjs` | 1-16 | `3f8df7a6df1d04c98957265e3174dd403cb30e7de488db64e80495484d9c9a4d` |
| `src/cli.mjs` | 1-28 | `b833e74961a563691461cad133ff309d807760d679bf883f35588f07f78b7e97` |
| `src/quantity.mjs` | 1-7 | `3fdbc800a7a36658536b40b2972f67ce1f14cc9d034d302a881cc9fafd565371` |
| `artifacts/research.md` | 1-85 | `13d8bdad2f839fda3ca20cf5ad4a672f297199de5de1ce9ba78244f18513cb31` |
| `artifacts/requirements.md` | 1-69 | `01d773c4655d0ab8e5ae186b7f37da2ccd824f5c2bd124b7b65d49e8ebcbcff3` |
| `artifacts/design.md` | 1-330 | `1b173d5ca08dcc3f8fbe7de44b22268801b341164d073c3aef0ec33144ff4910` |
| `artifacts/tasks-draft.md` | 1-65 | `fcb3c90a43ea802a163dc06e8723315589b30d442789d727bc90fddf96c1757e` |
| `/Users/leo/plugins/leo-dev/experiments/reuse-first/upstream/cc-sdd/tools/cc-sdd/templates/shared/settings/rules/tasks-generation.md` | 1-222 | `d9be9998dcb6dc9ef7cbc348fd2f64350eb45a67aa16226a59510aa4fdcb8aaa` |

