# Independent candidate review — cli-sample r1

## Verdict

**PASS**

No Critical, Important, or Minor findings. The frozen cli-sample candidate satisfies its V1 task specification and process-level acceptance contract.

Reviewer handle: /root/p3_review_fallback

## Reviewed binding

- Fixture: /private/tmp/leo-dev-spec-revision-live-p3.WxaWog
- Change: p3-live-retry1
- Task: cli-sample, revision 1
- Run: run-98fd6fb6-c03a-494a-a496-7d47042b654a
- Lease generation: 1
- Spec hash: 1e3c530ef74a379c2b9ce2d2994dfac8ed38740666a3307da0cc711da7103625
- Task hash: c7ab7ed43bed019f39ada1b0053225c95607903e66949411399521777d594f61
- Candidate tree hash: f1df939a597cc77f25fe95072a2bdcff94e522070d639f5d1b6146a3e7a578f3
- Gate: cli-sample-gate
- Gate definition hash: c8fd1abf061407c4786e57db9fef8fd22a084cb76f935ac11e3932702a83da65

I independently recomputed the task fingerprint from plan-v1.json, the Gate definition fingerprint from core/gates/default.yaml, and the canonical 16-entry tree identity. All values exactly match the candidate context, claim, candidate registration, Gate lifecycle, Gate result, submit binding, and review handoff. The current 44-frame journal hash chain verifies through sequence 44. The candidate context also records the required name-normalizer dependency as done before cli-sample review.

## Specification compliance

requirements-v1.md requires the public CLI to normalize the supplied name and append one LF. The routed cli-sample task adds the exact no-argument contract: one LF, exit zero, and empty stderr.

The candidate imports the bound normalizeName helper, passes the first user argument or an empty string, and writes the normalized result plus one newline:

```js
import { normalizeName } from './name.mjs';
process.stdout.write(`${normalizeName(process.argv[2] ?? '')}\n`);
```

This satisfies the reviewed cases:

- Unicode and internal spaces are passed unchanged to normalizeName; the helper trims only boundary whitespace and preserves internal code points and repeated spaces.
- A missing argument becomes the empty string, so stdout is exactly one LF.
- The successful path does not write stderr and leaves the process exit code at zero.
- Exactly one trailing LF is added after the normalized value; no extra formatting or logging is present.

The specification defines one supplied name, so reading process.argv[2] and ignoring unrelated later arguments does not conflict with the task contract.

## Code and test quality

The CLI is two direct statements with no state, parsing ambiguity, dependency beyond the reviewed helper, or unnecessary error handling. Template interpolation does not reinterpret characters in the supplied value, and process.stdout.write preserves Unicode output as UTF-8 under Node's string stream behavior.

acceptance/cli.test.mjs launches src/cli.mjs in a separate Node process for each case. It asserts process status, exact stdout, and exact empty stderr for:

- ASCII boundary whitespace with two internal spaces;
- Chinese characters with two internal spaces;
- no argument, expecting exactly one LF.

This is actual CLI process coverage rather than a direct helper-only assertion. A spawn or module-load failure would make the status assertion fail.

## Frozen source and evidence

- src/cli.mjs: ebb0b6416e22b105408cd8b6ea5b4584a045637a53ac46f90609ba59ce019b5e
- src/name.mjs: ead2a9cf6268362141c623856dda2db77a665feb162bdabadbf2ee20c828c845
- acceptance/cli.test.mjs: e8fe6d2e4003298242682283ad8452af57fa46b8079a19d0f9cc37511df3ee8b
- requirements-v1.md: 1e3c530ef74a379c2b9ce2d2994dfac8ed38740666a3307da0cc711da7103625
- plan-v1.json: ce7d6f974413f3ff4b333f62944b95cf3eb082e03e9911091e633b22c07579a1
- core/gates/default.yaml: 3d7368ab73dbdbe7e2fd4d426550d3c5199821ebb052d40c714bd0a60acaff0f
- candidate-cli-sample-r1.json: 8d31d13f5ce535e0362eb74ab8d8a3298ed7ed733c975ac56cf7c2c1c8992520
- Gate evidence.json: fcdfa2c68ed322f157a80a0ed97d95decac248fbb258c42e7587d1975ec2d249

The Gate evidence binds run-98fd6fb6-c03a-494a-a496-7d47042b654a, task revision 1, lease generation 1, Gate definition c8fd…da65, and the f1df…78f3 input/output tree. It records exit code 0, status succeeded, identical input/output write-surface hashes, one passing process-level test, and empty stderr. The exact command log independently records successful claim, Gate, submit, final status, and the matching review handoff.

## Limits

This judgment covers only cli-sample V1 revision 1 and the frozen src/cli.mjs candidate, including its dependency on the already reviewed src/name.mjs behavior. It does not approve a later Spec revision, controller behavior, packaging, installation, or broader P3/v1 completion.

I did not invoke the controller, create or modify a receipt, mutate the fixture, rerun the Gate, or change source, tests, data, or thresholds. The recorded CLI Gate does not separately exercise an explicit empty-string argument, tabs/newlines, or Unicode boundary whitespace. The no-argument contract is tested exactly, and the inspected normalizeName primitive covers the other boundary-whitespace cases; this is a coverage limit rather than a finding. This report is an unauthenticated independent judgment and is not controller authority.
