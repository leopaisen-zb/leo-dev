# Final C2 source regression — 2026-09-09

Main-thread verification on macOS, Node v25.8.2. This is source/controller acceptance evidence, not installed-client or real Codex application acceptance.

## Frozen identity

The following identities were checked before and after the final suite; source/tests were frozen while it ran:

```text
f8dbd2c572fd2b45745e55257d5db94c740ad831ee894c2ad2033825a5f7d440  packages/cli/src/controller/controller.ts
ef7947fda4ada339dfc75ba172e7b1d19c5db2063dd17a229631244a8536f61d  packages/cli/src/state/snapshot.ts
a806b227993793f341d382b074a0160e450f030a91af38108a77c59eee0849db  packages/cli/dist/controller/controller.js
878e8af44b86644753f5ddb7feb6a08984774cce19948dbf5f1b43ecd605d197  packages/cli/dist/index.js
299de13b25849209cad0d81b879b701ce3f3aebc88f43c23613952cd8b709927  tests/cli/crash-atomicity.test.ts
```

Exactly five production source files differ from the actual before-state snapshot: `commands/{claim,route,run-gates}.ts`, `controller/controller.ts`, and `state/snapshot.ts`. The repository has no HEAD; these are file comparisons, not a commit diff.

## Commands and results

The main thread ran this whole command chain and observed its terminal exit code **0**:

```sh
npm run build && npm run typecheck && ./node_modules/.bin/vitest run tests/changes tests/repository tests/routing tests/schema tests/state tests/gates --reporter=default --reporter=json --outputFile=verification/codex-execution/final-core-v2.json && node --test --test-reporter=tap --test-reporter-destination=verification/codex-execution/final-adapter-v2.tap tests/**/*.test.mjs && ./node_modules/.bin/vitest run tests/skill-contract tests/cli --reporter=default --reporter=json --outputFile=verification/codex-execution/final-cli-v2.json
```

| Final check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Core, schema, routing, repository, state and Gate tests | 161 | 0 | 0 |
| Adapter tests | 8 | 0 | 0 |
| CLI and skill contracts | 141 | 0 | 0 |
| **Node/TypeScript total** | **310** | **0** | **0** |

Native evidence: [core JSON](final-core-v2.json), [adapter TAP](final-adapter-v2.tap), [CLI/skill JSON](final-cli-v2.json). Both JSON reports have `success: true`. Core ran 03:06:57.995–03:07:14.584 UTC; CLI/skill ran 03:07:17.525–03:10:37.783 UTC. CLI/skill includes 55 crash-atomicity, 26 vertical-slice, 21 governance, 10 candidate, 10 plan, 8 execution, 5 baseline acceptance and 6 skill-contract tests.

Two additional final commands each exited 0:

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
PYTHONPATH=/private/tmp/leo-dev-source-audit.5I999C/spec-kit/src:experiments/codex-first /private/tmp/leo-dev-source-audit.5I999C/python-env/bin/python -m unittest discover -s experiments/codex-first -p 'test_*.py' -v
```

They passed 6 doctor tests and 13 historical experiment tests respectively. The latter remain experimental integration-mechanics evidence, not product workflow integration. No dependency installation was needed.

Skill validation and four generated package checks are recorded in [source checks](source-checks.md). No source skill/reference changed after their last validation. Documentation-only closeout edits are not controller or package code changes.

## Recovery evidence and limits

The 306-test pre-hardening checkpoint remains historical. The final 310 checks include post-release safe-abandonment refusal and the positive never-released recovery paths. The positive fixture reconstructs labelled synthetic hash-linked history; it is not an actual operating-system crash before argv release. The crash-batch test preserves old lease fencing, repeated-resume idempotence, no duplicate receipt, two same-task abandonments and increasing claim generations. Existing malformed/released/incomplete-history refusal assertions remain.

The guard mutation RED is post-fix mutation evidence, not retrospectively claimed TDD; its first invalid-ID run is not behavioral RED. See [implementation report](implementation-report.md) and [independent review](final-review.md).

Historical approval and installed develop entry hashes remain unchanged. No install, Git history mutation, publication, deployment or live application implementation ran. The controlled project remains approval-blocked: [boundary](live-blocker.md), [preservation](live-preservation.json). Linux, Node 20, fresh installed-client discovery and actual multi-session application behavior are **not run**.
