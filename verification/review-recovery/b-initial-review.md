# Independent candidate review — `live` / task `b`

## Verdict

**reject**. `src/cart.mjs` violates B's no-coercion and quantity-contract
requirements. Invalid non-primitive quantities are converted and accepted;
one invalid quantity also produces `TypeError` instead of required `RangeError`.

## Candidate identity and scope

- Change/task/revision: `live` / `b` / `1`; current state is
  `review-required` for run `run-76b0cdfe-fcc6-4249-83ff-f89895e36324`, lease
  generation `1`.
- Candidate tree hash from the supplied current `reviewContext`:
  `822aea4249d4f2ba7dca99f66eebdb0dfc18acb17414487120538c311e59da05`.
- Current candidate source SHA-256: `src/cart.mjs` =
  `4159748d5e5c74ef52e4af1af0eba4ae5e491d01ddb7be6e549a8b3293753165`.
- Accepted dependency source SHA-256: `src/quantity.mjs` =
  `3fdbc800a7a36658536b40b2972f67ce1f14cc9d034d302a881cc9fafd565371`.
- Task B's permitted write surface is `src/cart.mjs`; task A is done and was
  read only as B's accepted dependency.

## Loaded resources

- Frozen delivery skill and review references already loaded for this review
  series: `skills/develop/SKILL.md`; `references/review-protocol.md`,
  `references/lifecycle.md`, and `references/codex-team.md`.
- Reviewer contract: `verification/review-recovery/live-reviewer-brief.md`.
- Current application contract: `requirements.md`; task registry: `tasks.json`.
- Current B source: `src/cart.mjs`; accepted A dependency:
  `src/quantity.mjs`; fixed scoped public test: `acceptance/cart.test.mjs`.
- Current B submission state:
  `verification/review-recovery/b-submitted-status.json`.

## Findings

1. **High — invalid quantities are coerced and accepted**
   (`src/cart.mjs:8`). The expression `quantity(Number(count))` converts the
   caller's value before applying A's validator. B requires its quantity to
   satisfy A's primitive-number contract and expressly prohibits coercion.
   Concrete counterexamples observed with `totalCents(125, count)`:
   `count = '3'` returned `375`; `true` returned `125`; `3n`,
   `new Number(3)`, and `{ valueOf: () => 3 }` each returned `375`.
   All are invalid under A and must be rejected with `RangeError`.
2. **High — an invalid quantity can throw the wrong error type**
   (`src/cart.mjs:8`). `totalCents(125, Symbol('3'))` throws `TypeError` from
   `Number(Symbol(...))`, whereas an invalid quantity must be rejected with
   `RangeError`.

## Commands and observations

All Node commands used `/opt/homebrew/Cellar/node/25.8.2/bin/node` and exited
`0`; full commands and raw output are preserved in
`b-initial-review-commands.json`.

1. `node --test acceptance/cart.test.mjs`: public scoped gate passed 2 tests,
   failed 0.
2. Independent ESM probe invoked `totalCents(125, value)` for invalid quantity
   values. It printed the counterexamples recorded above and did not rely on
   the public test suite.
3. `shasum -a 256 src/cart.mjs src/quantity.mjs requirements.md tasks.json acceptance/cart.test.mjs`:
   confirmed the stated source hashes; `requirements.md` SHA-256 is
   `47f438f5c34c716afb671c061423e92cf7100ff0ee9b7bbf2d8bf0b626671c13`,
   matching the submitted review context.

## Remaining limits

This is an independent review of task B's current candidate only. I did not
run controller commands, modify the application/runtime/tests, inspect an
implementation report or other acceptance record, or review task C. The public
test's pass result is insufficient to offset the demonstrated contract
violations.
