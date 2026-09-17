# Independent review: scoped Board fixture preparation

## Verdict

Accept the bounded test-harness change in `tests/cli/board.test.ts` at SHA-256
`36fe8307180eba20cb81b56770b9a67104d882478f950ecc17c506d65f754650`.
I found no assertion weakening, fixture reuse, risk-binding ambiguity, cleanup
regression, timeout increase, production change, or benchmark-oracle change in
the reviewed delta.

The locked before-image hash is
`d629950f5de9a74760b971d5aeb731d85a44dcf585b8f2f4d26b870524d4f850`,
matching `board.test.pre-hook.sha256`.

## Semantic review

The diff only imports `beforeEach` and `describe`, then moves
`submittedFixture(...)` out of three test bodies and into suite-scoped
`beforeEach` hooks. All CLI calls after setup and all behavior assertions remain
unchanged.

- The forged-review case gets a new Lite submitted fixture before its sole test.
- `describe.each(['lite', 'standard'] as const)` binds each suite directly to its
  risk value. The hook calls `submittedFixture(risk)` with that value; it does
  not infer risk from a test or suite name.
- Each test gets a fresh `prepared` value. There is no cross-test fixture cache
  or hidden state reuse.
- The existing file-level `afterEach` still drains `owned` and removes every
  temporary fixture and receipt registered by the hook or test. A failed hook
  remains covered by that cleanup hook.
- No explicit timeout was added or raised. Fixture construction now uses
  Vitest's hook budget, while the behavior under test stays under the unchanged
  test budget. Reporter durations still expose the complete hook-plus-test
  cost, so this does not support a false performance claim.
- The change does not alter production code, product timing, CLI arguments,
  fixture lifecycle steps, admission inputs, or expected observation results.
  It is a test-structure correction for multi-process setup cost, not a repair
  to the benchmark oracle.

## Verification evidence

The final focused run is recorded in `affected-three-after-review.log` at
SHA-256 `0c6e1515523aef294b397cc80f94a759a65a01a145a5a300b57aff212850c798`.
It passed all three affected cases with 22 skipped:

- forged displayed review: 5018 ms;
- normally admitted Lite review: 4909 ms;
- normally admitted Standard review: 7195 ms.

Those names match the final direct `describe.each` risk binding. The durations
also confirm that the change did not hide total setup cost: two reported case
durations meet or exceed the unchanged 5000 ms test-body budget while still
passing because their fixture work is correctly accounted for as hook work.

The full Board-file run is recorded in `board-full-host-after-review.log` at
SHA-256 `dc494c0487ed0228e1db290a55daf0ab4f125629fde48e58cc396245c5d5397a`.
All three changed cases passed again at 4621, 6751, and 6899 ms. The run as a
whole was not green: 19 passed and 6 unchanged cases failed on the same 5000 ms
default timeout; one of those also reported an `ENOTEMPTY` cleanup error after
timeout. Nothing in the reviewed delta touches those tests or adds work to
them, so this is not a blocker for the bounded three-case structure change.
It does mean this artifact must not be cited as a 25/25 Board pass or as proof
that the prior 518-test command exited successfully.

## Caveat

This review accepts only the scoped harness delta identified by the candidate
hash above. It does not turn the retained 516/518 full-run result into a green
run, and it makes no broader claim that all existing Board tests are stable
under the current host load.
