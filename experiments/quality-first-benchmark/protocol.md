# Coding workflow benchmark v1

Status: frozen for W1 execution, 2026-09-16. Independent case/oracle and runner
reviews passed. Exact assets and staged inputs are recorded in
`frozen-cases.json` and `frozen-execution.json`.
Authority: `.scratch/unified-development-plugin/spec.md` v1.11.0, W1–W4.

## Question and scope

Can the installed workflow complete approved coding work, preserve existing
behavior, find omissions, accept valid alternatives and continue after an
observed interruption? Quality is the acceptance objective. Cost and elapsed
time are recorded; neither selects a winner. These small local repository
cases do not establish general superiority or Linux-kernel-equivalent quality.

## Cases and separation

| Case | Split | Observable work |
| --- | --- | --- |
| DEV-R1 | Development | Existing two-defect Python repair, including an incorrect prior diagnosis. |
| DEV-F1 | Development | Multi-module persistent inventory reservation through an API and CLI. |
| HOLD-R1 | Held out | Atomic persistent metadata repair, including a controlled mid-edit interruption. |
| HOLD-F1 | Held out | Multi-module export/import feature and preservation of existing behavior. |

Requirements, original tests, seeds, evaluator programs, calibration candidates
and invocation definitions receive SHA-256 manifests before scored execution.
Ignore Python caches; set `PYTHONDONTWRITEBYTECODE=1`. Stage only the selected
seed and framework resources into each fresh consumer. Actors must not read
oracles, references, other trials or results. This is an experiment isolation
rule, not a filesystem confidentiality guarantee. Inspect actual read commands
and mark a contaminated trial invalid. Held-out details and traces are not given
to the W2 product implementer. The manager and independent evaluator may inspect
them for acceptance; they must not use them to tune W2.

DEV-R1 reuses the existing public fixture with a recorded authority amendment:
its old single-worker restriction is replaced by this protocol's native-agent
permission. All behavior requirements remain unchanged. Its known outcomes are
development evidence only.

## Arms and actual installation

1. `codex-native`: no development framework selected or enabled.
2. `codex-superpowers`: complete installed Superpowers 6.3.0 skill distribution;
   its relevant planning/implementation/review/verification path.
3. `codex-ccsdd-full`: official cc-sdd 3.0.2 Codex-skills installer, commit
   `29aee950f4addc36f9aeecb9881c46540e71ecc9`; native requirements/design/tasks/
   implementation and review as applicable to the task.
4. `codex-speckit-full`: locally built official Specify CLI 1.0.8.dev0, commit
   `1d5106f59e1b148ee23ab136638932dd790ff1b6`; Codex skills with bundled Python
   scripts; constitution/specify/plan/tasks/implement/converge as applicable.
5. `codex-bmad-full`: official Codex marketplace method and toolbox packages
   6.13.0-next, distribution commit `d009608292d8a2ea4df846de7dca2f0d78a9e22d`;
   setup plus `bmad-build` and its actual normal steps. BMad Loop is distinct
   and is not substituted for this arm.
6. `leo-dev-current`: exact frozen prior Q1–Q4 installed package, including its
   runtime, with necessary external method skills available. The manager actor
   must run its controller and native members; an experiment script does not
   perform those steps in its place.

An installed distribution does not prove that its workflow ran. Record actual
resource reads, invoked scripts, produced artifacts and child activity. A
fragment, unavailable entry, failed setup or stopped conversation cannot be
reported as a completed full-framework workflow. Framework-specific artifacts
are allowed; scoring does not require another framework's directory format.

Global plugins/skills are disabled by process-local documented configuration;
the assigned complete skill trees are exposed through native project discovery.
Installed package and project-copy hashes must match. Normal Codex authentication
is used without copying credentials or connecting to an existing desktop server.
The host may still report the global AGENTS path: common developer instructions
restrict this experiment to its assigned methods, and traces must be checked for
cross-arm consumption. Any residual instruction/tool exposure is reported.

## Common execution contract

- Codex CLI 0.154.0 on this macOS host; Node 22.22.2 and Python 3.14.3.
- Main and requested native children: `gpt-5.6-terra`, effort `high`. Record
  requested and host-reported metadata separately; provider execution identity
  is not independently attested. Normalize upstream local model defaults only
  in the disposable consumer and record the exact patch. Do not change global
  defaults. A different observed model makes that trial an unmatched variant.
- Fresh working directory and ephemeral main thread for every attempt. Native
  children are permitted when the workflow uses them, at most two concurrently,
  with explicit ownership and no nested delegation. This compares end-to-end
  workflows, not equal-token computation or a fixed agent count.
- Same workspace-write, network-disabled actor sandbox and approval policy.
  Framework setup dependencies are installed beforehand in owned local paths.
  No credential reads, new dependencies, external services, publication or
  source-project mutation. No automatic permission approval.
- The supplied requirements authorize implementation and local verification.
  Framework-native planning artifacts may restate them without changing them.
  The benchmark does not authorize Git publication, cleanup or deleting work.
- A case has a 30-minute wall-clock limit including child work and continuation,
  and at most four submitted implementation candidates: initial, two ordinary
  repairs and one fresh-context diagnosis/repair. Individual tool operations and
  TDD edits are not separate candidates. All rejections/attempts remain visible.
- Routine confirmation answers, if requested, may only repeat: "The supplied
  requirements are approved. Continue the local implementation, tests and
  review within them; choose routine implementation details yourself." Count
  each answer as an intervention. Do not supply a diagnosis or favorable review.
  Unresolved material choices and permission requests terminate as blocked.
  The operator uses an exact checkpoint id/hash to choose `confirm-routine` or
  `finish`; no free-form answer is accepted. There are at most six confirmations.
  Finishing a terminal turn is not code-quality acceptance. Every real launch
  rechecks assigned skill names and canonical paths; each owned process group
  must be confirmed absent before external scoring or the next trial.
- Stop reasons distinguish completed, behavior failure, workflow stopped,
  timeout, host/environment failure, unsupported capability and invalid trial.
  Never turn an interrupted or unknown run into a passing result.

## Mid-edit continuation

For HOLD-R1, watch allowed source files. After observing their first byte change
and before a terminal candidate, issue a real host `turn/interrupt`. Save the
interruption request/result and source hashes. Continue the same conversation
once with a fixed instruction to inspect existing work and finish the approved
task. Do not add bug clues. If a terminal result races with the interrupt,
report `INTERRUPT_NOT_OBSERVED`, not recovery success. If child work continues,
record that fact and do not claim all writers were stopped. This tests native
turn interruption and continuation, not process-crash durability. A separate
pre-edit interruption is not equivalent.

## Result and process evaluation

An accepted candidate must pass the evaluator-owned behavioral oracle and the
original public regressions; preserve protected input hashes; stay in scope;
resolve real blocking review findings; and report completion honestly. Valid
alternative implementations/serialization are accepted. A test count cannot
offset a missed requirement. Run persistence checks in a fresh process.

Record per requirement: met, missed, contradicted or unverified. Record review
false acceptance, false objections, regressions, duplicate state authorities,
boundary violations, error handling and behavior-test quality separately.
Evaluate final code without the arm label where practical; inspect full traces
in a separate process review. A worker is not its own final evaluator.

Record wall time, main/child turns, last cumulative token reports per thread
(never sum repeated cumulative updates), resource reads, commands, actual tests,
review/repair steps, approval requests, interventions, interrupted bytes and
cleanup results. Unknown values remain unknown. Retain every failed attempt.

## Run schedule and inference limits

W1: one independent attempt per runnable arm on each development case. Freeze
these pre-change artifacts before W2. Diagnose W2 only from development results.

W4: three independent paired old-Leo/new-Leo attempts on each held-out case,
interleaved in one host window with deterministic random seed 20260916. Run one
held-out attempt per case for each upstream/native comparator as an exploratory
check of broader behavior; this is not a repeated superiority comparison.
Repeat a comparator only as a separately disclosed extension, without discarding
its first attempt. All arm eligibility and setup failures are retained.

Three Leo pairs are a small-sample engineering check, not statistical power.
Report observed quality and specific gaps in these cases; do not produce a
general ranking from one comparator attempt. If the intended fixed conditions
cannot run, report which comparison is unavailable rather than invent a proxy.
