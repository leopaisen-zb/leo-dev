# C3 team/runtime final verification

Date: 2026-09-10. Integration owner: main thread. Verdict: C3.1/C3.2 source and built-package seam accepted; bounded real-team correspondence/reconstruction accepted. Complete C3, installed-client loading and the pre-existing C2 expired-review recovery remain incomplete.

## Final-source checks

Build and typecheck exited 0. The final serial command exited 0 with **216 tests passed, 0 failed, 0 skipped**:

| Partition | Passed | Scope |
| --- | ---: | --- |
| Governance CLI | 21 | Existing 5000 ms test timeout unchanged |
| Core changes/repository/routing/schema/state/Gate | 161 | Includes containment, recovery, journal and fencing regressions |
| Codex team compiled CLI and narrow predicate tests | 15 | Active Gate barrier, actual public reconciliation, separate unknown Run, CAS, artifacts, generations, strict inputs, dry-run and persistence |
| Skill contract | 6 | Portable inventory and entry/reference contracts |
| Runtime and existing adapters | 13 | Relocation, persisted team status, exact inventory, forged manifest/code/dependency, thin-host injection and path checks |

Exact command, output and final hashes: [final-source-regression.json](final-source-regression.json). Controller source SHA-256: `b73c1468845c04c9193b7cf4a1d6405d7fd932eebaaf5346d6dddf789218f344`.

This is not a claim that a single final-source `npm test` invocation passed every repository test. Earlier in this turn the unaffected 114 CLI cases in crash-atomicity, vertical-slice, codex-execution, codex-candidate, codex-first-baseline and codex-plan passed. They were not rerun after the final team-only barrier correction. The final run covered that changed command and shared core/Gate/governance/package regressions; this snapshot distinction is intentional.

Source Skill validation, 6 doctor unit tests and 13 historical Python integration experiments also passed. Those experiments do not prove production Codex recovery or installed-host readiness. [Python and byte-preservation evidence](final-python-and-preservation.json).

## Preserved failures and review

The earlier combined build/typecheck/core/CLI run exited 1: its core 161 passed and CLI/skill had 149 passed, 3 failed. All three failures were existing governance tests exceeding their unchanged 5000 ms timeout: historical duplicate assessment ID, recycled unrelated evidence hash, and recycled prior-resolution evidence hash. They subsequently passed in two separate serial governance runs, including the final 21/21 above. No timeout was raised, threshold relaxed or failing case removed. Timing under load is not proven causal by this evidence; no CPU/process measurement is claimed. [Failed combined output](post-review-combined-run.json), [first serial rerun](serial-partitions-before-reconcile-fix.json).

Behavioral RED and fixture-only setup/oracle errors are distinguished in the [team review fixes](review-fixes.md), [Gate barrier report](gate-barrier-fix.md), and [runtime report](runtime-report.md). The original generic dry-run dispatch concern was explicitly retracted after source inspection; it was not a production defect fixed in this turn.

The separate [independent review](independent-review.md) found no remaining Critical, High or Medium issue in this bounded seam at the final source hashes. That reviewer inspected source/tests/evidence and did not personally rerun the broad suite; the final runs here belong to the integration owner. This review does not certify full-v1 readiness or eliminate all possible defects.

## Final package

Built from the freshly compiled, settled source:

```text
/private/tmp/leo-dev-c3-delivery.29T5ni/codex/leo-dev
```

The build, trusted-current-input package verifier, official plugin validator and official Skill validator all exited 0. Runtime has 1262 inventoried files. Manifest source digest: `6b9c2af8e056c61a5bc007e579e065e63286d53449991947c803678c0c980d32`; package digest: `0caccb9ba51ce834a0de93b552c84bcbdaad00c447729df038375f02874e4c4b`. Packaged controller and current compiled controller both hash to `8007f612dfa6936e02301845012303be555a12b8acbd2f0c02611058b6c5a113`.

Main ran fresh packaged CLI processes using the fixed Node executable `/Users/leo/.nvm/versions/node/v22.22.2/bin/node`: help, team status, ordinary status, exact-record dry-run and replay all returned their expected success codes. Team remained revision 12 with architect generation 2, three delivered messages and two pending messages; lifecycle remained triage with no tasks/runs. Journal and snapshot bytes were unchanged. [Exact package commands and outputs](final-package-verification.json).

Earlier actual fresh-agent reconstruction and manual package-consumer responses are preserved in [the host sample](live-20260910/README.md). Those agents consumed earlier package snapshots, not this final Gate-corrected package. The final check above is fresh CLI-process verification, not a new Agent observation or installed-client discovery. Node 20 itself was not executed; package prerequisite is >=20 and this live package check used Node 22.

## Delivery boundary

The existing specification/approval hierarchy, single `develop` entry and single journal completion authority are retained. Selective BMAD source adaptation and license are explicit. Team opinions cannot grant permission, complete a task, reset its budget or replace a current independent review receipt. The source has not been installed into the current Codex cache.

Unchanged evidence includes the controlled live fixture's Spec/source/tests/unrelated note, frozen journal copy and historical approval receipt. There was no Git commit/push, installation, global configuration change, new service, deployment or external publication.

Next on the approved plan: safe expired-submitted-review recovery and the unchanged dependent implementation/rejection/fresh-context case; then constitution and continuous Spec/design convergence with the complete governed vertical. Full-stack/training/Agent, installation and GitHub distribution keep their separate acceptance/authority gates.
