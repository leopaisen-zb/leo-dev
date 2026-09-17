# W3 read-only board: independent code review

## Verdict

**REJECTED pending repair.** The journal observation boundary, full controller validation path, end-of-observation journal guard, and fixed loopback HTTP surface are directionally sound. The candidate is not acceptable yet because it can publish `pass` / `matches` for evidence whose own candidate binding is invalid, and because the board omits several fields that specification v1.11.0 defines as the core connected-board value rather than optional presentation detail.

## Findings

### HIGH — Review and Gate freshness labels are not fully bound to the evidence being summarized

`packages/cli/src/controller/controller.ts:2318` selects a review receipt using only its nested `runId`. Lines 2320–2324 then derive `currentCandidate` from the separate `controller.submit.accepted` event and the latest candidate for that Run. They never compare the receipt's own `taskId`, `taskRevision`, `leaseGeneration`, `specHash`, `taskHash`, or `treeHash` with the submit/candidate binding. The ordinary `receipt.review.ingested` path is not semantically revalidated by `readEvents`; `verifyReviewRecoveryHistory` validates the separate recovery record, not every ordinary review receipt.

This produces a false positive with a valid journal hash chain. I created a normal public CLI history through claim, successful Gate execution, and submit, then appended a `receipt.review.ingested` event whose outer task envelope and `receipt.runId` matched but whose receipt task, revision, lease, spec, task hash, and tree hash were all wrong. Observation still returned:

```json
{
  "availability": "available",
  "taskState": "review-required",
  "review": {
    "status": "pass",
    "evidenceRef": "receipt:forged-pass",
    "currentCandidate": "matches"
  }
}
```

Gate matching has a related missing invariant. `boardCandidateStatus` at lines 2276–2280 checks Run, task, revision, lease generation, task hash, spec hash, and current tree, but does not require `candidate.claimInputTreeHash === claimed.lease.inputTreeHash`, an invariant already enforced by `assertCandidateBinding` at lines 2639–2643. After a valid Gate/submit history, I appended a same-Run candidate with the same output tree but a false claim-input hash. Both Gate and review summaries remained `currentCandidate: "matches"` and the observation remained available.

These are direct violations of the requirement that each Gate/review summary earn `matches` from its own Run/revision/lease/candidate binding. A later or malformed record can supply the displayed verdict while another record supplies the green candidate match. Extract and reuse the controller's exact candidate/submit/receipt binding checks. An internally inconsistent evidence history should make observation unavailable; it must not be presented as a current pass.

### HIGH — The observation omits required run, assignment, blocker, revision, and member-activity facts

The controller already records the necessary sources, but the board DTO drops them:

- `Claimed.sessionId` exists at `controller.ts:37`, and `reduceJournal` exposes Run state and lease activity. `BoardTaskObservation` (`packages/cli/src/board/types.ts:14–26`) has only a `runId`. `boardObservationState` selects the latest claim at `controller.ts:2304–2305` and publishes its Run ID at line 2328 without the recorded session/assignment, Run state, or whether the lease is active. A remediation/ready task can therefore display the terminal prior Run without explaining that it is failed/released rather than a current assignment.
- `blocker.recorded` events contain both `blockerId` and `reason`, but line 2336 publishes only `reduceJournal(...).blockers`, which is an ID list. Task records expose only `blocked: boolean`. The required blocker reason cannot be recovered by the client.
- Recorded team events have journal timestamps and operations that identify involved members. `RecordedTeamObservation` (`board/types.ts:28–33`) has no activity timestamp, and the mapping at `controller.ts:2330–2335` strips event time and message participants. The UI at `packages/cli/src/board/assets.ts:15` consequently shows a thread binding without any last recorded activity. It correctly says host liveness is unknown, but it does not implement the separate recorded-activity requirement.
- `currentAuthority` contains the numeric revision, but line 2336 publishes only `authority.revisionId`. That value is `null` for the valid initial revision, so a base change does not expose its actual current revision.

The UI cannot compensate for absent data: task detail at `assets.ts:13` shows only state, task revision, Run ID, and task-level activity; team rendering at line 15 has no activity; and the notice at line 17 can show only blocker IDs. A normal `claim --session producer-A` is enough to reproduce the missing assignment and Run-state fields in `observe --json`.

This is an acceptance blocker under W3, whose explicit purpose is to show actual tasks, recorded assignments, activity, blocker reasons, and current state. Extend the observation contract with the recorded claim session (and a member association only when supported by recorded data), Run state, lease-active status, blocker ID/reason records, per-member last recorded activity, and an honest current revision. Continue to label live host state `unknown`.

### MEDIUM — A successful refresh discards the selected task detail instead of updating it

The client retains only `latest` at `packages/cli/src/board/assets.ts:10`; it does not retain a selected task ID. Every successful response calls `resetDetail()` at line 17 before rendering the new cards. Reproduction: select a task, change its state/evidence, then press Refresh. The columns update, but the detail region reverts to “Select a task” rather than showing the refreshed version of the selected task.

Retain the selected task ID and rerender its detail from the new observation when it still exists; reset only when it no longer exists. The failure path already preserves the last detail and marks the observation stale, which is the correct behavior.

## Confirmed behavior

- `Journal.observe()` uses existing-file `lstat`/read operations and does not create a directory or lock, truncate a tail, or invoke recovery. Replay still truncates an incomplete tail before parsing committed frames, preserving the previous recovery/failure order.
- `Controller.observe()` supplies the read-only replay to the complete `readEvents` validation chain, then checks journal device/inode/size/mtime/digest after downstream projection and source reads. This is the designed best-effort cross-file observation; no atomic filesystem transaction is claimed.
- Missing workspaces, incomplete tails, pending controller batches, source drift, corrupt frames, invalid Gate handoffs, and projection disagreement flow to `availability: "unavailable"` instead of a normal task board.
- The server binds `127.0.0.1`, serves fixed GET paths, rejects foreign Host values and unsupported methods, applies a restrictive CSP, catches observer rejection, and the client renders stored strings through `textContent`.
- Failed/unavailable refreshes preserve the last successful view and mark it stale. Host liveness is always rendered as `unknown`.

## Verification evidence

- `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH npm run typecheck` — **passed** independently.
- `vitest ... tests/cli/board.test.ts tests/cli/board-server.test.ts` — five non-listening tests passed. Three server/listener cases were **environment-blocked** in this reviewer sandbox by `listen EPERM: operation not permitted 127.0.0.1` (the board startup test consequently timed out); this is not classified as a product failure and does not replace the separate real-browser review.
- Two disposable CLI-produced fixtures reproduced the evidence-binding failures above; both temporary repositories were removed after observation.
- The coordinator separately reported `vitest run tests/state` passing 5 files / 54 tests, including the new journal observation tests and the old recovery, fencing, spec-revision-fencing, and transition suites. That supports replay compatibility but does not cover the DTO/evidence semantics in these findings.

The focused tests do not currently cover malformed review-receipt bindings, claim-input candidate mismatch, recorded assignment/Run state, blocker reasons, member activity, base revision, or selected-detail refresh. Add behavior tests at those public seams with the fixes.

## Root scope adjudication

The root reviewer confirms that both **HIGH** findings above block W3 acceptance.

The selected-detail refresh observation is retained as an accurate description of the current interaction, but it is not an original W3 acceptance failure. The prior interaction decision expressly allowed a successful refresh to update or clear the selected task, and clearing the detail avoids leaving stale task content on screen. Root has now selected the small UX improvement of retaining the selected task when it still exists in the refreshed observation and clearing it only when it has been removed. That is a newly selected implementation preference, not a requirement retroactively attributed to the approved specification. The independent verdict remains **REJECTED pending repair** because of the two HIGH findings.

## Fixed-candidate re-review

### Verdict

**REJECTED: HIGH 2 is resolved, but HIGH 1 remains open at the review-receipt boundary.** The repair correctly rejects the two original candidate-field counterexamples and supplies the required recorded operational facts. A review receipt can still produce `pass` / `matches` without being a valid review receipt or belonging to the selected change, so the truthfulness defect is not fully closed.

### Blocking finding — a matching candidate does not make an invalid or cross-change receipt valid

The repaired `boardReviewReceipt` at `packages/cli/src/controller/controller.ts:2308–2318` checks the outer task/revision/lease fields and compares every `SubmittedCandidate` field with the nested receipt. It does not validate the receipt against the review schema or its historical ingestion time. It also does not check the receipt event's `changeId` against the requested change/submission, or require the receipt event to follow the submission.

I reproduced both remaining failures from normal CLI-created claim → successful Gate → submit histories:

1. I appended a receipt whose candidate fields exactly matched the real submission and whose outer task/revision/lease envelope was correct, but whose only additional fields were `receiptId` and `verdict: "pass"`. It omitted required review fields including `provenance`, `actorLabel`, `findingsHash`, `timestamp`, and `expiresAt`. Observation returned `availability: "available"`, `status: "pass"`, and `currentCandidate: "matches"`.
2. I appended a complete schema-valid receipt with every submitted-candidate field exactly matching, but set the receipt event's outer `changeId` to `other-change`. Observation again returned `availability: "available"`, `status: "pass"`, and `currentCandidate: "matches"` for the requested `board` change.

These fixtures use a valid journal hash chain but internally inconsistent review history. This is a local integrity check, not a claim of cryptographic issuer authentication: supported review receipts may remain explicitly unauthenticated under the existing controller policy. Before showing a recorded verdict, observation must establish that the receipt has the valid review shape and semantic timestamp interval, that claim/candidate/submit/receipt outer envelopes belong to the requested change, and that the receipt follows the submission it reviews. Historical receipts that were valid when ingested must remain observable after their later wall-clock expiry. Validate against the recorded receipt-event time (or an equivalent historical decoder), not `Date.now()`.

The original candidate-binding repairs themselves are correct:

- `boardCandidateStatus` now requires `candidate.claimInputTreeHash === claimed.lease.inputTreeHash`.
- Gate and submit evidence route through `assertCandidateBinding`; a missing or inconsistent claim/candidate becomes `OBSERVATION_UNAVAILABLE` / `BLOCKED`.
- A receipt with forged task/revision/lease/spec/task/tree fields is rejected, and multiple receipts for one selected submitted candidate are treated as ambiguous.
- The legitimate old-Gate/new-Run history remains available and labels the old candidate `drifted` rather than borrowing the later Run's candidate.

### Resolved finding — required recorded facts are present

`BoardTaskObservation` now exposes the recorded assignment session, Run state, lease-active state, task activity, and blocker records. The change summary exposes numeric authority revision plus the optional revision ID and blocker ID/reason/time records. Recorded team members and messages carry event-derived activity timestamps, while `hostLiveStatus` remains fixed to `unknown`. The UI renders these values as recorded facts and does not label a member online.

The projection remains read-only. It uses the already-observed event array, pure lifecycle/team projections, candidate binding checks, and repository hashing. `Controller.observe()` still performs the second journal identity/digest read after projection. No mkdir, lock, tail repair, snapshot recovery, controller batch commit, task write, or command execution was added to the observation path.

The selected-detail persistence, narrow-width wrapping, and fixed favicon are acceptable narrow improvements. Selected-detail persistence is still the root-selected UX preference recorded above, not a retroactive original acceptance condition.

### Nonblocking quality finding — the typed server fixture is stale

`tests/cli/board-server.test.ts:8–9` declares its fixture as `BoardObservation` but still assigns string `"r1"` to numeric `change.revision` and omits the newly required task fields `assignmentSession`, `runState`, `leaseActive`, and `blockers`. The repository's ordinary `npm run typecheck` does not include `tests/cli`, so it passes without detecting this drift. A direct no-emit check of that test reports TS2322 and TS2739. Update the fixture so the test remains an honest consumer of the public TypeScript contract.

### Re-review verification

- `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH npm run typecheck` — **passed**; this checks the CLI package and the dedicated routing test project, not `tests/cli`.
- Focused Vitest run for the old-Gate/new-Run case, both original HIGH 1 counterexamples, and the new recorded-facts case — **4 passed, 5 skipped** in `tests/cli/board.test.ts`.
- Direct no-emit TypeScript check of `tests/cli/board-server.test.ts` — **failed as described above** with TS2322 and TS2739.
- Two new disposable CLI fixtures reproduced the invalid-schema and wrong-change receipt defects. Both temporary repositories were removed.
- No build or full-suite command was run by this reviewer; the root reviewer was running the aggregate suite separately, and rebuilding would have changed the frozen runtime under review.

### Exact frozen-candidate hashes reviewed

```text
f889954cbd25d63b739c95a460c0f64101fa224390900b2480564dda2eff3cd3  verification/quality-first-benchmark-20260916/board-implementation.md
57e7181470840e15bfc87b6111bcbd1d851ccd192fc6b2a4cdd3acc7ec2e924b  packages/cli/src/state/journal.ts
f4383d2d7d174c9a8241a522d1c05791f141d9551d4a9b423aee2210d0906e8d  packages/cli/src/controller/controller.ts
860228c153d7889be9a3534f396f65b61026cee0d933a705f59122493f5f844e  packages/cli/src/index.ts
311c6e2da8f386c4b03b05ced1a24516b5843653c34aac9d54277886ee5fb048  packages/cli/src/board/assets.ts
c6705a680f1c3832b2ed166cc9abccab5c5a078bbce8ca548396ce37a15234f3  packages/cli/src/board/server.ts
64678da239e03c782d5e31c88cc87689118db7aa165f9f45fa7c7de922ec080d  packages/cli/src/board/types.ts
7c7e70181aedef1f3560d89dfb55831c2955ff3cafc6b11dc6c7b4ac6131f2e7  packages/cli/src/commands/observe.ts
cc2bf296a80e2d57fd9edb572c0110baffb20ad4a32da8c4fa2717e6fae42dcc  packages/cli/src/commands/board.ts
5ec378b143e98d2d6b6c4c98780a3a0fafd6cabce497aa79e36afd44ae9debf6  tests/state/journal-observe.test.ts
95fc9cc4fb49d3a2d9004d9b15d572739cad8dbcdfccf8ae90992dd744bd958a  tests/cli/board.test.ts
63847dbc2550f10241de137a2a92fc66f4f59bb10da84cc9e88a3c06656af508  tests/cli/board-server.test.ts
```

The root reviewer stopped the concurrent aggregate regression at 04:19:32 after the remaining defects were confirmed. At that point 183 core Vitest tests and 20 Node tests had passed; the CLI segment was interrupted, and the retained exit-143 log is **not** a full-suite pass.

## Second fixed-candidate re-review

### Verdict

**REJECTED: the two previously demonstrated shape/change counterexamples are fixed, but the review-history validator still has three blocking integrity gaps.** The new validator correctly checks the compiled review schema, the outer requested change, the claim → candidate → submit → receipt prefix, submitted fields, and route risk policy. It still re-evaluates nested Full-review assessments against the current wall clock, does not enforce the controller's global receipt-ID consumption rule, and can attach a receipt to a later submit that it precedes.

### HIGH — Historical Full-review assessments are revalidated against `Date.now()`

`validateBoardReviewHistory` validates the main receipt at its recorded ingestion time (`packages/cli/src/controller/controller.ts:2330`), which correctly preserves an ordinary historical receipt after wall-clock expiry. For a Full route, however, line 2360 calls the existing admission-time `fullReviewAssessments`. That helper checks every nested assessment's expiry and start time against `Date.now()` at lines 1895–1896.

I reproduced this through the public CLI. A Full task completed with three independently attributable, candidate-bound assessments whose timestamps and expiries were valid when the controller durably accepted the review. Observation was initially available. After only the nested assessments expired, while the main review receipt remained unexpired, the same unchanged journal returned:

```json
{
  "code": "OBSERVATION_UNAVAILABLE",
  "state": {
    "availability": "unavailable",
    "blocker": {
      "code": "BLOCKED",
      "message": "Recorded review receipt does not satisfy the recorded review policy"
    }
  }
}
```

This is a compatibility failure for legitimately ingested history. Parameterize the composite-assessment check with an evaluation time: admission should continue to use current durable-admission time, while observation must use `new Date(receiptEvent.timestamp)`. The nested assessment interval must have been valid at that recorded time; later expiry must not invalidate the board.

### HIGH — Review receipt IDs are not unique across the recorded receipt history

The controller's ordinary admission rule treats a receipt ID as consumed when it appears in any earlier receipt payload or nested assessment (`receiptIdUsed`, `controller.ts:1442–1449`). The observation validator instead checks only earlier `receipt.review.ingested` events at line 2353, and it receives only the current revision slice.

I created a normal claim → Gate → submit history, then appended a schema-valid, exactly candidate-bound review receipt whose `receiptId` reused the already consumed specification-approval receipt ID. Observation returned `availability: "available"`, review `status: "pass"`, `evidenceRef: "receipt:shared-cross-kind-id"`, and `currentCandidate: "matches"`.

Validate the new review receipt ID against the full strict event prefix using the same cross-kind/nested consumption semantics as `receiptIdUsed`. Prior-revision receipts do not need their old shapes revalidated, but their consumed IDs remain part of the prior history. This enforces local journal integrity; it does not authenticate the receipt issuer.

### HIGH — A receipt before the selected latest submit can still supply its verdict

The per-receipt loop requires exactly one matching submit *before* the receipt (`controller.ts:2334–2335`). Task projection independently selects the latest submit at line 2381, and `boardReviewReceipt` compares fields without checking its sequence against that selected submit (`controller.ts:2308–2318`).

I appended an otherwise valid sequence `submit S1 → matching pass receipt R → identical submit S2`. Validation accepted R against S1; projection then selected S2 and still displayed R as `pass` / `matches`, even though R preceded the submission being summarized. This internally inconsistent sequence cannot be produced by the normal controller path, but it has a valid journal chain and must not be certified by observation.

Require the selected receipt to follow the exact selected submit and reject ambiguous additional submits for that Run/current revision. Existing legitimate review recovery records do not create a second `controller.submit.accepted`, so this does not conflict with the supported recovery history.

### Confirmed repairs and boundaries

- A receipt containing only submitted fields now makes observation unavailable because the review schema is enforced.
- A schema-valid nested receipt in an outer event for another change now makes observation unavailable.
- Candidate, claim, submit, task/revision/lease, outer change, and current source bindings remain enforced for the ordinary single-submit history.
- The Lite/Standard provenance rules and integration-role elevation mirror the existing transition policy. The remaining Full issue is the historical evaluation clock, not the provenance rule itself.
- The board projection remains read-only and retains the journal identity/digest guard. The repair did not add recovery, locking, truncation, controller commits, or command execution to observation.
- The typed server fixture now conforms to `BoardObservation`; its direct no-emit TypeScript check passes.

### Independent verification

- `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH npm run typecheck` — **passed**.
- Direct no-emit TypeScript check of `tests/cli/board-server.test.ts` — **passed**.
- Focused board/journal/server Vitest set — **14 passed; 3 environment-blocked**. The two fixed schema/change tests passed. The three listener-dependent tests failed because this sandbox rejects `listen(127.0.0.1)` with `EPERM` (the CLI startup case timed out waiting for the unavailable listener). These are not classified as product failures and do not independently verify the worker's 17-pass listener claim.
- Three disposable public/runtime fixtures reproduced the historical Full-assessment expiry, cross-kind receipt-ID reuse, and receipt-before-latest-submit defects. All fixture repositories were removed afterward.
- No build or full repository suite was run. The coordinator will run the aggregate suite only after a candidate passes this bounded review.

### Exact second-candidate hashes reviewed

```text
8355ccd62e11a2ac3e77b1a41a392ecd29ef6f66f8ad04c54771ba2e343db622  verification/quality-first-benchmark-20260916/board-implementation.md
57e7181470840e15bfc87b6111bcbd1d851ccd192fc6b2a4cdd3acc7ec2e924b  packages/cli/src/state/journal.ts
b60183055839dd8e0a868c063e8496a69d249f9bd14336886e809a9567c927c7  packages/cli/src/controller/controller.ts
860228c153d7889be9a3534f396f65b61026cee0d933a705f59122493f5f844e  packages/cli/src/index.ts
311c6e2da8f386c4b03b05ced1a24516b5843653c34aac9d54277886ee5fb048  packages/cli/src/board/assets.ts
c6705a680f1c3832b2ed166cc9abccab5c5a078bbce8ca548396ce37a15234f3  packages/cli/src/board/server.ts
64678da239e03c782d5e31c88cc87689118db7aa165f9f45fa7c7de922ec080d  packages/cli/src/board/types.ts
7c7e70181aedef1f3560d89dfb55831c2955ff3cafc6b11dc6c7b4ac6131f2e7  packages/cli/src/commands/observe.ts
cc2bf296a80e2d57fd9edb572c0110baffb20ad4a32da8c4fa2717e6fae42dcc  packages/cli/src/commands/board.ts
e7ba139f36f4abc9b0c6470758264caeee86066acc41c07879d1f2f5f36a69c4  packages/cli/src/schema/validate.ts
10f0a4b12cdaf534bb44fa276260d466e8d393b5919da7002ab9e2f13f81f050  packages/cli/src/state/transition.ts
f70f580d1222f74859a75d391c72b51b0af154cc2cf5282e1e72ce3c6ef1341b  schemas/review.schema.json
5ec378b143e98d2d6b6c4c98780a3a0fafd6cabce497aa79e36afd44ae9debf6  tests/state/journal-observe.test.ts
0691581cf9c62057337e503c7d26d5468c3b8a181866e2ddeee80bd3cf0de8ca  tests/cli/board.test.ts
8fed4fa8d0a19e94e06361a0d0de1a68ec55174087fbdc962a527b73b465d60f  tests/cli/board-server.test.ts
```

## Command-registration regression test review

**ACCEPTED.** The two-line test update accurately incorporates the approved W3 public commands and does not weaken the assertion.

Against the preserved before-image, the only changes in `tests/cli/vertical-slice.test.ts` are:

- the test title now names the observation command category;
- the exact expected command array inserts `observe` and `board` after `inspect`.

The assertion remains `toEqual` on the complete ordered array. It will still fail for a missing command, an extra command, a duplicate, or any ordering change. The expected sequence exactly matches both `commandNames` and the registration calls in `packages/cli/src/index.ts:7–11`, where `registerObserve` and `registerBoard` occur after `registerInspect` and before `registerRoute`. No production source or acceptance threshold changed in this regression-test repair.

The prior full regression result therefore identified stale test expectation rather than a product defect: 183 core Vitest tests, 20 Node tests, and 308 CLI/skill tests had passed before this single exact-list mismatch. The coordinator's whole-file rerun was still in progress when this bounded review completed; its runtime result remains a coordinator gate.

Exact reviewed hashes:

```text
ca3a83220453ecc664ba9b70ec1e7e17d4df1e21c9043002dd9d108a10bd47ba  verification/quality-first-benchmark-20260916/before-w3-tests/vertical-slice.test.ts
033de566fb422a9431bc898b3227d4d73ba03fee5d017b99422dac5e33d3eae1  tests/cli/vertical-slice.test.ts
860228c153d7889be9a3534f396f65b61026cee0d933a705f59122493f5f844e  packages/cli/src/index.ts
```

## Final post-receipt recovery re-review

### Verdict

**ACCEPTED for the bounded W3 code review.** No blocking or nonblocking code finding remains in this review scope. The final three-line recovery change closes the last direction-of-history gap without changing receipt-ID, Full-assessment, lease-clock, or admission semantics. Aggregate regression and browser acceptance remain coordinator-owned gates rather than claims of this code-review verdict.

### Recovery binding verification

`reviewRecoveryReceiptBinding` now receives an optional receipt boundary, defaulting to the end of the supplied history for incoming admission (`packages/cli/src/controller/controller.ts:1814`). It resolves recovery only by the exact submitted event hash and rejects a matching recovery whose index is not strictly between submit and the boundary (`controller.ts:1818–1829`).

Incoming `review` admission still supplies its current complete history and uses the default end boundary. Board history validation supplies the full logical event array plus the exact receipt index (`controller.ts:2379`). Therefore:

- no matching recovery plus no `recoveryId` remains the ordinary valid path;
- no matching recovery plus an invented `recoveryId` is rejected;
- a matching recovery requires the exact ID and a receipt timestamp at or after recovery;
- a matching recovery after the receipt is visible in the full history and is rejected by `recoveryIndex >= receiptBoundary`;
- a valid submit → recovery → receipt chain remains accepted.

The observer continues to use the strict receipt prefix only where it is the correct boundary: prior receipt-ID consumption and historical Full-assessment independence. The fix does not re-evaluate historical leases against the current clock and does not weaken `verifyReviewRecoveryHistory`, which remains responsible for recovery provenance and duplicate-context validation.

The new public regression at `tests/cli/board.test.ts:408–417` constructs the exact previously missed ordering, `submit → receipt without recoveryId → recovery`, and requires observation to be unavailable. Together with the earlier four negative cases and legitimate recovery positive, this covers both sides of the receipt boundary.

### Regression assessment

- The shared helper still serves both incoming admission and observation; the observer adds only the recorded receipt boundary needed for historical certification.
- Normal Lite and Standard admitted receipts remain observable.
- Full admission still rejects expired nested assessments, while an admitted Full receipt remains observable after later expiry.
- All five malformed recovery relationships fail closed, and the legitimate recovered receipt remains available.
- Exact candidate, submit, outer change, current source, global receipt-ID, and route risk/provenance checks are unchanged from the previously reviewed repair.
- The board remains read-only and retains complete `readEvents` validation plus the final journal identity/digest guard.
- The “recorded blockers” label remains an accurate UI clarification with no DTO or lifecycle change.

### Independent final verification

- `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH npm run typecheck` — **passed**.
- Direct no-emit TypeScript check of `tests/cli/board-server.test.ts` — **passed**.
- `vitest run --no-file-parallelism tests/cli/board.test.ts -t 'recovery|normally admitted|nested assessments'` — **9 passed, 15 skipped**. This includes ordinary Lite/Standard/Full, invented/missing/wrong/predating recovery bindings, the valid recovered receipt, and the new post-receipt recovery case.
- The coordinator reports that the combined build passed for this same source candidate; this reviewer did not rerun the build.
- No full repository suite or listener/browser test was run by this reviewer.

### Exact accepted-candidate hashes reviewed

```text
ab2ee718dc8bb1d4114e39223e7893836df52b90823c01ba58e8bba6c4405ee0  verification/quality-first-benchmark-20260916/board-implementation.md
57e7181470840e15bfc87b6111bcbd1d851ccd192fc6b2a4cdd3acc7ec2e924b  packages/cli/src/state/journal.ts
0b7b99c80d26b580fdf5e438f450283475e4f1f0d731a3092b01b55386174131  packages/cli/src/controller/controller.ts
860228c153d7889be9a3534f396f65b61026cee0d933a705f59122493f5f844e  packages/cli/src/index.ts
bd6d97eac4617ac79e609c770fda6b5a08af992a68770ed4ddd892c8bc47ee0a  packages/cli/src/board/assets.ts
c6705a680f1c3832b2ed166cc9abccab5c5a078bbce8ca548396ce37a15234f3  packages/cli/src/board/server.ts
64678da239e03c782d5e31c88cc87689118db7aa165f9f45fa7c7de922ec080d  packages/cli/src/board/types.ts
7c7e70181aedef1f3560d89dfb55831c2955ff3cafc6b11dc6c7b4ac6131f2e7  packages/cli/src/commands/observe.ts
cc2bf296a80e2d57fd9edb572c0110baffb20ad4a32da8c4fa2717e6fae42dcc  packages/cli/src/commands/board.ts
e7ba139f36f4abc9b0c6470758264caeee86066acc41c07879d1f2f5f36a69c4  packages/cli/src/schema/validate.ts
10f0a4b12cdaf534bb44fa276260d466e8d393b5919da7002ab9e2f13f81f050  packages/cli/src/state/transition.ts
f70f580d1222f74859a75d391c72b51b0af154cc2cf5282e1e72ce3c6ef1341b  schemas/review.schema.json
5ec378b143e98d2d6b6c4c98780a3a0fafd6cabce497aa79e36afd44ae9debf6  tests/state/journal-observe.test.ts
6ae7b5cd263a5dfa625a1c47dccbd4616dac8a294ebd70f00621e59c3615f0e7  tests/cli/board.test.ts
8fed4fa8d0a19e94e06361a0d0de1a68ec55174087fbdc962a527b73b465d60f  tests/cli/board-server.test.ts
```

## Recovery-epoch repair re-review

### Verdict

**REJECTED for one remaining direction-of-history gap.** The shared helper closes the four reported recovery-binding cases, but observation passes only the receipt's strict prefix to it. That proves any recovery the helper sees precedes the receipt; it does not prove that the complete validated history has no matching recovery after the receipt.

### HIGH — A receipt without a recovery ID can be certified before a later matching recovery

`reviewRecoveryReceiptBinding` correctly resolves recoveries by the exact submitted event hash (`packages/cli/src/controller/controller.ts:1814–1831`). Incoming admission calls it with the complete history available at admission (`controller.ts:1881`). Observation instead constructs `strictPrefix = events.slice(0, events.indexOf(receiptEvent))` and passes that prefix at lines 2377–2379.

For an internally inconsistent but hash-valid history:

```text
submit S → review receipt R without recoveryId → recovery H bound to S
```

the helper cannot see `H`. It follows its no-recovery branch at line 1822 and certifies `R` because `R` correctly omits `recoveryId`. The complete `readEvents` path can independently validate `H` as a well-formed recovery: appending only a receipt event does not perform the normal review task transitions, so the task can remain review-required and later admit recovery. Projection can then use the certified `R` as `pass` / `matches`, even though the exact submitted candidate has a recovery epoch that did not exist when `R` was recorded.

The four new negative tests cover an invented recovery ID with no recovery, and missing/wrong/predating receipt fields when recovery already precedes the receipt. They do not cover a recovery event after a receipt that omits `recoveryId`.

Resolve the exact submit's unique recovery from the complete validated history, then require that recovery to occur before the receipt boundary. One implementation is to give the shared helper the full event array plus an optional receipt boundary. Incoming admission can retain an end-of-history boundary; observation can pass the actual receipt event/index. The existing `verifyReviewRecoveryHistory` remains authoritative for recovery provenance and duplicate recovery rejection.

This is still a recorded ordering check. It does not require a historical lease to be re-evaluated against the current wall clock.

### Confirmed repairs

- An ordinary submit with an invented recovery ID is rejected by observation.
- A recovered submit with a missing, wrong, or predating recovery binding is rejected.
- The valid recovered-review path remains available.
- Incoming admission and observation now share the same recovery binding predicate for the cases visible to both callers.
- The prior schema, candidate, change, receipt-ID, historical Full, and duplicate-submit repairs remain intact by source inspection.
- The label-only asset change now says “recorded blockers,” accurately distinguishing historical blocker records from current `task.blocked` state without changing the DTO.

### Independent verification

- `npm run typecheck` — **passed**.
- Direct no-emit TypeScript check of `tests/cli/board-server.test.ts` — **passed**.
- Focused board recovery selection — the three recovered negative variants and valid recovered positive passed. The no-recovery negative exceeded its individual five-second test timeout by about 0.1 seconds during the concurrent run; this is recorded as a timing failure, not a product failure and not as an independent 23/23 confirmation.
- Focused public admission/recovery suite — **2 passed, 11 skipped**, covering real recovery plus pre-epoch, wrong-epoch, and predating receipt rejection.
- No build, full suite, listener test, or new fixture was run.

### Exact rejected-candidate hashes reviewed

```text
a099ffd5b6e7d7697861449b90a2a57928e49225839b987363beedad6b8b6259  verification/quality-first-benchmark-20260916/board-implementation.md
57e7181470840e15bfc87b6111bcbd1d851ccd192fc6b2a4cdd3acc7ec2e924b  packages/cli/src/state/journal.ts
150016199b7c7fd4142dc396484eb82c44ea9920e569a9807450658bf6f3ba88  packages/cli/src/controller/controller.ts
860228c153d7889be9a3534f396f65b61026cee0d933a705f59122493f5f844e  packages/cli/src/index.ts
bd6d97eac4617ac79e609c770fda6b5a08af992a68770ed4ddd892c8bc47ee0a  packages/cli/src/board/assets.ts
c6705a680f1c3832b2ed166cc9abccab5c5a078bbce8ca548396ce37a15234f3  packages/cli/src/board/server.ts
64678da239e03c782d5e31c88cc87689118db7aa165f9f45fa7c7de922ec080d  packages/cli/src/board/types.ts
7c7e70181aedef1f3560d89dfb55831c2955ff3cafc6b11dc6c7b4ac6131f2e7  packages/cli/src/commands/observe.ts
cc2bf296a80e2d57fd9edb572c0110baffb20ad4a32da8c4fa2717e6fae42dcc  packages/cli/src/commands/board.ts
e7ba139f36f4abc9b0c6470758264caeee86066acc41c07879d1f2f5f36a69c4  packages/cli/src/schema/validate.ts
10f0a4b12cdaf534bb44fa276260d466e8d393b5919da7002ab9e2f13f81f050  packages/cli/src/state/transition.ts
f70f580d1222f74859a75d391c72b51b0af154cc2cf5282e1e72ce3c6ef1341b  schemas/review.schema.json
5ec378b143e98d2d6b6c4c98780a3a0fafd6cabce497aa79e36afd44ae9debf6  tests/state/journal-observe.test.ts
6ddf45d17bb8b5d5665a713444025529a8f0a8dc4ee27702331f4050f11c6281  tests/cli/board.test.ts
8fed4fa8d0a19e94e06361a0d0de1a68ec55174087fbdc962a527b73b465d60f  tests/cli/board-server.test.ts
```

## Third fixed-candidate re-review

### Verdict

**REJECTED: the three findings from the second re-review are resolved, but the certified review selection still omits the recorded recovery-epoch binding that normal review admission enforces.** This allows observation to certify a receipt that the controller's public `review` command would reject as unsolicited, missing, stale, or predating its recovery context.

### HIGH — Certified receipts are not bound to the exact review-recovery epoch

Normal review admission obtains the recovery for the submitted candidate and applies two explicit fences at `packages/cli/src/controller/controller.ts:1860–1863`:

- without a committed recovery, a receipt must not claim `recoveryId`;
- with a committed recovery, the receipt must contain that exact recovery ID and its receipt timestamp must not predate the recovery event.

`validateBoardReviewHistory` does not apply either fence. Its certification path at lines 2316–2367 validates receipt shape/time, unique current-revision claim/candidate/submit, exact envelopes and submitted fields, global receipt-ID consumption, route risk, and Full assessments. It never associates `controller.review.recovered.payload.submitEventHash` with the exact `submittedEvent`, never checks `receipt.recoveryId`, and never orders or timestamps the recovery relative to the receipt.

Consequently, all of these internally inconsistent histories can be certified and supply the displayed verdict:

1. An ordinary submitted candidate has no recovery, but its otherwise valid receipt claims an arbitrary `recoveryId`.
2. An expired submission has a valid committed recovery, but the receipt omits its recovery ID or names another recovery ID.
3. A receipt names the correct recovery but its receipt timestamp predates the recovery event, or the receipt event itself precedes the recovery record.

The schema permits optional `recoveryId`, so schema validation does not close this gap. `readEvents` correctly verifies the provenance and exact payload of every committed recovery record before board projection (`controller.ts:799` and `verifyReviewRecoveryHistory`), but that validation does not bind a later receipt to the record. The positive board test at `tests/cli/board.test.ts:368–382` proves that the legitimate recovery alternative remains observable; it does not exercise any mismatched recovery receipt. The existing admission tests in `tests/cli/codex-review-recovery.test.ts:324–337` prove that the public writer rejects wrong and predating recovery receipts, making the observer/writer policy mismatch explicit.

For each certified `submittedEvent`, select recovery records whose `submitEventHash` equals that exact event hash. No matching recovery means `receipt.recoveryId` must be absent. One matching recovery means the receipt ID must match, the recovery logical event must fall between submit and receipt, and the receipt timestamp must be at or after the recovery event timestamp. Multiple matching recovery records are already invalidated by the full `readEvents` recovery verifier, so the board should use that authoritative result rather than implement a weaker recovery decision. This remains local semantic integrity and does not authenticate the receipt issuer.

Do not add a new current-wall-clock lease test to observation. Normal admission checks the wall clock before its commit, and the design does not promise an atomic transaction between that check and the recorded receipt event. The missing requirement here is the durable recovery epoch, for which exact evidence is already recorded.

### Confirmed resolved behavior

- Historical Full reviews now evaluate nested assessment intervals at the recorded receipt event time. The focused test admitted a Full review, waited for only the nested assessments to expire, and kept observation available; it also confirmed that admission still rejects already-expired nested assessments.
- Review receipt IDs are checked with `receiptIdUsed` over the full strict logical prefix. Cross-kind reuse and reuse of a prior-revision nested assessment ID are unavailable, while old receipt shapes are not revalidated as current-revision receipts.
- Review certification requires exactly one current-revision claim, candidate, and submit for the Run and uses logical array position for claim → candidate → submit → receipt ordering. The certification map is keyed by the exact submit selected by projection, so `submit S1 → receipt R → submit S2` is unavailable.
- The global outer-change guard rejects any logical event whose change identity differs from the requested journal. Normal Lite, Standard, and Full admitted reviews remain observable.
- The normal expired-review recovery alternative with the correct recovery ID remains observable. The defect is limited to malformed receipt-to-recovery relationships.
- The compact card view keeps task title/state/revision and concise Gate/review status plus candidate state; selecting a card retains the complete recorded assignment, Run, lease, blocker, hash, Run ID, and evidence-reference detail. This UI change does not remove required evidence from the observation or selected detail.
- Observation remains read-only and still runs the complete `readEvents` recovery/history validation before projection, followed by the journal identity/digest guard.

### Independent verification

- `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH npm run typecheck` — **passed**.
- Direct no-emit TypeScript check of `tests/cli/board-server.test.ts` — **passed**.
- Focused semantic subset of `tests/cli/board.test.ts` — **14 passed, 5 skipped**. This independently covered the earlier binding counterexamples, normal Lite/Standard reviews, historical Full assessment expiry, cross-kind and prior-revision ID reuse, duplicate post-receipt submit, legitimate expired-review recovery, and global outer-change rejection.
- Focused `codex-review-recovery.test.ts` admission/recovery checks — **2 passed, 11 skipped**: the real expired submission recovery and its pre-epoch/wrong-epoch/predating-receipt fences.
- No build, listener test, new synthetic approval fixture, or full repository suite was run in this review.

### Exact third-candidate hashes reviewed

```text
044d87d96b711a242d827e875b2faf2aca4bc9197d77dab790e2b87544bd8191  verification/quality-first-benchmark-20260916/board-implementation.md
57e7181470840e15bfc87b6111bcbd1d851ccd192fc6b2a4cdd3acc7ec2e924b  packages/cli/src/state/journal.ts
29e4cd780cebf06968cff4bfc522f8cb8cb62d78997136f760b7b5e36a86ed2a  packages/cli/src/controller/controller.ts
860228c153d7889be9a3534f396f65b61026cee0d933a705f59122493f5f844e  packages/cli/src/index.ts
11d3c6b5440d7b323612ef80615598eb45323ec117b05fd89eabe789a6059a73  packages/cli/src/board/assets.ts
c6705a680f1c3832b2ed166cc9abccab5c5a078bbce8ca548396ce37a15234f3  packages/cli/src/board/server.ts
64678da239e03c782d5e31c88cc87689118db7aa165f9f45fa7c7de922ec080d  packages/cli/src/board/types.ts
7c7e70181aedef1f3560d89dfb55831c2955ff3cafc6b11dc6c7b4ac6131f2e7  packages/cli/src/commands/observe.ts
cc2bf296a80e2d57fd9edb572c0110baffb20ad4a32da8c4fa2717e6fae42dcc  packages/cli/src/commands/board.ts
e7ba139f36f4abc9b0c6470758264caeee86066acc41c07879d1f2f5f36a69c4  packages/cli/src/schema/validate.ts
10f0a4b12cdaf534bb44fa276260d466e8d393b5919da7002ab9e2f13f81f050  packages/cli/src/state/transition.ts
f70f580d1222f74859a75d391c72b51b0af154cc2cf5282e1e72ce3c6ef1341b  schemas/review.schema.json
5ec378b143e98d2d6b6c4c98780a3a0fafd6cabce497aa79e36afd44ae9debf6  tests/state/journal-observe.test.ts
8fcd258c53903ddecd395ef1599f5568f52b3dc5885e3c60777e4745c4fea29b  tests/cli/board.test.ts
8fed4fa8d0a19e94e06361a0d0de1a68ec55174087fbdc962a527b73b465d60f  tests/cli/board-server.test.ts
```
