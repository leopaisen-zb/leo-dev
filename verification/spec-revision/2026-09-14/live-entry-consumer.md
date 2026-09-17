# P3 live acceptance — fresh entry consumer

**Verdict: PASS.** A first-time consumer can reach the required revision behavior from the public `develop` entry and its directly linked lifecycle guidance, then can verify that the installed package exposes the needed `revise` inputs.

## What the package entry says

`skills/develop/SKILL.md` identifies `develop` as the only public development entry. It directs an existing approved change to controller current state, and explicitly links `references/lifecycle.md` for the conceptual/controller boundary.

The `Spec / constitution revision: preserve code, revalidate all tasks` section of that lifecycle reference states the following.

1. Before mutation, run a revision proposal with `revise --dry-run`, providing the new spec, complete plan, and explicit constitution. Read `state.revisionContext` from that proposal.
2. Prepare an assessment bound to that proposal's `authorityHash`, task identity, and subject-tree hash. Run another `revise --dry-run --assessment ...` and read `state.revisionApprovalContext`.
3. Obtain a change-scoped `operationKind: spec-revision`, `decision: grant` receipt matching that context. Supply assessment and receipt to the one mutating `revise` command. The entry explicitly rejects a normal spec-approval receipt for this purpose.
4. The revision retains existing task IDs and increments each current task revision. It preserves code and historical evidence, does not require rewriting already-correct code, and does not selectively inherit successful work.
5. After activation, check `spec-approved` and every new task revision, transition through `task-ready` and `executing`, and individually re-claim, Gate, submit, and obtain an actual review. It says plainly: “旧代码、运行和审查留在历史，旧成功不算本版本完成” (“old code, runs, and reviews remain history; old success does not count as completion of this version”).
6. The entry also says that the team enters the new version: inspect team status and explicitly open/bind real members; old opinions are archival and old request IDs, messages, and member bindings cannot become current evidence. This is the documented epoch boundary for team work.

The package CLI check returned `HELP` and lists all six required options: `--spec`, `--plan`, `--constitution`, `--assessment`, `--receipt`, plus `--dry-run`, `--change`, and `--repo`. Therefore the entry's procedure is actionable with this package rather than merely descriptive.

## Fixture observations and application

These are fixture-specific facts, not claims supplied by the package entry:

- `requirements-v1.md` requires trimming boundary whitespace and a trailing LF. `requirements-v2.md` adds/clarifies preservation of Unicode and internal double spaces, and no-argument CLI behavior (one LF, exit zero, empty stderr). This is a substantive revision of the approved V1 requirement.
- `plan-v1.json` has `name-normalizer` and `cli-sample` at revision 1. `plan-v2.json` retains both IDs but sets both to revision 2 and updates the normalizer acceptance wording for Unicode/internal double spaces. That conforms to the entry's “retain IDs; increment revision” requirement.
- `local-constitution-v2.md` requires preserving the frozen app and acceptance tests and accepting only current-version Gate and independent-review evidence. It reinforces the entry rule that V1 proof cannot satisfy V2.
- The current snapshot is sequence 44, change `p3-live-retry1`, state `executing`. `name-normalizer` is `done` at revision 1; `cli-sample` is `review-required` at revision 1. Their runs are V1 runs, including `run-e1d9b458-475f-4587-a27b-78547fcf8ec7` and `run-98fd6fb6-c03a-494a-a496-7d47042b654a` respectively. The V1 manifest/spec bind `requirements-v1.md` and source hash `1e3c530e…`.

From those facts and the entry contract, the correct next action for this fixture is proposal → assessment → grant → `revise`; it is not a direct code rewrite or reuse of the V1 `done`, run, Gate, candidate, or review state. Following activation, each V2 task must obtain a fresh claim, Run, Gate, submit, and review. Team participation must likewise be explicitly bound in the new version/epoch; V1 team material is historical only.

## Boundary of this consumer conclusion

**Package-entry inputs:** the public entry `SKILL.md`; its directly linked `lifecycle.md`, `gates.md`, `components.md`, `acceptance.md`, `review-protocol.md`, `codex-team.md`, `autonomous-execution.md`, `delivery.md`, and `upstream-methods.md`; and the package CLI help result. The lifecycle revision section is the source for the command order, full-task revalidation, evidence invalidation, and team-epoch conclusion. The CLI help is the source for availability of the command inputs.

**Fixture-derived inputs:** V1/V2 content, plan revisions, constitution rule, snapshot state, manifest/spec binding, and journal history. They establish that this particular change is in V1 execution and demonstrate why the package revision flow applies. No controller or fixture-changing command was executed; no receipt was created and no `revise` command was run.

## Read log

Absolute paths read:

- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/SKILL.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/lifecycle.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/gates.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/components.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/acceptance.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/review-protocol.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/codex-team.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/autonomous-execution.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/delivery.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/references/upstream-methods.md`
- `/private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/runtime/packages/cli/package.json`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/requirements-v1.md`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/requirements-v2.md`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/plan-v1.json`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/plan-v2.json`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/local-constitution-v2.md`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/runtime/p3-live-retry1/snapshot.json`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/changes/p3-live-retry1/manifest.yaml`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/changes/p3-live-retry1/spec.yaml`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/changes/p3-live-retry1/tasks.yaml`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/runtime/p3-live-retry1/journal.ndjson`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/runtime/p3-live-retry1/v1-plan-assessment.json`
- `/private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/runtime/p3-live-retry1/v1-spec-approval.json`

Read-only commands used:

```sh
sed -n '1,260p' /private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/skills/develop/SKILL.md
node /private/tmp/leo-dev-p3-final-package-20260914/codex/leo-dev/runtime/packages/cli/dist/index.js revise --help
jq . /private/tmp/leo-dev-spec-revision-live-p3.WxaWog/plan-v1.json
jq . /private/tmp/leo-dev-spec-revision-live-p3.WxaWog/plan-v2.json
jq . /private/tmp/leo-dev-spec-revision-live-p3.WxaWog/.leo-dev/runtime/p3-live-retry1/snapshot.json
```

Additional `sed`, `jq`, `find`, `rg`, and `ls` commands only enumerated or read the paths above. The observed `revise --help` response was JSON with `ok: true`, `code: "HELP"`, and all required revision options.
