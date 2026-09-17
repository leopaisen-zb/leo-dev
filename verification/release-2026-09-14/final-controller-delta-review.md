# Final controller compatibility delta review — 2026-09-14

Verdict: **PASS for the exact controller delta and the two test corrections identified below.** No blocking finding remains within this review's scope. This is not full-suite or release acceptance: the current rerun log is incomplete and already records a review-recovery failure, described below.

Reviewed against specification v1.8.0 and the active R1/R2 section of the existing release plan. Earlier historical Lite-only limitations do not override that approved Standard/Full behavior. This review was performed in the requested native session; actual model, effort and session identity belong to the outer execution trace. No session ID or independent-review receipt is invented here.

## Exact delta and compatibility

Independent Python SHA-256 and in-memory reverse-hunk checks reproduced both earlier reviewed identities:

- Current controller source: `61d9ff81a806a972eaeb9e96c31f17d37b75c1baae0033edb47f5bb517f1a485`. Replacing the single new two-condition hunk with the former combined condition yields `e595ed548bbbd66a15352c74243b2b709698ea9803d4ceee4bd463da9d96c3f2`, exactly the prior independently reviewed source.
- Current compiled controller: `2f15660c0d00ae203079ce683c74cbfe51eda5372f8312cd1f138d5fba20bfc1`. Reversing its corresponding single hunk yields `ba35340a3083d6065cbd7ae73f8cc8ed1977351da822d2454966d2843f58186e`, exactly the compiled artifact recorded in the earlier correction re-review.

Thus the delta has no hidden controller changes beyond archive error classification. The new guard at `packages/cli/src/controller/controller.ts:1412` returns exit 3 / `TRANSITION_FORBIDDEN` whenever ordinary archive admission is attempted outside `release-evidence`. Missing or wrong-change release proof within `release-evidence` still returns exit 5 / `CONFLICT` at line 1413. The accepted transition set is unchanged.

This matches `packages/cli/src/state/transition.ts:4` and the specification's transition table: ordinary archive admission has only the `release-evidence → archived` edge and requires independent CI plus matching archival evidence. A fresh, pure Node check of the compiled transition function passed all 16 assertions: 12 other states refuse even with both archive guards supplied; `release-evidence` refuses the three incomplete guard combinations and accepts both guards together. This exercises the transition policy, not a new end-to-end archive fixture.

`tests/cli/vertical-slice.test.ts` is byte-identical to the supplied pre-release copy. Its line 542 requires the triage dry-run refusal to return exit 3 / `TRANSITION_FORBIDDEN`; line 544 verifies the repository digest is unchanged. Line 708 requires the same exit/code from executing during actual invocation. [archive-exit-focused.log](archive-exit-focused.log) records both unchanged tests passing, with 24 filtered skips. The executing assertion itself checks the exit/code rather than a separate before/after digest.

Both actual transition and dry-run dispatch directly to `archiveRelease` before their mutation paths. The wrong-state guard precedes receipt loading/consumption, projection construction, recovery-proof capture, batch preparation/commit and snapshot writes. Earlier work consists of existing prerequisite/history validation, strict journal replay and tree reads. Strict replay does not truncate incomplete tails. Consequently refusal preserves durable journal, projections, receipt history and budgets. As in the existing public read-only contract, journal reads acquire and release the existing transient lock; this is not a claim of zero filesystem lock operations.

## Release validation remains intact

For a change already in `release-evidence`, the guard split leaves the following admission sequence unchanged (`controller.ts:1413–1452`):

- The stored proof must belong to the change, and the release projection must hash to that proof. Current authority and the frozen integration subject are rechecked. Entry through `readEvents` still verifies committed projections and Gate settlement/evidence history.
- Repository-contained CI input passes the existing receipt schema and temporal validation, revision-ID reservation and global receipt-reuse checks. Its change/spec/candidate/proof binding must match; the verifier session must differ from integration production and review.
- The verifier report must have the receipt-bound bytes, matching identities, a passed result and the required Gate-definition reference. The archive manifest must bind the proof; every declared artifact and retrospective must resolve within the repository and match its hash. Self-rewritten inputs and conflicting hashes for one file remain refused.
- Dry-run returns only after these checks. Actual archive still captures the admission tree, exact projection snapshots and bound CI/report/manifest/Gate/artifact/retrospective source hashes before committing through the existing batch owner.

The batch and snapshot source hashes still equal those in the earlier seven-case re-review. Source inspection confirms release/archive proofs remain required; pending preflight and locked recovery still validate source/reference freshness and reject third-value projections before applying projections. None of the five earlier correction paths was removed or bypassed by this delta. Their seven retained executable results remain prior evidence, not seven newly rerun tests.

## Test corrections and negative acceptance

The complete filesystem diff against `/private/tmp/leo-dev-release-before.jrvry4rk` was inspected for both test files.

At `tests/cli/codex-plan.test.ts:83`, the obsolete rejection of a valid Standard plan becomes rejection of the invalid risk `urgent`. It retains the nonzero exit, exact before/after file-content inventory and empty-task assertions. The other invalid-plan cases are unchanged. The added Standard and Full cases at line 101 explicitly require successful routing and preservation of both the change risk and routed task risk. A dependency-ready task in a routed plan does not authorize execution: claim still requires the executing lifecycle and fresh approved non-Lite design. The existing design tests retain direct task-ready refusal, independent design receipt checks, Standard self-review refusal and incomplete Full assessment refusal.

At `tests/skill-contract/develop.test.ts:70`, the validator now matches the current lifecycle, gates and review-protocol references: supported plan routing; no silent risk downgrade; design-review/design-approved before task-ready; supported-path bounded repair; distinct reviewer session or human receipt; and current candidate-bound Full architecture/security/NFR assessments. Repair limits, authority boundaries, unsafe-Gate prohibitions, review order and truthful evidence reporting remain required. Replacing obsolete discovery-only/Lite-only assumptions implements the approved contract; it does not relax design or review acceptance.

The mutation tests are non-vacuous on the current text. A narrow **read-only, in-memory Node diagnostic** extracted the actual `loadDocuments`, command inventory parser, `validateSemantics`, `replaceRequired`, and the two mutation arrays from this exact test source. TypeScript transpilation occurred only in memory. The diagnostic first validated the unmodified current documents, then checked the changed document and captured each rejection:

- Baseline validator: **PASS**.
- All **7 replacement** inputs passed both the original-clause-presence assertion and the changed-text assertion. Each changed exactly one document and failed on its corresponding missing normative clause.
- All **15 appended contradictions** changed exactly one document and failed on the corresponding forbidden-clause check, including downgrade, design bypass, role-play review, missing Full assessments, unlimited repair and misreported evidence.

The diagnostic exited 0 on Node `v22.22.2` at `2026-09-14T11:36:39.384Z`. These are 22 independently checked semantic mutations, not 22 extra Vitest tests. The separate positive validator test at line 136 also remains in the suite. The retained [focused verification record](legacy-contract-regressions/verification.md) reports exit 0 and 27/27 tests for the two updated files; this reviewer did not rerun that whole focused pair.

## Current hashes

These SHA-256 values were independently read at `2026-09-14T11:37:15Z`; the controller identities are above.

```text
packages/cli/src/controller/batch.ts
af64de27dc941daac7e2793988665c20ae77c278ec01b8154d40802e4bd9f01b
packages/cli/src/state/snapshot.ts
bab0a2952e02c911fe15b9fef4cc569d67d6b9209eecb124a14262f5117656a3
packages/cli/src/state/transition.ts
10f0a4b12cdaf534bb44fa276260d466e8d393b5919da7002ab9e2f13f81f050
packages/cli/dist/state/transition.js
edfdf688e57190372945f113535044626ce6a1f1200719181ba66c8bb134e4e5
tests/cli/codex-plan.test.ts
0f0d47916d1b98b80d46435bdb088eefecaca58eaa0da8b0718f6d311d994971
tests/skill-contract/develop.test.ts
f2b9e84f70bfcaecfb243b0456a6724af695d77b4faf314f4574d3bb115c8ecc
tests/cli/vertical-slice.test.ts (also identical to the supplied prior copy)
ca3a83220453ecc664ba9b70ec1e7e17d4df1e21c9043002dd9d108a10bd47ba
skills/develop/references/lifecycle.md
4c28b26b21fdb40b9f179a414c696d88a09f57d3f95f59567d4c014c1c36a261
skills/develop/references/gates.md
f593c4c064e2e158d06d2d626a1686c9dbe3963043cb17930fc0f7d6c811d773
skills/develop/references/review-protocol.md
880257004c30c3caf47b87b81608d9c0bd357c0d556b50f287bb205ddbda8ea7
.scratch/unified-development-plugin/spec.md
cd141836a390df5fde45fe88b5534bf704a1b829ce91e54716e7e3f4cae4d88f
docs/superpowers/plans/2026-09-04-unified-development-plugin.md
0c2af35698909faf81e5ce30ed4f74185969dedd5380b75511b0c033ae51ea89
```

## Remaining acceptance and evidence limits

[final-controller-suite.log](final-controller-suite.log) preserves the completed earlier run: 175 domain tests and 19 Node adapter tests passed; the last partition passed 259 and failed 4. The four failures are the two obsolete expectations and two archive exit compatibility assertions examined here. They have not been erased or relabelled as passing.

At the observation above, [final-controller-suite-rerun.log](final-controller-suite-rerun.log) contained completed 175/175 domain and 19/19 adapter partitions, but no final CLI/skill partition summary or process-exit result. It already recorded a failure in `tests/cli/codex-review-recovery.test.ts`, “fails closed on direct, forged committed, and duplicate committed recovery contexts”: expected exit 7, received exit 5 / `CONFLICT` with `Submitted candidate lease has not expired`. This review has not attributed the cause or classified it as a flake. Root must resolve it and obtain the completed final-source suite result. The observed log was 9,086 bytes, SHA-256 `2f9bc47080c4dc060bb4e5f35503e54ec21dba17018b11b83284c1d255e1e364`; later output belongs to root's continuing run.

[final-source-plugin-manifest.log](final-source-plugin-manifest.log) records successful validation of `/private/tmp/leo-dev-release-final-3ctFYr/codex/leo-dev`. [final-source-typecheck.log](final-source-typecheck.log) records the two configured TypeScript checks without diagnostics. These records were read, not independently rerun. The reported 1,309-file bundle/isolated-install match was not duplicated in this bounded review.

Current full-suite completion, app/frontend/browser acceptance, package integration and publication acceptance remain **root responsibilities**. Only this report was written. No production, test, reference, fixture, budget or threshold was modified; no subagent, Goal, new specification, Git operation, installation, external publication or global-setting change was performed.
