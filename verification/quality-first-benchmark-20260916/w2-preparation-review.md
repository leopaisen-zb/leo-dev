# W2 preparation independent review

Date: 2026-09-16  
Reviewer: independent `llm_evaluator`, Sol/high  
Scope: `prepare_w2.py`, its fake tests and preparation note, reused W4/layout helpers, and the installed W2 control-package identity. No consumer was staged and no model was run.

## Decision

**BLOCKING — do not freeze or stage W2 yet.** The two-case DEV-only construction, package-inventory check, per-attempt input/stage/archive locks, selected-consumer launch check, reused-trial rejection, and deliberate tolerance for a completed *other* consumer are sound. Three narrow provenance gates remain incomplete, so a run could be labelled W2 while using an unfinished W1, a changed DEV seed, or a different host configuration.

## Blocking findings

1. **`--w1-complete-evidence` proves existence, not W1 completion.** `prepare_w2.py:81-82` accepts any regular file, then records only its path and digest (`:119`); launch only rechecks those bytes (`:145-148`). The positive fake fixture at `test_prepare_w2.py:39-40` is literally the text `complete`. Therefore an arbitrary file can unlock W2 before all required W1 cases have terminal results and independent decisions. This contradicts the stated W1-completion prerequisite. Parse and validate a root-owned completion manifest with an exact phase/status and the complete required W1 attempt/result set, then lock that validated manifest. A missing, malformed, incomplete, wrong-phase, or nonterminal manifest must fail before creating consumers.

2. **The staged DEV seed is not checked against the frozen case manifest.** `prepare_w4.frozen_execution_guard()` verifies the digest of `frozen-cases.json`, but does not verify the fixture files named inside it. Frozen `stage.py:52-55` copies the current `fixtures/<case>` tree and merely records those current hashes; `prepare_w2.py:100-104` accepts that newly recorded tree. A modified `DEV-R1` or `DEV-F1` fixture would therefore become the locked W2 input instead of being rejected. Before or immediately after staging, compare the selected seed's complete manifest with the corresponding `frozen-cases.json` entries (including absence of extra files), and test a changed/extra DEV fixture rejection before any official run.

3. **The caller can select an unapproved `--lab` configuration.** The frozen guard checks `/private/tmp/leo-dev-w1-20260916/native-config.json`, while `leo_layout.prepare_regular_leo_inputs()` reads `native-config.json` from the independently supplied `args.lab`. `prepare_w2.py:92,97` passes that caller-controlled path without binding it to the approved lab or comparing the generated normalized inputs with the accepted W1 treatment. The resulting config/prompt/argv are immutable after staging, but their provenance can already be wrong. Bind `--lab` to the approved frozen lab, or validate the actual lab configuration and normalized generated inputs against the approved baseline before writing the freeze record. Add a fake alternate-lab rejection.

## Smaller correctness defect

`validate_condition()` claims to reject W1 arm labels, but its arm comparison is case-sensitive (`prepare_w2.py:46`). `LEO-DEV-CURRENT` and `CODEX-NATIVE` are accepted even though the character policy itself is case-insensitive. Compare lower-cased labels with lower-cased arm names and add a case-variant test. This should be repaired before freeze so condition names cannot misrepresent a reused W1 arm.

## Confirmed evidence

- `python3 -m unittest experiments/quality-first-benchmark/test_prepare_w2.py`: **3/3 passed**. The tests do not cover semantic W1 completion, frozen-seed provenance, alternate-lab rejection, case-variant W1 labels, or reused-trial rejection.
- Direct read-only `prepare_w4.load_identity(..., "w2-leo")` against the installed control package: **passed**, 1,326 files. Identity SHA-256 is `55b927034df545f0f2580870ead7f3bbee55bdedf4eb9793454c5a59dd490149`; computed inventory SHA-256 is `67d500bccba85c8d968d1e166f750d95be71799558a12379746fb05e41b54b57`.
- Dependency locking covers `prepare_w2.py`, `prepare_w4.py`, `leo_layout.py`, `stage.py`, `prepare_trial.py`, `runner.py`, `runner_v2.py`, `score.py`, `common-instructions.md`, and `frozen-execution.json`. `runner_v2.py` delegates only to the locked runner module. Generated config, prompt, skill input, argv, stage record, pre-layout archive, package inventory, and selected initial consumer tree are hashed.
- `verify_launch()` rejects an existing selected trial at `prepare_w2.py:175-176`. It checks every attempt's immutable stage/archive record but checks mutable product bytes only for the selected attempt, so a legitimately completed other DEV consumer does not block launch.
- No held-out case is scheduled: the schedule is constructed from the fixed tuple `("DEV-R1", "DEV-F1")`. No W2 consumer or model process was created during this review.

After the four points above are repaired and narrowly tested, the helper can be rereviewed without reopening the approved W1 oracle, runner, or package scope.


## Provenance-gate fix rereview

**Decision: still BLOCKING on W1 completion provenance.** The seed, lab, condition-label, ordering, and dependency-lock repairs are accepted. The new completion validator correctly requires twelve unique DEV case/arm rows and binds each scored row to the same stage/trial digests, but it still accepts a fabricated or stale candidate/source chain that is outside the approved W1 roots. W2 and W4 must not stage until this final guard is closed.

### Accepted fixes

- `verify_case_seed()` compares the complete selected fixture tree with its `frozen-cases.json` prefix, so changed, missing, and extra files are rejected. W2 verifies both DEV seeds before entering its consumer loop. W4 performs the corresponding held-seed checks only after explicit held staging is enabled and before its consumer loop; this review did not open held fixtures.
- `verify_lab()` requires the supplied lab, frozen `stage.py` LAB, and frozen `prepare_trial.py` LAB to resolve to one path, then resolves and hashes the sole frozen `native-config.json` entry. Both stage paths call it before creating consumers, and launch rechecks the same binding.
- Condition labels now compare case-folded values with every W1 arm. The former `LEO-DEV-CURRENT` bypass is covered.
- `benchmark_guards.py` is included in W4's module asset map and therefore also in W2's nested W4 asset map. Launch reruns the semantic guards and compares the returned evidence path/hash, lab binding, seed manifests, helper/dependency hashes, package identities, stage/archive locks, selected consumer, inputs, and unused trial path.
- A failed preflight may create the fresh output directory and a setup-failure record, but all completion/lab/seed checks run before either helper enters its consumer-staging loop. This satisfies the no-consumer-before-gate requirement.
- The combined local suite passed independently: **14/14** tests.

### Remaining blocker: stage/source/candidate/result roots and state are not fully bound

`validate_w1_completion()` does bind row case/arm to the adjacent stage and binds a score's `case`, `arm`, `trialManifestSha256`, and `stageSha256`. That prevents a simple case/arm swap. It does not validate any of the following:

- trial manifest path is under the approved W1 trial root;
- trial `cwd` is under the approved W1 consumer root;
- score path is under the approved W1 score root;
- stage status is `STAGED`;
- stage `seed` resolves to the matching frozen `fixtures/<case>` source and its recorded seed hashes match that frozen seed;
- score `executionOutcome` equals the evidence/trial outcome;
- score contains a complete `finalHashes` mapping and that mapping equals the current candidate tree.

The positive fake builder itself omits stage seed data and score final hashes, so those omissions are currently treated as valid. I also reproduced a full bypass in a temporary directory: starting from the accepted twelve-row fake evidence, I changed one stage to `SETUP_FAILED`, removed all seed provenance, changed its score outcome to `WRONG_OUTCOME`, left the score without `finalHashes`, and added an unscored file to the candidate after scoring. The validator still returned `ACCEPTED` for an entirely arbitrary temporary `w1-consumers`/`w1-trials`/`w1-scores` root.

This is not a signature objection. The helper explicitly claims deterministic path/hash/provenance validation, and the actual W1 manifests already contain the fields needed to perform it. The narrow repair is to pass the approved W1 lab/benchmark roots into the validator and require the three artifact namespaces, `STAGED` source binding, matching score outcome, and exact current final tree for every scored result. Noncompleted explicitly unscored rows may retain their reason without requiring final hashes. Add focused negative tests for wrong artifact root, wrong stage status/seed, score-outcome mismatch, and post-score candidate drift. Retain the existing rule that a baseline may be rejected or unscored for an explicit terminal reason; this gate must not require every W1 result to pass.

After that repair, no other W2/W4 preparation blocker remains in the reviewed scope.


## Final provenance-gate rereview

**Decision: PASS — W2/W4 preparation inputs may be frozen after root creates the real twelve-row W1 completion evidence.** The final shared guard closes the prior namespace, source, stage-state, outcome, and candidate-state bypasses. No actual W2/W4 consumer, held fixture, or model run was opened in this review.

The validator now requires trial manifests under the approved LAB `w1-trials` namespace, trial `cwd` under `w1-consumers`, and score artifacts under `w1-scores`; resolved-path checks also prevent a symlink escape. Each trial must have a nonempty `finishedAt`, no active cleanup turns, confirmed process-group cleanup, and an adjacent stage record. The stage must be `STAGED`, match the exact case/arm row, point to the corresponding benchmark fixture root, and carry the complete currently frozen seed manifest.

For every scored result, the score's case, arm, execution outcome, trial digest, and stage digest must match the same row, and its complete `finalHashes` must equal the current candidate tree. This rejects post-score product drift as well as copied or relabeled artifacts. Completed rows require a score. Noncompleted terminal rows may be unscored only with a nonempty reason, so the gate does not require every baseline to pass. `UNKNOWN` is accepted only as `UNVERIFIED` and unscored. `DISCOVERED` is no longer treated as a completed coding trial. The terminal vocabulary matches the frozen runner's execution outcomes; `CLEANUP_UNCONFIRMED` remains unable to pass the separate mandatory cleanup check, appropriately preventing W2/W4 while an owned process group is unconfirmed.

The earlier arbitrary-root/`SETUP_FAILED`/missing-seed/wrong-outcome/no-final-hashes/candidate-drift counterexample is now rejected at multiple independent checks. Focused tests cover wrong lab roots, failed stage, bad seed hashes, trial outcome mismatch, post-score candidate drift, permitted failed-unscored evidence, and rejected discovery-only evidence.

Both W2 and W4 invoke the completion guard before their consumer loops, then verify frozen LAB/config, package identity, and selected case seeds before staging. Launch repeats the semantic guard and all dependency/asset bindings. `benchmark_guards.py` remains transitively hash-locked in both helpers.

Independent verification:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  experiments/quality-first-benchmark/test_benchmark_guards.py \
  experiments/quality-first-benchmark/test_prepare_w2.py \
  experiments/quality-first-benchmark/test_prepare_w4.py
```

Result: **16 tests passed**. This approval is for the helper and guard bytes reviewed here. The eventual real `W1_COMPLETE` manifest must itself pass the guard before any W2 or W4 staging.
