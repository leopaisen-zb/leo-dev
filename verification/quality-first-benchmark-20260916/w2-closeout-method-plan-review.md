# Independent review: W2 candidate B closeout-method plan

**Verdict: REVISION REQUIRED before candidate B implementation or experimental freeze.** The source selection, authority model, and evidence limits are sound. Three binding details remain material because the proposed treatment could otherwise approve a different or stale candidate, or fail for repository mechanics unrelated to product quality.

## What is already acceptable

- The plan accurately treats A+B as a small development-only method experiment. It admits that Leo passed the W1 product cases, that no incremental benefit has been proved, and that one run per development case cannot establish causal or general superiority.
- The selected cc-sdd resources are review and fresh-claim verification methods rather than another specification authority. The raw resources are self-contained enough to package as immutable references, and the plan requires exact revision, license, provenance, and byte inventory. The Spec Kit source is used only for its intent inventory and gap classification; hooks, scripts, task appends, metadata writes, commits, and completion dispatch are explicitly disabled.
- Original approved intent remains authoritative. The proposed `verified / failed / unverified` evidence states and `missing / partial / contradicts / unrequested` classifications preserve uncertainty and legal alternatives. The plan expressly rejects invented serialization, algorithm, team-size, and marker-string requirements.
- The controller remains the sole task/state authority. A current submitted task uses candidate-bound rejection and the real remediation path; a done task is not reopened; the verification-only integration task cannot edit product code; an ordinary live task may edit an earlier file only when its existing scope and allowed paths permit it. Otherwise the method reports the authority boundary or uses the existing revision proposal. This matches the controller's actual `review-required -> reviewing -> remediation` rejection and fresh-claim behavior.
- Sequencing candidate A through independent acceptance and a separate installed/frozen identity before building B is correct. Retaining the existing BMAD-inspired handoff, native routing, and one review channel avoids adding a second authority or ceremonial reviewer merely for branding.

## Required corrections

### 1. Bind closeout to the exact submitted candidate and repeat it after remediation

Lines 47–59 require closeout before the last ordinary task is accepted, but do not specify the exact candidate identity or what happens when closeout causes a repair. A check performed on an implementing tree can become stale before Gate/submission; a check performed on a submitted tree becomes stale as soon as remediation changes that tree. “Fresh checks and independent review” at lines 61–63 does not guarantee that the original-intent inventory itself is repeated or that every prior finding is resolved against the replacement candidate.

Define the closeout as part of the final ordinary task's independent review of a **submitted** candidate. Its input/output must bind at least change ID, task ID/revision, Run ID, lease generation, current specification/task hashes, and submitted tree hash. A concrete gap must produce the ordinary candidate-bound reject receipt. After remediation, the fresh claim, Gate, and submission must be followed by a complete new closeout/review on the replacement submitted tree; alternatively, the final reviewer must explicitly re-evaluate every inventory item and prior finding against that exact tree. Only that current review may pass the task. Keep these fields in the existing review evidence/receipt path rather than inventing a second controller receipt.

This correction preserves the intended timing: the check still occurs before the last ordinary task becomes `done`, and any in-scope repair uses the controller's real revision/attempt budget. If authority or allowed paths do not admit the repair, retain the plan's existing blocked/revision-proposal outcome.

### 2. Override the upstream review's Git-first assumption with controller evidence

The pinned `kiro-review` resource says its first action is to run `git diff`. The W1 consumers can have no `HEAD`, and ordinary Git diff does not reliably inventory untracked new files. The current plan adapts marker and RED-evidence rules but does not adapt this first action. Following the raw instruction can omit precisely the implementation being reviewed or turn a valid candidate into a tooling failure.

The concise host binding must state that the controller's claim input, allowed paths, candidate registration, submission binding, and current controlled tree are the review baseline. Use a reliable file inventory/direct reads for the whole task boundary; use Git diff only when a valid baseline exists and never as proof that no new file changed. Keep the upstream resource bytes unchanged and record this project-specific adaptation beside the existing marker/script adaptations.

### 3. Select claim types without importing feature-release authority

`kiro-verify-completion` includes a `FEATURE_GO` mode that requires full-suite, runtime-smoke, integration, design, and blocked-task evidence. Candidate B is inserted at ordinary task acceptance/repair review, while Leo's integration and release boundaries remain separate. The plan should explicitly bind task acceptance to `TASK`, remediation to `FIX`, and individual command claims to `TEST_OR_BUILD`. It must not use `FEATURE_GO`, its boot-smoke requirement, or its `GO` language to mark a task done, advance the change, or replace later integration/release evidence. Missing environment evidence remains `UNVERIFIED` or `MANUAL_VERIFY_REQUIRED`; it is not automatically a product defect.

This keeps the useful fresh-evidence rule without importing a second completion engine or rejecting valid project-specific verification.

## Measurement and freeze limits

Before B is frozen, retain an exact A-to-B package delta manifest. It should show that controller/runtime/product behavior from accepted A is byte-identical and classify every B-only change as a selected raw resource/license, provenance/verifier entry, concise develop binding, package metadata, or method-specific test/evidence file. The comparison cannot literally use the same package bytes, so “same installed runtime” should mean the same host/runtime/model/permissions/budgets and the same accepted A controller/product bytes, with the treatment delta explicitly enumerated.

For each A+B DEV run, trace evidence must show reads of the exact pinned resources and use of their outputs on the current candidate. A skill-name mention or installed file is insufficient. If the resource is not consumed, report method consumption as failed or unverified rather than treating ordinary product success as evidence for B. Record ordering, latency, token usage, interventions, reviewer lifecycle, and outcome, but do not infer benefit, cost efficiency, or framework rank from the two single-run comparisons.

No additional framework, task, approval, threshold, held-out run, automatic hook, or model change is needed. Once the three binding corrections are explicit, the plan is suitable for candidate B implementation and a fresh A+B DEV experiment after candidate A is independently accepted and frozen.


## Narrow re-review after plan revision

**Verdict: PASS. All three prior blockers are resolved; the method plan may be frozen for implementation after candidate A satisfies its separate independent-acceptance and installed/frozen precondition.** This approval covers the plan and experiment design only; candidate B code, packaging, consumption, and DEV outcomes remain unverified until they exist.

- Lines 47–64 now place closeout inside the last ordinary task's independent review of its submitted candidate and bind change, task/revision, Run, lease generation, specification/task hashes, and submitted tree. Any remediation requires fresh claim, Gate, submission, and a complete replacement-tree closeout or explicit re-evaluation of every inventory item and prior finding. Only the existing candidate-bound review receipt is used.
- Lines 87–91 correctly replace the upstream Git-first assumption with controller claim/candidate/submission evidence and a complete relevant-file inventory, including untracked files. Git is auxiliary only when its baseline is valid; empty diff or missing `HEAD` cannot establish an empty change.
- Lines 93–98 limit fresh-completion use to `TASK`, `FIX`, and `TEST_OR_BUILD`. They explicitly deny `FEATURE_GO`, boot-smoke, and GO language any task, integration, or release authority, while preserving `UNVERIFIED`/`MANUAL_VERIFY_REQUIRED` for genuinely missing evidence.
- Lines 108–112 require an exact A-to-B package delta and byte-identical accepted-A runtime code, with every treatment-only resource, license, provenance/verifier, binding, and generated metadata entry enumerated. This makes the package difference explicit while holding host, model, permissions, budgets, cases, controller, and product behavior fixed.
- Lines 114–128 require trace evidence of actual relevant source-method consumption and application to the current candidate, preserve legal alternatives, reject invented authority and unnecessary confirmation, retain failed or unverified treatment outcomes, and prohibit causal or framework-ranking claims from the two single-run DEV comparisons.

The repaired plan preserves model judgment, original-intent authority, valid implementation alternatives, and the controller's real repair/revision boundary. It adds no automatic hook, task append, metadata mutation, commit, second ledger, parallel completion authority, held-out execution, or threshold change. No further plan change is required before the authorized implementation stage.
