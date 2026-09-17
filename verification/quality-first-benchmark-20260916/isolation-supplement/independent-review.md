# Independent review: W2/W4 isolation supplement

**Verdict: BLOCKING. Do not prepare or launch a supplement with the current helper.** The one-entry config delta and launch-argument preservation are sound in the synthetic path, but the helper cannot consume the retained real failure manifest and the documented command targets an attempt whose trial already exists. Its failure-evidence predicate is also too weak to prove the narrow pre-model humanizer isolation event that is supposed to authorize the exception.

## Blocking findings

### B1 — Real failure evidence uses a different terminal field

`isolation_supplement.py:160-164` accepts only JSON whose top-level `status` equals `ISOLATION_FAILED`. The retained runner manifest at `/private/tmp/leo-dev-w1-20260916/w2-design-repair-hostfix/trials/w2-dev-r1-design-repair-hostfix/manifest.json` has no `status` field. It records `executionOutcome: ISOLATION_FAILED` and `environmentStatus: skills-isolation-failed`.

Consequently the exact prepare command in `verification.md` reaches `_failure_evidence` and raises `isolation failure evidence must record status ISOLATION_FAILED`. The six synthetic tests do not expose this because `test_isolation_supplement.py:52` invents `{"status":"ISOLATION_FAILED"}` rather than using the frozen runner's manifest schema.

Required repair: validate the actual runner-manifest fields and add an actual-schema synthetic regression. Do not translate or rewrite the preserved failure manifest.

### B2 — The documented prepare command points to an already failed attempt

The same documented command selects root `w2-design-repair-hostfix` and attempt `w2-dev-r1-design-repair-hostfix`, whose trial directory already contains the retained isolation failure. `_prepare_record` first calls `prepare_w2.verify_launch`; that original guard rejects any existing trial at `prepare_w2.py:197-198`. The wrapper repeats the same protection at `isolation_supplement.py:191-193`.

This rejection is correct and must remain. The supplement needs a newly staged, distinctly labeled R1 attempt/root with no trial output, while `--failure-evidence` points back to the preserved failed manifest. The failed attempt must remain `ISOLATION_FAILED` and must not be reused, overwritten, or described as the supplemented run. Update `verification.md` to show the fresh attempt and separate prior-evidence paths. Do not run the current command.

### B3 — Failure evidence does not prove the narrow exception

Even if B1 were changed from `status` to `executionOutcome`, `_failure_evidence` currently accepts any JSON with that one value. It does not establish that the failure occurred before a model turn, that the only unexpected enabled skill was the exact known humanizer name/path, or that cleanup completed without an active turn. An unrelated isolation failure could therefore authorize the humanizer-specific config exception.

The retained real manifest provides deterministic fields sufficient for the intended proof without reading the skill contents:

- `executionOutcome == "ISOLATION_FAILED"` and `environmentStatus == "skills-isolation-failed"`;
- initialization and skills listing completed, but `threadId` is null, `terminalTurns` and `agentLifecycle` are empty, `tokenUsageByThread` is empty, and `primaryThreadTokenUsage` is null;
- `skillsDiscovery.unexpectedEnabledNames` is exactly `["humanizer:humanizer"]`, and the corresponding unexpected-skill record is exactly `/Users/leo/.codex/skills/humanizer/SKILL.md`;
- `activeTurnsAtCleanup` is empty and cleanup reports `confirmedGone: true`.

Validate this narrow shape and hash the unchanged evidence. Bind the supplement record to the prior failed attempt/frozen lineage strongly enough that an arbitrary W2/W4 isolation failure cannot be substituted. Add negative tests for a model turn/token record, an additional or different unexpected skill, incomplete cleanup, and mismatched failure identity.

## Checks that are satisfactory

- Both prepare and launch call the original W2/W4 `verify_launch` guard before using an attempt. Those guards revalidate the schedule/freeze, W1 completion, LAB/native config, helper assets, seeds, stage inventory, installed package identity, consumer tree, original input hashes, and absence of trial output.
- The supplement deep-copies the original config and appends exactly one disabled entry for the resolved global humanizer path. It refuses the target if it was already assigned or configured and does not read the skill contents.
- `_replace_config_argument` requires exactly one existing `--config-file`, verifies it names the frozen `config.json`, and changes only that value. Model, effort, prompt, skill input, permissions, runner, operator control, timeout, and allowed-skill arguments stay byte-for-byte equal in the argv list.
- Launch rechecks original inputs, original config, original runner argv, freeze hash, helper/test hashes, supplement config/hash, supplement argv/hash, target path, failure-evidence hash, and no-existing-output. Other unexpected skills remain subject to the unchanged runner allowlist and can still produce `ISOLATION_FAILED`.
- The helper writes only a new config beside the frozen input files and new supplement evidence. It does not edit the original config, helper modules, candidate package, consumer, global config, runner, thresholds, or results.
- W2 inherits the original launch environment; W4 adds the same `PYTHONDONTWRITEBYTECODE=1` value as its original launcher. The kind is limited to W2 or W4.

## Independent test evidence and limits

I reran:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest test_isolation_supplement.py -v
Ran 6 tests in 0.028s
OK
```

These tests establish the intended single-config-entry and single-argv-value delta plus several drift refusals. They are synthetic and mock `_verify_original`, so they do not validate the real manifest schema or the documented W2 command. No held input, actor case content, humanizer skill content, model, network, candidate, original result, or threshold was read or changed during this review.

After B1-B3 and the command documentation are repaired, the smallest rereview is the focused synthetic suite plus a read-only preflight of the new fresh attempt against the preserved real failure manifest. A model launch should remain blocked until that rereview passes.

## Rereview after B1-B3 repair

**Final verdict: PASS for freezing and use on fresh guarded W2/W4 attempts.** The initial BLOCKING decision above remains the audit record for the rejected before-images. The current helper at SHA-256 `efc3fe7d863f846d04b737fcd56df9231da0c6913f3719928dc60e50936538b5` and current test contract at `e828b6f264f5311331a3d450c72cf2a229152bfe10ab8fe282385abde3d6d3a8` resolve all three blockers without broadening the exception.

### Resolved findings

- **B1 resolved.** `_failure_evidence` now consumes the retained runner schema: `executionOutcome`, `environmentStatus`, initialization/listing state, server exit, model-activity fields, skills discovery, and cleanup. It no longer recognizes the invented top-level `status` shape. The focused suite includes a valid runner-shaped manifest and fail-closed variants.
- **B2 resolved.** `verification.md` now targets the fresh `w2-design-repair-isolated` root/attempt and uses the failed `w2-design-repair-hostfix` manifest only as prior evidence. Existing-trial refusal remains unchanged in both the original launch guard and wrapper. The failed attempt cannot be overwritten or launched through the supplement.
- **B3 resolved.** The exception requires exactly one unexpected enabled skill record, `humanizer:humanizer` at `/Users/leo/.codex/skills/humanizer/SKILL.md`; any other or additional record fails. It requires no thread, terminal turn/status, agent lifecycle, token usage, or active cleanup turn, plus confirmed process-group cleanup. It binds the manifest to exactly one prior W2 schedule row, the schedule and freeze hashes, attempt ID, trial, consumer/cwd, config/prompt/developer-instruction hashes, skill-input count, and every frozen input hash. Launch recomputes this complete record and compares it to the locked copy.

The rejected helper/test files are preserved under `rejected-before-images/` with matching recorded hashes (`20969e9c…` and `e6d86e01…`), and the original independent BLOCKING report hash is also listed. This keeps the two failed setup observations and rejected helper implementation visible rather than rewriting their history.

### Independent evidence

The read-only preflight of the actual preserved failure manifest passed and returned:

```text
priorAttemptId: w2-dev-r1-design-repair-hostfix
priorKind: w2
priorFreezeSha256: efd898858cf28c328f41dd399d6b05e901386f4e96921a1b7ae789b3616d81b5
priorScheduleSha256: b0bd2dc9fec81b25b542fe718b1a512d49b46c8870efa59b3fd9eec0993e22aa
failureManifestSha256: bfb44e156fa79f7c13ead8ee6351c0b423a5c7cff2a6c3c033859678e778b8a1
unexpectedEnabledSkill: humanizer:humanizer @ /Users/leo/.codex/skills/humanizer/SKILL.md
```

I independently reran the repaired focused suite:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_isolation_supplement.py
Ran 10 tests in 0.064s
OK
```

An additional temporary synthetic smoke used a retained W2-shaped isolation failure with a fresh W4 attempt. Prepare and verification both passed, the lock retained `kind: w4`, and the sole argv difference remained the value after `--config-file`. The exception is therefore not restricted to candidate A or the W2 cohort. Conversely, it cannot apply outside W2/W4, cannot disable another skill, and does not bypass the current attempt's W2/W4 package, seed, stage, input, consumer-tree, or allowlist guards. This is the intended common-baseline correction for fresh candidate-B and W4 trials as well.

### Exact approved A-R1 sequence

Run from `/Users/leo/plugins/leo-dev` only after the fresh root has been staged and its original `prepare_w2.py launch` verification succeeds:

```text
PYTHONDONTWRITEBYTECODE=1 python3 experiments/quality-first-benchmark/isolation_supplement.py prepare \
  --kind w2 \
  --root /private/tmp/leo-dev-w1-20260916/w2-design-repair-isolated \
  --attempt w2-dev-r1-design-repair-isolated \
  --out verification/quality-first-benchmark-20260916/isolation-supplement/w2-dev-r1-design-repair-isolated \
  --failure-evidence /private/tmp/leo-dev-w1-20260916/w2-design-repair-hostfix/trials/w2-dev-r1-design-repair-hostfix/manifest.json

PYTHONDONTWRITEBYTECODE=1 python3 experiments/quality-first-benchmark/isolation_supplement.py launch \
  --out verification/quality-first-benchmark-20260916/isolation-supplement/w2-dev-r1-design-repair-isolated

PYTHONDONTWRITEBYTECODE=1 python3 experiments/quality-first-benchmark/isolation_supplement.py launch \
  --out verification/quality-first-benchmark-20260916/isolation-supplement/w2-dev-r1-design-repair-isolated \
  --execute
```

The middle command is the required no-model preflight. Capture and externally freeze the generated supplement lock/config/argv hashes before the final `--execute`. For candidate B or W4, substitute only the freshly staged kind/root/attempt and a new evidence output directory; retain the same preserved failure manifest. Do not point `--root` or `--attempt` at either failed A-R1 trial.

No supplement was prepared and no actor/model was run during this rereview. The global skill contents, held cases, candidate code, frozen configs, helpers, results, and thresholds were not modified.
