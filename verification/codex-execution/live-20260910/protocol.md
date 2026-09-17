# Authorized controlled Codex exercise — 2026-09-10

User explicitly authorized “授权做隔离测试” after the precise local quantity → cart → JSON CLI approval request. This closes the earlier authorization blocker for this fixture only. No installation, external networking, publication, deployment, user Git history mutation or production-controller change is authorized by this exercise.

Fixture: `/private/tmp/leo-dev-codex-live.Kp2bmq`, change `live`. Requirements, acceptance tests, task plan, notes and Gate registry retain the 2026-09-09 seed hashes. All ten seed files and Git HEAD/index presence were checked unchanged before approval.

Runtime: `/private/tmp/leo-dev-c2-live-runtime.1gkxrk/packages/cli/dist/index.js`, copied from the final reviewed source. Controller source SHA-256 `f8dbd2c572fd2b45745e55257d5db94c740ad831ee894c2ad2033825a5f7d440`; compiled controller `a806b227993793f341d382b074a0160e450f030a91af38108a77c59eee0849db`. Schemas, core and source develop Skill are copied alongside it. Existing root and CLI-local node_modules are symlinked; dependencies were not installed or independently copied. The first snapshot omitted the CLI-local dependency link and failed to resolve commander; adding the existing local link and package manifest restored status. This was harness setup failure, not a product-behavior RED.

## Fixed execution protocol

1. Record the explicit human decision using the current approvalContext; use only the real CLI to approve/transition/claim/verify/submit/review.
2. Separate implementation and review agents. Each loads the source develop entry and applicable references; implementation reuses fixed tests and preserves immutable inputs.
3. A: actual claim, RED observation, implementation, Gate, independent review, acceptance.
4. B: actual implementation first. The coordinator then injects one separately recorded quantity-coercion defect before candidate verification. Fixed public gates intentionally do not cover every boundary. Review must inspect the full specification and independently decide a verdict; rejection is the expected acceptance outcome, not a verdict supplied to the reviewer. It is not an implementer-generated failure claim. C must remain pending and cannot be claimed.
5. New B Run/generation repairs the rejected candidate within the existing budget, verifies and is independently re-reviewed. Only accepted B unlocks C.
6. C: a distinct implementation context writes the candidate, then deliberately stops before candidate registration. A newly spawned continuation context reads persisted state and source, verifies the existing candidate using its original Run, and does not regenerate the implementation. This is controlled context interruption, not an OS crash or a fresh installed-client session.
7. Main runs frozen public tests and the separate review oracle, checks final state/candidate identities/budget, and compares immutable inputs plus Git HEAD/index and installed/source plugin hashes.

All source writes stay within the current task's exact allowedPaths. Receipts and reports stay outside the fixture. No ledger edits, fake sandbox environment, substitute executor, redefined thresholds, new tests inside the immutable fixture, or alternative approval writer. Unknown outcomes stop for supported reconciliation, not blind retry. UI/native/Linux/Node 20/installed-client/production release remain outside this exercise.

Evidence records tool-supplied model/effort, actual agent/task identity, UTC timing, commands/exits/output and read resources. Platform token/cost counters may be unavailable; do not invent them or claim a reliability rate from one sample. The coordinator retains final adjudication; reports are not another task-completion authority.

Pre-B protocol refinement: reading the already-fixed cart gate showed unsafe multiplication is covered, so removing that check would not exercise a green-gate/negative-review seam. Before B began, the planned mutation was changed to quantity coercion, a full-spec violation not covered by that public gate. No fixed test, oracle or requirement was changed. Reviewers receive the specification and actual candidate, not the injection recipe or expected verdict.

## Actual cross-context setup finding after A

Bare `node` resolved to Node 22.22.2 (`/Users/leo/.nvm/versions/node/v22.22.2/bin/node`) in the implementation agent, but Node 25.8.2 (`/opt/homebrew/Cellar/node/25.8.2/bin/node`) in the main shell. A's Gate and submission succeeded in the worker context; main `status` then refused the durable record with `BLOCKED` because its current launcher fingerprint differed. Read-only recomputation showed policy and operation fingerprints matched; only the `process.execPath`-bound launcher differed. Invoking the worker's exact existing Node22 binary in main restored normal `STATUS`, without journal, source, receipt, Gate or environment changes.

All subsequent controller commands in this exercise explicitly use that Node22 launcher. The frozen Gate registry still executes tests with its original absolute Node25 path. This is an observed runtime-selection intervention and a product discoverability/diagnostic limitation, not an automatically solved cross-client capability or a waived Gate check. The first worker's historical command stdout was saved as observed summaries, not native raw output; its report now labels that limitation. Subsequent commands retain raw output. The source guide's help-based flag discovery is also limited: current JSON help returns command names, not detailed flag documentation.
