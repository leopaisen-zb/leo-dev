# Q3 oracle baseline evidence

Recorded before any repair actor ran. The candidate application root is explicit; the oracle creates one fresh temporary data directory per run, starts its own `127.0.0.1` child server on port `0`, restarts that child during the future-timestamp check, and removes only that temporary directory after completion.

## Fixed inputs

- Protocol: `experiments/codex-quality/protocol.md` — SHA-256 `ce289bb5aa497f20cee1ee62852ded2114543a0247b344ac7833abcc5a0595ad`
- Fixture provenance: `experiments/codex-quality/fixture-provenance.json` — SHA-256 `a755884bb8dd31cff3794b01bd79c74fd42b6f475ff60341805b601a4dcf303b`
- Oracle: `experiments/codex-quality/oracle/behavior-oracle.mjs` — SHA-256 `8989c3a5e1d3a36b7028ad9e0d4cd945207e99c895c3ddad4fe45b96db999033`
- Valid calibration artifact: SHA-256 `4d0edf52684f4283b7463fbbd3f9e2b067199a4e3e7930334c9e77394d5368bf`
- Invalid calibration artifact: SHA-256 `3b9996d3a54abffcc7bd78c8cfeeb50f6d7101297eb0ef016d612c919197e1e0`
- Node: `/Users/leo/.nvm/versions/node/v22.22.2/bin/node`

## Commands and evidence

```text
/Users/leo/.nvm/versions/node/v22.22.2/bin/node experiments/codex-quality/oracle/behavior-oracle.mjs --app-root /Users/leo/plugins/leo-dev/examples/mochi-board
exit 0; outcome pass

/Users/leo/.nvm/versions/node/v22.22.2/bin/node experiments/codex-quality/oracle/behavior-oracle.mjs --app-root /Users/leo/plugins/leo-dev/experiments/codex-quality/fixture
exit 1; refusal surfaced while editing an imported future/calendar-boundary task because the seeded implementation wrote a backward `updatedAt`, making the persisted task invalid.

/Users/leo/.nvm/versions/node/v22.22.2/bin/node --check experiments/codex-quality/oracle/behavior-oracle.mjs
exit 0
```

The detailed initial outputs are retained in `oracle-green.log` and `oracle-red.log`. An initial sandboxed run was blocked by `listen EPERM` on `127.0.0.1`; the recorded baseline commands used the task-authorized scoped loopback execution approval. No host clock changes or timeout-threshold changes were made.

The oracle checks only three focused public behaviors: the valid future/calendar-boundary import → edit → restart → export → import path, ordinary create/edit/export behavior, and atomic refusal of a mixed invalid import. It does not replace the broader existing acceptance suite.

## Material ambiguity

The fixed protocol requires `updatedAt` not to move backward, but does not prescribe whether an update made while the wall clock is behind a future imported timestamp should retain the literal prior timestamp or choose a later representable value. The oracle accepts the contract's minimum literal outcome: it must preserve the imported future timestamp rather than move it backward. No protocol threshold was changed.
