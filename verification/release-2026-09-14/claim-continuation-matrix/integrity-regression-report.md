# Published claim-continuation integrity regressions

`tests/cli/codex-claim-continuation-integrity.test.ts` promotes three
representative continuation integrity checks into the repository test suite.
It uses ordinary temporary repositories, runtime-contained receipt inputs, the
public compiled CLI, and the existing controller fault-injection seam. It does
not reference private repair fixtures or evidence paths.

The tests cover:

- receipt-byte and reviewed-design drift in an ordinary fresh-review claim
  prepared batch, combined with an incomplete journal tail; public `resume`
  returns `BLOCKED` and preserves both journal and snapshot bytes;
- a receipt that is valid at planning time but expires before preparation;
  the claim rejects with `CONFLICT` and appends no journal bytes;
- a receipt-path race after `readReceipt` returns a passing result: the wrapper
  forwards every capture argument, normalizes the read path with `realpath`,
  then changes the same receipt to `reject`; the claim returns `BLOCKED` with
  no journal or snapshot write;
- an unbatched raw `task.continuation.recovered` guard; public `status` returns
  `BLOCKED` without rewriting the journal.

Executed command:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node ./node_modules/vitest/vitest.mjs run tests/cli/codex-claim-continuation-integrity.test.ts --testTimeout=90000
```

Result: exit 0, 4 passed in 36.90 seconds. Raw terminal output is
[integrity-regression-final-green.log](integrity-regression-final-green.log).

SHA-256 of the test source at this run:

```
9910848697b11012014eb22f6b9782826ddd2f49276fe7e3551ef92fb2d44a25
```

This focused result does not claim full-suite, package, live-example, or final
release acceptance.
