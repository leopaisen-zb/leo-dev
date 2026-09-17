# Codex quality exercise — protocol v1

Parent: Leo Dev specification v1.10.0 and Q3 of the existing implementation plan. Authorized by the user's subsequent “开工”. This is one controlled engineering exercise, not a reliability benchmark or a comparison winner.

## Inputs and fixed outcome

The fixture is a copy of the public Mochi Board example, with one recorded recurrence of the future-import/edit defect. fixture-provenance.json preserves original and mutated source hashes. Original examples, prior reviews and producer outputs remain untouched.

The task is a bounded backend repair. Only the exercise consumer's lib/store.mjs and task-owned regression tests may be changed. Preserve the existing HTTP/API, input validation, atomic persistence and import/export contracts. No frontend redesign, package dependency, service, product-model API or new global setting is required.

Mandatory behavior:

1. A valid imported task keeps its imported fields on import, including future and calendar-boundary timestamps already accepted by the current input contract.
2. Editing its status changes that field, preserves identity and creation time, and does not move updatedAt backwards relative to either prior timestamp.
3. The edited data survives a real server restart, exports, and can be imported again.
4. Invalid snapshots still refuse atomically; the existing valid board and unrelated source remain intact.
5. Legacy ordinary create/edit/export behavior stays valid. Existing public acceptance tests are not removed, weakened or substituted.

The independent evaluator owns the literal behavior oracle. It must catch the controlled seed and accept an original valid reference in isolated copies before actor execution. Do not derive expected results from the repaired implementation. Keep its oracle, initial outputs and frozen thresholds outside writer ownership.

## Review calibration

Use two small, coordinator-labelled review packets derived from the prior reuse trial's actual failure modes:

- A valid output may use different JSON key order/whitespace when the frozen contract defines parsed fields and one line, rather than exact successful bytes. Required producer/method evidence may live in an explicitly supplied report outside the main artifact directory.
- A package that changes a required public key or makes mandatory behavior checks optional must be rejected.

Give each reviewer the complete packet and contract, without an expected verdict or another reviewer's conclusions. Preserve initial findings. Missing material context is an evidence request, not automatically an implementation defect. Unsupported new requirements count as review false positives. The evaluator records its oracle separately and judges both legitimate acceptance and rejection.

## Method binding

requirements = this fixed task and fixture/docs/spec-v2.md;
design = fixture/docs/design.md plus the bounded repair plan;
tasks = existing Q3 exercise steps and task-specific runtime input;
constitution = repository/user development rules;
facts = fixture source, original tests and reproduced results;
approval = user's Q1–Q4 execution instruction;
language = English artifacts.

Selected cc-sdd light-design and Spec Kit analyze resources are read from the candidate package with their reference closure. They operate on these existing artifacts. Do not generate a second .kiro/.specify tree or repeat the approved product interview. A source-consumption report is necessary evidence but is not authenticated proof of comprehension.

Superpowers supplies test-first repair, implementer/reviewer separation and final code review. BMAD's adapted team method supplies independent first contributions, evidence-based targeted discussion and a retained handoff. Use actual native members; no role-playing several independent reviewers in one context.

## Actual host execution

Before execution, root freezes the candidate package, consumer roots, oracle and dispatch prompts. Verify isolated package installation and skill discovery using supported Codex interfaces. A separate authenticated explicit-skill invocation may only be accepted if the actual host supports selecting that same installed path and the trace proves exact candidate use; record discovery and actor contexts separately. Otherwise installed actor acceptance remains blocked, not replaced by source-only execution.

Native task roles follow existing user routing: routine repair Terra/medium; code/protocol review Terra/high; independent evaluation Sol/high. Root retains scope and final judgment. Record actual tool/request configuration and returned thread/turn IDs; effective model attestation or cost unavailable from the host stays unknown. Do not modify global model/security defaults.

Freeze the candidate while reviewing. One writer per consumer checkout. Members cannot write oracle/protocol/receipt authority or spawn additional members without coordinator ownership. No uncontrolled simultaneous source writers.

Exercise a controlled interruption only through a real supported host operation. Require the host's interrupted/completed status, preserve the handoff and existing code, then explicitly continue or replace the member. If only simulated unreachability is feasible, label it simulated and keep real host interruption unverified.

Exercise stale/current evidence against existing public controller contracts. Old generation/candidate evidence must refuse, while a fresh independent result for the legal current context must allow progress. A host interrupt does not itself establish controller cancellation or absence of side effects.

No automatic repair loops. Keep the initial failure, perform only the in-scope repair allowed by current state/budget, and obtain a distinct review. Two failed remediation attempts require root's evidence/contract reassessment before any fresh-context diagnosis.

## Recorded verdicts

Record result correctness, review accuracy, method consumption, actual member identities, current-candidate binding, interruption/continuation and source preservation separately. Save command argv, exit/protocol outcomes, relevant output, hashes, actual request model/effort and UTC start/end where available. Do not collect credentials or private reasoning.

Each mandatory criterion is passed, failed, not run, blocked or not applicable with a reason. The overall Q3 is complete only when required actual-host and outcome checks have current evidence. A package build, role label or producer's “done” cannot satisfy those checks.

Elapsed time, interventions, repair count and available usage data describe this exercise. No estimate from output length or model branding substitutes for measured tokens/cost. A single exercise does not establish universal model, OS or Harness stability.
