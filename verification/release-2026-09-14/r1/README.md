# R1 local verification — 2026-09-14

Scope: Standard/Full design admission and task-review policy only. This record does not cover R2 release finalization.

## Implemented contract

- A normalized task plan accepts Lite, Standard, and Full tasks without replacing their routed risk. Each task still names exactly one Gate.
- `role: integration` is optional and legacy plans remain valid. A declared integration task is unique, has no successor, and transitively depends on every other task.
- `transition --to design-review --design <repository-relative-path> --session <producer-session>` captures an immutable source path/bytes hash, current specification authority hash, normalized routed-plan hash, and producer session in the existing controller journal/batch.
- `transition --to design-approved --receipt <path>` accepts a current, exact, non-expired, non-reused independent platform receipt or a human-confirmed receipt. The receipt binds `changeId`, `specHash`, `planHash`, `designHash`, and `producerSession`, plus `receiptId`, provenance, actor/session, verdict, findings hash, timestamp, and expiry.
- `status` and dry runs expose `designReviewContext`. Non-Lite task-ready and claim admission recheck current design bytes and authority. A revision changes `specHash`, so it cannot carry the prior design evidence forward.
- Standard/Full task review now uses the routed task risk. Platform review requires a recorded, distinct implementation session; a human-confirmed review remains accepted. Full review additionally requires independently attributable architecture, security, and NFR assessment receipts bound to the same submitted candidate.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| TDD red | `npm run build && vitest run --no-file-parallelism tests/cli/codex-design.test.ts` before implementation | Failed as expected: Standard route was rejected as “not a valid Lite task”. |
| Standard review policy | `./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-design.test.ts -t 'Standard review rejects'` | Passed: 1 passed, 3 skipped, 11.36 s (16:32:47). |
| Full review composite | `./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-design.test.ts -t 'Full review refuses'` | Passed: 1 passed, 3 skipped, 11.42 s (16:33:05). |
| Design route, expiry and freshness | `npm run build && npm run typecheck && ./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-design.test.ts -t 'routes Standard without downgrade'` | Passed: build, typecheck, then 1 passed/3 skipped in 16.32 s (16:34:11). |
| Non-Lite revision reapproval | `./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-design.test.ts -t 'non-Lite revision invalidates'` | Passed: 1 passed, 4 skipped, 16.59 s (16:37:31). The case keeps task revision/budget projection, rejects direct task-ready, refuses a consumed revision receipt as design evidence, then accepts fresh design approval. |
| Interrupted design transition recovery | `./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-design.test.ts -t 'recovers a pending design-review batch'` | Passed: 1 passed, 5 skipped, 9.31 s (16:38:14). It resumes a prepared design-review batch and preserves a third-value manifest while refusing an after-projection design-approved recovery. |
| Type check | `npm run typecheck` | Passed, exit 0 (16:30). |
| Legacy plan spot regression | `./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-plan.test.ts -t 'unassessed legacy plans remain explicitly not-assessed'` | Passed: 1 passed, 18 skipped (16:28:26). |
| Revision receipt spot regression | `./node_modules/.bin/vitest run --no-file-parallelism tests/cli/codex-spec-revision.test.ts -t 'rejects a duplicate or direct orphan revision receipt'` | Passed: 1 passed, 56 skipped (16:28:50). |

The focused public tests cover Standard route preservation, direct non-Lite task-ready refusal without a journal write, repository-path escape refusal, expired and wrong design binding refusal without a write, platform self-review refusal without a write, fresh source drift refusal, the positive independent receipt path, invalid integration dependencies, Standard agent/same-session review refusal without consuming the attempt, and Full partial-composite refusal followed by the three-assessment positive path.

## Verification limitation

Two broader affected-suite commands were superseded after this worker launched a later focused verification; they were stopped without treating the absence of per-file output as a deadlock. They were: the three-file plan/review/revision group started 16:22:50, and a duplicate design invocation started 16:23:54 after its build/typecheck had completed. The root release owner will run the frozen full affected group and final configured suite.
