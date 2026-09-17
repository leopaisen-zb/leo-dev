# Codex-first C1: baseline and bounded comparison

Date: 2026-09-08
Status: baseline-and-bounded-trial-reviewed; production-selection-open; Codex-product-not-delivered
Scope: local baseline, fixed integration fixture, one Codex subagent quality sample. Not product completion, plugin installation, fresh-client E2E or production architecture selection.

## Reviewed outcomes

1. The production public CLI reproduces all three identified gaps: post-claim implementation edits are refused; schema-valid `verdict: reject` cannot enter remediation; a second task cannot be added to the same routed change. Passing the three characterization tests means these gaps remain, not that desired behavior now passes. [Baseline](baseline.md)
2. A shared fixed A→B→C fixture exercises real code writes, mechanical tests/review rejection, bounded retries, candidate fingerprints and process interruptions. The direct scripted host seam and real Spec Kit custom-step bridge use exactly the same owner. [Code](../../experiments/codex-first/trial.py), [bridge and limitations](speckit-bridge.md)
3. Of 16 recorded route/scenario observations, Spec Kit's native resume refuses the known-verified `running` crash case. The host fixture settles its saved verified candidate once and continues; the bridge does not silently change upstream status or start a fresh run. This is a narrow integration difference, not a proof of a production-grade host runtime. [Machine observations](comparison.json)
4. One Codex child session, manually loading the existing installed develop skill, repaired the two-defect quality fixture. Its five self-authored regressions passed; the separate four-test oracle moved from three failures on the seed to zero failures on the candidate. Requirements and unrelated-file hashes stayed unchanged. [Archived candidate and implementer report](quality-sample/report.md), [sample metadata](quality-sample/metadata.json)

The sample corrected the unsupported database/rewrite diagnosis and rejected coercion as inconsistent with the requirement. It does not establish reliability across projects, hosts or repetitions, nor does it justify claiming that a new prompt variant improved quality. No new workflow guidance was authored from a baseline that already passed this sample.

## Actual reuse, versus what is still missing

| Resource | What was done in C1 | What this does not establish |
|---|---|---|
| Existing leo-dev develop | Manually loaded in a fresh development subagent for one controlled repair | Installed-plugin discovery, whole-plan autonomy or cross-session host recovery |
| Spec Kit | Real pinned Python engine and custom StepBase called in executable tests; native pause/resume retained | Headless Codex integration; candidate review quality; production-ready custom loader/security |
| cc-sdd | Eight original workflow/template resources and MIT notice staged with exact source hashes; independent reviewer actually consumed the original kiro-review checklist with recorded invocation adaptations | No complete kiro-impl run; no patched main workflow; no proof of lower integration/upgrade cost |
| BMAD | Existing source-audit findings retained for later architecture-review integration | No BMAD adapter executed in C1 |

Source manifest: [cc-sdd snapshot](../../experiments/codex-first/upstream/cc-sdd/manifest.json). The initial copy introduced an extra final newline; hash verification caught it and the snapshot was corrected before consumption. Nine staged files now match the original hashes. No resource was registered or installed as a skill.

## Provisional selection recommendation

Do not add Spec Kit as the Codex-first production engine on this evidence: delegating all task authority to the same owner adds a Python runtime, engine state and an internal registry dependency, while the tested abrupt-running recovery still requires additional handling. This rules against this particular bridge for the first slice; it is not a claim that Spec Kit is generally unsuitable or cannot be adapted.

Keep the existing Codex entry, and consider cc-sdd's concrete implementer/reviewer/debugger resources selectively for the next real slice. Full cc-sdd orchestration has not been exercised, so C1 cannot declare it the proven winning architecture. The direct scripted fixture must not be relabelled as cc-sdd. The comparison answers one narrower decision—whether this engine bridge buys the required mechanics—not the total maintenance cost of two fully integrated products.

The next production step, if approved, should connect the three concrete gaps and demonstrate an actual Codex task sequence with recovery. It should not grow a new workflow DSL or replace all existing code. Relevant untouched primitives remain candidates for reuse; C1's small Python fixture is not a replacement controller to promote.

## Verification record

| Check | Current evidence | Boundary |
|---|---|---|
| Fixture TDD RED | Main-session tool trace reported eight tests / 17 failing subcases against a no-op driver, exit 1 | Raw RED output was not archived; this historical count is not independently reproducible from the final files and is not an independently verified review claim |
| Fixture/bridge GREEN | `PYTHONPATH=... python -m unittest discover -s experiments/codex-first -p 'test_*.py' -v`: 13 tests passed | Includes characterizations of undesirable upstream behavior; not all target recovery cases passed |
| Current CLI gaps | Compiled CLI three tests passed; valid reject probe corrected after main review | Reproduced missing behavior, not repaired production |
| Typecheck | `npm run typecheck`: exit 0 | Existing TypeScript boundaries |
| Existing Python regression | `python3 -m unittest discover -s tests -p 'test_*.py' -v`: 6 passed | Doctor unit tests, not real install |
| Full Node/TypeScript regression | `npm test`: exit 0; 161 domain + 8 adapter + 110 Skill/CLI = 279 passed | Includes three gap characterizations; not proof of autonomous development |
| Frozen core | 12 specified files match the [persisted pre-C1 SHA list](frozen-core.sha256) | Not a whole-worktree zero-change claim |
| Historical approval | SHA remains `ede9586fe9a25c1e97138d5d75dcb54e0bcef8a9460d558a0724458094fb433c` | New scope was recorded in spec/plan, not retrofitted into the old receipt |
| Independent review | [APPROVED for the bounded trial and quality sample](review.md); no Critical code/security finding | Production route selection NOT ESTABLISHED; recorded Important limits remain blockers to production adoption or broader claims |

Exact executable commands and current limits are also in [experiment usage](../../experiments/codex-first/README.md). The seeded quality oracle is expected to fail; the archived repaired candidate is the separate evaluation target.

The frozen-core list was copied unchanged from the earlier local record `/private/tmp/leo-dev-governance-review.k1dHz4/g1-final.sha256`, not regenerated from C1's final files. From the repository root, run `shasum -a 256 -c verification/codex-first/frozen-core.sha256`. This establishes agreement with that recorded baseline for those 12 files only; the record is not signed or an attestation of the entire worktree.

Independent review confirmed the 13 experimental tests, all 279 Node/TypeScript regressions, six existing Python tests, typecheck, reproduction of all 16 observations and the quality sample. Its Important findings limit adoption: the tested engine recovery gap, a scripted host rather than cc-sdd execution, forbidden-write detection after mutation rather than preservation, and one sample rather than a reliability study. No production fix was made in response to these out-of-scope limitations. The missing archived RED output remains explicitly unverified historical evidence.

## Not run / not delivered

- Fresh installed Codex plugin discovery, real multi-task Agent execution, real host cross-session recovery.
- Full cc-sdd main-workflow/renderer/approval/state adaptation and BMAD review adapter.
- Repeated or controlled A/B model-quality experiment, cost/latency evaluation, actual independent session attestation in a product runtime.
- Arbitrary/malicious code containment, external side-effect reconciliation, power-loss durability or distributed fencing.
- Linux runtime/CI, Claude Code/Cursor real-client tests, real full-stack project pilot, formal training or Agent/RAG evaluation.
- Production controller fixes, installed plugin replacement, GitHub remote/publication, Git history writes or deployment.

## Coordination and provenance

CLI baseline and Spec Kit bridge workers used `gpt-5.6-terra/high`; the independent quality baseline sample used `gpt-5.6-terra/medium`; the independent final reviewer used `gpt-5.6-sol/xhigh`. These are the explicitly supplied successful dispatch configurations, not model self-identification. No development agent changed the product's runtime model configuration.

The develop/TDD workflow produced behavior-first tests and preserved scope boundaries. The review process corrected an initially invalid `fail` receipt probe to valid `reject`, and removed test-only bridge visibility. Those corrections improved the evidence; they did not fix the production defects.
