# Independent review: loopback phase deadlines

## Verdict

Accept the bounded loopback-harness change in `tests/cli/board.test.ts` at
SHA-256
`40837b0875c9eddbfb88a0e1cd4a5a2fb113110046633744b4edb32e1eee776d`.
The locked baseline is
`2ef465f076d5f7b2ad45af454cc0b8a6163fad7ed5b2ca4de68a6e8efad81a69`,
matching the archived pre-change source and recorded hash.

The diff is limited to the loopback lifecycle test. It does not change product
code, other tests, fixture behavior, or the Board observation oracle.

## Contract and deadline review

The former structure gave the entire test Vitest's default 5000-ms deadline
while also allowing the URL-publication phase to consume 5000 ms. A valid
startup near that limit left no time for SIGINT shutdown, stream parsing, or
the existing exit and event assertions. The outer deadline could also preempt
the URL phase's own diagnostic.

The revised test composes three distinct limits:

- URL publication must still happen within 5000 ms.
- After SIGINT, the child must close within 1000 ms.
- The one combined lifecycle test has a 10000-ms outer harness ceiling so both
  phase checks, assertions, and `finally` cleanup can finish.

This raises one outer test timeout, so the earlier tentative statement that no
timeout override should be used is no longer correct. The change does not give
the product ten seconds to publish a URL or weaken shutdown behavior. Startup
retains its original five-second threshold, and shutdown now has an explicit
one-second threshold. The zero exit status, empty stderr, two-event stream,
loopback URL, real fixture root, change ID, and `BOARD_CLOSED` assertions are
all unchanged.

The phase promises clear their timers. The URL phase also removes its temporary
data and error listeners. The existing registered-child `finally` remains in
place, so a phase failure still stops and waits for the owned child before the
file-level cleanup removes the fixture root.

## Verification evidence

The default sandbox run is retained in `full-board-host.log` at SHA-256
`985330d0cdd66bdc476e4c1b30189bbcc41bbfc7e25c9f386dd318e464d37cde`.
Its filename is not treated as an execution-mode attestation. It exited 1 with
24 of 25 cases passing because the loopback child reported
`listen EPERM: operation not permitted 127.0.0.1`. The new phase diagnostic
correctly identified URL publication as the failed phase; it did not report an
ambiguous outer timeout or a SIGINT-close failure.

The coordinating root reports that the second command was executed through an
actual `require_escalated` tool call, outside the network-binding restriction.
Its separate raw output is `full-board-host-escalated.log` at SHA-256
`2050497510976d531a14456833d11426439fde83cab6eae93a6836c57442b94f`.
That run passed all 25 Board tests. The loopback lifecycle case passed in 945
ms; the complete file took 128.92 seconds. No timeout or cleanup failure was
reported.

## Limits of acceptance

This review accepts the hash-bound test-only change and its composed phase
deadlines. It does not reinterpret the sandboxed 24/25 run as green, and it
does not claim that earlier 518-test evidence exited successfully. The 25/25
claim is tied specifically to the separately logged, escalated Board-file run.
