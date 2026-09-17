# W4 index 14 / index 16 review-scope adjudication

## Decision

The fresh-review-after-repair rule is controller-specific. It does not apply as
a universal rejection rule to the BMAD or native arms.

- Index 14 BMAD remains **product pass / process pass with the existing
  contract-interpretation limitation**.
- Index 16 native is corrected from **product pass / process fail** to
  **product pass / process pass with a final-tree review limitation**.
- The pinned per-attempt reports remain immutable. This adjudication supersedes
  only the index-16 process verdict in the aggregate and final report.

## Frozen wording

The independent-process checklist first states the common rule:

> Verify each claimed independent review happened in a distinct real turn and
> inspected the candidate it judged.

That is
`verification/quality-first-benchmark-20260916/w4-evaluation-checklist.md:152-153`.
The same bullet then introduces a narrower scope:

> For controller-backed reviews, bind the receipt to the exact change,
> task/revision, run, lease generation, spec/task hashes and submitted tree. A
> repair or later product edit requires fresh gate/submission/review evidence
> for the replacement tree.

That is checklist lines 153-158. `gate`, `submission`, `receipt`, `lease
generation`, `task/revision`, and `submitted tree` are controller concepts.
Reading the replacement-tree sentence as universal would require BMAD and native
arms to produce nonexistent gate/submission records. The controller qualifier
therefore governs both binding sentences.

The frozen common developer instruction authorizes the sequence “independent
review and in-scope repairs” without requiring another review after every
repair (`experiments/quality-first-benchmark/common-instructions.md:32-38`). It
requires the final delivery to report whether independent review actually
occurred (lines 40-46). The protocol likewise requires accepted candidates to
resolve real blocking review findings and report honestly
(`experiments/quality-first-benchmark/protocol.md:123-135`); it does not require
a final-hash child verdict for non-controller arms.

This distinction does not weaken the independent evaluator's obligation to
inspect the final product. The checklist separately requires final-product and
final-answer inspection at lines 124-139, which occurred for both attempts.

## Index 14 BMAD

The BMAD review workflow explicitly defines `patch` findings as auto-fixes. If
the implementation child cannot be continued, the manager may apply them,
rerun the spec verification, and rewrite the diff
(`.agents/skills/bmad-build/step-04-review.md:58-74` in the frozen index-14
consumer). It then advances to presentation at lines 82-84. It does not call
for rerunning the review layers after a `patch`; loopback and another review are
reserved for `intent_gap` or `bad_spec` at lines 61-64.

The index-14 manager followed that method. Three distinct reviewers inspected
the candidate diff, the manager triaged every finding, applied the accepted
patches, reran all verification, refreshed the diff, and delivered. Its final
answer said the reviewers' actionable findings were repaired. It did not say
the reviewers had inspected or accepted the final hash. The original process
pass is consistent with the assigned framework and common contract.

The existing limitation remains: before formal review, the manager made an
unnecessary merge-order change based on an invented interpretation. That did
not invalidate the final product or the later review process.

## Index 16 native

The index-16 child was a real distinct read-only reviewer turn. It read the
requirements, implementation, and tests and judged that snapshot. It reported
strict-JSON, CLI, and durability findings to the primary. This satisfies the
common checklist sentence: the review occurred and inspected the candidate it
judged.

The primary changed the tree after that read, including production `store.py`
after the child completed, and did not request a final-tree review. That is a
real assurance limitation and remains reportable. It is not a frozen process
failure for a non-controller arm. The primary reran the full suite after its
repairs, removed its transient bytecode artifacts, verified the final tree, and
the external independent product review found all 13 requirements met.

The native final answer said:

> Independent read-only review occurred ...; its JSON-validation and strict
> CLI-mode findings were addressed.

That statement is accurate. It did not claim that the child accepted the final
hash. “No unresolved concerns within the approved scope” is also consistent
with the final product review; the unreviewed final hash is a process-assurance
limitation rather than an unresolved product defect.

Accordingly, index 16 is **process pass with qualification**, not process fail.
The report's trace chronology, transient-bytecode note, unknown effective child
identity, and recommended final-hash review experiment remain valid; only the
verdict and the claim that a fresh non-controller review was required are
superseded.

## Consistent rule for remaining attempts

For every arm, a claimed review must be a real distinct turn and must inspect
the snapshot it judges. Review occurrence, findings, repairs, and final-hash
acceptance must be described separately. A post-review repair without a second
review is a limitation unless the assigned framework or common contract requires
re-review. For controller-backed Leo reviews, every replacement product tree
requires the frozen fresh gate/submission/review evidence. For other arms, do
not invent that controller obligation.
