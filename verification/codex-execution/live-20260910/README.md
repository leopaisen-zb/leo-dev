# Controlled Codex exercise — failed workflow acceptance

Date: 2026-09-10 (Asia/Shanghai). **Outcome: NOT PASSED.** Explicit user authorization was obtained and an actual implementation plus independent review ran. Task A's code passed, but its expired lease prevents workflow acceptance and there is no supported continuation for that state. B/C, injected-review remediation and fresh-context C continuation were not executed. Do not substitute the earlier 310-test source regression for this live result.

## What actually ran

| Stage | Observed outcome |
| --- | --- |
| Fixture/authorization | Seven immutable inputs and three seed modules matched the prior baseline; explicit local approval accepted; `live` transitioned to executing |
| Actual A implementation | Separate Terra/high agent claimed A, observed the fixed test RED, changed only `src/quantity.mjs`, obtained Gate success and submitted the candidate |
| Cross-context status | Main's Node25 launcher was refused; using the worker's exact existing Node22 launcher restored status without changing evidence or environment |
| Independent A code review | Separate Sol/high agent: code PASS, public tests 2/2 and boundary probes passed, no code findings, source hash unchanged |
| Review acceptance | Lease expired before review report persistence; actual dry-run and non-dry-run review both exited 5, `CONFLICT: Submitted candidate lease is no longer current` |
| Recovery | `resume` exited 0 `RESUMED` but left the task `review-required`; dry/actual re-claim both exited 5 `Task is not claimable` |
| Whole fixed application suite | Exit 1: 6 tests, 2 passed and 4 failed. The four failures are the unchanged, unimplemented B/C seed behavior, not regressions introduced by A |
| Preservation | Seven immutable inputs, all 160 inventoried production files, installed Skill entry and historical plugin approval unchanged; Git HEAD/index preserved; only fixture `src/quantity.mjs` changed |

The independent report separates **code PASS** from **workflow REJECT**. Main did not manufacture a passing review. A fresh, agent-asserted **reject** diagnostic receipt bound to that real report was submitted solely to verify the expiry refusal. It was not ingested: the journal hash remained `735a1f8b2803da3812b4f3105b12c7fa85b52e0c54bb48d920b2cf3328fd2e07` across the refused attempts. No failure-budget event or successor unlock was forced.

## Blocking findings

### 1. Expired submitted candidates have no supported recovery path

A was claimed at approximately 18:11:18 UTC with an explicitly selected 600,000 ms lease, expiring at **2026-09-09 18:21:18.211 UTC**. Gate success was durable at 18:12:39 UTC. The reviewer checked the current candidate at 18:21:14 UTC and explicitly confirmed expiry at 18:22:11 UTC before finalizing its report. These are recorded clock observations, not a claim about uninterrupted agent CPU time or the cause of any scheduling delay.

The refusal itself is the intended freshness protection. The liveness gap is that successful submission retains the implementation lease, review requires it unexpired, and no renewal/re-claim transition exists for an expired `review-required` task. `resume` can report success while leaving that unrecoverable state intact. Increasing TTL before a future test could reduce exposure, but cannot recover this candidate and is not a correctness fix.

Root's actual CLI probes are corroborated by a separate read-only Terra/high code audit:

- `controller.ts:993` (`assertReviewCandidate`) checks the submitted candidate and active, current, unexpired lease.
- `controller.ts:1250` (`claimAdmission`) accepts only ready/remediation tasks and refuses an active projected lease regardless of expiry.
- `controller.ts:1779` (`resume`) repairs existing crash/journal/Gate handoffs; it does not renew or fence an ordinary expired submitted lease.
- `resolve`/`waive` record unapplied receipts, `transition` is change-scope-only, and `reconcile` requires an unknown Run/blocked task/approval-required change. None is a legitimate repair path here.

No task/lease/clock/log edits, stale-evidence refresh, forced state transition, or replacement fixture was used to hide this result. The next required production work is a reviewed safe expired-owner handoff that preserves candidate identity and fences stale workers; this test authorization does not itself approve that implementation or a new recovery policy.

### 2. Bare Node selection is not portable across these actual contexts

The worker's `node` resolved to `/Users/leo/.nvm/versions/node/v22.22.2/bin/node`; main's resolved to `/opt/homebrew/Cellar/node/25.8.2/bin/node`. Historical Gate verification binds `launcherCommandFingerprint` to the current `process.execPath` and launcher source (`gates/runner.ts:722–730`, equivalent terminal check at 840–848). Root recomputation found matching policy and operation hashes but a different launcher hash. The same original Node22 executable restored valid reads; the fixed Gate registry continued to run tests with its original absolute Node25 argv.

This is an observed runtime-selection constraint and inadequate diagnostic/discovery behavior, not corrupt application code or permission to disable binding checks. A stable confirmed controller entry should make this prerequisite explicit. No system default, sandbox variable or Gate definition was changed.

### 3. Help/evidence capture limitations

The source guidance asks agents to discover flags through command help, but the current JSON help returns command names rather than detailed flags. Actual supported commands still worked. This is a non-blocking discoverability finding, not a new flag implementation claim.

The first implementation report retained command observations/summaries, not verbatim historic stdout. The reviewer retained raw source/test output but explicitly omitted unrelated fields from one status capture. Main's later CLI/refusal artifacts contain unabridged tool outputs. These distinctions remain visible; no missing raw evidence was reconstructed and presented as an original capture.

## Artifacts and reproducibility

- Fixture retained: `/private/tmp/leo-dev-codex-live.Kp2bmq`, change `live`.
- Runtime retained: `/private/tmp/leo-dev-c2-live-runtime.1gkxrk/packages/cli/dist/index.js`.
- Controller source `f8dbd2c572fd2b45745e55257d5db94c740ad831ee894c2ad2033825a5f7d440`; compiled controller `a806b227993793f341d382b074a0160e450f030a91af38108a77c59eee0849db`, unchanged from the reviewed C2 source. Existing dependencies are symlinked, not separately vendored or newly installed.
- Candidate A source `3fdbc800a7a36658536b40b2972f67ce1f14cc9d034d302a881cc9fafd565371`; Run `run-37ef1942-8850-431a-b054-bade9b167fac`; revision/generation 1; candidate tree `b4122af79847a2fa1c0b232b8650d1f7ce38798e6b4c025e67d0a517187a72e4`.
- [Protocol and setup interventions](protocol.md), [explicit approval](spec-approval.json).
- [A implementation](a-implementation.md), [implementation observations](a-operations.json), [independent review](a-review.md), [review operation evidence](a-review-operations.json).
- [Coordinator operations](coordinator-operations.json), [follow-up operations](coordinator-operations-followup.json), [launcher diagnosis](root-launcher-diagnostic.json).
- [Resume/re-claim evidence](expiry-recovery-operations.json), [actual review refusals](expired-review-refusal.json), [full fixed acceptance result](public-acceptance-at-blocker.json), [preservation](preservation-final.json).

Relevant read-only status command:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node /private/tmp/leo-dev-c2-live-runtime.1gkxrk/packages/cli/dist/index.js status --repo /private/tmp/leo-dev-codex-live.Kp2bmq --change live --json
```

## Scope and routing limits

Caller-supplied routing successfully used `/root/live_implementation_ab` (`gpt-5.6-terra`, high), `/root/live_reviewer` (`gpt-5.6-sol`, high), and read-only `/root/live_expiry_diagnosis` (`gpt-5.6-terra`, high). Implementation and review were genuinely separate platform contexts. This is a source-loaded, coordinator-managed exercise, **not** fresh installed-client discovery, a fully unattended task runner, a cross-client guarantee or a reliability estimate. Token/cost counters were not exposed by the delegation tools and are not invented. UTC observations and command durations are retained where available; wall-clock gaps are not attributed to model work without evidence.

No controller/Skill production implementation was changed, no dependency installed, and no network, user Git-history mutation, publication or deployment was performed. All B/C and recovery acceptance beyond this blocker remains **not run**. The public four failures remain disclosed. Linux, Node20, installed Codex discovery, Claude/Cursor, full-stack/training/Agent domain quality and release readiness were not evaluated.
