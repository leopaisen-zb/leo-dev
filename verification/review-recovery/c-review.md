# Independent candidate review — `live` / task `c`

## Verdict

**pass**. The current C candidate meets the command-line contract: it accepts
exactly one valid JSON object argument, delegates total computation to B, and
emits exactly the required success or failure output with the specified exit
status and no stderr output.

## Candidate identity and scope

- Change/task/revision: `live` / `c` / `1`; current state `review-required`.
- Run: `run-fa074fe5-eec8-4607-ae2c-646603a993b8`; lease generation `1`.
- Candidate tree hash from the supplied `reviewContext`:
  `32930bb77586660cb668df772782c33345257ce7a0c2a17e98e0e2078e60126b`.
- Current C source SHA-256: `src/cli.mjs` =
  `b833e74961a563691461cad133ff309d807760d679bf883f35588f07f78b7e97`.
- Accepted dependency hashes: `src/cart.mjs` =
  `3f8df7a6df1d04c98957265e3174dd403cb30e7de488db64e80495484d9c9a4d`;
  `src/quantity.mjs` =
  `3fdbc800a7a36658536b40b2972f67ce1f14cc9d034d302a881cc9fafd565371`.
- C's permitted write surface is `src/cli.mjs`; A/B were read-only accepted
  dependencies.

## Loaded resources

- Frozen delivery skill and review references already loaded for this review
  series: `skills/develop/SKILL.md`; `references/review-protocol.md`,
  `references/lifecycle.md`, and `references/codex-team.md`.
- Reviewer contract: `verification/review-recovery/live-reviewer-brief.md`.
- Full application contract: `requirements.md`; task registry: `tasks.json`.
- Current C source: `src/cli.mjs`; accepted dependencies:
  `src/cart.mjs` and `src/quantity.mjs`; fixed C test:
  `acceptance/cli.test.mjs`.
- Current submission state:
  `verification/review-recovery/c-submitted-status.json`.

## Contract assessment

`src/cli.mjs:8` rejects every argv length other than exactly one user argument.
Lines 12–22 parse that argument and reject malformed JSON, null, arrays and all
non-object JSON values, as well as objects lacking either required own field.
Line 24 passes both fields to `totalCents` and serializes its result as one JSON
line. Every parsing/domain failure reaches `invalidInput` (lines 3–6), which
writes only `{"error":"INVALID_INPUT"}\n` to stdout and sets exit code `2`;
the code contains no stderr write. Extra object fields are intentionally
ignored. The candidate has no state, persistence, dependency, or output beyond
the required command-line behavior.

## Commands and observations

All commands used `/opt/homebrew/Cellar/node/25.8.2/bin/node`; every outer
command exited `0`. Exact commands, full probe source, raw tool output,
captured child stdout/stderr, and each child exit status are preserved in
`c-review-commands.json`.

1. `node --test acceptance/cli.test.mjs`: public C test passed 2 tests and
   failed 0.
2. An independent ESM subprocess probe asserted exact stdout, stderr and exit
   status for normal success, unknown fields, no argument, extra argument,
   malformed JSON, array/scalar/null top-level JSON, each missing required
   field, string quantity, negative price, and unsafe product. It captured
   expected `0` / `{"totalCents":375}\n` for successes and expected `2` /
   `{"error":"INVALID_INPUT"}\n` with empty stderr for every failure.
3. Source/input hashing confirmed the hashes above. `requirements.md` SHA-256
   was `47f438f5c34c716afb671c061423e92cf7100ff0ee9b7bbf2d8bf0b626671c13`,
   matching `reviewContext.specHash`.

## Remaining limits

This is independent task-C candidate evidence, not controller acceptance or
release evidence. I did not run controller commands, modify the application,
runtime, tests, frozen plugin, Git, or older reports, and did not inspect an
implementation report. No C-contract defect or concrete counterexample was
found.
