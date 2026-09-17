# C2 implementation report

## Scope and boundaries

Implementer-owned C2 controller, command/state integration, and synthetic CLI
regression tests only. No installation, network access, Git mutation, cleanup,
documentation/skill changes outside this report, or live-fixture edits were
performed. The real Codex acceptance fixture and final whole-suite execution
remain main-thread work.

## Original baseline and desired-behaviour RED

The frozen original compiled CLI baseline was recorded by the main thread as
110/110 passing at `/private/tmp/leo-dev-c2-baseline.D6NyCk/cli-results.json`.
This is historical baseline evidence, not evidence for the added C2 requirements.

Before C2, the controller used `Lease.inputTreeHash` for post-implementation
handoff; rejected reviews were not a bounded remediation path; and route/claim
handling was single-task/legacy oriented. The desired C2 baseline test failed
5/5 on the original compiled CLI (unknown `--run`, missing explicit matching
Run, rejected review receipt, and plan routing requirements). After the C2
implementation and candidate repairs, its native Vitest run passed 5/5.

## Implemented C2 behaviour

- A claimed Run keeps claim-time input separate from its durable candidate
  output binding. Gate settlement, submission, review, recovery and candidate
  validation use the candidate bound to the exact Run, including changed trees.
- Gate failure and reviewed rejection share one four-attempt ledger. Attempts
  1--3 select remediation/fresh-debug as applicable; attempt 4 may use only a
  distinct fresh debug session; a fourth failure blocks the task/change; the
  **fifth** claim is refused. Missing earlier session provenance fails closed.
- Plan routing persists per-task routes and unlocks only dependency-ready
  successors; review completion enters integration only after all routed tasks
  are done. Plan/claim/run-gates dry-runs use the same read-only fencing as the
  actual paths.
- Reconciliation of a failed unknown Run charges the same attempt ledger and
  releases its lease. A safe abandoned reconciliation is zero-cost only when
  it is `safeToRetry`, says `sideEffectDisposition: "not-started"`, and the
  bound durable Gate history contains no `gate.attempt.released`.
- Resume has one narrowly fenced exception for an otherwise unsettled Gate
  attempt: exactly a prepared/(optional started), unreleased attempt whose
  exact Run context, complete committed reconciliation batch, old full lease
  abandonment, and old Run `unknown -> abandoned` all match. It is keyed by
  historical `runId`, not the latest context for a task, so multiple valid
  abandoned generations do not invalidate each other. All other unsettled
  Gate histories remain blocked.

## Safe-abandonment RED/GREEN evidence

The first abandoned test attempt used invalid change IDs and is intentionally
not counted as behavioural RED evidence. The corrected cases use valid IDs.

For the corrected three cases, the guard alone was temporarily removed with a
local reversible patch, the selected tests were rebuilt/run, then the exact
guard was restored and rebuilt. Native report
`verification/codex-execution/worker-abandoned-mutation-red.json` records
0 passed, 3 failed, 5 skipped: before the guard, dry-run wrongly accepted each
released unknown as `DRY_RUN` instead of returning `BLOCKED`.

With the restored guard,
`verification/codex-execution/worker-abandoned-green.json` records 3 passed,
0 failed, 5 skipped. The cases cover a durable released Gate prefix plus
`not-started`, `side-effects-absent`, and `failed` receipts; both dry-run and
actual reconciliation fail closed and leave journal, task/change state, lease,
and budget unchanged.

Positive recovery coverage is retained rather than replaced by those negative
cases. The fixture is explicitly labelled synthetic legacy no-release history:
it starts from a real unknown execution then transforms the hash-linked prefix
to a prepared-before-release durable history. It is not a runtime gate
emulator or production exception.

- `worker-safe-abandoned-existing.json`: 1 passed, 0 failed, 25 skipped.
  It verifies a valid no-release `not-started` receipt recovers to ready with
  the old lease abandoned and the next normal claim usable.
- `worker-safe-abandoned-crash.json`: 1 passed, 0 failed, 54 skipped.
  It preserves the atomic recovery assertions: committed reconcile batch only,
  double resume has no journal mutation/duplicate receipt, a successor claim
  has a higher generation, then a second same-task no-release abandonment
  also resumes idempotently and permits a third higher generation. This is the
  regression for selecting the historical context by exact `runId`.

## Final focused evidence for this handoff

```text
./node_modules/.bin/vitest run tests/cli/codex-execution.test.ts \
  --pool=forks --reporter=json \
  --outputFile=verification/codex-execution/worker-execution-abandoned-final.json
```

Result: exit 0; 8 passed, 0 failed, 0 skipped. It includes the A→B→C synthetic
lifecycle, valid review reject → reclaim → pass → dependency unlock, candidate
source evolution/narrow allowed paths, dry-run parity, and the mixed gate/review
four-attempt exhaustion/fresh-session/fifth-claim refusal checks.

The positive crash and vertical focused reports above passed after the final
controller change. The main thread will run the final full suite and independent
review from this frozen source; no full-suite result after the final narrow guard
is claimed here.

## Frozen implementation identifiers

At handoff the relevant source and compiled module SHA-256 values are:

```text
f8dbd2c572fd2b45745e55257d5db94c740ad831ee894c2ad2033825a5f7d440  packages/cli/src/controller/controller.ts
a806b227993793f341d382b074a0160e450f030a91af38108a77c59eee0849db  packages/cli/dist/controller/controller.js
```

No claim is made here for live human approval, a production Codex run, or final
whole-repository acceptance.
