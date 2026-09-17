# Q1b fix 2 — fresh-claim precedence and narrow context decoding

Date: 2026-09-15

## Verified compatibility boundary

The Q1b rereview identified a possible fresh-claim ordering regression.  It
was verified before changing source:

- `red-current-collision.txt` records the current public CLI returning exit 5
  / `CONFLICT` for a drifted design source plus a same-call repository-escaping
  fresh receipt reference.  The test also confirms no journal or snapshot
  writes.
- `q1a-accepted-public-probe.txt` runs the same public CLI sequence in an
  isolated copy compiled from the accepted Q1a controller.  It returns exit 2
  / `VALIDATION_ERROR`, with no journal or snapshot writes.

The disposable comparison copy is outside the workspace at
`/private/tmp/q1a-controller-precedence-probe`; no workspace source was
replaced.  `order-before.md` records the accepted and pre-fix orders.

## Repair

Fresh claim admission now keeps the accepted order without reading the receipt
early:

1. non-Lite check and raw prior-receipt event presence;
2. controller canonicalizes `resolve(repositoryRoot, reference)`, realpaths
   it, and requires containment;
3. service checks the latest request context, authority, and current design
   source;
4. controller reads/parses/captures the one canonical receipt buffer;
5. service checks reuse, binding, and independence; controller then reserves
   revision receipt IDs.

The service has separate `prepareReceipt` and `acquireReceipt` callbacks.  The
controller owns both filesystem stages.  Ordinary design approval retains its
raw caller-CWD receipt reference.  It and fresh receipt admission now request
only `latestDesignReviewContext`; aggregate history decoding remains where an
existing historical receipt is actually consumed by existing-approved and
recovery validation.

## Checks

- `typecheck.txt`: `npm run typecheck` passed.
- `build.txt`: `npm run build` passed.
- `green-current-collision.txt`: public collision regression passed.
- `green-fresh-byte-binding.txt`: the existing public fresh-receipt
  single-capture/embedded-batch binding check passed.

No whole CLI suite was repeated in this repair; Q2/Q4 own broader verification.

## Modified files

- `packages/cli/src/controller/controller.ts`
- `packages/cli/src/changes/design-admission.ts`
- `tests/cli/codex-claim-continuation.test.ts`
- `verification/codex-quality-update/q1b-fix2-20260915/`
