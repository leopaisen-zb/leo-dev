# Final verification record

Candidate source:

```text
tests/cli/board.test.ts
SHA-256 36fe8307180eba20cb81b56770b9a67104d882478f950ecc17c506d65f754650
```

The pre-change source archive is `board.test.pre-hook.ts` with SHA-256
`d629950f5de9a74760b971d5aeb731d85a44dcf585b8f2f4d26b870524d4f850`.

Focused verification used Node
`/Users/leo/.nvm/versions/node/v22.22.2/bin/node`:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node node_modules/vitest/vitest.mjs run --no-file-parallelism tests/cli/board.test.ts --testNamePattern 'displayed review receipt has a forged candidate binding|normally admitted (lite|standard) review'
```

Result: exit 0; three target cases passed. Raw output is
`affected-three-after-review.log`, SHA-256
`0c6e1515523aef294b397cc80f94a759a65a01a145a5a300b57aff212850c798`.

Full board verification used the same Node binary and host loopback:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node node_modules/vitest/vitest.mjs run --no-file-parallelism tests/cli/board.test.ts
```

Result: exit 1. The three repaired cases passed, while six other existing
default-5000-ms cases timed out under full-file load and an `afterEach` cleanup
reported ENOTEMPTY. This command was not retried. Raw output is
`board-full-host-after-review.log`, SHA-256
`dc494c0487ed0228e1db290a55daf0ab4f125629fde48e58cc396245c5d5397a`.
