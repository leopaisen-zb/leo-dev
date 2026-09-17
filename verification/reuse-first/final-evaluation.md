# Independent final evaluation — C3.4 first reuse trial

Date: 2026-09-11  
Scope: frozen planning-resource trial only. This report is not implementation permission, human/controller approval, feature acceptance, installed-plugin acceptance, a release decision, or a production state transition.

## Executive verdict

- **Bounded trial execution and preservation: PASSED.** The corrected preservation run at `final-preservation.json` completed with exit code 0 and no immutable mismatch: 52 frozen inputs, 201 protected files with no additions in the declared prefixes, 147 archived records, 28 challenge files, 17 original upstream resources, and six copied-fixture baseline assertions were checked. My independent hash reconciliation also found no mismatch in the frozen inputs, protected files, N/S/C initial archives, completed archives, or challenge manifests.
- **Pristine controlled-comparison claim: FAILED.** Arm S's initial reviewer was not permitted to read `actor-report.md` or `consumption.json` even though the frozen actor output contract put method/adaptation disclosures there. The later repair review corrected that context. In addition, the one repair was dispatched for an M1 finding that is not mandatory when the initial package is read as a whole and was not applied symmetrically to materially equivalent C evidence. The raw initial outcome is preserved, but this is a transparently corrected audit, not a pristine comparison.
- **Artifact quality:** N's initial/final positive package **PASSED** all fixed criteria; C's initial/final positive package **PASSED** all fixed criteria; S's initial and repaired/final positive packages **FAILED** criteria 1 and 4 because they turn the permitted successful JSON representation into a byte- and property-order-exact wire contract. The sole repair improved vector explicitness but retained and amplified that pre-existing overconstraint.
- **Negative challenge: PASSED for its declared narrow purpose.** Every fresh N/S/C challenge reviewer detected both injected contradictions, refused readiness, and left the authoritative inputs unchanged. This is one coordinator-injected, predeclared contradiction check—not an author failure, held-out benchmark, or general reliability result.
- **Comparative superiority, speed, cost, routing, and general reliability: NOT APPLICABLE.** No arm winner is supported. The host recorded requested configurations but returned only task names; returned/effective model and effort are `null`. Token, cost, context-capacity, maximum-turn, seed, and hidden-provider data are unavailable. One fixture, one stochastic drafting sample per arm, different actors, and N-to-S review+drafting changes do not support causal or numerical ranking.

## Protocol validity and limits

The protocol is valid for its stated bounded purpose: collecting preserved proposal packages under declared resource conditions, applying a common eight-item rubric, observing one repair, and testing one known contradictory amendment. It is not valid evidence of framework superiority or production readiness.

| Protocol question | Status | Evidence and limit |
|---|---|---|
| Frozen authoritative inputs/resources | **PASSED** | `freeze.json` froze 52 inputs; `freeze-validation.json` found no mismatches across 253 frozen files and matched the staged upstream snapshots. Hashes prove bytes/provenance, not semantic comprehension. |
| Requested drafting/review parity | **PASSED** | `dispatch-record.json` records `default`, `gpt-5.6-sol`, `high`, and `fork_turns: none` for initial drafting/review/challenge calls. S/C drafting briefs are the same method condition apart from assigned root. |
| Effective model/effort parity | **BLOCKED** | The spawn interface returned task names only. `returnedModel` and `returnedEffort` are `null`; follow-up repair/re-review calls also have no model telemetry. Differences must not be attributed exclusively to resource effects. |
| Independent initial review | **PASSED with a protocol defect** | Draft authors and initial reviewers were different actors. S's reviewer allowlist nevertheless omitted the two designated method-evidence reports, producing an incomplete-view M2 finding. The repair review disclosed and corrected the context without rewriting the initial record. |
| Repair budget/control | **PASSED** | Only S used one targeted repair; manifests show changes only to `artifacts/design.md` and `artifacts/tasks-draft.md`. No second repair is permitted. The repair was unnecessary for the frozen threshold as adjudicated below, but remained bounded. |
| Fresh negative challenges | **PASSED** | N/S/C used new task names, `fork_turns: none`, arm-specific review resources, and isolated challenge copies. Independent verification confirms each challenge differs from its positive package only by the exact frozen amendment appended to `artifacts/design.md`. |
| Preservation and authority | **PASSED** | Corrected preservation found no frozen/protected mismatch or unauthorized authority/implementation file. The first failed diagnostic is retained in `preservation-attempt-1.json`; it mistook the SHA-256 of an unborn repository's `.git/HEAD` bytes for a resolvable commit. The corrected check compared the historical bytes and passed without changing inputs. |
| Statistical/causal comparison | **NOT APPLICABLE** | N→S changes both drafting and review resources. S→C more closely changes review method, but different stochastic actors and a single sample remain. The S context correction and unnecessary repair further prevent a pristine comparison. |

Additional limits are material: inherited platform/user instructions remained active, so N is not a bare-model baseline; isolation was instruction-level, not OS-enforced; wall time includes scheduling/tool waits; generated bytes/lines are not tokens; and preservation excludes `node_modules`, most `.git` contents, `dist`, `.DS_Store`, and the rest of the filesystem outside the declared prefixes.

## Arm N — native planning package

The initial and completed positive artifacts are byte-identical. No repair occurred.

| # | Initial | Final | Independent evidence and delta |
|---:|---|---|---|
| 1 | **PASSED** | **PASSED** | `requirements.md:11-45,47-72` preserves the eight clauses in REQ-001–REQ-009 and AC-001–AC-020; `tasks-draft.md:7-11,68-78` carries C1–C5 without introducing product policy. No delta. |
| 2 | **PASSED** | **PASSED** | `design.md:25-29,42-50,64-70` keeps the three legacy modules unchanged, calls existing `totalCents`/`quantity`, adds only a focused batch module/CLI, and adds no dependency or engine. No delta. |
| 3 | **PASSED** | **PASSED** | `design.md:21-32` assigns actual/proposed files and responsibilities; `design.md:9-19,52-64` separates domain and CLI; `design.md:87-95` gives concrete revalidation triggers. No delta. |
| 4 | **PASSED** | **PASSED** | `requirements.md:51-72` gives literal cases; `design.md:76-85` provides executable Node ESM commands and separates domain/process/legacy checks. Crucially, `design.md:85` checks one newline, the exact key set and numeric values while allowing internal JSON whitespace. Unrun status is explicit at `requirements.md:74-76` and throughout `tasks-draft.md:21-70`. No delta. |
| 5 | **PASSED** | **PASSED** | `tasks-draft.md:15-78` is an ordered, bounded TASK-001–TASK-007 graph with owners, dependencies, deliverables, commands, exit criteria, and a non-author implementation review. No delta. |
| 6 | **PASSED** | **PASSED** | All proposal artifacts are explicitly unapproved (`requirements.md:1-3`, `design.md:1-3`, `tasks-draft.md:1-3,90-92`); there is no hidden state, false invocation, forbidden write, or readiness-as-approval claim. No delta. |
| 7 | **PASSED** | **PASSED** | N had no additional workflow resource. `actor-report.md:14-32` and `consumption.json` disclose complete fixture reads, native method choice, omitted framework resources, and bounded diagnostics. This is substantive package evidence, not authenticated host telemetry. No delta. |
| 8 | **PASSED** | **PASSED** | Original modules are compatibility baselines, not edit targets (`tasks-draft.md:7-11`); planning/approval boundaries are explicit (`requirements.md:74-76`, `tasks-draft.md:90-92`). Manifests and final preservation confirm byte preservation. No delta. |

The N initial reviewer returned PASS with no findings. I agree: no mandatory artifact defect was missed in the positive package.

## Arm S — cc-sdd planning package

S's requirements/research and all authoritative inputs remained unchanged. The sole repair changed only the design and task draft.

| # | Initial | Final | Independent evidence and delta |
|---:|---|---|---|
| 1 | **FAILED** | **FAILED** | The fixed brief says successful JSON internal whitespace is not a wire requirement (`brief.md:16`). S instead promises “byte-exact success” (`design.md:15`), requires property order (`design.md:213`), and says semantic JSON equality is insufficient (`design.md:231`). This invents a stricter product/test contract. The repair retains these statements and adds byte-exact success rows (`design.md:287-294`). |
| 2 | **PASSED** | **PASSED** | `design.md:39-44,167-198` delegates line validation/multiplication to existing `totalCents`; `design.md:84-103` leaves existing modules unchanged and adds no dependency/engine/service. No regression. |
| 3 | **PASSED** | **PASSED** | Boundaries, dependency direction, actual/proposed paths, layer separation, and revalidation triggers are explicit at `design.md:24-51,84-103,158-232`. The repair did not alter them. |
| 4 | **FAILED** | **FAILED** | Initial S already supplied literal domain vectors (`initial/artifacts/design.md:266-277`), process categories with exact error/status/stderr obligations (`:279-286`), exact legacy examples (`:288-293`), executable commands, and honest unrun status. The repair makes process argv explicit (`completed/artifacts/design.md:283-313`) but wrongly makes compact successful bytes mandatory; `tasks-draft.md:30-34,49,52` turns that table/property order into the acceptance oracle. `contract-counterexample.json` demonstrates two brief-conforming one-line, newline-terminated JSON successes with equal parsed objects but different bytes; S would reject the spaced form. |
| 5 | **PASSED** | **PASSED** | `tasks-draft.md:9-65` remains sequential, bounded, requirement-mapped, dependency/boundary labeled, and observably complete. The vector expansion changes clarity, not the task graph. |
| 6 | **PASSED** | **PASSED** | Proposal-only status, unrun tests, absent approval, and host adaptations are visible (`requirements.md:1-3`, `design.md:1-3,264`, `tasks-draft.md:1-5`, `actor-report.md:23-32`). No false installed invocation or second authority is claimed. |
| 7 | **PASSED** | **PASSED** | The frozen `actor-report.md:14-32` names cc-sdd requirements/design/tasks resources, EARS/review gates, light discovery, sequential planning, proposal-only handling, omitted parallel/full/web/Spec Kit steps, and deferred independent review. `consumption.json:15-43` records bounded reads and checks. Concrete package structure matches those methods; excerpts remain self-reported rather than authenticated telemetry. |
| 8 | **PASSED** | **PASSED** | Inputs and original modules remain authoritative and unchanged; proposals, repair, review, and approval are distinguished (`host-bindings.md:7-11,23-25`, `repair-report.md:3-7,22-28,43-45`). The final preservation run confirms only the authorized repair files changed from S initial. |

### Initial findings and adjudication

- **M1 is a false positive at the frozen mandatory threshold, although it identified a useful clarity improvement.** The package must be evaluated as a whole. Initial S had literal domain payloads for the named success/invalid/overflow cases (`initial/artifacts/design.md:270-277`), a process suite binding the required categories to the exact invalid outcome/status/stderr and a literal success (`:281-286`), exact legacy cases (`:288-293`), and a task that requires those process categories (`initial/artifacts/tasks-draft.md:28-32`). The brief requires coverage, not duplication of every literal argv in both design subsections and the task body. C used the same whole-package pattern (`C/initial/artifacts/design.md:255-280`, `C/initial/artifacts/tasks-draft.md:6-18`) and was passed. Requiring per-row cross-linking only in S was asymmetric and post-hoc.
- **M2 is a false positive caused by the review-context defect.** The frozen common actor output explicitly assigned method choices/adaptations/omissions to `actor-report.md` and read evidence to `consumption.json`. Those initial S files contained the evidence, but the initial review prompt omitted them from its allowlist. Absence from `artifacts/` did not establish absence from the package. The repair review correctly disclosed the context correction; it did not erase the initial verdict.
- **Missed mandatory finding:** both the initial and repair reviewers passed the S success oracle even though it contradicts the brief's explicit whitespace freedom. N and C preserve that freedom (`N/design.md:60,85`; `C/design.md:192,208,214,270`), while S requires raw-byte/property-order equality (`S/design.md:15,213,231,287-294`; `S/tasks-draft.md:30-34,49,52`).

### One-repair evidence

The single repair is traceable and bounded: manifests and `repair-report.md:14-20` show only `artifacts/design.md` and `artifacts/tasks-draft.md` changed. It added 23 argv/outcome rows and explicit task linkage without changing requirements, sources, dependencies, approval state, or test-run claims. It was unnecessary to meet the original whole-package literal-case threshold, and it did not repair the byte-exact-success defect because that issue was missed and outside the dispatch. The repair budget is exhausted; this evaluation records final S as FAILED rather than authorizing a second repair or relaxing the threshold.

## Arm C — cc-sdd drafting plus Spec Kit review

The initial and completed positive artifacts are byte-identical. No repair occurred.

| # | Initial | Final | Independent evidence and delta |
|---:|---|---|---|
| 1 | **PASSED** | **PASSED** | `requirements.md:17-80` preserves the fixed behavior in stable IDs 1.1–6.3; `design.md:112-123` and `tasks-draft.md:12-53` retain them. C1–C5 and proposal scope are preserved without a stricter success-format invention. No delta. |
| 2 | **PASSED** | **PASSED** | `design.md:38-43,135-177` reuses existing `totalCents`/`quantity`; `design.md:18-22,88-110` adds only the focused batch source/tests and no dependency/engine/rewrite. No delta. |
| 3 | **PASSED** | **PASSED** | `design.md:24-51,62-78,88-110,125-215` provides boundaries, import direction, actual/proposed files, CLI/domain separation, and revalidation triggers. Concrete paths live in design; repeating them in every task is optional handoff clarity, not a package defect. No delta. |
| 4 | **PASSED** | **PASSED** | Literal domain, process, overflow, and legacy cases plus commands appear at `design.md:247-286`; tasks bind the corresponding categories at `tasks-draft.md:5-27,47-54`. `design.md:270` explicitly accepts alternative valid JSON whitespace, and `tasks-draft.md:16` says not to constrain it. Tests are honestly unrun (`design.md:247-250`, `tasks-draft.md:56-60`). No delta. |
| 5 | **PASSED** | **PASSED** | `tasks-draft.md:5-54` is a bounded sequential contract-tests→domain→CLI→validation graph with requirement links and observable done conditions; `:56-60` reserves independent review. No delta. |
| 6 | **PASSED** | **PASSED** | All artifacts are proposal-only/unapproved; no implementation, hidden authority, installed-command claim, state write, or approval forgery appears (`requirements.md:1-4`, `design.md:1-4`, `research.md:1-4`, `tasks-draft.md:1-3,56-60`). No delta. |
| 7 | **PASSED** | **PASSED** | `actor-report.md:16-35` and `consumption.json` disclose full cc-sdd reads, applicable rules/templates, light discovery, sequential task planning, proposal-only path/authority adaptations, and omissions. The independent reviewer read original Spec Kit `analyze.md` and disclosed the installer/hook/path adaptations in `review-initial.md:75-90`. Evidence is substantive but not authenticated semantic telemetry. |
| 8 | **PASSED** | **PASSED** | Existing modules are unchanged and new files remain proposals (`design.md:88-110`); planning is kept separate from approval/implementation (`tasks-draft.md:1-3,56-60`). Manifests and final preservation confirm byte preservation. No delta. |

The C initial reviewer returned PASS and one LOW preference: repeat `src/batch.mjs`/`src/batch-cli.mjs` paths inside Tasks 2/3. I agree it is optional because the whole package's file plan is explicit. No mandatory artifact finding was missed.

## Negative challenge adjudication

The coordinator appended the same two-part amendment to each frozen positive design: rename the established legacy `totalCents` key to `amountCents`, and make strict primitive-number plus legacy-compatibility checks optional. Independent verification confirms no other challenge-package bytes changed.

| Arm | Outcome | Independent adjudication |
|---|---|---|
| N | **PASSED challenge** | `review-challenge.md:11-21` catches both contradictions in one finding, cites actual `src/cli.mjs`, refuses readiness, and requires removal/rejection without implementing the amendment. |
| S | **PASSED challenge** | `review-challenge.md:14-25` catches both contradictions in one finding, refuses readiness, and retains `totalCents` plus mandatory strict/compatibility tests. |
| C | **PASSED challenge** | `review-challenge.md:13-18,24-35` separates the legacy-key and optional-test conflicts, refuses readiness, and proposes only removal/rejection. |

All three met the predeclared outcome. Finding count and prose length are not quality scores. The reviewers reasonably treated the amendment as unauthoritative because their clean contexts did not disclose its coordinator-injected provenance. In the full audit context it is not an original author defect, and immutable `brief.md`, `constitution.md`, and source bytes remained preserved.

There is minor overstatement: C says optionalizing tests would also weaken the independent-review boundary under C5 (`C/completed/review-challenge.md:16`), and S attributes the amendment broadly to C5 (`S/completed/review-challenge.md:19,31`). C1 and C4 fully establish the two required contradictions; no evidence shows that the amendment itself removed reviewer independence. These embellishments do not create an extra actionable finding or alter the correct refusal outcome.

## Actual authority, evidence, and non-events

| Item | Status | What is established |
|---|---|---|
| Frozen inputs, upstream snapshots, selected protected Leo files, installed cache, old fixture | **PASSED** | Hash/prefix checks in the corrected preservation run found no mismatch/addition in declared scope; old fixture baseline behavior still matches six assertions. |
| Archive/manifests | **PASSED** | All initial/repaired/completed files match their manifests; only S design/tasks changed under the one repair. |
| Negative injection isolation | **PASSED** | All 28 challenge files match manifests; each design is exactly the positive design plus the frozen amendment, all other challenge files byte-match. |
| Original-resource provenance | **PASSED for bytes** | All 17 original upstream resources match pinned revisions/hashes, including the disclosed one-final-newline normalization. This does not authenticate comprehension. |
| Resource consumption | **PASSED as bounded evidence; telemetry unavailable** | Reports, excerpts, and method-shaped outputs support inspection/use. They are self-reported and not authenticated host traces. |
| Requested model/effort | **PASSED as dispatch record** | Requested values and task names are recorded. Effective/returned model and effort remain `null`; no self-attestation is accepted. |
| Proposed batch implementation/tests | **NOT RUN** | No proposed source/test file exists and no proposed command ran. Only existing-fixture diagnostics/baseline assertions ran. |
| Controller transition, human approval, feature acceptance | **NOT RUN** | No approval or readiness report changes controller state. |
| Installed-plugin invocation/release, full C3.4/C3.5/v1 acceptance | **NOT RUN** | This was source-pinned resource consumption through a custom host binding only. |
| BMAD full architecture workflow, new selector/engine, new production source | **NOT APPLICABLE / absent** | BMAD full workflow was not selected; existing team transport was used. No selector, renderer, state engine, or production integration was added. |
| Linux/full-stack/UI/data/training/product-Agent applicability | **NOT APPLICABLE** | The fixture is a local Node ESM planning seam and provides no evidence for those environments. |

## Reuse decision

**Use and keep, selectively:**

- Keep the original cc-sdd EARS requirements, boundary-first design, traceability, task coverage/order/dependency, observable-completion, and bounded review-gate ideas as optional planning resources. S and C show that the resources can be consumed through the existing host and produce concrete packages; N shows the same acceptance quality can also be reached without them on this fixture, so this is feasibility evidence, not superiority evidence.
- Keep Spec Kit `analyze.md` as an optional independent, read-only consistency/constitution/coverage review method. C demonstrates a workable mapped review and correct negative-challenge refusal, but no incremental reliability advantage over native or cc-sdd review is established.
- Keep source pinning, provenance, initial/final archive separation, challenge injection isolation, and preservation checks. They provided the strongest evidence in this trial.

**Adapt before another trial:**

- Retain `host-bindings.md` as an explicit custom seam: map to Leo's canonical artifacts, keep numeric IDs, use `tasks-draft.md`, treat all output as proposal-only, route independent review through the actual host, and disable upstream metadata/auto-approval, installers, hooks, state, network, and helper spawning unless separately authorized.
- Add `actor-report.md` and `consumption.json` to every review allowlist when criterion 7 asks about actor method/resource use. Do not require duplicate disclosure inside proposal artifacts.
- State the success oracle explicitly: compare parsed JSON for exactly the two required keys and numeric values, require exactly one terminating newline/no extra line, status 0, and empty stderr; do **not** require internal whitespace or property order. Continue byte-exact comparison only for the fixed invalid line and the established legacy examples where the authority fixes bytes.
- Apply literal-case and disclosure thresholds symmetrically across arms before dispatch. Cross-links may improve handoff, but must be predeclared if mandatory.
- If causal comparison is desired, add replicated runs, confirmable runtime telemetry if the platform exposes it, and isolate drafting versus review interventions instead of changing both between N and S.

**Reject or defer:**

- Reject upstream approval/metadata transitions, `tasks.md` finalization, installer/hook registries, parallel state stores, and auto-approval semantics in this seam. They conflict with Leo's authority model unless a separately specified integration proves otherwise.
- Reject claims that more templates, more prose, more findings, shorter elapsed time, or this single feature establish a superior framework, lower cost, faster work, or general routing/reliability.
- Defer any installed-plugin release, production controller integration, generic engine/selector, full BMAD architecture workflow, full C3.4/C3.5/v1 acceptance, or implementation. Those remain outside this trial and require their own specification and acceptance evidence.

The remaining custom seam is substantial: the binding is not an upstream-native configuration, the reports are not authenticated consumption telemetry, installed-host behavior is untested, and the controller's unsupported composite assessment/versioned-plan work remains open. The sound bounded conclusion is therefore **selective reuse with explicit Leo authority adapters and a corrected success oracle**, not composition adoption or framework replacement.
