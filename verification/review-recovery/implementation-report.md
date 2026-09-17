# C3.3 expired submitted-review recovery — implementation handoff

Status: implementation and tests preserved for main-thread completion; this report is not final acceptance.

## Contract implemented in the current workspace

The current source exposes `resume --change ID --task TASK --recover-review [--dry-run] [--json]`. Recovery is represented by one `controller.review.recovered` operation in an `expired-review-recovery` controller batch. The payload binds the original submitted candidate plus claim, candidate, Gate result, Gate terminal/attempt, evidence and submit event hashes. `state.reviewContext` retains the submitted receipt fields and adds only `recoveryId`; recovery time and evidence metadata are exposed separately as `state.reviewRecovery`.

Review admission now distinguishes unrecovered and recovered submissions: an unsolicited `recoveryId` is refused before recovery; a recovered submission requires the exact ID and a receipt timestamp no earlier than the committed recovery event. The original projected lease remains active with its original generation and expiry until ordinary review pass/reject. The recovery source includes committed-batch provenance/history checks, exact replay behavior, pending recovery completion, current-tree checks, and local recovery CAS conflict mapping. No GateRunner, lifecycle transition, lease implementation, dependency, global setting, live fixture, or Git state was intentionally changed.

## Files

- `packages/cli/src/commands/resume.ts` — public `--task` and `--recover-review` options.
- `packages/cli/src/controller/types.ts` — parsed `recoverReview` option.
- `packages/cli/src/controller/controller.ts` — recovery binding/history verification, state/receipt fencing, dry-run and actual resume recovery paths.
- `schemas/review.schema.json` — optional nonempty `recoveryId`; no `recoveredAt` receipt field.
- `tests/cli/codex-review-recovery.test.ts` — compiled-CLI fixture and behavioral cases.
- `verification/review-recovery/red-evidence.json` — RED and invalid preliminary-run evidence.

Before-source snapshot: `/private/tmp/leo-dev-review-recovery-before.5OZhSJ` (`src/`, `schemas/`, `schema-tests/`, and `cli-tests/` mirror their repository locations). The repository has no usable commit/HEAD range for this work; compare files against that retained snapshot rather than inventing a commit range.

## Contribution split

The implementation worker wrote the first behavioral test and observed the valid RED, then added the public resume options, controller option type, review schema field, core submitted-history/recovery-batch binding verifier, recovered receipt fencing, separated state metadata, pending recovery validator, and the expanded focused test source.

Immediately before the controlled handoff, the worker completed the parameter-presence and TypeScript narrowing corrections identified by main, then explicitly released the production files with no pending patch. Main completed the actual `recoverSubmittedReview`/`resume` connection, ordinary-resume pending/committed recovery prevalidation, the global settled-lane check, and local CAS-to-`CONFLICT` handling. Main reported an intermediate `npm run build && npm run typecheck` exit 0 before one later ordinary-resume dry-run validation edit. That report is coordination context, not fresh final evidence from this worker. This paragraph's contribution attribution was corrected by main against the actual handoff message.

## TDD evidence

Valid RED command:

```text
npx vitest run tests/cli/codex-review-recovery.test.ts --fileParallelism false
exit 1
```

The synthetic fixture ran a real local Gate process, recorded its successful result, submitted the candidate, waited for the 15-second lease to expire, and then invoked the compiled public recovery command. The assertion failed at the intended missing-capability boundary:

```text
process exit 2; VALIDATION_ERROR; error: unknown option '--task'
```

This proves the test did not fail on Gate execution, candidate registration, submission, receipt path, or expiry setup. Full structured evidence is in `red-evidence.json`.

Two earlier runs are not feature REDs and must not be counted:

1. A 2-second lease expired before submit, producing `CONFLICT: Current active lease is required before submit` (test command exit 1).
2. After raising the lease TTL, Vitest's default 5-second test timeout fired during the bounded expiry wait (test command exit 1).

The fixture was corrected to a 15-second TTL and a 30-second timeout before the valid RED. Receipt files were moved outside the repository fixture so post-claim review receipts cannot change the canonical candidate tree.

## Current focused test inventory

Written but not run against the integrated production source:

- malformed option pairing, including empty/whitespace `--task` and dry-run, with no runtime creation;
- review schema accepts only an optional nonempty `recoveryId` and refuses `recoveredAt`;
- unexpired recovery refuses without journal mutation;
- expired ordinary review and unsolicited recovery ID refuse without journal mutation;
- recovery dry-run writes nothing;
- actual recovery preserves original Run/lease/attempt context, task states and Gate event hashes;
- the expired lane remains occupied; old worker Gate/submit calls remain fenced;
- exact recovery replay returns the same ID with no new event;
- exact recovered receipt passes, releases the original lease and unlocks only the dependent successor;
- recovery after `done` refuses without a new event.

These assertions are present in the current test file but have **not** earned GREEN status. No build or test process remains active.

## Checks and status

| Check | Status | Evidence |
| --- | --- | --- |
| Baseline build and existing `codex-execution` 8/8 | Passed before this slice | Recorded in the approved implementation brief; not rerun by this worker. |
| Behavioral RED | Passed as a TDD gate (test intentionally failed) | `red-evidence.json`; command exit 1 at missing CLI option. |
| Current `npm run build` | Not run after final integrated source | Main thread reported an earlier exit 0, followed by another production edit. |
| Current `npm run typecheck` | Not run after final integrated source | Same boundary as build. |
| Focused recovery suite | Not run against integrated source | Main thread owns remaining execution. |
| Relevant existing candidate/expiry/crash regressions | Not run | Main thread owns serial final verification. |
| Live retained fixture continuation | Not run or modified | Main thread owns the protocol and fixture. |
| Independent review | In progress externally to this worker | Main thread dispatched a separate Sol/xhigh read-only reviewer. |

## Remaining required coverage / concerns

The current focused test source does not yet cover the full required matrix. Remaining cases include recovered rejection and next-generation budget preservation; missing/wrong/predating recovery receipts as distinct assertions; controlled exception interruption at both `after-batch-prepared` and `after-batch-projection` followed by a new CLI process; concurrent recovery convergence; Spec/task/registry/evidence/candidate drift; unknown/nonterminal/released/missing lease histories; and forged orphan/duplicate recovery batches.

The batch fault hooks throw a controlled `Error`; tests using them must be labelled **controlled exception interruption plus recovery in a new CLI process**, not an operating-system crash or kill. Synthetic history tests must preserve the existing `readEvents` barriers and clearly distinguish hand-built mutation fixtures from real Gate execution.

No blocker, pending patch, child agent, background process, or active exec cell remained at handoff. No Git write, install, network call, settings change, source fetch, or live-fixture mutation was performed by this worker.
