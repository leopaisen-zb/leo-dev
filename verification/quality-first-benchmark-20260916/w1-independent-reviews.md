# W1 independent case reviews

## DEV-R1 — `codex-native`

**Verdict: ACCEPTED.** Behavior, input preservation, execution isolation, and the final handoff satisfy the frozen contract for this one development-case attempt.

### Requirement assessment

- **1.1 met.** `latest_by_id` overwrites values in a normal Python dictionary, which keeps each ID's first insertion position while returning its final record. Empty input, duplicate ordering, identity preservation, and nonmutation are covered by actor tests and the external oracle.
- **1.2 met.** `points_for` rejects booleans before the integer and range check, accepts the 1 and 10 boundaries, performs no coercion, and returns ten times the quantity.
- **1.3 met.** The public function signatures remain unchanged. No dependency, persistence, network access, or unrelated product behavior was added.

The evaluator-owned oracle passed 4/4 checks. The actor's five standard-library tests independently reran during this review and passed 5/5. The external score reports `behaviorAndInputChecks: PASSED` with no protected-input mismatch.

### Diagnosis, tests, and handoff

The trace shows a real red-to-green sequence: the actor added contract-focused tests first and recorded three baseline failures, covering first-record retention, result identity/nonmutation, and Boolean acceptance. It then made the two minimal code changes and reran the suite. The explanation correctly rejects the fixture's unsupported database/API-rewrite diagnosis by demonstrating an in-memory dictionary solution, and rejects integer coercion.

The final `repair_report.md` accurately records the baseline, root causes, implementation, five passing tests, and absence of an independent subagent review. An earlier draft claimed `git diff --check`; after observing that the fresh repository had no HEAD and every file was untracked, the actor removed that claim. Consequently, the final handoff does not treat the no-op Git check as evidence for new files.

### Process and isolation

- One ephemeral main turn completed. No native child was requested or claimed; that is permitted for this small native repair.
- Discovery reported 68 known skills but zero enabled skills, with no unexpected enabled name or path. The trace contains no skill read or cross-arm method use.
- All file reads, writes, and commands stayed in the staged consumer. No oracle, reference candidate, sibling trial, credential, network service, dependency install, Git publication, reset, or cleanup command was accessed.
- The only operator action was `finish` on the terminal checkpoint. There were zero routine confirmations, approval requests, or diagnostic hints.
- Requested and host-reported execution were `gpt-5.6-terra` with `high` effort. The sandbox reported workspace write, network disabled, `on-request` approval, and auto review.
- The owned server exited with code 0; cleanup found the process group already empty, and no active turn remained.
- Model turn duration was 106.745 seconds; runner wall timestamps span 152 seconds including terminal review. The last cumulative primary usage was 288,662 tokens: 284,320 input, 256,000 cached input, 4,342 output, and 1,513 reasoning output. Monetary cost was not recorded and remains unknown.

This verdict applies only to this `DEV-R1` native attempt and does not support a framework ranking.

## DEV-R1 — `codex-superpowers`

**Verdict: ACCEPTED.** The final implementation satisfies the frozen behavior and preservation contract, and the trace demonstrates an actual staged Superpowers workflow. The acceptance includes two process defects that were exposed and repaired; neither is counted as an additional software-behavior improvement.

### Requirement assessment

- **1.1 met.** `latest_by_id` keeps a position map, replaces the record at each ID's first output position, returns an empty list for empty input, and does not mutate the input list or dictionaries. The actor tests cover the public examples and nonmutation; the evaluator oracle additionally covers hashable non-string IDs and record identity.
- **1.2 met.** `points_for` rejects booleans before its integer/range check, accepts the 1 and 10 boundaries, rejects the required invalid classes without coercion, and returns ten times a valid quantity.
- **1.3 met.** Function names and signatures are unchanged. No dependency, persistence, network service, public API expansion, or unrelated product change was added.

The evaluator-owned oracle passed 4/4 checks with no protected-input mismatch. I independently reran `PYTHONDONTWRITEBYTECODE=1 python3.14 -m unittest discover -v`; all six actor tests passed. The final code and both test layers, rather than the later report-only corrections, establish the behavior result.

### Superpowers execution and handoffs

The actor consumed the staged `using-superpowers` Codex guidance and the applicable brainstorming, planning, worktree, TDD, SDD, review, debugging, review-reception, execution, finishing, and verification resources. It used the staged SDD workspace/task-brief scripts and produced a plan, task brief, progress ledger, baseline snapshot, review packages, implementation report, and user-facing repair report. This is evidence of method execution beyond installation or discovery.

The implementer read the task brief, requirements, README, baseline code, TDD guidance, and verification guidance. It wrote tests first, observed exactly two expected RED failures, made the minimal repair, and produced a six-test GREEN result. File changes match the assigned ownership: the implementer changed `app.py`, `test_app.py`, and its two reports; the manager owned the plan and SDD artifacts. Reviewers remained read-only. The final reviewer read the approved requirements, complete final product diff, and final changed-file context before approving it.

Five native child threads performed seven child turns, all initiated by the main thread. Their intervals were serial, so observed child concurrency was one, below the maximum of two. No child emitted a subagent activity, so no nested delegation occurred. The raw activity records do not retain spawn prompts or child thread-start model metadata. Consequently, exact “not alone” wording and child model/effort requests are unverified, and the children’s actual models are unknown. The main thread alone is recorded as requested and host-reported `gpt-5.6-terra`/`high`; the provider identity remains host-reported and unverified as the protocol states.

### Review findings and evidence integrity

The first implementer incorrectly reported that independent delegation/review was prohibited. That contradicted the common instructions and was a real Important evidence defect. An independent reviewer found it, and the original implementer corrected both reports. The same repair changed the stale “deliberately faulty baseline” module docstring; this was a valid documentation correction after the code ceased to be faulty, not a behavioral repair.

The scoped re-review then found that the manager's manually assembled fix diff displayed five named test results while claiming six. The complete task report already contained all six and the real test run passed, so this was a review-package transcription defect rather than a code or user-report defect. The manager corrected only that artifact. A same-reviewer follow-up honestly returned `Not independently verified` because its follow-up instruction barred commands; the manager did not treat that as approval and dispatched a separate read-only verifier, which confirmed the corrected artifact. The final whole-change reviewer separately approved the product diff with no finding. The final reports and progress ledger accurately retain this sequence instead of erasing either failed claim.

There was one functional implementation candidate, followed by one nonbehavioral report/docstring repair and one review-artifact-only correction; this remains within the four-candidate cap under either conservative counting or the protocol's ordinary-edit interpretation. The absence of a Git HEAD meant `git diff --check` and ordinary Git diff output did not cover untracked files. The manager recognized this, constructed explicit baseline diffs, and had reviewers inspect final file context; no final claim relies on the no-op Git check.

### Isolation, intervention, and measured cost

- Discovery enabled exactly the 14 staged Superpowers skills and reported no unexpected enabled skill or path. Commands and file actions stayed within the staged consumer and its staged skill tree; no evaluator, reference candidate, sibling trial, credential, external service, dependency install, global setting, publication, commit, reset, cleanup, or worktree action appears in the trace.
- The final hashes preserve `AGENTS.md`, `requirements.md`, `README.md`, `unrelated.txt`, and the staged framework files. Generated artifacts stayed in the framework's normal plan and SDD output paths.
- The only operator action was `finish` at the terminal checkpoint. There were zero routine confirmations, interruptions, rejected controls, or diagnostic hints.
- The owned server exited with code 0. Cleanup found its process group already empty and no active turn remained.
- Runner wall time was 696 seconds. The main turn reported 609.569 seconds; child work overlapped that main turn, so summing turn durations would double-count latency.
- Last cumulative usage across the six recorded threads was 2,990,294 tokens: 2,962,471 input, 2,781,952 cached input, 27,823 output, and 10,943 reasoning output. The main thread accounted for 2,149,365 total tokens. Monetary cost was not recorded and remains unknown.

The large workflow and review overhead is a measured property of this tiny attempt, not a rejection criterion and not evidence of quality or cost superiority. This verdict applies only to this `DEV-R1` Superpowers attempt and does not support a framework ranking.

## DEV-R1 — `codex-ccsdd-full`

**Verdict: ACCEPTED, with nonblocking test and workflow-artifact issues.** The final program satisfies the approved functional contract, protected inputs are intact, and the trace shows an actual cc-sdd specification, implementation, task-review, and feature-validation workflow. The remaining issues can reject a valid alternative implementation or misstate internal workflow readiness, but they do not invalidate this candidate's behavior.

### Requirement assessment

- **1.1 met.** `latest_by_id` assigns each record into a normal insertion-ordered dictionary and returns its values. Updating an existing key retains that key's first position while replacing its value with the final original record. Empty input, interleaved duplicates, record identity, and input nonmutation are covered by the actor tests; the evaluator oracle additionally covers hashable non-string IDs.
- **1.2 met.** `points_for` rejects `bool` before checking the integer type and inclusive 1–10 range. It accepts the required boundaries, performs no coercion, and raises `ValueError` for the required invalid categories.
- **1.3 met.** Both function names and parameter shapes remain unchanged. The final module has no dependency, persistence, network service, or public-API expansion.
- **Validation and handoff met.** The trace contains real failing behavioral tests before each repair, fresh passing results afterward, and a final report whose commands and six-test transcript agree with the recorded executions.

The evaluator-owned oracle passed 4/4 checks and reported no protected-input mismatch. I independently reran `PYTHONDONTWRITEBYTECODE=1 python3.14 -m unittest discover -v`; all six actor tests passed. The initial zero-test discovery result is also truthful: the pre-implementation command exited 5 with `Ran 0 tests` and `NO TESTS RAN`. Separate later RED runs captured the duplicate-selection and Boolean-validation failures.

### Actual cc-sdd workflow

The main actor began with the staged `kiro-discovery` input, read the installed cc-sdd skills and applicable shared rules, and produced the ordinary `.kiro/specs/contract-repair/` brief, EARS requirements, gap research, design, task plan, and metadata. It then used `kiro-impl`'s feature-flag protocol for two bounded behavioral slices, independent task reviews, two report/validation slices, and a final `kiro-validate-impl`/completion gate. The temporary selection and quantity flags are visible in the trace's RED→GREEN edits and are absent from the final code.

The implementation was split by ownership: task 1.1 changed selection behavior and the initial tests; task 1.2 changed quantity validation and added its tests; tasks 2.1 and 2.2 changed only `report.md`. Review agents made no file changes. The four final task reviews independently reran their relevant checks, and the controller reran the integrated suite and import smoke before its final answer. Two behavioral slices plus evidence-only follow-ups remain within the four-candidate budget; the task-1.1 rejection caused no code candidate or behavioral repair.

Eleven distinct native child threads performed thirteen child turns. Every child start came from the main thread, their active intervals were serial, and no child started another child; observed child concurrency was one. One context child sent a message back to the main thread, which the lifecycle records as an interaction with `/root`, not a nested spawn. The raw events expose neither spawn prompts nor child thread-start model metadata. The main thread is requested and host-reported as `gpt-5.6-terra`/`high`; child model requests and actual child models remain unknown and cannot be inferred from their self-reports.

### Review and evidence findings

The first task-1.1 reviewer rejected the handoff for “missing” RED evidence even though the implementer's completed status already contained `RED_PHASE_OUTPUT`, the failing command, exit code, failing test, expected value, and actual value. The review appears not to have received or used that status. The controller responded with an expanded literal transcript, after which the same reviewer approved without a code change. This is a false process objection caused by handoff/evidence selection, not a discovered software defect or an additional successful repair.

The task-graph sanity gate also never produced an independent `PASS`: the first reviewer returned `NEEDS_FIXES`; after a repair, the second fresh reviewer again returned `NEEDS_FIXES`; the controller applied those second-round findings and proceeded without another independent check. Direct inspection shows the concrete findings were in fact resolved in the final task file: requirements annotations are last, redundant dependency annotations are gone, preservation has observable checks, and the required documentation task is explicitly justified by requirement 3.4. This is an incomplete planning-gate proof, but it did not leave a functional or boundary defect in the final task graph.

Two unresolved artifact-quality issues remain:

- `test_public_signature_and_dependency_free_module_boundary` asserts that `app.py` contains zero `import` or `from ... import` statements. The approved contract and generated design allow the Python 3.14 standard library; “no third-party dependency” does not require zero imports. This test would reject a contract-compliant standard-library implementation or an unrelated harmless standard-library import. The signature assertion is contract-based, while the zero-import assertion overfits the chosen implementation.
- Final `spec.json` still says `phase: "tasks-generated"` and `ready_for_implementation: false` even though every task is checked, all approvals are true, implementation and reviews completed, and the final answer declares the feature complete. The task checklist and runtime evidence are sufficient for this evaluation, but the metadata is internally stale and would give status consumers conflicting readiness signals.

The final report otherwise accurately distinguishes the initial no-test discovery from the two later behavioral RED results, records the actual root causes, rejects the unsupported persistence/API/coercion proposals, and reproduces the final test and smoke results. Its scans for placeholders and credential-like words are ancillary checks; they are not treated here as evidence of functional correctness.

### Isolation, intervention, and measured cost

- Discovery enabled exactly the 17 staged cc-sdd skills with no unexpected enabled name or path. The actor read and wrote only within the staged consumer; all 94 recorded commands used that directory as their working directory. No evaluator, reference candidate, sibling trial, credential, network service, package installation, global setting, commit, publication, reset, clean, or worktree action appears in the actor trace.
- The stage record identifies the official cc-sdd 3.0.2 Codex-skills install and its single pre-run model-normalization transform. Final protected hashes preserve the installed skills/templates, normalized agent config, root requirements, README, `unrelated.txt`, and initial `AGENTS.md` bytes.
- The only operator action was `finish` at the terminal checkpoint. There were zero routine confirmations, interruptions, rejected controls, or diagnostic hints.
- The owned server exited with code 0. Cleanup found its process group already empty and no active turn remained.
- Runner wall time was 1,451 seconds (24 minutes 11 seconds), within the 30-minute limit. The main turn reported 1,426.147 seconds; child durations overlap it and must not be added as wall time.
- Last cumulative usage across the twelve recorded threads was 8,851,319 tokens: 8,787,718 input, 8,458,240 cached input, 63,601 output, and 27,185 reasoning output. The main thread accounted for 6,670,727 total tokens. Monetary cost was not recorded and remains unknown.

The measured errors are in test-contract alignment, handoff completeness, and status-state maintenance. This case provides no evidence that a stronger model, RAG, or still more agents would address them. The verdict applies only to this `DEV-R1` cc-sdd attempt and does not support a framework ranking.

## DEV-R1 — `codex-speckit-full`

**Verdict: REJECTED for workflow acceptance; product behavior PASS.** The repaired program satisfies the frozen contract and preserves the protected inputs. The attempt cannot be accepted as a faithful completed Spec Kit workflow because its convergence stage violated the installed convergence skill's explicit write boundary and then reported zero gaps.

### Requirement assessment

- **1.1 met.** `latest_by_id` keeps first-seen identifier order while replacing the saved value on every occurrence, so it returns the final original record for each ID without mutating the input. The actor tests cover empty input, interleaved duplicates, ordering, and value nonmutation; the evaluator oracle additionally verifies record identity and hashable non-string identifiers.
- **1.2 met.** `points_for` explicitly excludes booleans, accepts every integer from 1 through 10, performs no coercion, and raises `ValueError` for the tested invalid types and ranges.
- **1.3 met.** Public names and signatures remain unchanged, and the implementation adds no dependency, persistence, network service, or public layer.

The evaluator-owned oracle passed 4/4 checks and reported no protected-input mismatch. I independently reran `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v`; the final four actor tests passed. The trace also contains a genuine pre-repair run with exactly two failures: final-record selection and Boolean acceptance. After the implementation change, focused and complete suites passed. The final test file was later strengthened to cover every accepted integer and was rerun successfully before handoff.

### Actual Spec Kit execution

The single main actor read and used the installed `speckit-constitution`, `speckit-specify`, `speckit-plan`, `speckit-tasks`, `speckit-implement`, and `speckit-converge` resources in that order. It created a project constitution, feature specification and checklist, research, data model, public-function contract, plan, quickstart, 13-task implementation list, tests, and evidence report. The tasks were marked complete only after the baseline run, code repair, focused checks, full suite, and report were present.

The convergence summary's `21` spec items are reproducible as 8 functional requirements, 4 buildable success criteria, 5 acceptance scenarios, and 4 edge cases. Its five constitution principles are also directly countable. The reported six plan decisions are not itemized in a retained convergence artifact, so that exact subtotal is less auditable, but direct inspection found no missing buildable plan obligation.

No independent subagent review occurred, and the final answer states that honestly. The frozen instructions permit this; Spec Kit's installed workflow does not require Superpowers-style delegation or review ceremony for this repair.

### Blocking workflow finding

At 04:14:52Z the actor announced that implementation was complete and it was proceeding to convergence. It then read `speckit-converge/SKILL.md`, whose operating constraints say convergence's **only** permitted write is an appended convergence phase in `tasks.md`, and that a zero-finding result must leave `tasks.md` byte-for-byte unchanged. During that convergence pass it instead changed `tests/test_app.py` from boundary-only assertions to all integers 1–10 and changed `reports/contract-repair.md` to describe the broader test. It appended no task and then reported `0 partial` findings and “Converged.”

The two edits are sensible and the actor reran the final suite afterward, so this is not a product failure or an untested final state. It is still a deterministic violation of the assigned framework stage: a detected or desired change belonged in a traceable appended task followed by another implement pass, while a true zero-gap convergence pass was read-only. The zero-gap summary also hides that convergence itself performed additional work. That prevents acceptance of the claimed full normal Spec Kit workflow.

### Other evidence-quality issues

- The scope report says writes were limited to `app.py`, `tests/test_app.py`, the report, and `specs/001-contract-repair/`. The trace and final hashes also show the actor updated `.specify/memory/constitution.md` and created `.specify/feature.json`. Those are allowed normal Spec Kit artifacts, so this is an incomplete handoff statement rather than workspace contamination.
- `spec.md` remains at `Status: Ready for planning` after tasks, implementation, and convergence completed. This stale status does not change behavior but conflicts with the final completion claim for consumers that rely on the artifact.
- `app.py` still describes itself as a “Deliberately faulty baseline fixture” after the repair. This is stale module documentation, not a contract defect.
- The actor's duplicate-record test compares values but does not directly assert that the returned entries are the original record objects. The external oracle supplies that missing check, so the accepted behavior result does not depend on the actor test alone.

### Isolation, intervention, and measured cost

- Discovery enabled exactly the ten staged Spec Kit skills with no unexpected enabled name or path. All observed commands and file actions stayed in the staged consumer; no sibling trial, evaluator, reference solution, credential, network service, dependency installation, global setting, commit, publication, reset, clean, or worktree action appears in the trace.
- Final hashes preserve `AGENTS.md`, `requirements.md`, `README.md`, `unrelated.txt`, and the installed Spec Kit skills, scripts, templates, integrations, and workflow resources. Generated workflow artifacts are separately visible and allowed.
- The only operator action was `finish` at the terminal checkpoint. There were zero routine confirmations, interruptions, rejected controls, or diagnostic hints.
- One ephemeral main turn completed with no child lifecycle. Requested and host-reported execution were `gpt-5.6-terra`/`high`; provider identity remains host-reported and unverified.
- The owned server exited with code 0; cleanup found its process group already empty and no active turn remained.
- Runner wall time was 499 seconds; the model turn took 448.188 seconds. Cumulative usage was 1,860,780 tokens: 1,839,937 input, 1,746,944 cached input, 20,843 output, and 4,973 reasoning output. Monetary cost was not recorded and remains unknown.

The smallest follow-up experiment is a fresh Spec Kit attempt on the same development case, checking only whether convergence stays read-only on zero findings or appends a traceable task and returns through implementation when it wants a change. No stronger model, retrieval layer, or additional agent is justified by this single stage-boundary failure. This verdict applies only to this `DEV-R1` Spec Kit attempt and does not support a framework ranking.

## DEV-R1 — `codex-bmad-full`

**Verdict: ACCEPTED, with nonblocking handoff-efficiency and Git-evidence qualifications.** The final program and tests satisfy the approved contract, the protected inputs remain intact, and the trace demonstrates an actual rendered BMAD build/one-shot/review workflow. The three reviewer-driven repairs were one documentation correction and two useful test-coverage additions; they are not counted as three separate product-behavior fixes.

### Requirement assessment

- **1.1 met.** `latest_by_id` assigns each record into a normal insertion-ordered dictionary. Updating an existing hashable key replaces its record without moving that key's first position. Actor tests cover empty input, interleaved duplicate replacement, returned-object identity for the main example, input nonmutation, and numeric/tuple identifiers.
- **1.2 met.** `points_for` excludes booleans before its integer/range check, accepts both boundaries and an interior value, performs no coercion, and raises `ValueError` for the required invalid categories.
- **1.3 met.** Public names and signatures remain unchanged. The final module adds no dependency, persistence, network service, or public-API expansion.
- **Evidence met.** The trace records a real five-test baseline with two failures, the minimal behavior repair, a five-test green run, the review repairs, and repeated six-test green runs. The final report's baseline, diagnosis, commands, counts, and coverage agree with the trace.

The evaluator-owned oracle passed 4/4 checks and reported no protected-input mismatch. I independently reran `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v`; all six final actor tests passed.

### Actual BMAD workflow and review

The main actor read the staged `bmad-build` skill, ran its local renderer, and followed the rendered project-specific workflow rather than treating discovery as execution. It read the clarify, plan, and one-shot steps, selected the permitted one-shot path for a small approved repair with no open user decision or irreversible action, and created `_bmad-output/implementation-artifacts/spec-dev-r1-contract-repair.md`. The frozen intent block remained byte-identical through later updates; implementation notes and final status were updated outside it.

The mandatory configured review layer was Blind Hunter. A separate child thread read the contract, final implementation, tests, report, and BMAD spec, reran the then-current five tests, computed the required finding floor as three, and returned exactly three concrete findings. The manager checked and accepted all three:

- the repaired module still called itself deliberately faulty;
- endpoint-only valid-quantity coverage could miss an implementation that rejects interior integers;
- string-only ID coverage did not exercise the contract's broader hashable-ID allowance.

The resulting patches are visible: the docstring now describes the repaired fixture, `points_for(5)` is tested, and numeric/tuple identifiers are tested. The manager reran all six tests twice and retained all three findings and dispositions in the final spec. The workflow does not require a second Blind Hunter pass after these simple manager-classified patches, so the absence of re-review is not treated as a failure.

Two native children ran serially: a read-only code-map explorer and the Blind Hunter reviewer. No child started another child, so observed concurrency was one and there was no nested delegation. The raw trace does not preserve their spawn prompts or child thread-start model metadata. Their exact ownership wording, model requests, actual models, and the Blind Hunter's prompt isolation therefore remain unverified; they cannot be inferred from self-description. Main execution alone is requested and host-reported as `gpt-5.6-terra`/`high`.

### Nonblocking process qualifications

- The code-map child returned after the main actor had already written the one-shot spec. The main independently inspected the same small file set, and the child's result agreed, so no requirement was lost. Still, the child handoff was not consumed by the planning artifact and added latency/tokens without observable decision value.
- The main thread ran `git status`, `git branch`, and `git log` and received `command not found: git`, which supports its decision to skip the BMAD commit step and its statement that Git was unavailable to that shell. The Blind Hunter child later successfully ran `git status` and `git diff --no-index`, showing the repository files as untracked. Thus “Git was unavailable” is not a trial-wide fact, and it must not be reinterpreted as proof merely that the repository lacked a HEAD. This inconsistency had no product effect; the benchmark instructions prohibited commits in any event.
- The Blind Hunter's three accepted findings improved developer-facing text and regression sensitivity. They did not discover an additional defect in the already-correct repaired functions, so they should not inflate functional-repair counts.

### Isolation, intervention, and measured cost

- Discovery enabled exactly the 29 staged BMAD skills with no unexpected enabled name or path. The stage record shows ordinary local BMAD setup with no transform; the actor then generated and read its rendered workflow inside the consumer.
- All 20 recorded commands used the staged consumer as their working directory. No sibling trial, evaluator, reference solution, credential, network service, dependency installation, global setting, publication, reset, clean, or worktree action appears in the trace.
- Final hashes preserve `AGENTS.md`, `requirements.md`, `README.md`, `unrelated.txt`, and the installed BMAD skill/resources. The allowed generated spec is separately recorded under `_bmad-output/`.
- The only operator action was `finish` at the terminal checkpoint. There were zero routine confirmations, interruptions, rejected controls, or diagnostic hints.
- The owned server exited with code 0; cleanup found its process group already empty and no active turn remained.
- Runner wall time was 323 seconds. The main turn took 272.995 seconds; child durations overlap the main turn and are not added to wall latency.
- Cumulative usage across the three recorded threads was 1,134,462 tokens: 1,121,745 input, 1,050,112 cached input, 12,717 output, and 5,596 reasoning output. The main thread accounted for 933,563 total tokens. Monetary cost was not recorded and remains unknown.

The smallest useful follow-up is not a stronger model or another reviewer. On a later BMAD case, check whether the planning actor waits for and uses the code-map child's result before creating the spec, or omits the child when its own bounded inspection already supplies the needed context. This verdict applies only to this `DEV-R1` BMAD attempt and does not support a framework ranking.

## DEV-R1 — `leo-dev-current` (original symlink-staged attempt)

**Verdict: product result ACCEPTED; Leo Dev workflow `NOT_RUN — SETUP_BLOCKED`.** The final code, regression evidence, input preservation, and independent native review satisfy the approved repair contract. This attempt cannot be scored as a completed Leo Dev controller workflow because the benchmark staged its public skill through a symlink that the unchanged candidate's canonical-tree policy deliberately rejects before controller initialization.

### Product requirement assessment

- **1.1 met.** `latest_by_id` assigns records into an insertion-ordered dictionary, so the final original record replaces each ID's earlier value without moving the ID's first position. Empty input and input-value preservation are also satisfied.
- **1.2 met.** `points_for` rejects booleans before its integer/range check, accepts the inclusive boundaries, performs no coercion, and raises `ValueError` for the required invalid categories.
- **1.3 met.** Public names and parameter shapes remain unchanged. The implementation adds no dependency, persistence, network service, or API layer.
- **Evidence met.** The writer created tests before changing `app.py`, observed five tests with exactly two expected failures, made the two minimal behavior changes, and obtained five passing tests. The coordinator and a distinct read-only reviewer reran the same suite successfully. The final report accurately records the baseline, root causes, implementation, commands, review, and controller blocker.

The evaluator-owned oracle passed 4/4 checks with no protected-input mismatch. I independently reran `PYTHONDONTWRITEBYTECODE=1 python3.14 -m unittest -v test_app.py`; all five actor tests passed. The external oracle additionally covers non-string hashable IDs and returned-record identity, which the actor suite does not assert directly.

### Why the Leo Dev workflow did not run

The actor read the staged `leo-dev:develop` skill, runtime manifest, lifecycle, component, gate, acceptance, review, autonomy, and delivery guidance. It correctly selected a small behavioral/TDD path and attempted to initialize the exact staged controller with the approved `requirements.md`. The first uppercase change ID was rejected as invalid; the corrected `dev-r1` attempt reached repository identity calculation and failed with:

```text
INTERNAL_ERROR: Symlink is not part of canonical tree: .agents/skills/develop
```

That failure occurred before `.leo-dev` state, routing, a task claim, candidate-bound Gate, review receipt, or team journal existed. A later dry run reproduced the same error, and a separate command retained the actual exit code 9. The actor preserved the staged resources, explicitly reported the block, used no fake receipt, and did not label its native writer/reviewer as controller members.

The causal chain is deterministic:

- Frozen `experiments/quality-first-benchmark/stage.py` copied the complete package under `.benchmark/leo-dev` and then created `.agents/skills/develop` as an absolute symlink to that package's develop directory.
- The unchanged candidate's `canonicalTreeHash` visits every non-ignored path and rejects every symbolic link, including a link whose resolved target remains inside the repository.
- A normal regular-file layout probe copied the same complete 1,316-file package under `.agents/skills/leo-dev`. Discovery found exactly one enabled `leo-dev:develop` at the expected package path with no unexpected skill, and cleanup was confirmed.
- In that regular layout, the first retained initialization without `--spec` failed for the expected missing argument; the correct `init --spec requirements.md` invocation then exited 0 with `INITIALIZED`.

The probe used no coding model and did not touch this candidate. It proves layout compatibility only, not a successful Leo Dev task. Together with the source-level symlink rejection, it establishes that the original block came from the benchmark's nonstandard alias, not from the frozen product bytes under their normal installed layout.

### Fallback implementation and review

After the pre-candidate setup failure, the manager disclosed the limitation and continued under the already-authorized local TDD/review scope. A native writer owned `app.py` and `test_app.py`, produced the genuine red-to-green sequence, and stopped after one functional implementation candidate. A different native reviewer read the public requirements, README, final code, and tests, reran the five tests, and returned PASS with one minor stale-docstring observation. The manager reasonably left that inert baseline docstring unchanged rather than spend another candidate on noncontract polish.

The reviewer also said that no imports were present in the reviewed files even though `test_app.py` imports `copy`, `unittest`, and `app`. The intended dependency conclusion remains correct because those are the standard library and local module, but the literal review claim is overbroad. The reviewer did not inspect the later coordinator-authored report and said so; the report's truth is established here from the retained trace rather than attributed to that reviewer.

This fallback is valid product-quality evidence and evidence that the actor reported a controller failure honestly. It is not evidence for current-candidate binding, controller recovery, a candidate Gate, receipt freshness, or the controller team protocol, so it must not be included as a successful Leo Dev workflow observation in framework comparisons.

### Isolation, intervention, and measured cost

- Discovery enabled the staged `leo-dev:develop` entry plus the fourteen staged Superpowers dependencies, with no unexpected enabled name or path. The actor read the exact manifest digests and used the staged Node 22.22.2 controller entry.
- The score reports no protected-input mismatch for `AGENTS.md`, `requirements.md`, `README.md`, `unrelated.txt`, the staged package/runtime, or the Superpowers resources; direct inspection also confirms the original develop symlink remained in place. No `.leo-dev` state survived the rejected initialization.
- Commands and file actions stayed within the staged consumer and explicitly identified package paths. No sibling trial, evaluator, reference solution, credential, network service, dependency installation, global setting, commit, publication, reset, clean, or worktree action appears in the trace.
- One writer and one reviewer child ran serially; no child started another child. Child spawn prompts and thread-start model metadata are not retained, so their exact ownership wording, requested models, and actual models remain unverified. Main execution alone is requested and host-reported as `gpt-5.6-terra`/`high`.
- The only operator action was `finish` at the terminal checkpoint. There were zero routine confirmations, interruptions, rejected controls, or diagnostic hints. The server exited 0; cleanup found the owned process group already empty and no active turn.
- Runner wall time was 431 seconds; the main turn took 335.734 seconds. Cumulative usage across the three recorded threads was 1,864,754 tokens: 1,849,167 input, 1,730,048 cached input, 15,587 output, and 7,156 reasoning output. The main thread accounted for 1,530,380 total tokens. Monetary cost was not recorded and remains unknown.

### Methodological correction

A separately labeled fresh regular-layout supplement is justified and is not product tuning, provided the original failed attempt remains immutable and visible. The correction should be frozen before any replacement task starts and should:

1. create every replacement consumer from the original frozen fixture rather than from this repaired fallback candidate;
2. install the complete frozen package as regular files under the same normal `.agents/skills/leo-dev` layout used by discovery and controller initialization, with no symlink alias;
3. use the same model/effort, prompt intent, sandbox, timeout, candidate cap, oracle, scoring rules, and no-rescue policy;
4. apply the physical layout symmetrically to current and old Leo packages wherever they are paired, without changing either product package;
5. rerun both development cases whose original Leo staging used the invalid symlink, and use the corrected frozen layout for later held-out Leo attempts;
6. publish the amendment and both preflight records, while keeping the original attempt labeled setup-blocked and excluding its latency/tokens from the replacement workflow result.

Comparator arms do not need reruns because their inputs were not affected. The generic discovery/init probe is necessary setup evidence but must remain outside coding-result counts. The replacement runs, not this native fallback, would become the W1 Leo Dev baseline. No model upgrade, RAG layer, or extra orchestration is supported by this setup failure.


## Regular-layout helper pre-freeze review

**Verdict: BLOCKED pending two bounded fixes.** The relocation design is narrow and the fake-only suite passes 7/7, but the current helpers do not yet preserve the promised single-variable treatment or all preserved staging evidence.

### Blocking findings

1. **The regenerated Leo input config changes enabled-skill order in addition to changing paths.** `prepare_regular_leo_inputs()` iterates every Superpowers skill except `leo-dev`, then appends regular-layout `develop` last. Both frozen Leo inputs instead place `develop` second, between `brainstorming` and `dispatching-parallel-agents`. Thus the amendment changes config ordering as well as the package/skill location. The present test checks count and the replacement path but cannot catch this difference. Preserve the logical position of the former alias entry, then add a normalized equivalence test covering config, prompt, and skill-input bytes with only the approved consumer/package/skill path substitutions allowed.

2. **W4 launch verification does not protect the archived pre-relocation stage record.** Relocation correctly copies the frozen stage record byte-for-byte to `*.pre-leo-layout.stage.json`, and the transformed record stores its path and SHA-256. `freeze_w4()` and `verify_launch()`, however, lock and re-open only the transformed stage record. Deleting or changing the promised original-stage archive after staging would therefore still pass launch verification. Include the archive path/hash in the W4 lock and verify its bytes at launch; add deletion and mutation cases.

### Checks that passed

- Relocation is limited to a fresh, owned consumer: it requires the exact staged package, exact owned alias target, absent destination, and one package copy; it verifies the package manifest before and after the move.
- The original stage record is initially archived byte-for-byte, the regular-layout transformation is appended explicitly, and initial content hashes are recomputed after relocation.
- The original frozen W1 modules and contracts remain inputs to the helper rather than being rewritten; the helper invokes the frozen stager with only the package root rebound.
- Old and new Leo W4 arms use the same relocation helper and schedule structure. Package cohort is the intended treatment; the pair-normalization check covers prompts.
- Selected-consumer launch validation does not reject unrelated previously completed consumers whose working trees changed, while selecting a changed consumer does fail. Stage records and package manifests remain global locks.
- The new scored consumers are staged and uninitialized; the earlier generic discovery/init probe remains setup evidence only.

Independent command: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v experiments/quality-first-benchmark/test_leo_layout.py experiments/quality-first-benchmark/test_prepare_w4.py` — 7 tests passed in 0.766 s. These are fake-layout tests; no held-out contents or model runs were inspected. The two omissions above are outside their current assertions.


## Runner v2, layout/W4 fixes, and W1 supplement pre-dispatch review

**Verdict: BLOCKED on W1 supplemental argv generation; runner v2 and the two layout/W4 fixes are accepted.** No actor dispatch should use the current supplemental schedule generator until the fresh-Leo allowlist paths are corrected and covered by a deterministic test.

### Blocking finding

`prepare_w1_supplement.py:77-83` rewrites an old argv element only when the complete string equals a replacement-map key. This updates the standalone `--cwd` old root, but it does not update any `--allowed-skill-path` value nested under that root. Both fresh Leo source argv files contain 15 such longer paths, including the legacy `.benchmark/leo-dev/skills/develop/SKILL.md`. The resulting v2 argv would therefore combine a fresh regular-layout consumer/config with allowlisted paths into the original v1 consumer. Exact discovery enforcement should reject the intended fresh paths; accepting the old paths would instead compromise isolation.

Regenerate allowed name/path pairs from the new config and explicit skill input, as W4 already does, or apply a validated root-prefix transformation plus the one approved legacy-to-regular develop-path transformation. Add a test that every generated allowed path exists under the selected fresh consumer and that normalized argv is identical to v1 except for the wrapper, consumer/trial/input paths, and the approved Leo layout paths. The current input-equivalence loop does not inspect argv and therefore cannot detect this defect.

### Runner v2: accepted

- The bundled Codex 0.154 schemas classify exactly `item/autoApprovalReview/started` and `item/autoApprovalReview/completed` under `ServerNotification`; `JSONRPCNotification` expects no response, while `JSONRPCRequest` requires an `id`.
- The wrapper exempts only those two exact methods and only when the `id` member is absent. An `id` member set to null or an integer, the separately defined strict-review notification, unknown approval-named methods, and ordinary approval requests all retain the frozen conservative stop path.
- The wrapper does not send an approval response or change the platform review. A denied auto-review notification is allowed to continue only because the host still owns enforcement; the runner remains observational.
- The original frozen runner supplies terminal handling, interruptions, deadlines, child drain, process-group cleanup, checkpoints, and manifests unchanged. The wrapper patches only the module-global predicate that `Trial.handle_notification()` resolves.
- Independent fake-protocol command `PYTHONDONTWRITEBYTECODE=1 python3 experiments/quality-first-benchmark/test_runner_v2.py -v` passed all 22 tests: the 18 frozen cases plus four notification/request regressions.

The retained first DEV-F1 native attempt remains an unscored harness failure with unresolved actor state. Its manifest and trace must remain unchanged; a fresh v2 attempt is the valid replacement evidence.

### Layout and W4 helper fixes: accepted

Both previously reported blockers are resolved. Regular-layout input generation now places qualified `leo-dev:develop` at the frozen logical position and tests normalized whole config, prompt, and explicit skill input. W4 now records and verifies each archived pre-layout stage record, including deletion and byte-mutation failures. It requires `runner_v2.py` before creating a held-out consumer and locks both the wrapper and frozen runner dependency. Old/new Leo cohorts still use the same relocation and runner treatment.

Independent fake-only command `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v experiments/quality-first-benchmark/test_leo_layout.py experiments/quality-first-benchmark/test_prepare_w4.py` passed 9/9 in 1.108 s.

### Supplemental orchestration checks that passed

- The seven new labels retain completed v1 DEV-R1 results and the failed DEV-F1 native attempt rather than overwriting them.
- Native DEV-F1 and both Leo supplements use fresh consumers. The four previously unrun comparator consumers are reusable only when the complete frozen initial manifest matches; direct `stage.manifest()` comparison currently matches all four.
- Prompt, config, and explicit skill input are regenerated, path-normalized, and compared byte-for-byte with their frozen v1 counterparts. Fresh Leo package and archived-stage bytes are locked.
- Launch rechecks all supplemental assets, rejects an existing v2 trial directory, and rechecks the selected consumer against its initial manifest. The operator-control file is intentionally a mutable checkpoint channel and may be absent before a checkpoint; it should not be treated as a frozen treatment input.

No held-out contents, candidate implementation, or oracle were inspected. No model trial was started.


### W1 supplemental argv blocker — fix re-review

**Resolved; W1 supplemental preparation is approved for freezing and dispatch.** `corrected_argv()` retains exact-value substitutions for the wrapper, cwd, trial, and input files, then handles only values following `--allowed-skill-path`. Each old path must be lexically relative to the frozen original consumer; the one canonical legacy Leo develop path is mapped to the approved regular nested path; every resulting path must exist as a file and resolve inside the selected consumer. All other argv values, including skill names, model, effort, timeout, method order, and checkpoint channel, remain unchanged.

The added regression constructs an old and fresh Leo layout, checks every allowed path belongs to the selected root and exists, normalizes only the approved wrapper/root/input/trial/layout substitutions, and requires exact equality with the original argv. It also confirms the original argv bytes decode unchanged. The new test file is included in the future supplemental lock.

Independent command: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v experiments/quality-first-benchmark/test_prepare_w1_supplement.py` — 1 test passed in 0.003 s. No staged supplemental inputs or model runs existed during this review.


### W1 old-package identity format correction

**Accepted for W1 retry.** The old identity has two distinct inventories: top-level `files` is the complete 1,316-file plugin tree, while `originalManifest.files` is a 1,280-entry runtime-relative manifest. The aborted preparation read the latter and failed its count guard before creating a supplemental schedule, lock, consumer, input, or actor run. It is a helper-format error, not package drift.

`old_package_files()` now selects the top-level mapping, requires a dictionary of 1,316 string path/hash pairs, checks both declared original and copied counts, and requires `sameFiles` to be true. `prepare()` still compares that entire mapping with a fresh `stage.manifest(originalPackageRoot)` before any staging. The actual identity smoke confirms the two inventory sizes differ and the selected 1,316-file mapping exactly equals the current original package tree.

Independent command: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v experiments/quality-first-benchmark/test_prepare_w1_supplement.py` — 2 tests passed in 0.236 s. No `w1-supplement-schedule.json`, `w1-supplement-lock.json`, or `*-v2` supplemental consumer/input was produced by the failed preparation. The analogous W4 loader remains outside this approval until its separately assigned fix is reviewed.


### W4 identity-loader correction

**Accepted.** `load_identity()` now treats top-level `files` as the complete package inventory for both old and new Leo cohorts. It requires a path-to-hash dictionary with string entries, validates the declared file count and any copy-count/exact-copy attestations, binds any declared package root to the supplied package path, and compares the complete actual tree with the supplied inventory before held-out staging. The old cohort retains the fixed 1,316-file requirement; the new cohort uses its own complete declared inventory, preserving package bytes as the treatment.

The regression explicitly supplies a misleading nested runtime manifest and confirms that the loader uses the 1,316-entry top-level mapping. The real old identity independently loaded as 1,316 files with inventory SHA-256 `69f4717921452d1399c908b54b0ad91ce73a206b91f3cbc7629ab46a568978ee`; this was a read-only package-tree check.

Independent fake-only command covering layout and W4: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v experiments/quality-first-benchmark/test_leo_layout.py experiments/quality-first-benchmark/test_prepare_w4.py` — 10 tests passed in 1.083 s. No held-out fixture content or model run was inspected.


## DEV-R1 — `leo-dev-current` regular-layout supplement (`dev-r1-leo-v2`)

**Verdict: ACCEPTED as the W1 Leo Dev baseline.** The corrected regular-file layout allowed the exact installed controller, current-candidate gate, native implementation and independent review, receipt validation, and task completion to run. The product behavior, process evidence, isolation, and final reporting satisfy the frozen DEV-R1 contract. This verdict replaces no record: the original symlink-staged attempt remains separately labeled product-pass/workflow-setup-blocked, and only this supplement demonstrates the Leo Dev workflow.

### Product and evidence

- `latest_by_id` overwrites the value for an existing dictionary key without changing that key's insertion position. It therefore returns each ID's final original record in first-ID order and preserves object identity without mutating the input.
- `points_for` rejects booleans before its integer/range check, accepts integers 1 through 10, performs no coercion, and returns ten times the input.
- Public signatures are unchanged. No dependency, persistence, network service, database, or API rewrite was introduced.
- The implementer added five standard-library tests covering empty input, final-record/first-ID ordering, retained identity, nonmutation, valid boundaries, booleans, out-of-range integers, and representative invalid types. The retained trace shows the test-first run failing exactly twice on the two baseline defects at 05:01:03Z, followed by the minimal `app.py` change and a green five-test run at 05:01:16Z.
- The evaluator oracle passed 4/4 checks and reported no protected-input mismatch. I independently reran the five actor tests and an interleaved-duplicate/all-valid-quantity probe; both passed.
- `requirements.md`, `README.md`, `AGENTS.md`, and `unrelated.txt` match their stage seed hashes. The staged package and Superpowers resources remain protected by the external final manifest. Changed task files are `app.py`, `test_app.py`, and allowed `.leo-dev` workflow/evidence records.

### Actual Leo Dev workflow

The main actor read the explicit `leo-dev:develop` resource from the nested regular package, the runtime manifest, and the applicable lifecycle, components, gates, acceptance, review, team, autonomy, and delivery references. Discovery enabled exactly `leo-dev:develop` plus the fourteen staged Superpowers skills and reported no unexpected name or path.

The first controller call used uppercase `DEV-R1` and received a transparent `VALIDATION_ERROR`; the actor inspected the documented ID constraint and retried as `dev-r1`. This was a recoverable invocation error, not a product or evidence failure. The successful flow then:

1. initialized against the approved `requirements.md`, opened a two-member controller team, recorded the explicit requirement approval, routed the task as Lite, and advanced the change to execution;
2. spawned distinct native `/root/implementer` and `/root/reviewer` threads, then journal-bound those exact thread paths to write and read roles before substantive implementation/final review;
3. claimed `repair-contract`, captured the real red-to-green TDD sequence, registered tree `9ae91f1f…`, and ran the declared standard-library Gate to `GATES_PASSED`;
4. submitted that tree for review; the reviewer independently reran the suite and an additional contract probe, returned PASS with no findings, and did not write product files;
5. ingested a receipt matching run ID, task revision, lease generation, spec hash, task hash, submitted tree hash, and the retained findings-file hash; the controller moved the task to `done` and the change to `integration-review`.

The final delivery report was added after controller review. No `app.py`, `test_app.py`, or protected-file change occurred after the reviewer inspected the submitted candidate. Controller projections and the delivery record make the final repository tree differ from the submitted tree, but they do not change the reviewed product candidate; this evaluator has independently checked the final report and final code.

Receipt provenance has a clear limit. The JSON labels itself `platform-attested`, while the controller journal records `issuerAuthenticated: false` and team status describes host-reported, unauthenticated provenance. The app-server trace independently corroborates the distinct reviewer thread, its baseline and candidate checks, exact final report, and timing, so the review is real for this experiment. The receipt is not cryptographic identity proof, and the actor correctly disclosed that limitation rather than claiming authentication.

### Isolation, intervention, and measured cost

- Host lifecycle evidence contains one implementer and one reviewer child, both completed; no grandchild appears. Their exact model metadata is not recorded, so no child-model claim is made. Only the main thread is requested and host-reported as `gpt-5.6-terra`/`high`.
- The only operator action was terminal `finish`. There were zero routine confirmations, approval responses, source interruptions, rejected controls, or diagnostic rescue messages.
- Execution ended `COMPLETED`; no active turn remained. The owned process group was already empty and cleanup was confirmed.
- Wall time was 516 seconds. Cumulative recorded usage across the three threads was 4,394,195 tokens: 4,371,010 input, 4,154,880 cached input, 23,185 output, and 8,727 reasoning output. The main thread accounted for 4,036,795 total tokens. Monetary cost was not recorded and remains unknown.

The workflow is substantially more expensive in context and elapsed time than the tiny repair itself, but this single quality-first case cannot establish a general efficiency regression or justify a different model, RAG, or extra orchestration. The next useful evidence is the already-planned multi-module DEV-F1 run under the same frozen treatment, not another DEV-R1 rerun.


## DEV-F1 — Codex native v2 (`dev-f1-native-v2`)

**Independent contract verdict: ACCEPTED. Frozen scorer result: FAILED, retained and classified as an evaluator false negative.** The candidate satisfies the public functional contract and process requirements. The sole external-oracle failure adds a direct-Python-API response-envelope requirement that the public requirements do not specify. This review does not edit or reinterpret the frozen result in place; any corrected aggregate comparison needs a versioned, symmetric secondary adjudication for every arm.

### Contract adjudication

The failed assertion is `dev_f1_oracle.py:86`: after the evaluator calls `json.dumps()` on the direct `reserve_batch()` return value, it requires the decoded value to contain a dictionary-valued `stock` member. The candidate instead returns the resulting stock mapping directly from the Python API and wraps it as `{"stock": stock}` at the CLI boundary.

That is a valid reading of the frozen public requirements:

- Requirement 1 names the public `reserve_batch(requests)` API but specifies no return schema.
- Requirement 9 explicitly assigns JSON input and output to the CLI.
- Requirement 12's “Success JSON” and “error JSON” follow that CLI contract and require a `stock` object on CLI success. The candidate emits exactly that shape.
- The oracle itself treats direct-API failures as exceptions/nonzero process exits rather than requiring the API to return an `{"error": ...}` envelope. Importing only the success envelope from the CLI into the API is therefore internally asymmetric.

The frozen calibration does not settle this ambiguity. Its legal alternatives vary serialization, while its wrapper-only mutants test missing CLI behavior; it contains no legal implementation with a plain stock-mapping API and a wrapped CLI response. Therefore the line-86 failure is evidence of an uncovered evaluator assumption, not a product-contract violation.

The original score remains unchanged: execution is `COMPLETED`, protected-input checks pass with zero mismatches, the public suite passes 9/9, and `behaviorAndInputChecks` is `FAILED` solely at this assertion. The smallest corrective experiment is an isolated positive calibration case whose API returns the plain mapping while its CLI emits the required `stock` envelope. If that case passes an independently reviewed contract oracle, produce a versioned secondary result for all arms; do not alter the frozen oracle or selectively rescore this arm.

### Product behavior

- `reserve_batch()` validates that the request is a list of dictionaries, rejects booleans as quantities, requires positive integers and nonempty string SKUs, ignores extra fields, and accumulates duplicate SKUs before checking inventory.
- All inventory and type/stock checks occur before mutation. Invalid, unknown, or insufficient batches leave the persisted file byte-for-byte unchanged.
- Successful batches decrement all requested quantities, write atomically through a temporary file and replacement, and survive a fresh process. Empty batches are successful no-ops.
- The CLI accepts the required JSON array, prints `{"stock": ...}` on success, and returns nonzero with a nonempty `error` string on failure. Existing single-reservation behavior is preserved.

I independently reran the nine actor tests and the frozen oracle. The tests passed 9/9; the oracle reproduced only the disputed direct-API envelope failure. A separate contract probe verified accumulated duplicates, ignored extra fields, exact-byte preservation for invalid API requests, empty no-op behavior, fresh-process persistence, CLI success shape, and CLI error/exit behavior. It passed. No protected input changed.

### Actual workflow and review evidence

The main actor inspected the requirements and baseline, implemented the store and CLI changes, and ran the public suite. It then spawned one distinct read-only reviewer. The reviewer read the requirements, implementation, and tests, reran the suite, and suggested two useful coverage additions: CLI semantic checks and accumulated-shortage behavior. The main actor added those tests without changing the implementation and reran the suite successfully.

The reviewer's no-defect verdict is consistent with the public contract, although its report should have stated the API-return interpretation explicitly. Its claim that all twelve requirements pass is therefore supportable, but it did not anticipate the evaluator's undocumented envelope assumption. This is an evidence-clarity limitation rather than a missed software defect.

The implementation did not record a test-first red phase. Native W1 does not require Superpowers/TDD ceremony, so this is not a protocol failure. No diagnostic rescue or extra human guidance occurred: the only intervention was terminal `finish`, with zero routine confirmations or approval responses. The v2 attempt is fresh and remains distinct from the original unscored runner false-stop.

### Isolation and measurements

- The trial finished `COMPLETED` with no blocked reason, interruption, protocol error, active turn, or unconfirmed process cleanup. The owned group was already empty and cleanup was confirmed.
- One reviewer child started and completed, with no grandchild. Child model metadata is unavailable, so its effective model is unknown; only the main request/report identifies Terra/high.
- No enabled framework skill, network access, dependency installation, or unrelated source change appears in the trace. The score confirms all protected inputs match their initial hashes.
- Wall time was 211 seconds. Recorded main-plus-reviewer usage was 470,774 total tokens: 461,473 input, 422,400 cached input, 9,301 output, and 4,992 reasoning output. Monetary cost was not recorded.

This single case demonstrates a valid implementation and a concrete oracle false negative. It does not support a general claim about native Codex quality, cost, or rank relative to the other arms.


## DEV-F1 — Codex Superpowers v2 (`dev-f1-superpowers-v2`)

**Verdict: ACCEPTED.** The final candidate satisfies the frozen public contract, the original frozen oracle passes, and the trace demonstrates a substantive Superpowers workflow rather than skill-name citation. The independent review found two real defects in the first green implementation; both were reproduced with red tests, repaired, and rechecked by the same read-only reviewer.

### Product behavior and findings

The final `reserve_batch()` validates the complete request list before touching persistent state, rejects booleans and other invalid quantities, requires nonempty string SKUs, ignores extra fields, aggregates duplicate SKUs before checking stock, and applies each accumulated decrement once. Empty input returns current stock without writing. Successful data is written to a temporary file in the database directory, flushed and file-synced, then atomically replaces the live path. The returned object and CLI success output contain the required `stock` object. The reserve CLI converts parse, validation, lookup, read, and persistence failures into a nonzero JSON response with a nonempty `error` string. Existing list/get behavior remains intact.

The first independent review raised two Important findings, and both were contract-relevant:

1. The initial implementation used `Path.write_text()` directly on the live database. A write failure after truncation could change the bytes despite the operation failing, contradicting requirement 6's exact-byte guarantee. This was a functional atomicity defect, not a preferred implementation objection.
2. The initial reserve error boundary omitted `OSError`. A store read or persistence failure could emit a traceback and no JSON response, contradicting the CLI's failure-output contract. The reviewer appropriately phrased the original scope qualification and the actor then demonstrated the failure with a missing database path.

The actor added focused tests before each repair. The combined red run failed exactly because mocked replacement did not affect the direct-write implementation and a missing store produced no JSON. The repaired code made both focused checks green. The actor also added direct non-list, mixed-validity, negative quantity, non-string SKU, duplicate shortage, ignored-extra-field, fresh-process persistence, and compatibility coverage. The reviewer reread the final code, reran 14 tests, and approved the two repairs. No implementation changed after that re-review.

The frozen scorer passes both the oracle and actor suite, with 14/14 tests and zero protected-input mismatches. I independently reran the 14-test standard-library suite; it passed. The external oracle separately covers the required mutation, persistence, invalid-input, CLI-envelope, and original-regression behavior. I found no remaining contract defect. The broad `except:` in temporary-file cleanup reraises after cleanup and does not hide a failure; it is not a behavioral blocker for this contract.

### Workflow fidelity and evidence limits

The main actor read the staged `using-superpowers` instructions and Codex adapter, used the approved requirements as the existing design decision, and then used brainstorming, test-driven development, requesting/receiving code review, systematic debugging, and verification-before-completion at the relevant phases. It recorded an initial 5-test public baseline, a feature RED caused by the absent API/CLI, the first 9-test GREEN, independent review, a second defect-specific RED, focused repairs, a 14-test GREEN, and final compatibility verification. This is faithful use of the staged method for one bounded feature; a separate plan document or subagent implementer is not required by the approved case.

The fixture had no committed `HEAD`, so the main actor's ordinary `git diff` could not establish a candidate delta and its no-index probe was imperfect. This did not weaken the actual review: the reviewer directly read the complete requirements, source, and tests and executed the documented suite. The final compatibility probe initially had a one-line Python syntax error; the actor explicitly rejected that as evidence, corrected it, and recorded a successful rerun before the final answer.

One distinct reviewer child performed both review turns and modified no file. The trace shows start, two completed reviewer turns, and completion, with no grandchild. Its effective model is not present in host metadata and remains unknown. The main model is host-reported, unverified Terra/high.

### Isolation and measurements

- The reused consumer was still at its exact frozen initial manifest before this first scored attempt; the result is labeled v2 only because it uses the corrected runner. The score reports no protected-input mismatch and the final changed task files are limited to `store.py`, `cli.py`, and the new reservation test.
- The only operator intervention was terminal `finish`. There were no routine confirmations, interruptions, rejected controls, protocol/server errors, or approval responses. Execution ended `COMPLETED`, no active turn remained, and the owned process group was already empty with cleanup confirmed.
- Trial wall time was 455 seconds. Recorded main-plus-reviewer usage was 1,518,415 tokens: 1,498,594 input, 1,401,600 cached input, 19,821 output, and 11,209 reasoning output. Monetary cost was not recorded.

This case shows that independent review materially improved the candidate: the first implementation passed its chosen tests while still violating two failure-path requirements. It does not isolate whether the improvement came from Superpowers instructions, adding a reviewer, or additional token/time expenditure, and it cannot support a cross-arm ranking by itself.


## DEV-F1 contract-v2 secondary evaluator — freeze review

**Verdict: oracle and calibration ACCEPTED; scorer wrapper BLOCKED on one case-binding defect.** The evaluator correction is precisely scoped and independently reproduces all 11 calibration expectations. Before freezing or rescoring, `score_contract_v2.py` must refuse every case other than `DEV-F1`; it currently produces a semantically false DEV-F1 adjudication label for other cases.

### Oracle delta and calibration

The diff from frozen `dev_f1_oracle.py` changes one behavior check only. The direct Python success probe no longer serializes or inspects the method's return value. It requires the subprocess to exit successfully and then verifies the durable stock decrement. CLI success still requires a dictionary-valued `stock` member, CLI failures still require nonzero status and a nonempty JSON `error`, direct API negative cases still require failure with exact-byte preservation, fresh-process persistence remains checked, and the original public regression suite still runs.

This resolves the demonstrated false negative without weakening any stated requirement. It permits a mapping, `None`, or a non-JSON-serializable direct API return because the public contract does not define that return schema. It does not permit an implementation to satisfy only the CLI wrapper: direct API success, negative validation, durable mutation, and late-invalid atomicity remain independently exercised.

The calibration constructs fresh candidates, runs protection before and after, requires public regressions to pass, and checks the expected frozen/v2 exit pair. Its 11 cases have useful discrimination:

- The existing wrapped reference passes both oracles.
- Plain-map and `None` API legal alternatives retain a wrapped CLI, fail only the frozen return-envelope assertion, and pass v2.
- Eight negative mutants are rejected by both oracles: boolean and numeric-string acceptance, insufficient-stock acceptance, non-JSON CLI failure, partial late-invalid write, object-as-empty acceptance, and two CLI-only validation disguises.

I reran calibration into a separate temporary report. All 11 expectations passed with the same pattern: reference `0/0`, both legal alternatives `1/0`, and all eight mutants `1/1` for frozen/v2. The retained report binds frozen oracle SHA-256 `770d45a1…` and v2 oracle SHA-256 `fc697d26…`; current bytes match. I also ran the secondary scorer on the native DEV-F1 candidate: it changed the former false negative to behavior PASS, retained cleanup/protection/public-test guards, recorded the v2 oracle hash, and added the explicit secondary-adjudication label. Original candidate and frozen score files were not modified.

### Blocking scorer defect

`score_contract_v2.py:33-49` accepts any case supported by frozen `score.py`. It overrides only the DEV-F1 oracle, but it unconditionally appends `version: DEV-F1-contract-v2` and the DEV-F1 direct-return delta to whatever result was produced. I reproduced this with the completed `dev-r1-native` root: the command exited successfully and wrote a result whose `case` was `DEV-R1`, whose oracle hash was the DEV-R1 oracle, but whose `secondaryAdjudication` claimed `DEV-F1-contract-v2` and the DEV-F1 return-envelope correction.

This does not affect a correctly selected DEV-F1 run, but it makes the versioned scoring tool capable of silently generating mislabeled evidence and leaves “all comparison arms” open to operator interpretation. Before freeze, parse and bind the selected root's stage record to `case == "DEV-F1"` and defensively verify the generated result case before annotation. Add one fake or read-only regression proving a DEV-R1/HOLD root is refused without a secondary result. Then rerun the existing 11-case calibration and one DEV-F1 wrapper smoke. No oracle, threshold, candidate, or frozen result change is needed.

The annotation's `frozenScorePreservedElsewhere: true` is also unsupported by the wrapper. It neither requires an original frozen-score path nor checks that such a file belongs to the same candidate. Merely omitting the boolean and documenting an operator procedure would avoid a false claim, but it would still allow secondary scoring after unprotected product files changed. For comparison-grade evidence, require an explicit original frozen-score input and verify at least `case`, `arm`, `stageSha256`, `trialManifestSha256`, and the complete `finalHashes` mapping against the new result. Also verify the original score's `oracleSha256` equals the frozen DEV-F1 oracle, require the original and secondary output paths to differ, and record the original score's path and SHA-256 in the secondary annotation. Exact `finalHashes` equality is necessary because stage/trial hashes do not bind actor-modified product files. Capture the original score hash before scoring and confirm it is unchanged afterward. A mismatched or missing original must fail without claiming a secondary adjudication.

The final asset freeze should hash the v2 oracle, calibration program/report/legal alternatives, wrapper, and its case-guard regression because the frozen v1 asset manifest intentionally does not bind these new secondary files.


### Contract-v2 wrapper fix re-review

**Verdict: BLOCKED on result-state semantics and postcheck output handling.** The earlier case-binding and original-score provenance defects are fixed. One ordinary candidate failure is currently labeled like an invalid diagnostic, and a post-scoring binding failure can leave an unannotated file at the official output path. Both should be corrected before the v2 asset freeze.

The accepted parts are concrete:

- `--frozen-score` is mandatory and removed before forwarding arguments to frozen `score.py`; `sys.argv` and the oracle table are restored in `finally`.
- Preflight rejects a non-DEV-F1 stage before invoking the scorer or creating output. It rejects a reused/same output path, wrong frozen case or arm, stage/trial mismatch, wrong frozen-oracle hash, and any candidate drift from the original complete `finalHashes` map.
- The wrapper captures both original score bytes and SHA-256, checks them after scoring, and postchecks the secondary case, arm, stage, trial, and complete final hashes before annotation. The annotation now records the original resolved path and hash instead of the unsupported preservation boolean.
- The three fake tests pass independently and cover a successful matching binding, pre-output non-DEV-F1 rejection, and pre-output candidate-drift rejection. The accepted oracle and 11-case calibration assets are unchanged.

Two related issues remain:

1. `score_contract_v2.py:102` writes `FAILED_DIAGNOSTIC` whenever frozen `score.main()` returns nonzero. For this scorer, exit 1 normally means the evaluation completed and the candidate's `behaviorAndInputChecks` is `FAILED`; it is valid comparison evidence, not a harness-invalid diagnostic. Label the adjudication execution `COMPLETED` whenever a result was successfully produced and all bindings passed, and record the outcome separately from `result["behaviorAndInputChecks"]` (or rely on that existing field). Preserve the process exit status of 1 so automation still detects the failed candidate. Add a fake negative candidate test asserting: exit 1, output retained and fully annotated, execution status completed, behavior outcome failed.
2. Frozen `score.py` writes directly to the requested official secondary path before lines 87–97 perform the original-score immutability and result-binding checks. If either postcheck fails, the wrapper raises but leaves an unannotated base-score JSON at the official path. That file is neither a valid secondary artifact nor guaranteed to be excluded by file-based aggregation. Run the frozen scorer against a new internal temporary output, perform all postchecks and annotation there, and publish the requested output only after validation; on infrastructure/binding failure, no official output should exist. A focused fake test can force a postcheck mismatch and assert refusal with no official artifact.

The appended `CALIBRATION.md` currently says a nonzero v2 check is `FAILED_DIAGNOSTIC` and “never labeled a completed adjudication”; update that sentence with the corrected distinction: a completed behavioral failure is a valid completed adjudication with a failed outcome, while harness/binding errors produce no official secondary result.


## DEV-F1 — cc-sdd full v2 (`dev-f1-ccsdd-v2`)

**Verdict: REJECTED for product and workflow acceptance.** The frozen oracle and all 12 actor tests pass, but the final implementation has two reproducible failure-path violations that those checks omit. The cc-sdd implementation reviewer approved them despite directly reading the relevant requirements and source. The actor also replaced the workflow's required autonomous per-task implementation mode with one batched main-thread implementation without receiving task numbers.

### Product defects

1. **Direct persistence can corrupt the live database on a failed write.** `store.py:49` calls `Path.write_text()` on the database itself. Validation failures are handled before that call, but requirement 6 says the database bytes remain exactly unchanged on any failure. A write can truncate or partially replace the file before raising `OSError`. I independently patched that call to write a partial prefix and then raise; `reserve_batch()` propagated the failure and the original bytes changed from the complete database to `b'{"items":'`. The earlier research child explicitly warned that in-place persistence was risky, yet the design narrowed “atomic” to validation-before-one-write and declared interruption during a successful write out of scope. That local design cannot narrow the approved exact-byte failure contract.
2. **Filesystem failures do not produce the required CLI JSON error.** `cli.py:19` catches only `ValueError`/`JSONDecodeError`. A reserve request against a missing database exits 1 with a Python traceback on stderr and empty stdout, not a JSON object containing a nonempty `error`. I reproduced this with a valid nonempty request and a nonexistent database path. This violates the reserve CLI's failure-output requirement and is the same boundary that independent review correctly caught in the Superpowers candidate.

These are concrete runtime failures, not objections to coding style or to a chosen return shape. A same-directory temporary write followed by atomic replacement, cleanup on failure, and reserve-boundary handling of expected I/O errors are sufficient repairs. The final cc-sdd candidate has neither.

The original frozen scorer remains truthfully `PASSED`: its oracle checks logical invalid inputs and durable success but does not inject a persistence failure or a store-read failure at the CLI boundary. Protected-input mismatches are zero. I independently reran the actor suite; all 12 tests passed, confirming that the defect is missing coverage rather than a flaky existing test. The frozen score must remain unchanged; this review supplies the additional process/code judgment the protocol requires.

### Review and specification failure

The implementation reviewer read `requirements.md`, the generated spec/design/tasks, `store.py`, `cli.py`, and the tests, and reran the suite. It nevertheless approved the direct live-path write, describing “the sole write only after all availability checks” as sufficient atomicity. It also reported error handling complete without exercising `OSError`. The reviewer therefore false-accepted two Important defects. There was no product remediation or implementation re-review after that approval.

The planning workflow did include a real independent task-graph review and a second turn after three textual findings. Those findings repaired argument-count coverage and clarified ignored fields, but one also entrenched a nonempty `ValueError` requirement for all direct API rejection cases. The approved root contract specifies failure, not one exception class, so that generated test/spec constraint is narrower than necessary. It does not break this chosen implementation but could reject a valid alternative.

The generated design's explicit non-goal, “recovery from interruption during a successful file write,” is materially misleading here. The observed case is an operation that reports failure after changing bytes, which requirement 6 directly covers; it is not a request for crash recovery or journaling. That scope statement likely contributed to both the direct-write implementation and reviewer miss.

### Workflow fidelity

The actor genuinely used the staged cc-sdd discovery and specification stack: it created a brief, EARS requirements, brownfield research, design, tasks, and metadata; ran a task-graph reviewer; recorded a feature RED before implementation; wrote production code in the main thread; ran a 12-test GREEN; and used an independent implementation reviewer plus a final integrated test/smoke run. The documents and tests are real artifacts, but their volume does not offset the two missed behaviors.

The installed `kiro-impl` contract selects autonomous mode when no task numbers are supplied and requires one fresh implementer and review cycle per subtask. The benchmark requested the complete ordinary workflow and supplied no task numbers. The actor instead declared manual mode because commits were prohibited, batched all five subtasks into one main-thread code change, and obtained one review for the aggregate. The no-commit instruction overrides the skill's commit step, but it does not require abandoning per-task implementer/reviewer handoffs; the skill separately provides that structure. This is a material method deviation, especially because the single aggregate reviewer missed the two cross-cutting failure paths.

Three distinct child threads were real: one read-only requirements/codebase researcher, one task-graph reviewer with a repair recheck, and one final implementation reviewer. No implementer child was used, and no grandchild appears. Child model metadata is absent, so effective child models remain unknown. The main request/report is host-attested, unverified Terra/high.

### Isolation and measurements

- The staged consumer enabled exactly the 17 cc-sdd skills with no unexpected name/path. The protected cc-sdd resources, root requirements, README, original regression test, and agent instructions match their initial hashes.
- The only operator intervention was terminal `finish`. There were zero routine confirmations, interruptions, rejected controls, protocol/server errors, or diagnostic rescue messages. Execution ended `COMPLETED`; no active turn remained and cleanup confirmed the process group already empty.
- Runner wall time was 930 seconds (15 minutes 30 seconds). Recorded cumulative usage across the main thread and three children was 3,562,869 tokens: 3,521,616 input, 3,319,552 cached input, 41,253 output, and 18,284 reasoning output. Monetary cost was not recorded.

The representative failure is reviewer and test-oracle blind spot, not lack of specification prose. The smallest future evaluator improvement is a versioned, symmetrically calibrated persistence-failure/CLI-I/O probe across every DEV-F1 arm. It should remain separate from the frozen W1 score rather than changing this run's thresholds or historical results.


### Contract-v2 wrapper final-fix re-review

**Code/tests verdict: ACCEPTED. Asset freeze: BLOCKED only by contradictory retained documentation.** The wrapper now satisfies the two prior code findings, and the six fake checks pass independently. Frozen `dev_f1_oracle.py`, the accepted contract-v2 oracle, and the 11-run calibration report retain their prior SHA-256 values.

The scorer now runs frozen `score.py` against a private temporary result, restores `sys.argv` and the oracle table in `finally`, accepts only the scorer's defined statuses 0 and 1, verifies original-score bytes/hash and all result bindings, annotates the temporary artifact, and publishes only after every check. A normal behavioral failure retains exit 1 and `behaviorAndInputChecks: FAILED` while its adjudication status is `COMPLETED`. Exceptions, unsupported statuses, original-score mutation, missing temporary output, or result-binding failure leave no requested official output. The new tests directly cover both postcheck failure paths and the valid failed-candidate case.

`contract-v2/CALIBRATION.md` still contains the superseded “Secondary-score binding amendment” statements that a nonzero v2 check is `FAILED_DIAGNOSTIC`, is never a completed adjudication, and that the suite has three tests. Its appended “Publication and outcome amendment” then states the corrected opposite semantics and six tests. This is a direct contradiction in a proposed frozen evidence asset. Remove or rewrite the obsolete sentences/test block so the document contains one current contract. No code, oracle, alternative, calibration result, threshold, or candidate change is required. After that documentation cleanup, the assets are ready to freeze and the corrected wrapper can score every completed DEV-F1 arm symmetrically against its matching original frozen score.

**Documentation cleanup recheck: ACCEPTED; contract-v2 assets are approved for freeze.** The obsolete `FAILED_DIAGNOSTIC`/three-test text is gone. `CALIBRATION.md` now states one consistent contract: scorer exit 0 or 1 is a completed adjudication, exit 1 preserves `behaviorAndInputChecks: FAILED`, infrastructure/binding errors publish no result, and the current fake suite contains six checks. The frozen v1 oracle, accepted v2 oracle, calibration report, wrapper, and tests retain the reviewed code/data hashes except for the expected documentation hash change. Root may freeze these bytes and then run the wrapper uniformly for every completed DEV-F1 arm with its matching original frozen score. There were no official secondary scores at this approval point.


## Independent DEV-F1 I/O diagnostics — completed native, Superpowers, and cc-sdd arms

These checks are independent code-review diagnostics and are not part of the frozen oracle, contract-v2 correction, official score, or actor-visible input. The same script ran against each currently completed DEV-F1 candidate using only temporary databases and controlled standard-library mocks. It hashed every candidate file before and after; all three candidate trees were unchanged.

The persistence probe submits a valid reservation and injects failure at either `Path.write_text` or `os.replace`, whichever implementation reaches. It judges only requirement 6's exact-byte property. An unrecognized persistence mechanism is reported `UNVERIFIED`, not failed. The CLI probe invokes a valid nonempty reserve request against a missing database and requires nonzero exit plus a complete JSON object containing a nonempty string `error`, following requirements 9 and 12.

Results:

- **Codex native: PASSED.** Failure was injected at `os.replace`; the API raised `OSError` and the original database SHA-256/bytes were unchanged. The CLI exited 1 and emitted a valid JSON error on stdout.
- **Codex Superpowers: PASSED.** Failure was injected at `os.replace`; the API raised `OSError` and the original bytes were unchanged. The CLI exited 1 with a valid JSON error on stdout.
- **cc-sdd: FAILED both checks.** Failure was injected at its direct `Path.write_text`; the call raised `OSError` after the live database changed to the partial prefix `b'{"items":'`. Its CLI exited 1 for a missing database but emitted no JSON, only a traceback.

The retained script SHA-256 is `9f4b7784553b522f01aa08118934c5bc7c7d784c26ccdaf2007c98654601df06`; the three-arm raw report SHA-256 is `e6dec49389478501622bcf088655fc2b082ec3b4b969cc1b0f5db63cccc0d5eb`. Later completed DEV-F1 arms should be evaluated with the same script into a new report rather than overwriting this evidence. These results explain an independent-review distinction that the frozen oracle does not measure; they do not retroactively change any frozen or contract-v2 score.


## DEV-F1 — Spec Kit full v2 (`dev-f1-speckit-v2`)

**Verdict: REJECTED for product acceptance; workflow execution accepted with a false convergence result.** Both the original frozen scorer and the uniformly applied contract-v2 secondary scorer pass, all 13 actor tests pass, and protected-input mismatches are zero. The final store nevertheless violates the approved exact-byte failure contract on a persistence error. The Spec Kit analysis, final source review, and convergence all missed that live defect.

### Product result

The ordinary behavior is broadly correct. The public `reserve_batch()` validates list/request shape, rejects booleans and other invalid quantities, accumulates duplicate SKUs before availability checks, preserves logical rejection bytes, ignores extra fields, persists successful deductions, and returns a stock envelope. The CLI preserves `list`/`get`, emits JSON for reservation success and the tested validation failures, and catches expected store/JSON errors. The actor suite and both versioned oracles independently confirm those behaviors.

One Important contract defect remains. `store.py:51-52` writes JSON directly to the live database with `Path.write_text()`. If the write truncates or partially writes and then raises `OSError`, the reservation reports failure after changing the database bytes. I ran the same controlled probe used for the other completed DEV-F1 arms: it injected failure after writing `b'{"items":'`; `reserve_batch()` raised `OSError`, but the original database SHA-256 changed from `4d362b80…` to `90caeeb4…`. This violates requirement 6, “On any failure, the database file bytes remain exactly unchanged.” The candidate tree itself remained byte-for-byte unchanged by the diagnostic.

The CLI-side I/O boundary passes the shared diagnostic. A reservation against a missing database exits 1 and prints a JSON object with a nonempty `error` on stdout. The repair scope is therefore limited to durable publication in the store: write a same-directory temporary file, atomically replace the live path only after the complete write succeeds, and clean up on failure. Add a test that injects a persistence failure after partial temporary output and asserts the live bytes are unchanged.

The original frozen and contract-v2 scores remain truthful historical **PASSED** results. Neither oracle injects a success-path persistence failure; the contract-v2 delta only removes the unsupported direct-API return-envelope constraint. This independent finding does not change either score or threshold.

### Specification and convergence

The generated feature specification actually preserves the stronger contract: `spec.md:100-103` requires exact bytes on every failure, and its success criteria repeat 100% byte preservation. The store contract likewise says no failure writes the database. The implementation plan and research then narrow the risk model to “validate before the sole success-path write” (`plan.md:32-44`; `research.md:3-12`). That prevents logical partial application but does not make a live-path write failure atomic. Tasks T002/T004 test only rejected inputs before persistence, while T008 marks byte preservation reviewed without a write-failure case.

The trace contains a real Spec Kit sequence: constitution, specification and checklist, plan/research/contracts, tasks, analyze, implement, and converge. Tests were written RED before each store/CLI implementation step, all eight tasks were checked off, the final 13-test run passed, and `tasks.md` remained unchanged across converge. The method did not require an independent subagent review, and the actor explicitly disclosed that none occurred; no penalty is assigned merely for having no child agent.

However, the analysis declared 100% coverage and zero critical issues, then convergence counted 10 functional requirements, 5 outcomes, 9 scenarios, 5 plan decisions, and 5 constitution principles and declared zero gaps. Those are document-to-task coverage counts, not proof of runtime completeness. Because the plan had already equated “one write after validation” with atomic persistence, both later checks inherited the same blind spot and falsely accepted the implementation. The final response's claim that all requirements and all-or-nothing persistence were satisfied is therefore false despite honestly disclosing the lack of independent review.

### Isolation, process, and measurements

- Discovery enabled exactly the 10 staged Spec Kit skills and reported no unexpected enabled skill. The actor read and used the relevant phase skills. No cross-arm skill/path or product contamination appears in the final tree; changes are limited to `store.py`, `cli.py`, the new reservation tests, constitution/feature metadata, and the generated feature artifacts.
- Execution completed normally. Cleanup confirmed the owned process group was already empty; there were no active turns, interruptions, protocol/server errors, rejected controls, routine confirmations, or diagnostic rescue messages. The sole operator intervention was terminal `finish`.
- The requested/reported main model was Terra/high, host-attested rather than independently verified. There were no child lifecycles, so no child-model claim applies.
- Wall time was 747 seconds (12 minutes 27 seconds). Recorded cumulative usage was 2,421,425 tokens: 2,389,282 input, 2,275,584 cached input, 32,143 output, and 8,167 reasoning output. Monetary cost was not recorded.

### Symmetric independent I/O evidence

The shared four-arm diagnostic is retained at `independent-dev-f1-io-probes-4arms.json` (SHA-256 `ef2a71adb0830610552424873200696425f3c7a53da5e5bc080d010b17e74805`). Native and Superpowers pass both probes; cc-sdd fails persistence and CLI I/O handling; Spec Kit fails persistence and passes CLI I/O handling. The probe script remains unchanged at SHA-256 `9f4b7784553b522f01aa08118934c5bc7c7d784c26ccdaf2007c98654601df06`. These are independent-review diagnostics, not additions to the frozen oracle or actor-visible requirements.

The smallest next experiment is one calibrated DEV-F1 persistence-failure probe, run symmetrically across every completed arm and kept separate from the frozen scores. Current evidence supports adding that evaluator coverage; it does not support a model, effort, retrieval, or multi-agent change by itself.


## DEV-F1 — BMAD full v2 (`dev-f1-bmad-v2`)

**Verdict: REJECTED for product acceptance; the BMAD workflow was substantively exercised, but its final review and completion claim missed one public CLI failure contract.** The original frozen score fails only because of the already-adjudicated direct-API return-envelope assumption, and the uniform contract-v2 secondary score passes. Neither score exercises database I/O failure at the CLI boundary. A symmetric independent probe reproduces a real requirement 9/12 violation in the final candidate.

### Product result and score interpretation

The store implementation satisfies the main batch semantics. It validates the complete request list, rejects booleans and invalid quantities, accepts extra fields, aggregates duplicate SKUs before availability checks, preserves bytes for logical rejections, treats an empty batch as a no-op, and persists successful deductions. The post-review persistence repair is also functional: `store.py:55-73` stages the complete serialization in the database directory, flushes and file-syncs it, replaces the live file only afterward, and removes a leftover temporary file on failure. The shared persistence diagnostic injected an `os.replace` failure; the API raised `OSError`, the original bytes and SHA-256 stayed exact, and the candidate tree remained unchanged.

One Important defect remains at `cli.py:13-18`. The reserve branch catches parse, indexing, type, and validation errors, but not `OSError`/`FileNotFoundError`. A valid reservation against a missing database exits 1 with a traceback on stderr and empty stdout. It therefore fails requirements 9 and 12, which require reserve-command failures to exit nonzero with a JSON object containing a nonempty string `error`. This is a public-boundary behavior, not a preference about internal exception types. The smallest repair is to normalize expected store I/O failures at the reserve CLI boundary and add one subprocess test for a missing or unreadable database.

The final public suite passes 15/15 and the targeted reservation suite passes 10/10, but neither covers that path. The original frozen scorer's `FAILED` result is a false negative caused solely by requiring the unspecified direct API `stock` envelope; the versioned contract-v2 result correctly changes that result to `PASSED`, with zero protected-input mismatches. The CLI I/O defect is an independent-review finding outside both evaluator versions. The actor's final statements that requirements 8–12 were covered and that JSON CLI errors were complete are consequently false.

### Review and workflow evidence

This was a real BMAD build, not a label-only invocation. The actor used the staged build workflow to create and advance a specification, launched a code-map child and a distinct implementation child, then launched blind-hunter, edge-case-hunter, and verification-gap reviewers. The reviewers found the original direct live-file write and several missing cases. Rejecting their cross-process locking concern was reasonable because concurrent writers are outside the approved single-call contract. Accepting the live-write finding was material: the first green implementation could corrupt the database on a failed write, and the final atomic-publication repair now passes the independent persistence probe.

The review still has two evidence limits. First, none of the three reviewers tested or identified the reserve CLI's database-I/O failure, even though the root requirements and `cli.py` were in scope. The generated specification initially described error handling mainly as invalid-request handling, which likely focused review on validation failures and contributed to this blind spot. Second, the review step instructed the manager to re-engage the same implementation child for accepted patches, with an explicit self-patch fallback only if continuation was unavailable. The main actor announced that it was re-engaging the original worker, but the trace contains no follow-up or second turn for that child; the file changes occur in the main turn, and no inability to continue is recorded. This is a workflow/evidence mismatch. Main-thread tests verified the repair, but no independent reviewer reread the changed implementation afterward.

The two routine confirmations are accurately recorded and contain no diagnostic rescue. The first allowed the workflow to treat the uncommitted, no-`HEAD` checkout as its local baseline; the second approved continuing the already supplied requirements/specification. Both received the same frozen continuation text. They make this an assisted ordinary-workflow run rather than evidence of fully unassisted autonomy. The only other intervention was terminal `finish`.

### Isolation and measurements

- Execution finished `COMPLETED` with no interruption, rejected control, protocol/server error, or active turn at cleanup. The owned process group was already empty and cleanup was confirmed.
- Six threads contributed work: main, code-map, implementation, and three review roles. All five child threads completed and no grandchild appears. Host metadata attests only the main Terra/high request/report; effective child models are not independently observable and remain unknown.
- Protected inputs have zero mismatches, and the trace shows no diagnostic guidance, network use, or cross-arm product edits. Framework artifacts and review records remain inside the selected consumer.
- End-to-end trial time was 1,105 seconds (18 minutes 25 seconds). Recorded cumulative usage was 3,508,896 tokens: 3,466,550 input, 3,252,992 cached input, 42,346 output, and 21,291 reasoning output. Monetary cost was not recorded.

### Symmetric independent diagnostic

The unchanged shared probe now covers five completed DEV-F1 arms. Its raw report is `independent-dev-f1-io-probes-5arms.json`, SHA-256 `463f4babba8a63817b335756faf6542c06537d8f905df44172cb75da79370fca`; the probe script remains SHA-256 `9f4b7784553b522f01aa08118934c5bc7c7d784c26ccdaf2007c98654601df06`. BMAD passes exact-byte preservation under injected publication failure and fails only the CLI I/O JSON check. Native and Superpowers pass both checks; cc-sdd fails both; Spec Kit fails persistence and passes CLI I/O. All five candidate trees were unchanged.

The smallest next experiment remains a versioned, independently calibrated persistence/CLI-I/O evaluator applied symmetrically to all DEV-F1 arms. This case supplies measured evidence that BMAD's multiple specialist reviews repaired one real defect but missed another adjacent failure boundary; it does not establish a general benefit or cost disadvantage for multi-agent review from one sample.


## DEV-F1 — Leo Dev current v2 (`dev-f1-leo-v2`)

**Verdict: ACCEPTED for product; ACCEPTED for the completed corrected-change workflow, with a material same-change repair limitation and one inaccurate evidence claim in the final report.** The final implementation satisfies the approved functional contract, its 11 tests pass independently, and it passes both shared I/O diagnostics. The installed controller also produced a real, current, independently reviewed candidate receipt and advanced the corrected change to `integration-review`. However, it could not record the first design rejection or resubmit a repaired design on the original change, so the actor had to repeat the lifecycle under a new change ID.

### Product and score adjudication

`store.py` validates the full batch before mutation, rejects booleans and other invalid quantities, ignores extra fields, aggregates duplicate SKUs before availability checks, and returns a plain SKU-to-count mapping. Logical failures leave the database untouched, an empty batch performs no write, and success is published through a same-directory temporary file followed by `fsync` and `os.replace`; temporary output is removed on failure. `cli.py` preserves `list` and `get`, wraps reservation success as `{"stock": ...}`, and normalizes reserve-path exceptions to nonzero JSON errors.

I independently reran the actor's standard-library suite with bytecode disabled: all 11 tests passed. The unchanged shared diagnostic also passes both omitted failure boundaries: an injected `os.replace` failure raises while preserving the live database bytes and SHA-256 exactly, and a valid reservation against a missing database exits 1 with a complete JSON object containing a nonempty `error`. The candidate tree was unchanged after the probes.

The original frozen score remains `FAILED` solely because oracle line 86 requires the direct Python API to return a `stock` envelope that the approved requirements do not specify. The candidate's plain mapping is a legal API result, while the CLI supplies the explicitly required envelope. The uniformly bound contract-v2 secondary score therefore correctly reports `PASSED`, with zero protected-input mismatches. Its annotation binds the original score at SHA-256 `b76f89f7bb381acfa02badda327804911f558c735db8cfe84c6841cdd1ea2ace`, the same case/stage/trial, and the versioned oracle. This is an evaluator correction, not a candidate repair.

### Actual Leo workflow and the design-repair gap

The first `dev-f1` lifecycle was real. It progressed through triage, discovery, independent specification approval, and a design-review request. The design reviewer rejected four substantive gaps before any product edit: direct live-file replacement was not failure-atomic; empty input did not explicitly guarantee no write; the reserve-only exception boundary was ambiguous; and malformed or missing CLI input was underspecified. Those findings match the final contract and were useful.

The installed controller has no supported operation to ingest that design rejection and return the same change to an editable design state. It also cannot request a new review after editing a design already awaiting review. Consequently the original change remains at `design-review`. This is a confirmed controller capability gap, not actor preference. The actor preserved the rejection in the host trace and a local `design-review-rejected.md`, then created `dev-f1-corrected` with the same approved requirements/specification and a corrected design. It did not modify the original change or falsely advance it.

The corrected change then completed the ordinary controller lifecycle. A distinct design-review thread approved the corrected design with exact spec, plan, design, change, and producer-session bindings. A writer claimed the task, produced genuine RED results before the API/CLI existed, implemented only the assigned store, CLI, and test files, and reached 11/11 green. The manager registered the current candidate; the controller gate reran the full suite and bound its evidence to the current tree. The same independent reviewer later reviewed the frozen candidate in a separate turn and passed it. The final candidate-review receipt is bound to the exact run, task revision, lease generation, specification, task contract, and tree; the controller accepted it, marked the task done, released the lease, and advanced the corrected change to `integration-review`. No product file changed after candidate review.

The final response accurately disclosed that two change IDs were used, the original remained blocked after rejection, the corrected change reached integration review, and no commit, release, archive, or external evaluator run occurred. One phrase is inaccurate: it says the design rejection “receipt was preserved.” No rejection receipt was created or ingested, and the original controller journal contains no `receipt.design-review.ingested` event. What was preserved is host-trace evidence and a local Markdown record. This overstates controller provenance but does not invalidate the independently visible rejection or the corrected candidate's valid receipts.

### Isolation, intervention, and measurements

- Discovery enabled exactly the expected 15 skills (`leo-dev:develop` plus the staged Superpowers set), with no unexpected skill name or path. Protected-input mismatches are zero, and there is no evaluator/oracle access or cross-arm product contamination in the trace.
- The only operator intervention was terminal `finish`. There were zero routine confirmations, interruptions, rejected controls, server/protocol errors, or diagnostic rescue messages. Execution ended `COMPLETED`; cleanup found no active turn and confirmed the owned process group gone.
- Four threads participated: main, the initial design reviewer, the corrected-design/candidate reviewer, and the implementation writer. All children completed and no grandchild appears. Terra/high is host-attested for the main request/report; effective child models are not independently observable.
- End-to-end runner time was 1,260 seconds (21 minutes). Recorded cumulative usage was 9,983,036 tokens: 9,935,536 input, 9,575,680 cached input, 47,500 output, and 22,902 reasoning output. The main thread alone accounts for 9,094,822 tokens. Monetary cost was not recorded. Repeated large controller-state and manifest reads are a measured context-efficiency concern, but this one quality-first case cannot establish a model, retrieval, or orchestration remedy.

### Six-arm symmetric I/O evidence

The unchanged independent diagnostic now covers every completed DEV-F1 arm. Its raw six-arm report is `independent-dev-f1-io-probes-6arms.json`, SHA-256 `8a0eb6ce574328d5eb690ae60d532b446ef62514f8457340b3cd2691866062d1`; the probe script remains SHA-256 `9f4b7784553b522f01aa08118934c5bc7c7d784c26ccdaf2007c98654601df06`. Native, Superpowers, and Leo pass both checks; cc-sdd fails both; Spec Kit fails persistence only; BMAD fails CLI error output only. All six candidate trees remained unchanged. These diagnostics are independent-review evidence and do not alter either frozen scorer or any historical result.


## W1 development-case aggregate disposition

**W1 is complete as a 12-observation development baseline.** This disposition covers the six arms on `DEV-R1` and `DEV-F1`, one attempt per arm and case. It does not rank the frameworks or support a general reliability, cost, or efficiency claim.

- `DEV-R1` product behavior is accepted for all six arms. The regular-layout `dev-r1-leo-v2` supplement is the official Leo baseline; the earlier symlink attempt remains a separate setup-blocked run. Spec Kit's product passes, but its workflow acceptance is rejected because implementation edits occurred during the required convergence-only phase.
- `DEV-F1` product behavior is accepted for 3/6 arms: native, Superpowers, and Leo. cc-sdd, Spec Kit, and BMAD are rejected for reproducible public-contract defects. Across both development cases, product acceptance is therefore **9/12 observations**.
- Workflow evidence is heterogeneous and must remain separate from product counts. Superpowers found and repaired two real DEV-F1 issues through independent review. cc-sdd materially deviated from its selected per-task implementation mode and its aggregate reviewer missed two defects. Spec Kit falsely converged with a live persistence defect. BMAD exercised real build and specialist-review stages and repaired atomic publication, but missed the CLI failure boundary and did not independently rereview the repair. Leo completed a fully gated corrected-change lifecycle, but its controller could not repair the rejected design within the original change and its final report mislabeled the locally retained rejection evidence as a receipt.
- The original frozen DEV-F1 scorer false-rejects legal plain direct-API returns, affecting native, BMAD, and Leo. Contract-v2 corrects only that unsupported constraint. Conversely, both scorer versions miss the persistence and CLI-I/O failures found by the symmetric independent probes. Frozen and secondary results remain preserved as historical evaluator outputs; the independent verdicts above are the protocol's separate process/code adjudication.

These samples show concrete evaluator and review blind spots, not a causal benefit from higher reasoning effort, a stronger model, retrieval, or more agents. The smallest next experiment is the already planned independently calibrated evaluator for the two public failure boundaries, applied symmetrically without changing W1 results. Repeated trials and held-out cases are still required before comparative product or workflow claims.
