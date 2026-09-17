# Governance admission verification — 2026-09-07

Status: passed-for-local-G1; not-a-full-v1-or-client-release

## Scope and authority

User authorized local implementation after accepting architecture/code robustness over speed for relevant high-risk debt. Work is limited to G1 admission, persistence, tests, and reference updates in the existing project. No upstream replacement, installed-cache/global configuration changes, commits, push, deployment, or paid provider calls are authorized by this work.

Plan: `docs/superpowers/plans/2026-09-04-unified-development-plugin.md`, Active slice G1. Normative source: `.scratch/unified-development-plugin/spec.md`. Original approval receipt is retained unchanged. Pre-edit comparison copy: `/private/tmp/leo-dev-governance-review.k1dHz4/`; the working repository was already untracked, so commit-only diffs would omit the user's work.

## Preflight and ownership

| Work | Owner / interface | Check |
| --- | --- | --- |
| G1.1 schema, evaluator, CLI and tests | `governance_implementation`, gpt-5.6-terra / high | Uses existing route/batch; no new lifecycle states or scheduler |
| G1.2 reference, spec/plan and delivery | Main thread | Consumes G1.1 field names and returned JSON; no worker file overlap |
| G1.1 ↔ G1.2 | `--assessment`, `assessmentContext`, governance disposition | Field names aligned before reference edit |
| Independent final review | `governance_final_review`, gpt-5.6-sol / xhigh | Reviews real baseline diff and source; not the implementer |
| Independent reference application | `governance_forward`, gpt-5.6-terra / high | Uses actual CLI against the isolated fixture; does not edit plugin source |

## Baseline — before production changes

- `npm test`: passed, exit 0. 161 domain/controller tests + 8 adapter tests + 86 Skill/CLI tests = 255 tests.
- `python3 -m unittest discover -s tests -p 'test_*.py' -v`: passed, exit 0, 6 tests.
- `npm run typecheck`: passed, exit 0, before controller implementation changes.
- Node/TypeScript checks and final full regression will be recorded after integration; baseline results do not certify new behavior.

## Reference application baseline

An independent gpt-5.6-terra / medium agent used the old Skill/reference and current CLI for a local label feature with a required high-risk dependency repair and unrelated UI debt. No files or external systems were changed.

Observed result: the reference could only suggest a spec addendum and legacy init/inspect/route. It correctly identified the missing interface: “There is no CLI or artifact interface to record DEP-1 semantically, create a repair-first task, constrain scope to the module, or exclude the UI debt.” It did not falsely claim enforcement. This is a reference/capability gap, not evidence that the agent violated policy or a quantified model-quality regression.

The new reference is limited to the admission interface and its unsupported boundaries. It does not introduce a new reasoning discipline or claim that one successful exercise proves universal compliance.

- After the reference edit, `./node_modules/.bin/vitest run tests/skill-contract/develop.test.ts`: passed, exit 0, 6 tests. These are instruction/packaging contract checks, not real Agent behavioral proof.
- `python3 /Users/leo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/develop`: blocked before validation, exit 1, because the selected interpreter has no `yaml` module. No dependency was installed.
- Fallback using the repository's existing Node YAML parser and `validatePortableSkill`: passed, exit 0, frontmatter/name/description and the 9-file source inventory validated. This is reported separately, not as a successful run of the Python helper.

## Decisions retained for review

- Ruling: preserve legacy calls with explicit `not-assessed`, but make governance participation sticky. Cost if wrong: universal governance still requires a later migration decision.
- Ruling: refuse feature admission instead of inventing a repair DAG in Lite. Cost if wrong: host-Agent orchestration still owns the actual local repair.
- Ruling: input belongs under runtime; immutable normalized decisions belong under versionable change artifacts. Admission hashes are historical after publication, while execution evidence still needs current-tree binding.

## Implementation and final verification

Implementation-worker RED/GREEN evidence is in `verification/governance-implementation.md`: the initial four tests failed on missing context / unrecognized option before source edits; 13 focused compiled-CLI tests then passed after implementation. Main-thread initial integration regression and independent reference application passed. Independent review subsequently identified R1–R4 below; the final post-fix verification is recorded separately rather than reusing those earlier results.

Main-thread checks after initial source integration, before review fix R1:

- `npm test`: passed, exit 0. 161 domain/controller tests + 8 adapter tests + 99 Skill/CLI tests = 268 tests (13 more than baseline). The 99 include 13 new governance cases, 26 existing vertical-slice cases, 54 crash-atomicity cases and 6 portable Skill contract cases. The crash-atomicity file took 209 seconds; passing this suite is not real-client smoke evidence.
- `npm run typecheck`: passed, exit 0.
- `python3 -m unittest discover -s tests -p 'test_*.py' -v`: passed, exit 0, 6 tests.
- `npm run build:adapters -- --out /private/tmp/leo-dev-governance-packages.UVDo6K`: passed, exit 0; built into an isolated output directory without overwriting an installed client package.
- `npm run verify:packages -- --dist /private/tmp/leo-dev-governance-packages.UVDo6K`: passed, exit 0; verifies Codex, Claude, Cursor, and generic open-agent-plugin manifests, inventory and source hashes. This is static packaging, not four client executions; the distribution contains portable Skill content, not an automatically installed controller runtime.
- `cmp .scratch/unified-development-plugin/approval.yaml /private/tmp/leo-dev-governance-review.k1dHz4/.scratch/unified-development-plugin/approval.yaml`: passed, exit 0; original receipt bytes preserved.

## Isolated application fixture baseline

Fixture location: `/private/tmp/leo-dev-governance-example.1HDkm3/`. It contains an orders module importing a private ledger file despite an existing public entry, plus unrelated UI content. Only the local import repair is authorized; no product label implementation or other module edits are authorized in this exercise.

- Node v22.22.2, `node --test tests/orders.test.mjs`: passed, 2 tests, exit 0.
- Same Node, `node scripts/check-boundary.mjs`: expected failure, exit 1, “Orders must use the existing public ledger entry, not its private store”.
- This demonstrates that passing functional tests can coexist with a specific executable architecture violation. The small explicit import rule is a fixture, not a generic architecture-analysis product.

## Independent reference application and main-thread recheck

Report: `verification/governance-forward.md`. The fresh gpt-5.6-terra / high agent read the updated portable Skill/reference and used the actual compiled CLI, not an in-memory evaluator mock.

- The first `orders-label` assessment recorded a relevant high-risk local finding plus unrelated UI debt and returned `LOCAL_REMEDIATION_REQUIRED`, exit 7, without a task.
- The agent changed only `src/orders/service.mjs` to use `../ledger/index.mjs`, refreshed context/evidence, retained unrelated UI debt, and supplied an explicit linked resolution. The successor returned `ROUTED_LITE`, exit 0.
- The separate `orders-boundary-review` material probe returned `APPROVAL_REQUIRED`, exit 6. Omission and a linked ready-looking successor remained refused; no task or authorization receipt was created.
- Main independently reran `node --test tests/orders.test.mjs` (2 passed, exit 0) and `node scripts/check-boundary.mjs` (passed, exit 0), with `/Users/leo/.nvm/versions/node/v22.22.2/bin/node` in the fixture.
- Main independently queried both changes: the local task remains `ready` with its linked assessment, no run or lease; the material change remains `triage` with no route/tasks and `assessmentContext.status: approval-required`. Historical and current tree hashes are distinct as documented.
- The fixture did not claim/execute/review the admitted feature task, and no label feature was implemented. This proves this bounded admission/reference exercise, not full delivery, general Agent compliance, or a measured reduction in technical debt.
- Existing Lite `allowedPaths: ['.']` and generic task acceptance remain unchanged. The one-import scope was honored by the host Agent and independently inspected, not imposed by a newly derived file allowlist.

## Independent review and remediation

Review R1 (P2, accepted; closed): a first assessment could carry a nonempty `resolutions` array and successors could resolve an ID with no prior relevant-high finding. The reviewer reproduced an admitted first record with `findingId: never-existed`. Main traced this to `requireSupersession` returning after the previous-fingerprint check and subsequently checking only whether each dropped prior blocker has a resolution, not whether every supplied resolution has a valid predecessor.

Ruling: fix this bounded audit-integrity defect rather than broadening resolution semantics. Initial nonempty resolutions must be refused; successor resolutions must reference a relevant-high finding in the immediately previous assessment. Empty arrays may be normalized away. Existing semantic-truth and authority limitations remain unchanged. The implementation worker completed test-first repair; main reran integration tests and the independent reviewer verified closure before final acceptance.

Worker R1 evidence: 3 expected RED failures, then build, 16 focused CLI tests and typecheck passed. Main inspected the two added validation branches and unchanged downgrade/removal loop. See the worker report for exact commands.

Review R2 (P1, accepted; closed): a duplicate `assessmentId` was validated only during post-commit history replay. The reviewer reproduced a partial assessment followed by a complete successor reusing its ID: the successor committed an assessment, route and ready task, then returned a schema error and made later status reads unusable. Main confirmed that `governanceAdmission` validated only the candidate against the latest record before the batch, whereas `verifyRecordedHistory` checked all identities afterward.

Ruling: validate the prospective full history in the shared dry/actual admission preflight before any projection or batch write; reuse replay invariants rather than introducing a competing uniqueness rule. Test immediate and earlier duplicate IDs, zero-write rejection and continued readable state. No repair of the reviewer's disposable malformed history or new migration subsystem is part of this fix.

Review R3 (P2, accepted; closed): resolution freshness only compared against that finding's previous hashes. A reviewer reproduced a successor that resolved a high-risk finding by citing hash B, already present as unrelated evidence in the previous assessment, and was admitted without any new evidence content relative to that record.

Ruling: require at least one current supporting hash absent from every finding/resolution evidence reference in the immediately previous assessment. This is a local predecessor-comparison invariant, not uniqueness across the entire history or semantic proof that a repair is correct. The plan and reference now state that exact boundary. The worker added separate recycled-unrelated and recycled-previous-resolution tests before the minimal comparator change.

Worker R2/R3 evidence: each issue reproduced with two RED cases, followed by build, 20 focused CLI tests and typecheck passing. Source fixes respectively reuse prospective-history validation and aggregate the immediately previous record's evidence hashes.

Review R4 (P2, accepted; closed): the retained relevant-high branch skipped a supplied resolution for that same ID, permitting contradictory retained-and-resolved audit entries. The R3 prior-resolution fixture itself used that contradictory state. Main inspected both and confirmed the mismatch with the existing retain-or-resolve contract.

Ruling: reject simultaneous relevant-high retention and resolution; do not introduce partial-remediation events. Rewrite the R3 fixture as a valid two-finding chain: resolve A while retaining B, then reject a later attempt to resolve B using A's previous resolution evidence. Add a separate test-first zero-write rejection case for the contradiction, preserve valid partial progress, and re-review before main's final regression.

## Final post-review verification

All four review findings are closed for G1. R4 separately reproduced the contradictory record before its guard was added; the valid A/B gradual-resolution chain preserves R3's recycled-evidence coverage. The implementation/portable source was frozen before final tests; only spec/plan/report status text was finalized afterward.

| Check | Actual result |
| --- | --- |
| Main final `npm test` after R1–R4 | PASS, exit 0: 161 domain/controller + 8 adapter + 107 Skill/CLI = **276 tests** |
| Included governance / vertical / crash / Skill cases | 21 / 26 / 54 / 6 passed; the crash file took 216.6 seconds |
| Main final `npm run typecheck` | PASS, exit 0 |
| Main final Python unittest discovery | PASS, exit 0, **6 tests** |
| Independent reviewer focused governance suite | PASS, exit 0, **21 tests**; not the implementer's own result |
| Final adapter build and verification | PASS, exit 0; `--out` / `--dist /private/tmp/leo-dev-governance-final-packages.ZrNPGY` |
| Frozen inventory verification | PASS, exit 0, **12/12**; independently checked by reviewer and main |
| Main post-fix fixture recheck | PASS: 2 functional tests, explicit boundary check, local/material status reads |
| Original approval receipt comparison | PASS, byte-identical to the pre-edit copy |

Independent final review: `verification/governance-review.md`. Outcome: no open G1 blocker; approval is for this bounded slice, not the complete plugin roadmap. Review packet: `/private/tmp/leo-dev-governance-review.k1dHz4/g1-final-review.diff`. Frozen inventory: `/private/tmp/leo-dev-governance-review.k1dHz4/g1-final.sha256`; the inventory intentionally excludes final report/status text.

## Delivery and remaining boundaries

- Source location: `/Users/leo/plugins/leo-dev`. The final isolated package directory above contains generated Skill/manifests. Neither is an installed-client upgrade; the existing personal-plugin cache was not changed and the CLI was not installed on PATH.
- The one-entry `develop` workflow, existing controller, external upstream strategy and dependency set were retained. No new workflow engine, role framework, plugin entry or runtime provider was introduced.
- Implemented: optional evidence-bearing Lite admission, immutable linked decisions, local/material/incomplete dispositions, prospective-history validation, atomic persistence/recovery and explicit legacy `not-assessed`. This is not automatic architecture scanning, automatic debt discovery, a repair DAG, or semantic certification.
- Not run / not delivered: real Claude Code/Cursor/Codex load-and-execute smoke, Node 20 runtime verification, paid model/provider evaluation, full-stack production rollout, training/Agent product experiments, Standard/Full execution, complete v1, GitHub publication or deployment.
- The Python Skill helper remains blocked by missing PyYAML; repository YAML/frontmatter/inventory validation and adapter verification passed separately. No dependency was installed to change that environment.
- Material decisions remain terminal for this slice. Unrelated debt remains recorded. Existing Lite task scope is still broad, so authorized local repair boundaries require the host Agent and reviewer; this is not a filesystem/security boundary.
- Safe follow-on: pilot reviewed project-specific boundary/contract gates and real-client loading, then separately extend task specifications and resumable repair → feature dependencies. These are remaining work, not delivered capabilities.
