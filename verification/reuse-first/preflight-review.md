# C3.4 reuse-trial independent preflight

Date: 2026-09-11. Scope: protocol feasibility before any arm actor runs. Inputs reviewed: `protocol.md`, the fixed fixture brief and constitution, `host-bindings.md`, `provenance.json`, the selection record, the C3.4 execution brief, and the copied three-module fixture. No actor output existed, no production source was inspected or changed, and this review does not assess artifact quality.

## Verdict

**FEASIBLE; CONDITIONALLY READY TO DISPATCH.** I found no intrinsic contradiction or unfairness that requires redesigning the trial. Approval is limited to running this bounded, single-fixture resource-consumption trial. It is not approval of an arm's planning package, a production/controller transition, full installed-framework fidelity, composition superiority, generalized model reliability, speed, or cost advantage.

The two gates below are blocking until the coordinator records them in the frozen execution evidence. They are execution controls already implied by the protocol, not new product requirements or changed thresholds.

1. **Freeze dispatch parity before the first actor call.** Preserve exact per-arm workspace/input hashes, common prompt text, the disclosed arm-specific resource block, requested and actually returned model/effort, permissions, turn/repair policy, output contract and resource manifest. Apply equal controls where the host exposes them. This host does not expose numeric context capacity, token budget, maximum-turn controls or reliable token/cost telemetry, so record those fields as unavailable/`null`; do not invent equality or numeric values. If enforceable parity cannot be shown, do not interpret output differences as resource effects.
2. **Use a clean invocation for every negative challenge.** Freeze the initial and repaired package first, copy it, inject only the common amendment, and start a new context with the arm's declared review resources and no earlier verdict/conversation. Reusing a context that remembers the original review would contaminate the challenge. Preserve challenge outputs separately from author failures and repairs.

## Fairness and causal limits

- All arms share the same copied source, eight brief clauses, five constitution principles, acceptance rubric, actor/reviewer model class and bounded repair policy. Different authors and non-author reviewers prevent direct self-review. The resource asymmetry is declared rather than hidden.
- In the staged workspaces, N/S/C copies of `brief.md`, `constitution.md` and all three source modules are hash-identical. The S and C copies of `host-bindings.md` are hash-identical to the canonical binding, and their actor briefs differ only in the assigned root path. This establishes the intended drafting parity before the coordinator's final freeze; the freeze record remains the authoritative dispatch checkpoint.
- N versus S changes both drafting guidance and review guidance. It can compare complete arm packages, but it cannot attribute a difference specifically to drafting or reviewing. S versus C isolates the added Spec Kit review method more closely because their drafting resources are the same.
- Arm C's additional review resource is the intended intervention, so equal resource counts are neither possible nor required. The final evaluator must apply the common eight-item acceptance contract to all arms and separately report method-specific findings; it must not award quality merely for more files, more findings, more tokens, or closer template conformity.
- Inherited host instructions and instruction-level isolation are disclosed. Hidden provider prompt/version, sampling seed, numeric context/token/turn controls and OS-enforced isolation are unavailable; therefore byte-identical hidden context, equal numeric capacity and deterministic replication cannot be claimed. One run per arm is suitable for feasibility and representative failure analysis only, not statistical ranking.
- Final evaluation should record each fixed acceptance item as pass/fail/blocked with cited artifact evidence. Judgments such as "bounded," "executable," and "complete" remain evaluator-dependent; report uncertainty and avoid converting them into an undisclosed aggregate score or post-hoc threshold.

## Authority and guardrail check

- `brief.md`, `constitution.md`, and the copied `src/*.mjs` are the only product-input authority. The common experiment contract controls procedure. Upstream resources and `host-bindings.md` supply methods/path adaptations only; neither may amend product intent or confer approval.
- The binding visibly overrides upstream metadata and auto-approval behavior with proposal-only reporting, maps outputs to the canonical `artifacts/` package, forbids parallel state stores and helper spawning, and reserves checkpoint freezing to the root coordinator. This avoids a second artifact or approval authority.
- Requirements, design and `tasks-draft.md` remain unapproved proposals. Reviewer readiness is evidence, not human/controller approval. The negative amendment must be rejected against the unchanged brief/constitution rather than implemented or used to weaken tests.
- The permitted writes are limited to each assigned experimental root. Git, network, installers, settings, production code and implementation writes are prohibited. Resource reads outside an arm root are limited to the declared read-only snapshot paths.

## Testability and traceability check

- The acceptance oracle is inspectable: stable numeric requirement coverage; eight brief clauses and C1-C5; concrete ownership/dependencies/files; literal domain/process cases; legacy CLI preservation; mandatory checks; task ordering; authority violations; required resource reads; and honest unrun-test labels.
- The fixture supports the stated cases without an inherent semantic conflict. Its copied modules implement primitive-number quantity validation, nonnegative safe-integer prices, safe multiplication and the documented single-item JSON CLI contract. Proposed batch tests need not exist or run during planning; their commands and expected observations must nevertheless be literal and path-correct.
- Local hash verification found all 16 untransformed upstream entries equal to the SHA-256 values in `provenance.json`; removing the one disclosed terminal newline from `design-discovery-light.md` reproduces its recorded source hash, and the appended byte is `0a`. All three fixture module hashes match the manifest. These checks establish byte identity/transformation only, not semantic consumption.
- `actor-report.md` plus captured read commands/output can support a bounded claim that paths were accessed. Neither proves comprehension or causal use. If authenticated host telemetry is unavailable, keep it unavailable rather than upgrading self-report into telemetry.
- Preserve initial, repaired, review and challenge artifacts distinctly. Record actual timestamps and any available token/cost fields; unavailable token/cost data stays `null`. Wall time includes scheduling/tool waits, generated bytes/lines are not token counts, and neither is a standalone quality metric.

## Residual risks and evaluator bias

- The evaluator cannot be practically blinded to arms because templates and reports reveal resource use. A fixed criterion-by-criterion matrix and evidence citations reduce, but do not eliminate, expectancy bias.
- Model sampling and the single feature can dominate small differences. A failure may be caused by actor variance, resource conflict, host adaptation, prompt handling or review quality; attribution should be marked uncertain unless the trace distinguishes them.
- The expected negative-challenge behavior is predeclared and explicitly not held out. Passing it demonstrates one controlled contradiction refusal, not broad prompt-injection or governance reliability.

Subject to the two dispatch gates, the smallest valid next action is to execute the frozen N/S/C runs exactly once under the protocol and retain raw evidence. Any later keep/use/adapt/reject decision must be based on the observed acceptance matrix and representative failures; this preflight supplies no evidence that composed resources are better.
