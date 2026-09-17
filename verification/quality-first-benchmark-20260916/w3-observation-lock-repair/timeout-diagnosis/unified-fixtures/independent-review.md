# Independent review: unified Board fixtures

## Verdict

Accept the bounded test-harness change in `tests/cli/board.test.ts` at SHA-256
`2ef465f076d5f7b2ad45af454cc0b8a6163fad7ed5b2ca4de68a6e8efad81a69`.
The locked baseline is
`36fe8307180eba20cb81b56770b9a67104d882478f950ecc17c506d65f754650`,
matching both the archived source and its recorded hash.

I found no production change, assertion weakening, fixture reuse, risk-binding
ambiguity, timeout-value change, or benchmark-oracle change in this delta.

## Fixture semantics

The change moves setup-heavy preparation into suite-scoped `beforeEach` hooks.
Every hook creates a new root or submitted fixture for the individual test;
the mutable suite variable is overwritten before each case and is never used
as a cache. The Lite and Standard review suites retain direct
`describe.each(['lite', 'standard'])` risk binding and pass that bound value to
`submittedFixture(risk)`.

The moved setup covers the loopback lifecycle, superseded Gate history,
completed Gate observation, displayed candidate/review integrity, malformed
review receipts, recorded claim, normal Lite/Standard review, Full review,
review-receipt history, prior revision review, and duplicate-submit history.
CLI arguments, mutation steps, receipts, expected envelopes, metadata checks,
and all behavioral assertions remain present.

The recovery cases remain in their test bodies. Their six-second lease-expiry
waits and existing 30-second test budgets are unchanged. The existing 30- and
40-second deadlines on the other long cases are also unchanged. No timeout was
added or increased. Moving prerequisite construction into the existing hook
budget separates setup from the behavior deadline, while Vitest's reported
case durations continue to include setup time.

Cheap tests that only need `fixture()` remain in their bodies, except the
loopback test, whose root must participate in ordered child cleanup. This scope
matches the observed failure mode rather than changing every test mechanically.

## Loopback ownership and cleanup

The loopback child is registered immediately after `spawn`, and its `close`
promise is attached at that point. The test retains the SIGINT action, zero
exit assertion, empty-stderr assertion, and both emitted-event assertions.

The test-level `finally` and file-level `afterEach` both use that registered
child. Cleanup targets only children created and registered by this test file.
It sends SIGINT first, falls back to SIGTERM after one second, waits for close,
and only then removes paths from `owned`. This ordering addresses the previous
root-removal race without a process-wide kill or deletion-before-close path.
The normal path is idempotent: after the asserted close, the helper only awaits
the already settled close promise.

## Verification evidence

The full Board-file run in `full-board-host.log` has SHA-256
`e36787757e89ab3b352e25c7207b6ac4613339358cbafeaacfb11cdd60d4c52f`.
It exited 1 with 24 of 25 cases passing. All previously failing
submitted-fixture and recorded-claim cases passed, and the prior `ENOTEMPTY`
cleanup failure did not recur. The sole failure was the loopback case at 5631
ms against its unchanged 5000-ms test timeout.

The isolated loopback run in `loopback-instrumented.log` has SHA-256
`8f8a4bd9d52fb8c9212462d44a24991843998d50f50a83a6f82ac5af0b76346f`.
It passed the unchanged loopback test in 980 ms. Together with the full-run
result, this supports accepting the structure and treating the remaining
full-run failure as timing-sensitive rather than an assertion or cleanup
regression.

The accompanying preloader did not capture child lifecycle timing:
`loopback-child-events.ndjson` contains only its `preloader-ready` event and no
target spawn, stdout, kill, exit, or close records. Therefore this review does
not claim that the instrumentation identified whether the 5631-ms run spent
its time waiting for the URL or waiting for SIGINT close.

## Limits of acceptance

This verdict accepts the semantics and cleanup of the hash-bound test-only
delta. It does not claim that `full-board-host.log` is green, that the Board
file passed 25 of 25 in one run, or that the earlier 518-test command exited
successfully. The retained evidence remains 24/25 for the unified full-file run
and 1/1 for the isolated loopback run.
