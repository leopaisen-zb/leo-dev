# Claim-continuation public CLI matrix

## Scope

This matrix extends the native three-case continuation test with public compiled
CLI checks for dry-run immutability, refusal write-freedom, fresh design receipt
admission, outcome fencing, and failure-budget continuity. It uses runtime
receipt files so new receipt inputs do not create canonical-source drift before
a claim.

The added helper waits conditionally until a recorded lease or receipt expiry
has actually passed. It does not fabricate a prior time or increase any product
lease TTL.

## First compiled run

Command:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node ./node_modules/vitest/vitest.mjs run tests/cli/codex-claim-continuation.test.ts --testTimeout=90000
```

The terminal result in [compiled-matrix.log](compiled-matrix.log) was exit 1:
the three native handoff tests passed and all three newly added tests failed.

One failure is a confirmed production defect. After three failed Gate attempts,
the public status correctly reports `consumed: 3` and `nextKind: fresh-debug`.
The test claims a fresh-debug Run under `fresh-debugger`, waits for its expiry,
then uses `claim --supersede` with `producer-one`, a session from an earlier
attempt. This must fail because fresh-debug requires a session distinct from
every earlier claim. The compiled CLI instead returned `CLAIMED`, made a fifth
generation, and recorded its new claim as `attemptKind: initial`.

The other two first-run failures were fixture timing errors, not product
findings: an 80ms lease expired before a real Gate could start, and a 100ms
design receipt expired during the multi-command setup itself. The test now uses
a 1000ms lease for the real-Gate outcome fence and records a 15-second design
expiry before conditionally waiting for it. The contract assertions are
unchanged.

## Fixture-corrected rerun

The same fixed-Node command was rerun against the still-frozen compiled dist.
Its terminal output is [compiled-matrix-rerun.log](compiled-matrix-rerun.log):
exit 1, with 5 passed and 1 failed in 84.74 seconds. The dry-run/refusal,
outcome fence, and fresh-receipt checks now pass. The only remaining failure is
the confirmed fresh-debug historical-session defect described above.

## Additional public-contract draft, not yet run

The matrix now also contains these unexecuted cases, intentionally held until
the producer rebuilds a source-consistent dist:

- two real concurrently spawned `claim --supersede` CLIs yield exactly one
  replacement; the winner fences the old Run, retains dirty allowed source and
  consumed budget, then completes Gate, submit and independent review through
  public commands;
- an ordinary fresh-design-receipt claim dry-run leaves journal, snapshot and
  receipt bytes unchanged;
- an unexpired old Run and an expired Run with an out-of-allowed-path source
  change both refuse with no journal/snapshot writes;
- a prepared supersession that ingests a fresh runtime receipt rejects both
  receipt-byte drift and an appended incomplete journal tail through public
  `resume`, without truncating that tail;
- after the fresh-debug old-session refusal, a genuinely new session must
  supersede successfully while retaining `consumed: 3` and
  `attemptKind: fresh-debug`.

These cases are drafted against the public CLI and the existing fault-injection
seam only. They have no result yet and are not represented as current evidence.

## Required next run

After a producer fixes the confirmed fresh-debug continuation defect, rerun the
same command. Passing this file will still not replace the frozen full suite,
independent review, or the live Mochi continuation acceptance.
