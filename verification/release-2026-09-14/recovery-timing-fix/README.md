# Review-recovery expiry timing fix

## Observed RED evidence

`../final-controller-suite-rerun.log` records the public test
`fails closed on direct, forged committed, and duplicate committed recovery contexts`
as failed. The forged context assertion received `5/CONFLICT` with
`Submitted candidate lease has not expired`, where the assertion requires
`7/BLOCKED`. The surrounding full-suite process was intentionally stopped by
the root coordinator after identified failures (exit 130); it is not a
completed full-suite result.

The failure did not reach forged-payload validation. In
`verifyReviewRecoveryHistory`, the controller derives `recoveredAt` from the
forged batch's `controller.batch.committed.timestamp` and calls
`reviewRecoveryBinding` before comparing the expected recovery payload. The
reported conflict therefore establishes that the forged committed timestamp
preceded the submitted candidate lease expiry.

The prior test helper used one `setTimeout` against `expiresAt + 30ms`. Its
wakeup did not re-check the wall-clock precondition before writing the forged
batch. A host suspension or wall-clock adjustment is a plausible trigger, but
the removed fixture does not preserve enough timestamp evidence to establish
that trigger. This report intentionally does not label it a controller defect
or a measured clock drift.

## Change

`waitUntilExpired` keeps the existing 30ms allowance and now loops, sleeping
at most 50ms before rechecking `Date.now()`. It returns only after the wall
clock is strictly later than `expiresAt + 30ms`. The TTL, controller behavior,
and all direct/forged/duplicate `BLOCKED` assertions remain unchanged.

## Focused verification

Command:

```sh
./node_modules/.bin/vitest run tests/cli/codex-review-recovery.test.ts --testNamePattern "fails closed on direct" --reporter verbose
```

Result: exit 0; 1 test passed and 12 were skipped. The terminal output is in
[`focused-fail-closed-after.log`](focused-fail-closed-after.log).

`focused-fail-closed.log` is an invalid, interrupted attempt: `npm exec`
consumed the Vitest options instead of forwarding them. It has no terminal
test result and is retained only to make the command history explicit.
