# Independent candidate review — name-normalizer r1

## Verdict

**PASS**

No findings. The frozen name-normalizer candidate satisfies its task-level specification and acceptance criteria.

Reviewer handle: /root/p3_review_fallback

## Reviewed binding

- Fixture: /private/tmp/leo-dev-spec-revision-live-p3.WxaWog
- Change: p3-live-retry1
- Task: name-normalizer, revision 1
- Run: run-e1d9b458-475f-4587-a27b-78547fcf8ec7
- Lease generation: 1
- Spec hash: 1e3c530ef74a379c2b9ce2d2994dfac8ed38740666a3307da0cc711da7103625
- Task hash: a1888e97d5846e58d6eb62f3ab9743fc2418196048e3ba97a79020bea2d93c73
- Candidate tree hash: f1df939a597cc77f25fe95072a2bdcff94e522070d639f5d1b6146a3e7a578f3
- Gate: name-normalizer-gate
- Gate definition hash: a1b7baeab7d23899faf8e9657ef4864d8b4d1fcba21ecda5ab5bb3a98c7f4e0e

I independently recomputed the task fingerprint from plan-v1.json, the Gate definition fingerprint from core/gates/default.yaml, and the canonical 16-entry tree identity. All match the review context and durable candidate/submit bindings. The 28-frame journal hash chain also verifies through its current sequence 28 tail.

## Specification compliance

requirements-v1.md requires name normalization to trim boundary whitespace while preserving every internal character. The routed task narrows this review to src/name.mjs and states the same acceptance rule.

The implementation is:

```js
export function normalizeName(value = '') { return String(value).trim(); }
```

For string inputs, String.prototype.trim removes only leading and trailing ECMAScript whitespace. It does not collapse, reorder, or normalize internal code points. The implementation therefore:

- trims boundary whitespace;
- preserves internal repeated spaces and Unicode characters;
- returns the empty string for an empty or whitespace-only name.

The default handles an omitted value as an empty string. Explicit non-string values are converted with String; the task defines no conflicting type-validation or error-handling requirement.

## Code quality

The implementation is direct, deterministic, stateless, and uses the platform primitive that exactly expresses the required operation. It introduces no dependency, mutation, locale-sensitive normalization, or unnecessary error path. There is no simpler implementation that would improve correctness for the stated contract.

## Frozen source and evidence

- src/name.mjs: ead2a9cf6268362141c623856dda2db77a665feb162bdabadbf2ee20c828c845
- acceptance/name.test.mjs: 96ee46c60dd8b9780d9f2c0ddd6b13acc296d223994697a803461224cb33c158
- requirements-v1.md: 1e3c530ef74a379c2b9ce2d2994dfac8ed38740666a3307da0cc711da7103625
- plan-v1.json: ce7d6f974413f3ff4b333f62944b95cf3eb082e03e9911091e633b22c07579a1
- core/gates/default.yaml: 3d7368ab73dbdbe7e2fd4d426550d3c5199821ebb052d40c714bd0a60acaff0f
- candidate-name-normalizer-r1.json: 0990ba23d293c123680fb9ad75471aae85d29fd33122fa70832c132605fc1be5
- Gate evidence.json: 6af1007a3c82e0ef6bc0a6ab1202390584f10d3fe50714c160a7cb92ea979879

The Gate evidence binds the reviewed Run, task revision, lease generation, Gate definition, and f1df…78f3 input/output tree. It records exit code 0, status succeeded, identical input/output write-surface hashes, one passing test, and empty stderr. The acceptance test checks ASCII boundary trimming with repeated internal spaces, Chinese characters with an internal double space, and a whitespace-only value.

## Limits

This judgment covers only the name-normalizer task and its frozen src/name.mjs candidate. It does not review or approve src/cli.mjs, the cli-sample task, the later Spec revision, the controller, packaging, installation, or the broader P3/v1 workflow.

I did not invoke the controller, create or ingest a receipt, mutate the fixture, rerun the Gate, or change source, tests, data, or thresholds. The recorded Gate does not explicitly exercise a literal empty string, tabs/newlines, or Unicode boundary whitespace; the inspected built-in trim implementation covers those cases, so this is a coverage limit rather than a finding. This report is an unauthenticated independent judgment and is not controller authority.
