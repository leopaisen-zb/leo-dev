# W4 independent evaluation checklist

## Scope and readiness decision

This checklist reviews experiment control and result recording only. It does not
open held-out requirements, seed files, evaluator code, reference solutions, or
trial candidates. It reuses the frozen protocol's acceptance rules and adds no
quality threshold.

**Decision: the existing W4 preparation, runner manifest, scorer and protocol
are sufficient for the fixed 22-attempt execution if the coordinator and
independent evaluator apply the bindings below.** The accepted execution path
uses the separately frozen `isolation_supplement.py`; direct
`prepare_w4.py launch --execute` is not the W4 launch procedure. Two other
controls are operational rather than enforced by `prepare_w4.py`:

1. `launch` verifies an attempt but does not reject launching a later schedule
   entry before an earlier one. The coordinator must use the immutable array
   order in `w4-schedule.json`. Entry N must have a terminal manifest, confirmed
   process-group cleanup and no active turn before entry N+1 starts. Its
   independent semantic evaluation may finish while entry N+1 runs, provided no
   finding is disclosed to an actor; all 22 dispositions must be complete before
   W4 is closed.
2. The frozen scorer records `case` and `arm`, but both Leo cohorts intentionally
   share arm `leo-dev-current`; it does not copy `attemptId`, `cohort`, or
   `pairId` into the score. Every independent result must therefore bind the
   score path/hash to the exact frozen schedule entry, stage hash, and trial
   manifest hash. Filename or arm label alone is insufficient.

These are recording/operation duties, not reasons to change the frozen helper,
scorer, cases, oracle, or thresholds.

## Before attempt N starts

- Verify `w4-freeze.json` has status `FROZEN_W4_PREPARED`; record its SHA-256,
  the locked `w4-schedule.json` SHA-256, and the schedule seed. Confirm the
  schedule still has exactly 22 entries: 12 paired Leo attempts and 10 one-off
  comparator attempts.
- Select entry N directly from the frozen schedule. Record its array index,
  `attemptId`, `case`, `arm`, `cohort`, `pairId`, model, effort, timeout, consumer,
  input, trial and stage-record paths. For a Leo entry, also record whether its
  frozen package identity is old or new; do not infer this from the shared arm
  name.
- Require the immediately preceding schedule entry to have a retained terminal
  manifest, confirmed process-group cleanup, and no active turn. Its independent
  product/process disposition need not be complete before this launch and may
  run concurrently without communicating findings to the active actor. Absence
  of a passing result does not permit deletion or rerun. No later entry may
  already have a trial directory.
- Run `prepare_w4.py launch` without `--execute` as the original guard. Require
  the frozen W1 evidence, W4 assets, LAB binding, case-seed hash, package
  identity, copied package, archived pre-layout stage record, selected consumer
  tree, and frozen input hashes to match. Compare the printed argv with the
  entry's frozen `runnerArgv`; do not execute through this command.
- For this one attempt, run `isolation_supplement.py prepare --kind w4` into a
  new attempt-specific evidence directory, using the accepted retained
  pre-model failure manifest as `--failure-evidence`. Require
  `accepted-helper-lock.json` at SHA-256
  `038463ae7c4925753d29e1ba5abc66a8ffb42bff4406921700bb8fa7fc9cf912`;
  its pins require helper SHA-256
  `efc3fe7d863f846d04b737fcd56df9231da0c6913f3719928dc60e50936538b5`,
  test SHA-256
  `e828b6f264f5311331a3d450c72cf2a229152bfe10ab8fe282385abde3d6d3a8`,
  and accepted independent-review SHA-256
  `7d4db17320ab1431850f850ab62f8989b3a9716cfb903cd1374730656f158988`.
  Preserve the helper's checked lineage to the prior no-model failure.
- Run `isolation_supplement.py launch` without `--execute`, then externally
  record and freeze the generated supplement-lock, supplemented-config, and
  supplement-argv hashes. Only after that no-model preflight succeeds may the
  same wrapper be called with `--execute`. The wrapper must re-run the original
  W4 launch guard and all supplement pins. Its only argv/config difference is
  replacement of the `--config-file` value with a config that adds the observed
  global `/Users/leo/.codex/skills/humanizer/SKILL.md` path as disabled. The
  original `config.json`, `prompt.md`, `skill-input.json`, and `control.json`
  bytes remain unchanged.
- Confirm the selected consumer is fresh and the trial output does not exist.
  Earlier completed consumers may contain their own actor changes and are not
  reset. A setup or verification failure is retained under its attempt ID and is
  classified before advancing; it is not overwritten with a replacement run.

## Terminal and cleanup gate

- Bind `events.ndjson` and `manifest.json` by their SHA-256 values. Check that
  `cwd`, prompt/developer-instruction hashes, requested model/effort,
  skills input, normal-host authentication context, sandbox and approval policy
  match the frozen entry. Separate requested/host-reported model metadata from
  independently unknown provider execution identity.
- Require the manifest's `configSha256` to equal the externally frozen
  supplemented-config hash, while the original four input hashes still equal
  their frozen W4 values. Bind the manifest to the attempt-specific supplement
  lock/argv hashes and to the accepted helper lock above; do not compare the
  manifest config hash to the untouched original `config.json` hash.
- Preserve the runner's actual terminal outcome. `COMPLETED` means only that the
  conversation ended normally; it is not product acceptance. Keep `FAILED`,
  `BLOCKED`, `UNKNOWN`, `ISOLATION_FAILED`, `INTERRUPT_NOT_OBSERVED`, timeout,
  protocol/server errors and setup failures distinct. Never convert an unknown
  or interrupted run into a pass.
- Require `activeTurnsAtCleanup` to be empty and
  `cleanup.processGroup.confirmedGone` to be true before behavioral scoring.
  Record TERM/KILL use and the cleanup outcome. `CLEANUP_UNCONFIRMED`, a live
  child, or unresolved active turn remains unverified and unscored; retain all
  evidence rather than amending the terminal manifest.
- Record every operator action. Routine continuation must use the exact frozen
  text and checkpoint ID/hash, stays within the six-confirmation maximum, and
  counts as an intervention. A permission request is never answered by the
  runner. Terminal `finish` is recorded but supplies no favorable quality
  judgment.

## Frozen behavioral score

- Run the frozen scorer only after the actor and owned processes have terminated,
  using a new score output path. Preserve exit 0 and exit 1 results alike. Never
  replace a score after review or repair the candidate outside the recorded
  actor workflow.
- Check that the score's `stageSha256` equals the selected schedule entry's
  locked stage-record hash and that `trialManifestSha256` equals the manifest
  just reviewed. Record the score SHA-256, oracle SHA-256, every check command,
  exit code, timeout and output, and all protected-input mismatches.
- Treat `behaviorAndInputChecks: PASSED` as necessary but insufficient. An
  accepted result must also pass every original public regression required by
  the project, preserve protected inputs, and survive the independent product
  and process review below. Persistence checks must execute in a fresh process.

## Independent product review

- Inspect the final product against the original held-out requirements before
  using the framework label as an explanation. For each stable requirement,
  record `met`, `missed`, `contradicted`, or `unverified` with code and runtime
  evidence. Accept valid implementations and serialization choices; do not add
  an algorithm, byte order, report format, or other unstated requirement.
- Inspect the whole relevant implementation and original tests, not only the
  actor's changed files or test count. Reproduce the smallest disputed behavior
  when necessary without mutating the candidate. Record scope violations,
  regressions, error-boundary failures, partial writes, and ordinary-behavior
  failures separately.
- Compare the final answer and delivery artifacts with observed facts. Mark a
  missed requirement or unresolved material concern even when actor tests and
  the frozen oracle pass. Conversely, preserve evaluator ambiguity and valid
  alternatives rather than rejecting by oracle output alone.

## Independent process review

- Inspect the complete trace for actual reads of the assigned framework entry,
  scripts/templates/resources, generated artifacts and tool calls. Discovery or
  installation alone is not consumption. Any oracle/reference/sibling-result
  read, cross-arm method use, hidden rescue, credential/global-config access, or
  out-of-scope write makes contamination explicit and may invalidate the trial.
- Reconstruct submitted candidates and repair generations. Count no more than
  four submitted implementations. Preserve every rejection and failed command;
  distinguish intended RED tests from unexpected errors and from later passing
  verification.
- Verify each claimed independent review happened in a distinct real turn and
  inspected the candidate it judged. For controller-backed reviews, bind the
  receipt to the exact change, task/revision, run, lease generation, spec/task
  hashes and submitted tree. A repair or later product edit requires fresh
  gate/submission/review evidence for the replacement tree. Record false
  acceptance, false objection, invented requirement, duplicate state authority,
  unauthenticated provenance and unknown child-model identity separately.
- Check native-agent limits from host lifecycle evidence: at most two children
  concurrently, no child delegation, explicit writer ownership, all children
  terminal or honestly reported active. Self-report is not lifecycle evidence.
- For the held repair case, require an observed allowed-source byte change before
  the real host interrupt and before a terminal candidate. Bind the interrupt
  request/result and before/after source hashes, then verify one continuation of
  the same conversation with the frozen neutral instruction. If the terminal
  result won the race, use `INTERRUPT_NOT_OBSERVED`; if child work continued,
  record it. A pre-edit stop or process restart is not mid-edit recovery.
- Record wall time; main and child turns; last cumulative token report per thread
  without summing repeated cumulative updates; cached/input/output/reasoning
  values; actual commands and tests; review/repair steps; approvals,
  confirmations and other interventions. Monetary cost stays unknown unless the
  host records it directly.

## Per-attempt disposition record

For every schedule entry, append one immutable evaluation row or section. This
may occur while a later, strictly ordered trial runs, but every field below must
be complete before final W4 closeout:

- schedule index and schedule/freeze hashes;
- `attemptId`, case, arm, cohort and pair ID;
- consumer/stage/trial/score paths and their binding hashes;
- execution and cleanup outcome;
- behavioral/input score and original-regression outcome;
- separate product verdict and process verdict with concrete reasons;
- per-requirement statuses, false acceptances/objections, contamination and
  unresolved uncertainty;
- resource consumption, interventions, interruption evidence when applicable,
  child lifecycle and effective-model limits;
- final code/report claims checked against the trace.

Retain failed and unscored entries in their original schedule position. After
all 22 dispositions, compare old/new Leo only within the three frozen pairs per
held case and describe the observed differences. Comparator attempts remain
single exploratory observations. The sample supports case-specific failures and
quality observations, not a global workflow ranking or a claim of statistical
superiority.
