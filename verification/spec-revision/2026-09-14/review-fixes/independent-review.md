# P3 review fixes — independent review

Date: 2026-09-14  
Scope: read-only independent review of RF-01 and RF-02 against `review-before.md`, `implementation-brief.md`, and the sole P3 plan. This review used `/private/tmp/leo-dev-p3-review-fixes-before.96nf94w7/source` as the pre-fix filesystem baseline. It did not use Git history.

## Verdict

No P1, P2, or P3 blocking finding.

The final production/test diff is confined to:

- `packages/cli/src/controller/controller.ts`
- `tests/cli/codex-spec-revision.test.ts`

## RF-01: revision receipt reservation

The controller now rejects a receipt ID already consumed by a committed specification revision before ordinary receipt writers mutate state:

- Dry-run performs the shared reservation check at `controller.ts:646-649`.
- `review` performs the check at `controller.ts:2324-2331`.
- Shared ordinary ingest for `approve`, `waive`, and `resolve` performs it at `controller.ts:2390-2405`.
- `reconcile` performs it at `controller.ts:2407-2413`.
- The reservation predicate is `controller.ts:2316-2322` and returns `CONFLICT` (exit 5), preserving the normal public-request error class.

The reverse direction remains protected by the existing `revise` receipt-consumption test before preparation. Pending receipt validation now includes every pending `receipt.*.ingested` operation at `controller.ts:869-885`; consequently a corrupt pending ordinary batch that reuses a committed revision receipt fails as `BLOCKED` (exit 7) before recovery writes. Non-revision-only legacy duplicates remain accepted by the existing regression.

The CAS/concurrency boundary remains intact: controller batches hold the journal lock and append against the expected tail. If a competing batch advances the tail after public preflight, append fails instead of committing an invalid receipt collision.

Focused regression coverage is concrete:

- `codex-spec-revision.test.ts:716-734` exercises public `approve` using a consumed revision grant in both dry-run and real modes, asserts `CONFLICT`, unchanged journal/snapshot, readable `status`, and successful subsequent `resume`.
- `codex-spec-revision.test.ts:736-755` creates a pending ordinary approval batch using the committed revision receipt and asserts `BLOCKED` plus unchanged journal/snapshot for dry-run and real recovery.

## RF-02: recovery before incomplete-tail truncation

`resume` now calls the existing exact pending-batch recovery preflight before `recoverJournal` can truncate an incomplete tail at `controller.ts:2551-2555`. The locked recovery path continues to validate again before applying projections and committing, so the preflight does not replace the in-lock check.

`preflightControllerBatchRecovery` validates bound source files, the canonical remainder tree, and each projection's prior-or-desired file state including mode. This keeps valid all-prior, all-desired, and mixed projection recovery behavior while refusing source/tree/projection drift before a write or truncation.

Focused regression coverage is concrete:

- `codex-spec-revision.test.ts:303-327` appends an incomplete frame after a prepared revision, introduces bound-source drift or a third-value projection, then checks both dry-run and real `resume` for `BLOCKED`, exact unchanged journal bytes, unchanged projections, and unchanged snapshot bytes.
- `codex-spec-revision.test.ts:329-339` confirms a valid prepared revision with an incomplete tail still recovers.
- Existing recovery tests retain fully desired and mixed projection recovery coverage.

## Optional coverage boundary

The new incomplete-tail cases do not separately construct a remainder-tree drift. The same `validateSpecRevisionRecovery` branch performs that check, and an existing pending-recovery test covers remainder-tree refusal without an incomplete tail. This is an optional coverage addition, not evidence of a production defect or a blocking finding.

## Verification status

This reviewer did not run tests, build, typecheck, package relocation, or installed-package acceptance, because the main reviewer owns the full-suite and packaged acceptance runs. No files were modified by this review other than this report.

Final reviewed SHA-256 values:

- `packages/cli/src/controller/controller.ts`: `e795dc8fa4fb5cc1f3d0401864764fe2165722da7ac7384013af3c2451f350b8`
- `tests/cli/codex-spec-revision.test.ts`: `e2b04b37dd6524ba6b5eaced460dbd8068b85a146d1ee33862596c012f7aa6fa`
