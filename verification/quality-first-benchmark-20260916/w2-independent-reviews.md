# W2 independent trial reviews

## DEV-R1 control — W3 runtime with original methods (`w2-dev-r1-w3-runtime-control`)

**Product verdict: ACCEPTED. Process verdict: ACCEPTED with material efficiency/usability limits.** The final code satisfies the approved contract, the original external scorer passes with zero protected-input mismatches, and the actor's five-test suite passes independently. The design rejection, scope-preserving plan revision, candidate review recovery, and final review receipt all correspond to real host/controller evidence. This is a W2 control observation, separate from the frozen primary W1 result.

### Product and verification

`latest_by_id` retains first-seen IDs in a list while overwriting each ID's dictionary entry, so it returns the final record per hashable ID in first-ID-occurrence order. It returns the original record objects and does not mutate the input list or dictionaries. `points_for` rejects `bool` before accepting only `int` values 1–10 and performs no coercion. The implementation adds no dependency, storage, or public API.

I independently reran `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -v`; all five actor tests passed. The external frozen scorer separately ran four oracle tests covering empty and hashable non-string identifiers, last-value/first-key ordering and nonmutation, valid quantity boundaries, and invalid values without coercion; all passed. `requirements.md`, `README.md`, and `unrelated.txt` retain their protected hashes, and the score reports no protected-input mismatch.

The actor's RED evidence is genuine: before the repair the same five-test command exited 1 with exactly two failures, one for returning first rather than last duplicate records and one for accepting `True`. `DEV-R1-report.md` records those failures, their actual causes, the minimal changes, and the final command/result. It correctly says README contains no regression command. The stale `app.py` module docstring still calls the file a faulty baseline fixture; this is misleading prose but does not affect any approved behavior.

### Routing, rejection, and revision authority

The actor routed one Standard task because the repair added a behavior test/report and used the installed package's controller. The first independent design reviewer accepted both product designs but rejected the handoff plan for two real specification-compliance gaps: task acceptance omitted the report required by requirements section 3, and it falsely referred to a nonexistent README regression command. No product edit or candidate existed at that point.

The actor did not pretend that rejection was an ingested controller receipt. It retained the real host response and `design-review-findings.md`, then used the existing substantive revision path. The revision leaves `requirements.md` byte-identical at SHA-256 `a951c505b6a526d78d14390ca94e4f327ebb7aa002903af175e6578faafb15df`; task revision 1 advances exactly to revision 2 and adds the already-approved report obligation plus the accurate standard-library command/no-README-command condition. It records a complete assessment, a new task hash, and a new authority revision before resetting `design-review` to `spec-approved`.

The local `human-confirmed` revision receipt is unauthenticated, as the controller records. In this trial it does not invent a new human decision: the user prompt expressly says the requirements are approved, authorizes ordinary planning artifacts and in-scope repair without another routine go-ahead, and forbids only new product scope or material approval. The task-plan correction implements an explicit existing requirement and changes no public behavior, allowed path, risk, dependency, or product scope. Treating that prior authorization as the local revision grant is therefore acceptable here. It would not authorize a changed requirement or new task scope in another case.

A new independent reviewer session then reviewed the revised design, accurately confirmed resolution of every prior finding, and issued a pass receipt bound to the new spec, plan, design, producer session, and findings. The controller ingested it before task claim. The actor then used a single revision-2 run and lease, real RED/GREEN implementation, candidate registration, the declared Python gate, and submission. This sequence preserves one task authority rather than appending a shadow task or restarting the change.

### Current-candidate review and recovery

Two read-only native roles inspected the submitted tree: a separate current-candidate verifier and the revised-design reviewer acting later as the independent code reviewer. Both reran the five tests and inspected the product, report, task scope, and gate evidence. Reusing the design reviewer for candidate review remains independent from the main-thread implementer; the additional verifier is corroborating evidence rather than a second controller authority.

The first candidate review completed before the lease expiry and produced a candidate-bound pass document/receipt, but the manager spent enough time inspecting receipt schema that it did not call `review` until five seconds after the lease expired. The controller correctly rejected that receipt with `CONFLICT: Submitted candidate lease is no longer current`; it was never ingested and did not mark the task done.

The actor then used `resume --recover-review`. The recovery event binds the original claim, registered candidate, successful Gate result, submit event, task revision, lease generation, spec/task hashes, and unchanged tree `0d6314bf…` under recovery ID `12a1cafd-92d8-4bff-a675-b1fda14df957`. The same independent reviewer received a new turn after recovery, reread the candidate and recovery/gate evidence, reran all five tests, and produced a fresh receipt timestamped after recovery with that exact recovery ID. The controller accepted only this new receipt, moved `review-required -> reviewing -> done`, released the lease, and advanced the change to `integration-review`. No product file changed between submission, recovery, rereview, and acceptance.

The final answer accurately distinguishes task `done` from release readiness, reports both independent reviews and the recovery, and does not claim release, archive, commit, or deployment. Local receipt provenance remains unauthenticated; actual host trace proves the three child sessions and their outputs, while effective child model selection is not independently observable.

### Retained command errors and process limits

The trace contains the following nonzero commands; none is hidden or reclassified as a passed check:

1. A combined initial read command exited 1 because its final `rg` found no additional Python file; the preceding reads completed.
2. An uppercase `DEV-R1` team-status probe returned `VALIDATION_ERROR`; the actor switched to the required lowercase ID.
3. A pre-initialization status probe returned `PREREQUISITE_FAILED`.
4. A premature `triage -> discovery` dry run returned `TRANSITION_FORBIDDEN` because risk reasons had not been routed.
5. An `approve` probe omitted its required receipt and returned `VALIDATION_ERROR`.
6. An early route probe assumed a nonexistent default gate-registry path and returned `PREREQUISITE_FAILED`.
7. After recording the approval receipt, the actor attempted `spec-review -> design-review` before the required `spec-approved` transition and received `TRANSITION_FORBIDDEN`; it then used the valid sequence.
8. The first revision dry run left the task at revision 1 and received `VALIDATION_ERROR: must advance exactly one revision`; the corrected revision-2 plan was subsequently accepted.
9. The intended RED test exited 1 with the two expected product failures.
10. A schema-inspection command used the wrong installed path (`runtime/schemas/review.json`) and exited 1; this contributed to review delay but did not change state.
11. The first review-ingestion command returned the expected lease-expiry `CONFLICT`; recovery and a fresh rereview followed.
12. A post-completion transition probe omitted `--scope` and returned `VALIDATION_ERROR`.
13. A narrow `rg` source lookup returned 2 after producing its useful matches.
14. A dry run of `integration-review -> done` returned `TRANSITION_FORBIDDEN`; the actor then correctly retained `integration-review` rather than forcing a nonexistent change state.
15. A final optional board command returned `INTERNAL_ERROR` because its loopback listener was denied by the process sandbox. The accepted review response and journal still provided current lifecycle state.

These probes demonstrate honest error handling and successful recovery, but the amount of CLI discovery is excessive for this small repair. The run lasted 1,083 seconds (18 minutes 3 seconds). Four threads consumed 11,144,978 cumulative tokens: 11,105,585 input, 10,653,952 cached input, 39,393 output, and 14,855 reasoning output. The main thread alone consumed 10,681,904 tokens, largely from repeated full controller state, installed resource listings, and base64-heavy command output. Monetary cost was not recorded, so no cost comparison is supported.

### Isolation and evidence limits

- Discovery enabled exactly the staged 15 skills and no unexpected skill. The installed control identity records 1,326 files, `sameFiles: true`, `originalMethodsUnchanged: true`, and the isolated package location. The actor read the staged Leo develop skill/runtime plus relevant staged TDD, debugging, review, and verification resources.
- Execution ended `COMPLETED` with server exit 0. The sole operator action was terminal `finish`; routine confirmations, interruptions, rejected controls, server/protocol errors, and active turns at cleanup were all zero. Cleanup confirmed the owned process group already empty.
- Three child threads were real and completed: initial design reviewer, revised-design/final/recovery reviewer, and current-candidate verifier. There is no grandchild. Main Terra/high is host-attested; child effective models remain unknown.
- The board listener failure means there is no successful rendered-board observation in this trial. It does not affect the journal-backed task state, product result, or scorer, and the final response does not claim board success.

This single control case shows that the original method/runtime can produce a correct DEV-R1 result and can recover a stale review without changing the candidate. It also exposes high context/CLI-discovery overhead and a preventable lease-expiry detour. It does not establish comparative benefit for candidate A or B, and it does not support changing model, effort, retrieval, or team size from this observation alone. The smallest useful comparison is the already planned same-condition DEV-F1 control followed by independently accepted/frozen candidate-A development runs; preserve the same latency, token, intervention, routing, and current-evidence measurements.

## DEV-F1 control — W3 runtime with original methods (`w2-dev-f1-w3-runtime-control`)

**Product verdict: REJECTED. Process verdict: REJECTED for false acceptance of two contract failures.** The contract-corrected frozen scorer passes and protected inputs are unchanged, but the unchanged independent I/O diagnostic exposes two material requirements that the actor's tests and both native reviews missed. The original frozen score's sole failure is the already-adjudicated unsupported direct-API return envelope; it is retained but is not the basis for this rejection.

### Product behavior

The implementation correctly validates list and mapping inputs, rejects boolean/non-positive/non-integer quantities, aggregates repeated SKUs before checking availability, preserves bytes for validation and stock failures, persists ordinary successful reservations, preserves `list`/`get`, and emits the specified CLI envelope for covered parse and reservation errors. `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v` independently passed all 11 actor tests. The corrected contract-v2 score passes, while the original score fails only because it requires the unspecified direct Python API return to contain a nested `stock` object. Both score records report no protected-input mismatch.

Two independently reproduced failures remain:

1. `store.py:42` writes directly to the target with `Path.write_text`. Injecting a failure after a prefix write changes the target from SHA-256 `4d362b80…` to `90caeeb4…`; exact original bytes are not preserved. This violates requirement 6's unqualified "on any failure" guarantee.
2. `cli.py:13-15` does not catch `OSError`. A missing database path exits 1 with an empty stdout and a traceback on stderr, rather than a JSON object with a nonempty `error`. This violates requirements 9 and 12 for CLI failure output.

The unchanged diagnostic is recorded in `w2-control-dev-f1-io-probe.json`; it reports `candidateTreeUnchanged: true`. This diagnostic is independent-review evidence, not a retroactive change to either frozen scorer.

### Workflow and review evidence

The actor used the installed Leo Dev skill and controller, routed one Standard task, obtained a real design review, claimed a writer-bound run, demonstrated an intended RED failure, ran the controller-bound gate, submitted the exact candidate, and returned it to the same independent reviewer for a separate final turn. The reviewer independently reran all 11 tests. The controller accepted a candidate-bound receipt and moved the task to `done` and the change to `integration-review`; the final answer correctly withheld release readiness.

That ceremony did not provide sufficient specification review. The design said that delaying `write_text` until after request checks was enough to preserve bytes, and the design reviewer explicitly accepted that reasoning. The candidate reviewer then repeated it and declared all requirements covered. Neither reviewer considered a persistence-operation failure or an I/O-originated CLI failure. The actor's final table consequently overstates requirements 6, 9, and 12. The process verdict is therefore rejected even though the handoffs, role separation, TDD evidence, and controller transitions are genuine.

After review acceptance, the controller observer reports the gated/reviewed candidate as drifted because the accepted review artifacts themselves were written under `.leo-dev/runtime`. The actor disclosed this and product files did not change, but the final controller state cannot itself demonstrate a current whole-tree match. This is a provenance/usability limit of the control runtime, not the cause of the product rejection.

The retained nonzero commands were: the combined baseline/doctor command exited 8 because `doctor` searched for a nonexistent repository-local default gate registry; a transition-probing loop exited 3 on deliberately invalid state jumps; and the intended reservation RED suite exited 1 before implementation. None was hidden as a passing check.

The run lasted 614 seconds. Three threads consumed 4,911,314 cumulative tokens: 4,883,984 input, 4,617,728 cached input, 27,330 output, and 11,680 reasoning output. These are host cumulative counters, not billable-token or monetary-cost measurements. Main-thread metadata requests Terra/high, while effective child model identity remains unverified. Execution ended `COMPLETED`, server exit was 0, the only operator action was terminal `finish`, routine confirmations/interruption/rejected controls were zero, and cleanup confirmed no active turns and an empty owned process group.

## Candidate-A DEV-R1 setup failure and proposed host-fix supplement

**Original observation: UNVERIFIED / NOT RUN — SETUP FAILURE. Proposed separately labeled supplement: ACCEPTABLE under the frozen conditions below.** The original `w2-dev-r1-design-repair` manifest proves that no model or product workflow started: `initialized=false`, `threadId=null`, no skills discovery, no terminal turn, no agent lifecycle, and the event log contains only the client's `initialize` request with no server message. The app server exited 1 in the same recorded second; cleanup confirmed the process group gone with no active turn.

The trace does not contain stderr, so it cannot prove the exact launch failure. The operator's account that the first launch inherited the wrong sandbox and that a corrected escalated attempt then refused to overwrite the existing output is plausible and consistent with the retained files, but remains an operator account rather than trace-derived cause attribution. The existing frozen score exercised the unchanged seed after no actor turn and failed its behavior oracle; it must remain preserved but must not be counted as candidate-A product performance.

A fresh R1-only `design-repair-hostfix` observation is a defensible preregistered supplement because there was no model output, candidate edit, diagnostic feedback, or method outcome to select on. It may serve as the primary analyzable A-R1 observation only if all of the following stay true:

- retain the original manifest, event, and score as a nonprimary `UNKNOWN` setup failure; never overwrite or relabel it as a completed trial;
- use a newly staged consumer/trial/input and a distinct label, with the same frozen DEV-R1 bytes, prompt, developer instructions, model/effort, tools, limits, runner/protocol, and exact installed candidate-A package; record and hash the launch-environment-only amendment before dispatch;
- do not reuse any changed consumer or carry evidence from the failed directory, and verify the fresh consumer against its stage and package inventories before launch;
- run only the never-started R1 observation; leave the already completed A DEV-F1 and the newly created but unused supplement F1 consumer unrun;
- present the supplement alongside the original setup failure, rather than calling it an overwrite-free first attempt or silently replacing the failed row.

Under those constraints this corrects a host setup defect without weakening an observed product or workflow failure. It adds a methodological caveat to any paired A/control comparison and does not erase the extra setup attempt.

## DEV-F1 candidate A — design-repair controller (`w2-dev-f1-design-repair`)

**Product verdict: REJECTED. Process verdict: REJECTED overall, with verified improvement in design-rejection recovery and persistence atomicity.** Candidate A uses the new design-repair edge on real evidence and fixes the control's destructive-write failure, but the final code still violates the CLI error contract. Its manager and final reviewer incorrectly reported no unresolved behavior concerns.

### Product behavior and independent checks

The final store validates the full batch, aggregates duplicate SKUs, rejects invalid values, preserves invalid-input bytes, returns only affected stocks, treats an empty list as a no-write `{}`, and writes a complete temporary file in the target directory before `os.replace`. The actor suite independently passes 12/12. The contract-v2 score passes and protected inputs are unchanged. The original frozen score again fails only its unsupported direct-API-envelope assertion and remains preserved.

The uniform independent diagnostic confirms a real improvement over the control: injecting `OSError` at `os.replace` leaves the target byte-for-byte unchanged at SHA-256 `4d362b80…`; the implementation's `finally` block also removes an unpublished temporary path. The diagnostic finds the remaining contract failure: `cli.py:15-17` does not catch `OSError`, so a missing database produces exit 1 with an empty stdout and a traceback instead of the required JSON `error`. The evidence is in `w2-design-repair-dev-f1-io-probe.json`, with `candidateTreeUnchanged: true`. Because requirement 9 says the CLI emits JSON on failure and requirement 12 requires a nonempty error string, this is a product rejection even though ordinary covered behavior and atomic persistence pass.

### Actual use of candidate A

The new controller capability was consumed rather than inferred from package branding. An actual native reviewer rejected design hash `6fb0369e…` because its direct-write strategy could corrupt the database on I/O failure. Journal sequence 19 atomically ingests that reject receipt, bound to the unchanged approved spec hash, task plan hash, design hash, producer session, findings hash, and reviewer session, then transitions `design-review -> spec-approved`. Existing spec approval fields remain unchanged; the reject is not rebound as an approval.

The manager revised only the design, adding complete temporary-file preparation and atomic replacement. Journal sequence 21 records a new design hash `178aea54…` and a fresh review request under the same approved spec and plan. The same independent reviewer rechecked the corrected design; sequence 23 ingests the new pass receipt and advances to `design-approved`. No task, scope, approval, or requirement was invented. This is a valid real-world use of candidate A's intended repair path, and the final implementation plus independent failure injection show that the resulting atomic-write requirement was actually realized.

During candidate review, the reviewer separately enforced two rules from the actor-authored, independently approved design: reject a non-list direct API batch and return only affected SKU entries (`{}` for an empty list). The first is a compatible and prudent public-API choice, and accepting `{}` as an empty batch conflicted with that approved design. The original requirements are less explicit: they require the CLI input to be a JSON array and malformed requests to fail, but do not unambiguously define the direct Python API's batch-container type. I therefore do not count this finding alone as an independently proven original-contract defect.

The affected-only return rule is even clearer design alignment rather than a product requirement. Requirement 12 permits any success JSON containing at least a `stock` object; it does not require that object to omit unaffected inventory or require `{}` for an empty batch. The selected design may legally narrow its own API result, but the reviewer's LOW finding imposed an unnecessary implementation constraint and the manager overstated both findings as original "API-contract gaps." The final affected-only behavior is allowed, but it is neither a general quality improvement nor evidence that the prior all-stock mapping violated the approved product contract.

The first lease had expired, so the controller recorded a candidate/gate/submit-bound review-recovery context before ingesting this design-alignment reject receipt. It then moved the same task to remediation, issued lease generation 2, gated/submitted a replacement tree, and accepted a new pass receipt bound to the second run and tree. The repair has real RED evidence and final 12-test evidence. This candidate-review remediation uses existing review recovery and demonstrates current-candidate binding and honest rejection handling, while also showing that a reviewer can turn optional design choices into avoidable remediation work.

The remaining CLI I/O gap was nevertheless visible from the approved language and the plan's promise to translate store failures. The final independent reviewer checked only validation and ordinary store errors, then claimed requirements 1–12 were clean. The manager repeated that claim. Thus the A process cannot be accepted end to end. It supports a narrow measured finding—candidate A enabled a rejected design to be corrected without a fresh change and produced a truly atomic persistence path—but it does not support overall product acceptance or a general superiority claim.

The retained nonzero commands were an uppercase change-ID validation error; three intended TDD RED commands during initial work; the intended five-failure remediation RED run; an unsupported `submit --run` option; and a schema-invalid final receipt whose verdict used `clean` before metadata was corrected to `pass`. The latter correction did not change the candidate or findings, but the local receipt remained unauthenticated as the controller reports. No hidden model rescue or operator diagnosis was supplied.

The run lasted 1,091 seconds. Three threads consumed 11,377,008 cumulative tokens: 11,336,411 input, 10,944,000 cached input, 40,597 output, and 14,672 reasoning output. This is about 1.78 times the control elapsed time and 2.32 times its cumulative tokens for this single sample; candidate A also performed more genuine rejection/remediation work, so the difference cannot be attributed to the controller delta alone. Monetary cost was not recorded. Main Terra/high is host-attested; child effective model identity is unknown.

Discovery enabled the expected staged 15 skills with no unexpected skill. The actor read the installed Leo Dev method and package controller, used two actual child threads (one writer and one independent reviewer), and created no grandchild. Execution ended `COMPLETED` with server exit 0, zero routine confirmations/interruption/rejected controls, terminal `finish` as the sole operator action, and confirmed cleanup with no active turn. These controls establish a valid candidate-A method observation despite the rejected product result.

Across the two completed DEV-F1 observations, candidate A improves one specifically measured failure: persistence-operation failure preserves exact bytes, while the control corrupts them. Both miss JSON CLI handling for database I/O errors, so neither is independently accepted. With one observation per condition, no measured evidence supports changing model strength, reasoning effort, retrieval, or team count. The smallest next experiment for this result is the already preregistered fresh A DEV-R1 setup supplement; after that, adjudicate candidate A on the two DEV cases without repairing benchmark outputs or adding a post hoc scorer condition.

## DEV-R1 candidate A — fresh isolated setup replacement (`w2-dev-r1-design-repair-isolated`)

**Product verdict: ACCEPTED. Process verdict: ACCEPTED with a nonblocking planning/review-coverage defect and substantial efficiency limits.** This is the first candidate-A DEV-R1 attempt in which a model turn actually ran. It is a separately labeled setup replacement: it does not erase the original `w2-dev-r1-design-repair` app-server startup failure or the subsequent `w2-dev-r1-design-repair-hostfix` isolation failure, both of which remain `UNKNOWN`/unscored observations with no actor turn.

### Product and requirement coverage

The final `latest_by_id` records each hashable ID's first output position and replaces the record at that position on later occurrences. It therefore implements last-record-wins with first-ID ordering while leaving the input list and dictionaries untouched. `points_for` explicitly rejects `bool`, accepts only integers 1 through 10, performs no coercion, and returns ten times the quantity. No dependency, storage, or public-API change was introduced.

I independently reran `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_app.py`; all five actor tests passed. Those tests cover empty input, multiple duplicate IDs and ordering, input nonmutation, both valid boundaries, booleans, out-of-range integers, a float, a string, and `None`. They do not directly exercise a non-string hashable ID, but the separately frozen scorer does: its four oracle tests all pass, including hashable non-string IDs, and it reports zero protected-input mismatches. The protected requirements, README, unrelated file, and staged method/package inputs were therefore preserved.

The TDD record is real. Before editing `app.py`, the actor ran the same five-test command and obtained exactly two failures: the baseline retained the first duplicate records and accepted `True`. After the minimal implementation changes the actor, both independent reviewers, the controller gate, the actor's final verification, this independent review, and the frozen oracle all passed their respective checks. The delivery record accurately identifies the two root causes, rejects the unverified database/API-rewrite and coercion suggestions by implementing the local contract, records the baseline exit 1 and final exit 0, and discloses that `integration-review` is not release evidence.

One nonfunctional defect remains: `app.py` still begins with the stale sentence `Deliberately faulty baseline fixture; not product implementation.` The implementation is now the accepted product result, so that sentence is misleading. It does not change behavior and was inherited in the control result as well.

### Actual workflow and current-candidate evidence

The main actor read the staged `leo-dev:develop` method and controller references, initialized the change against the unchanged requirements, created one lite repair task, claimed a controller lease, ran the declared Python gate, registered/submitted the resulting tree, and obtained an accepted current-candidate review receipt. The receipt is bound to task `repair-contract` revision 1, lease generation 1, the approved spec and task hashes, gate run `run-99db6e0c-d949-49db-bb27-f3538de72db4`, and candidate tree `e87a6dcb…`. The controller moved the task to `done` and the change to `integration-review`; the final answer does not inflate that into release, commit, archive, or deployment.

Two real read-only child sessions ran concurrently after submission: `/root/independent_reviewer` and `/root/acceptance_auditor`. Each inspected the frozen product files and requirements and reran all five tests. Their clean findings agree with the code and independent oracle. The team bindings and receipt have `host-reported-not-authenticated`/`agent-asserted` provenance, so they are not cryptographic proof of reviewer identity; the preserved host lifecycle and transcript do establish that distinct child turns actually ran and completed. Effective child model identity remains unknown.

Candidate A's new design-repair edge was not exercised in this case. The actor classified the task as lite, did not enter design review, and encountered no design rejection. This run supports candidate A's ordinary repair, gate, submission, and current-candidate path; it supplies no additional evidence that the new rejection-to-repair transition is beneficial. The A DEV-F1 observation remains the only measured consumption of that new edge.

There is one process-coverage defect. The task plan's allowed paths and acceptance list include only `app.py`, `test_app.py`, behavior, and tests; they omit the requirements section 3 delivery-report obligation. Both native reviews occurred before `.leo-dev/runtime/dev-r1/delivery.md` was written and consequently did not independently review that final handoff record. The delivery record is a controller-runtime artifact outside the submitted product tree rather than an unauthorized product edit, and this independent review finds its contents accurate, so the omission does not reject the delivered result. It does mean the actor's claim that the independent reviewers covered all requirements is slightly broader than the evidence. The control run's initial design reviewer caught this same planning omission; the lite path here did not.

The stale all-untracked Git status was handled honestly. `git diff -- app.py` could not establish preservation against a repository HEAD, and `git diff --no-index` returned the expected nonzero status for new-file display. Product preservation instead rests on the staged hashes and frozen scorer, which is the appropriate evidence for this fixture.

### Isolation, interventions, and retained errors

The isolation amendment is exactly scoped. The original `config.json` remains SHA-256 `d41d6483…`; the supplemented config differs only by adding `/Users/leo/.codex/skills/humanizer/SKILL.md` with `enabled: false`. There are no other top-level, added, removed, or changed skill settings. The trial manifest's config hash is the supplemented config hash `38d04bb2…`, and skill discovery enabled exactly the staged 15 allowed skills with no unexpected skill. The frozen attempt lock is present at its preregistered SHA-256 `53332fd7…` and binds the prior isolation failure, original inputs/stage/package, supplemented argv/config, and this distinct consumer/trial. Thus the humanizer suppression corrected the recorded host isolation drift without changing the prompt, model request, method files, product fixture, thresholds, or permissions.

Execution ran from 07:55:50 to 08:05:10 UTC (560 seconds), ended `COMPLETED` with server exit 0, and required only the terminal `finish` action. There were zero routine confirmations, interruptions, rejected controls, protocol/server errors, or active turns at cleanup. Cleanup confirmed the owned process group already empty.

The trace preserves several non-product command failures: an early route probe assumed a missing repository-local default gate registry; transition probes tried forbidden states while discovering the controller sequence; one shell command mistakenly attempted to execute the Node binary as a script; a receipt-status command had a shell quoting error; and `git diff --no-index` returned 1 while intentionally displaying untracked files. None was presented as a successful check or altered the accepted candidate, but the amount of controller/schema discovery was disproportionate to this small repair.

The three threads consumed 5,364,803 cumulative tokens: 5,344,381 input, 5,095,680 cached input, 20,422 output, and 7,237 reasoning output. The main thread accounted for 5,173,293 tokens. These are host cumulative counters, not billable-token or monetary-cost measurements. Requested and host-reported main configuration was Terra/high; no cost was recorded. This one accepted R1 result does not justify a stronger model, more agents, or added retrieval. It instead shows that ordinary correctness was achieved with high orchestration/context overhead for a tiny two-function repair.

### Final disposition of the three A-R1 attempts

- `w2-dev-r1-design-repair`: retained `UNKNOWN` setup failure; app server exited before initialization and before any actor/model turn.
- `w2-dev-r1-design-repair-hostfix`: retained `UNKNOWN` isolation failure; initialization/skill discovery exposed the unexpected global humanizer, but no actor/model turn ran.
- `w2-dev-r1-design-repair-isolated`: **ACCEPTED product result and usable process observation**, with the report-planning/review limitation above.

This accepted replacement makes candidate A's DEV-R1 result analyzable under the preregistered isolation correction. Candidate A's source-level design-repair mechanism remains independently accepted, while its DEV-F1 product result remains independently rejected; this report therefore does not imply that candidate A passed an overall two-case product-quality acceptance. The separate requirement that both DEV products pass before retaining candidate B belongs to the B method-treatment plan and is not retroactively applied as candidate A's source-mechanism acceptance rule.

## DEV-R1 candidate B — closeout-method treatment (`w2-dev-r1-closeout-method`)

**Product verdict: ACCEPTED. Core workflow verdict: ACCEPTED. Candidate-B resource-treatment observation: NOT CONSUMED, so this result supplies no attributable evidence of benefit from the three added source resources.** The final product is correct and the ordinary Leo controller/reviewer path is genuine. Neither the manager nor the independent reviewer read or applied the packaged `kiro-review`, `kiro-verify-completion`, or Spec Kit `converge` resource to the submitted candidate. That absence is an execution fact, but the frozen binding makes those resources conditional rather than mandatory for every ordinary task; it is not by itself a process rejection.

### Product and preservation

The final `latest_by_id` assigns records into a Python insertion-ordered dictionary. Reassignment replaces the value without moving the ID's first insertion position, so `list(latest_records.values())` returns the original last record per hashable ID in first-ID order. The function does not mutate its input. `points_for` rejects booleans before accepting only integers 1–10 and performs no coercion. The implementation adds no dependency, storage, or public API.

I independently reran `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -v`; all five actor tests passed. The tests cover empty input, duplicate/order behavior, retention of the last original record object, integer IDs, list/dictionary nonmutation, both valid boundaries, strings, floats, both booleans, and out-of-range integers. The frozen external score independently passes all four oracle checks, including hashable non-string IDs, and reports no protected-input mismatch. Its evidence bindings are stage SHA-256 `44811c36…`, terminal-manifest SHA-256 `7ec9bf74…`, and oracle SHA-256 `4f996aed…`.

The TDD evidence is authentic. The writer first added the five tests and recorded a run with exactly two expected failures: first-record-wins and acceptance of `True`. It then made the minimal two-function repair and reran the same command green. `dev-r1-report.md` preserves the exact red output, root causes, changes, and final five-test result. It is included in task `repair-contract`'s allowed paths alongside `app.py` and `test_app.py`, existed before Gate/submission, and was read by the independent reviewer. This avoids the report-planning gap seen in candidate A's lite R1 run.

The unchanged baseline module docstring still describes `app.py` as a deliberately faulty fixture. That sentence is now stale and misleading but does not affect the required behavior; it is the same nonfunctional issue retained in the other accepted R1 products.

### Controller and independent-review evidence

The manager used one Lite task under the unchanged approved requirements. A distinct writer `/root/implementer` held the sole write role and changed only the three allowed files. The controller recorded successful Gate evidence for run `run-88016767-e6ae-46c2-bc98-e8144749ce5d`, registered/submitted tree `12e89650…`, and established review context for task revision 1 and lease generation 1. Task hash `465e7a0d…` and spec hash `a951c505…` match the accepted receipt.

After submission, distinct read-only reviewer `/root/reviewer` inventoried the complete relevant candidate despite the repository having no useful committed HEAD, read requirements, code, tests, report and controller evidence, and independently reran all five tests. Its clean findings hash is `3ee56004…`. Receipt `independent-review-dev-r1-1` binds that findings hash and the exact run/task/revision/generation/spec/task/tree identities. The controller returned `LITE_REVIEW_ACCEPTED_UNAUTHENTICATED`, marked the task done, released the lease, and advanced to `integration-review`. The unauthenticated label is correctly preserved; host lifecycle evidence independently shows the writer and reviewer turns occurred and completed. No product file changed after review.

The final answer accurately reports the files, requirements, command/result, accepted independent review, and `integration-review` limitation. It does not claim release, archive, deployment, or cryptographically authenticated reviewer identity. The user-approved local requirements justify the recorded human-confirmed spec approval; its local provenance remains an audit label rather than independent authentication.

### Added resources were not consumed; the existing closeout was sufficient here

The installed B identity is frozen at SHA-256 `f5496dcc6d7797786382ce58d6d38dcd3b239fa5e77da70f6187b69cdc0de929` with 1,330 files and `sameFiles: true`. Its A-to-B delta records the runtime as byte-identical and adds the three intended read-only resources plus their license/provenance and concise bindings. This proves that the selected package contained the treatment; it does not prove use.

The complete command trace shows the manager read `develop/SKILL.md` and the ordinary lifecycle, components, gates, acceptance, review-protocol, team, autonomy and delivery references. It never opened `references/upstream-methods.md` or any of these packaged source resources:

- `.../kiro-review/RESOURCE.md`
- `.../kiro-verify-completion/RESOURCE.md`
- `.../spec-kit/templates/commands/converge.md`

The writer read TDD material and the fixture. The reviewer read the submitted project files and controller evidence and ran the tests; its command trace likewise contains no read of those four method/binding paths. No resource-consumption record, inventory attributed to Spec Kit convergence, cc-sdd review application, or cc-sdd `TASK`/`TEST_OR_BUILD` claim exists. The installed package and generic review alone therefore cannot support a claim that the added methods caused or improved this result.

The frozen applicability clauses do not make those reads mandatory for this task. The plan says to select the packaged review/fresh-evidence resources for **nontrivial** acceptance or repair review and says a sufficient existing review may supply the same evidence. The installed `upstream-methods.md` table likewise assigns the three resources to a “非 trivial” ordinary task, while `review-protocol.md` says to select upstream methods only when useful and not duplicate a sufficient existing review. `repair-contract` is a narrowly scoped Lite repair: two small pure functions, one standard-library test module, and one report. The trace does not establish a gap that made an upstream resource necessary. My earlier inference that being the last ordinary task alone required reading all three resources was therefore too strong.

The actual review supplies the required closeout substance without relying only on a green count. It reads the original `requirements.md`, implementation, tests, report and current controller evidence; checks last-write-wins, first-ID ordering, empty input, original-object/nonmutation behavior, integer boundaries, boolean and other invalid inputs, dependency/API/persistence scope; and independently reruns the tests on the submitted tree. The report and final response also reject the two unverified diagnoses from requirements section 2. The receipt binds the current change, task/revision, Run, lease generation, spec/task hashes and submitted tree. The review artifact uses behavior names rather than writing numeric IDs beside each bullet, although the final response explicitly marks requirements 1.1, 1.2 and 1.3 verified. That is a minor traceability presentation weakness, not a missing behavior or failure-condition review.

The generic reviewer did not invent constraints, false-object, create another state authority, add a receipt, mutate the candidate, or request approval. It covered the original requirements accurately and found no real omission. The bounded finding is therefore **no observed consumption and no attributable B-method benefit**, not a method-fidelity failure or hidden product defect. Nothing should be repaired after the completed trial or inferred from the package name.

### Runtime, isolation, and limits

The trial ran from 08:06:02 to 08:16:23 UTC (621 seconds). Three threads consumed 4,641,451 cumulative tokens: 4,618,248 input, 4,332,288 cached input, 23,203 output, and 8,632 reasoning output. These are cumulative host counters, not billable-token or monetary-cost data. Main Terra/high is host-reported but not independently attested; child effective models are unknown.

The only operator action was terminal `finish`; routine confirmations, interruptions, rejected controls, server/protocol errors and active turns at cleanup were zero. Cleanup confirmed the process group already empty. Discovery enabled exactly the staged 15 skills with no unexpected skill. The accepted isolation supplement is also present: the original and supplemented configs differ only by adding `/Users/leo/.codex/skills/humanizer/SKILL.md` as disabled; manifest config SHA-256 `02b4f6dc…` and lock SHA-256 `bcf2b447…` bind that amendment.

Retained nonzero commands were a pre-test discovery run that correctly reported zero tests before the writer created them, four uppercase change-ID probes rejected as invalid, a source-search command whose final `rg` found no match, and the intended two-failure RED suite. A first Gate shell construction did not execute the Gate because temporary variables expanded incorrectly; the manager disclosed it, reran with the fixed absolute invocation, and only the latter produced `GATES_PASSED` and submission. None of these errors was hidden as product verification.

Compared with the accepted candidate-A R1 observation, B R1 took 61 seconds longer but used about 723,000 fewer cumulative tokens; the actor/team shapes and controller exploration also differ, so one sample supports no efficiency or causal method claim. No evidence here supports changing model, effort, retrieval, or agent count.

For the B retention rule, this R1 product satisfies independent acceptance and introduces no unmet requirement, invented authority, or unnecessary routine confirmation. Because the task is Lite and its existing closeout is sufficient, the evidence does not establish that any of the optional upstream methods was necessary; their non-consumption is not a failed mandatory condition in this observation. It also provides no positive treatment evidence. Overall B retention remains unadjudicated until the independently reviewed DEV-F1 result is available; that later decision must preserve this R1 result as a correct product with **no attributable source-method consumption or benefit**.

## DEV-F1 candidate B — closeout-method treatment (`w2-dev-f1-closeout-method`)

**Product verdict: ACCEPTED. Controller-governed process verdict: REJECTED / INCOMPLETE for the repaired final tree. Method observation: the source resources were consumed by the manager and their closeout pattern found a real defect, but direct reviewer consumption is unproved and the repaired tree never became a controller-submitted candidate.** Both frozen behavioral scores say `FAILED`, but each rejects a behavior the approved requirements permit. Independent code review, 13 public tests, and the unchanged cross-arm I/O diagnostic support product acceptance.

### Product contract and independent behavior

The final `InventoryStore.reserve_batch` satisfies requirements 1–8 and 11–12. It accepts mapping-like requests, rejects empty/non-string SKUs and non-positive, non-integer or boolean quantities, ignores extra fields, accumulates repeated SKUs before availability checks, and performs all validation before persistence. Empty input returns the complete stock map without writing. A successful nonempty batch updates each accumulated SKU once, stages JSON in the database directory, replaces the live path only after the staged write succeeds, cleans a leftover stage, and is visible to a fresh store instance. Existing `list_items` and `get` code remains unchanged.

The CLI requires a JSON array for `reserve`, wraps success in a JSON object containing `stock`, and returns nonzero with a nonempty JSON `error` on invalid input or database I/O. It writes errors to stderr. Requirements 9 and 12 specify JSON and a nonzero status but do not choose stdout over stderr, so that channel is a valid implementation choice.

I independently reran the documented command:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
Ran 13 tests in 0.101s
OK
```

The suite covers all five preserved regressions plus accumulation, persistence through a fresh store, invalid and late-invalid batches with byte preservation, booleans, empty no-write behavior, ignored extra fields, success/error CLI JSON, and an interrupted staged-write fault. The protected requirements, README and public regression inputs have zero score-reported mismatches.

The uniform independent diagnostic at `w2-closeout-method-dev-f1-io-probe.json` also passes and leaves all 1,415 candidate files unchanged. Its injected `Path.write_text` failure happens on the staged file while the live database remains byte-identical at SHA-256 `4d362b80…`. A missing-database CLI operation exits 1 and emits `{"error": "..."}` on stderr; no database is created. This directly covers the two public I/O boundaries missed by earlier W2 candidates.

### Both scorer failures are evaluator false negatives

The original frozen score is retained at SHA-256 `e6588ea4…`. It stops at the known unsupported direct-API assertion that `reserve_batch` itself must return an object containing a nested `stock` map. The API contract does not define that return envelope; this candidate's plain SKU-to-count mapping is valid, while its CLI supplies the required `stock` object.

The contract-v2 score is retained at SHA-256 `5836b1f3…` and fixes that API-envelope mistake, but it fails when `{}` is passed to the CLI because its helper parses only stdout. The candidate correctly exits nonzero and prints `{"error": "reserve argument must be a JSON array"}` to stderr. Neither requirement 9 nor 12 fixes the error channel, and the already uniform independent probe deliberately accepts JSON from stdout or stderr. This is a second oracle gap, not a product defect. Both scores bind stage SHA-256 `0159cd4b…` and terminal manifest SHA-256 `4e7b6459…`; neither reports protected-input drift.

### Genuine method consumption and a useful finding

This Standard task made the B closeout resources applicable. Before producing the design and task artifacts, the manager read `upstream-methods.md`, the pinned cc-sdd `kiro-review` and `kiro-verify-completion` resources, Spec Kit `converge`, and the selected cc-sdd design/task references. It did not merely discover or name them. The resulting design binds the original requirements, existing implementation facts, task and constitution, maps stable requirement IDs to components/evidence, and keeps the original requirements authoritative.

The independent design reviewer first rejected a concrete requirement-12 gap: the design called the empty batch successful but did not require it to avoid a write. The actor used the accepted design-repair back edge, added that no-write rule without changing the approved specification, obtained a fresh pass over the revised design, and claimed implementation against that reviewed design. This is a valid original-intent correction rather than an invented constraint.

The first submitted implementation passed 12 tests but wrote directly to the live database. The independent reviewer read the original requirements and complete current candidate, independently reran the suite, then injected an interrupted `Path.write_text`. The live file changed from its original bytes to a partial JSON prefix, proving a requirement-6 violation. This is exactly the kind of original-intent/failure-condition review the B treatment selected; green-count acceptance would have missed it.

The same writer then used a real RED/GREEN repair: the new staged-write regression initially failed with the live database reduced to `b'{"ite'`, then passed after same-directory staging and replacement. Focused reservation tests passed 8/8 and the full suite passed 13/13. The independent reviewer reread the repaired implementation and all tests, reran the full suite, and recorded requirements 1–12 as verified on the replacement filesystem tree. No product requirement was narrowed or added, and no routine user confirmation was requested.

This is useful observed method-aligned behavior, but it is not a controlled causal claim. The same reviewer or an ordinary careful review might have found the defect without the added resources. The reviewer command history also does not show it opening the pinned source files itself; resource consumption is proven at the manager/team level, and the review output operationalizes the inventory/fresh-evidence pattern, but the binding's preferred direct reviewer read is unverified. No result supports a general framework or efficiency ranking.

### The repaired tree is outside the controller's accepted candidate chain

The controller successfully claimed, gated and submitted only the original 12-test tree `9781bf19…` under run `run-2e7e79fd-901b-49e1-887b-08d716b73bdd`, task revision 1 and lease generation 1. Its journal ends after the submit batch at sequence 42. The initial review finding was real and bound to that tree, but the first manually assembled receipt used schema-invalid verdict `fail`; changing it to `reject` exposed a controller `BLOCKED` error: `The prepared execution policy is not bound to the reviewed Gate and launcher`.

The later read-only diagnosis in `w2-b-f1-binding-diagnosis.md` attributes this refusal to launcher identity rather than Gate, operation, PATH policy or runtime-source drift. Frozen B plus `/Users/leo/.nvm/versions/node/v22.22.2/bin/node` reconstructs the complete prepared launcher digest `6d061eb3274a17d2af0a077a18ad181b4ad4e46db6140e178249c22ab8d3d94a`. The actor's explicit Node 22 retries instead used Homebrew `22.22.0_1`, whose launcher digest differs. The original passing Gate command used dynamic `command -v node` without printing its resolved path, so NVM 22.22.2 is a matching reconstruction rather than a path recorded directly by that command. The earlier claim that the actor retried with the original Node 22 executable is withdrawn. The retained evidence demonstrates an intended identity-binding refusal, not a controller defect.

The manager then continued the repair under the unchanged user-approved scope and original allowed implementation paths, so the product edit itself did not require a new product decision. However, the frozen B host binding requires a current candidate rejection followed by the controller's remediation path, fresh claim, Gate, submission and current-tree review. None occurred for the repaired 13-test tree. The final independent review is real host evidence, but it has no controller receipt containing that final tree, run and generation, and the historical Gate explicitly covers only the rejected 12-test candidate. The final task therefore remains `review-required`; it is not controller `done` or a completed current-candidate closeout.

The actor also deleted the initial review document/receipt from the candidate after the binding refusal and wrote the corrected receipt to `/tmp/dev-f1-candidate-review-reject-1.json`, where it still exists at SHA-256 `4e822907…`. The raw trial trace preserves the original rejection and the final answer discloses it, so the incomplete closeout was not hidden, but this is a concrete write outside the instruction to work only inside the candidate checkout. The receipt's self-written `platform-attested` provenance is not independently authenticated; actual host lifecycle proves the reviewer turns, not that label.

Other retained nonzero commands are distinguishable from product failures: one uppercase change-ID probe was invalid; the initial feature-absence suite produced the intended errors/failure; the independent interrupted-live-write probe reproduced the real defect; a file-read command ended on a nonexistent `runtime/manifest.json`; one receipt used invalid verdict syntax; repeated review/status/resume attempts hit the launcher-binding block; one source search targeted a nonexistent journal path; and the new staged-write test supplied the intended repair RED. The final answer accurately reports the product pass and the missing controller closeout instead of claiming task completion or release readiness.

### Isolation, lifecycle, and resource use

The attempt ran from 08:17:16 to 08:38:17 UTC (1,261 seconds). Three threads report 11,505,547 cumulative tokens in total: 11,456,647 input, 11,011,840 cached input, 48,900 output and 20,510 reasoning output. These are summed host cumulative counters, not billable cost. Main Terra/high is host-reported and unverified; effective child models remain unknown despite the actor's requested labels.

The sole operator action was terminal `finish`; routine confirmations, interruptions, rejected controls, server/protocol errors and active turns at cleanup were zero. All child turns terminated. Cleanup found the owned process group already empty and confirmed it gone. Discovery enabled exactly the 15 staged skills with no unexpected skill. Isolation supplement lock SHA-256 `6eb65022…` binds the accepted helper and the prior pre-model failure; manifest config SHA-256 `aa5b4987…` differs from the original only by disabling the known global humanizer path.

### B retention recommendation

Across B, both DEV products pass independent behavioral acceptance. R1 needed no optional upstream method and supplies no method-benefit evidence. F1 consumed the source resources at manager level, applied their closeout pattern, found a real requirement-6 defect, repaired it, and introduced no false requirement or routine confirmation. These facts support retaining the **method assets as promising** and show a concrete quality gain within this observation.

The frozen retention condition is nevertheless not fully demonstrated because the F1 replacement tree was never a fresh controller-claimed, gated, submitted and receipt-bound current candidate. Direct source consumption by the final reviewer is also unproved, and the outside-checkout receipt write is a process violation. I therefore recommend **HOLD rather than final retention on W2 evidence alone**.

The completed read-only fault isolation establishes that the immediate blocker was launcher-identity mismatch: the prepared NVM Node 22.22.2 identity was replaced by later Node 25 and Homebrew Node 22.22.0 identities. Gate definition, environment policy, operation fingerprint and frozen launcher source match; the controller's refusal was expected. The W3 source repair addresses a nested lock in the observation path and leaves this review/recovery identity check unchanged, so it is unrelated to the refusal.

That diagnosis explains the stopped controller chain but cannot add missing claims, Gates, submissions or receipts to the already ended trial. B-F1 remains process-incomplete and cannot retroactively satisfy the preregistered current-candidate retention condition. Root's resulting package-selection decision is recorded separately in `w2-selection.md`; this independent report retains its **HOLD** recommendation and does not recast the completed observation. The evidence does not support discarding the useful review methods, lowering a threshold, or repeating DEV-F1 to seek a cleaner outcome.
