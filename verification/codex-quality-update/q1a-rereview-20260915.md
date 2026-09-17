# Q1a fix 1 limited re-review — 2026-09-15

Scope: re-review only the repair for the prior empty-design-source Important
finding. No Q1b or unrelated source was assessed.

## Result

The repair is correct and limited. `decodeContext` now accepts an empty
`designSourceBase64` only when it is still a canonical Base64 string. This
matches `captureDesignReviewContext`, which permits any readable design file
and serializes an empty file as `''`. Hash/path/session checks are unchanged.

`decodeSource` remains stricter: `receiptSource.bytesBase64` must be nonempty
and canonical. This is correct because the existing fresh-claim writer calls
`readReceipt` and schema validation before it can emit a receipt source; a
zero-byte receipt file is not a schema-valid design-review receipt.

The public regression in `tests/cli/codex-design.test.ts` covers an empty
design file through normal `transition` and `status`, then through a prepared
batch crash, `resume`, and post-resume `status`. It directly prevents the
prior durable-write-then-BLOCKED failure.

## Independent focused validation

Ran:

```sh
PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH \
  ./node_modules/.bin/vitest run --exclude '**/verification/**' \
  tests/cli/codex-design.test.ts \
  -t 'accepts an empty design source through transition, status, and prepared-batch recovery'
```

Passed: 1 file, 1 selected test (9 skipped). The built CLI contains the same
canonical-Base64 condition as the source. Producer evidence also records the
five-file, 41-test source-only focused run as passed.

## Assessment

The prior Important finding is resolved. No new blocking issue was introduced
by this narrow repair. Q1a is ready to enter Q1b.
