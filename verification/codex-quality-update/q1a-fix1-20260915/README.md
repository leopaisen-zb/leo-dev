# Q1a fix 1 — empty design source compatibility

Environment: macOS local workspace, `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH`.

The independent Q1a review found that an empty, readable design file is a valid
existing writer input, serialized as `designSourceBase64: ''`. The decoder now
accepts any string whose Base64 round trip is canonical; it still rejects a
non-string or malformed value. `receiptSource.bytesBase64` remains nonempty.

## TDD evidence

- `red-empty-design-public.txt`: public transition with an empty `design.md`
  failed after its request was durably committed, returning `BLOCKED` for the
  decoder's nonempty source check.
- `green-empty-design-public.txt`: after the narrow decoder fix, the same
  public test passed through normal transition, status, prepared-batch resume,
  and post-resume status.

## Final source-only checks

- `typecheck.txt`: `npm run typecheck` — passed.
- `build.txt`: `npm run build` — passed.
- `final-source-only-focused.txt`: `vitest run --no-file-parallelism --exclude '**/verification/**' tests/changes/design-events.test.ts tests/schema/validation.test.ts tests/cli/codex-design.test.ts tests/cli/codex-claim-continuation.test.ts tests/cli/codex-claim-continuation-integrity.test.ts` — passed, 5 files / 41 tests.
