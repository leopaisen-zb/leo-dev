# Bounded claim-continuation repair plan

## Scope and invariants

1. Add public `claim` options for an explicit superseded Run and an optional fresh
   design-review receipt. Ordinary claims retain their current refusal behavior.
2. A supersession is admitted only for the current, executing, implementing task's
   expired active lease, with an explicit matching Run ID and a distinct nonempty
   session. It refuses any candidate, Gate attempt/result, submit, or unknown
   outcome and preserves the old Run, source bytes, and budgets.
3. Before a dirty pre-Gate claim is adopted, validate it with the existing
   candidate-path assertion against the old Run's `inputEntries`. One controller
   batch records the old-run fence/abandonment and a normal fresh-generation claim.
   The recovery proof protects source/receipt bindings and is preflighted before
   repairing an incomplete batch tail.
4. A supplied design receipt is consumed only by an otherwise eligible claim. It
   must be a fresh, independent, passing receipt for the immutable current
   design/spec/plan/producer binding and requires existing approved design history;
   reuse, expiry, self-review, drift, and invalid claim admission leave no writes.
5. Tests exercise the compiled public CLI: positive supersession and receipt
   ingestion; refusal/write-free matrix; one-winner concurrency; fault-injected
   prepared recovery; and source/receipt-drift recovery. No new scanner, runner,
   scheduler, batch engine, or lifecycle reopening is introduced.

## TDD sequence

1. Create `tests/cli/codex-claim-continuation.test.ts` and build it; run it to
   capture the expected missing-option/behavior RED result.
2. Implement the smallest controller/CLI/batch extension that satisfies the first
   observed contract, then run the focused test GREEN.
3. Add the remaining negative and recovery cases one at a time, preserving each
   RED-to-GREEN observation. Finish with focused build/typecheck tests and record
   actual results in `report.md`.
