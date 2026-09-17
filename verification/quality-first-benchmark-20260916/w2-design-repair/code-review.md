# W2 candidate A design repair: independent code review

## Verdict

**ACCEPTED.** I found no blocking correctness, security, or state-integrity defect in the bounded W2 candidate.

The implementation admits only the exact `design-review -> spec-approved` repair edge. `rejectDesignReview()` reuses the current non-Lite authority/context, source-current, receipt-schema/time, unused-ID, exact-binding, provenance, and independence checks while requiring `verdict: reject`; ordinary approval still requires `verdict: pass`. The controller invokes the reject path only from the exact source state, then places `receipt.design-review.ingested` before `change.transition` in one existing controller batch.

The rejection path does not create or renew specification authority. Its manifest and spec projections retain their existing `approvalRef` and `approvalHash`, and it creates no task projection, so task states and revisions remain unchanged. The later public path still requires a new design-review request bound to repaired bytes and a fresh passing receipt before `design-approved`; non-Lite `task-ready` and claim admission remain unreachable from the rejected state/history alone.

Dry-run receipt selection is state-aware: `spec-approved` is treated as a design-rejection target only when the current journal state is `design-review`. The ordinary `spec-review -> spec-approved` approval path is not reclassified by an irrelevant `--receipt`. Invalid, expired, future-dated, reused, mismatched, same-session, wrong-verdict, and source-drift rejection attempts validate before batch preparation and therefore remain write-free. Existing design-event decoding continues to make status and subsequent admission fail closed on malformed persisted design history.

The added recovery tests exercise both supported fault points. After resume, each yields exactly one rejection receipt and one back transition, with the original approval projections preserved. Status and observe accept the valid rejected-design history while leaving the routed task ready rather than treating it as completed.

## Independent verification

- Exact candidate hashes matched the implementation record for all eight listed source, test, and documentation files.
- Focused Vitest review: **7 passed, 19 skipped** across `tests/changes/design-admission.test.ts`, `tests/state/transition.test.ts`, and the selected W2 plus retained source-drift/substantive-revision cases in `tests/cli/codex-design.test.ts`.
- Existing malformed-design-history guard: **1 passed, 13 skipped** in `tests/cli/codex-design.test.ts`.
- `npm run build`: **passed**.
- `npm run typecheck`: **passed**.
- `npm run lint:quality`: **passed**.

## Review limits

The repository-wide long suite and installed benchmark were not run; those remain with the root acceptance owner as planned. This verdict covers the frozen source candidate and focused controller behavior, not benchmark improvement. Receipt provenance and session labels remain unauthenticated local metadata, exactly as documented; this review does not elevate them to authenticated identity.

## Exact candidate hashes reviewed

```text
b084bd8f751f81b23c321e05a666178adade71046d6be955ba28373a4a507df5  packages/cli/src/changes/design-admission.ts
29e2d420697cd8645bdb794b89b1dc356fbbef913c7968d5cf903645d4263abf  packages/cli/src/controller/controller.ts
ffabac991310c3db16261a1bc4a5f6cd16502471103e5dea846ab8689477dccc  packages/cli/src/state/transition.ts
4787a4dc6c5549d559b22a2ad94a15d5de0d99674877d3cf14380ba7527deaa9  tests/changes/design-admission.test.ts
285f3160bfe60dc93d45575925f054254c083e6311a61048885ab197e7eddde7  tests/changes/design-events.test.ts
3b4c327b6b5b848ca7aa73930d0c5dc8fb57c0dc7a221f0bd91f323c90c6a83d  tests/state/transition.test.ts
2e219de69b3418510b3faefcb79e513e1f727ee0aa3bfff0217ce1daebebe159  tests/cli/codex-design.test.ts
3731aa651f10e55d44d741faa2ae758bf73d4dd6b46e7804d4c5aa3c4a64812d  skills/develop/references/lifecycle.md
```
