# C3.1 Codex team seam — implementation report

Date: 2026-09-10

## Scope delivered

- Added the public `leo-dev team` command with `status` and `record` actions.
- Added strict, journal-projected team protocol types and validation for open, bind, message, and acknowledgement records.
- Uses the existing controller read/preflight and journal batch/CAS path. Team entries are only `team.operation.recorded`; they do not alter lifecycle reduction, completion, leases, candidates, or receipts.
- Team responses identify `currentSpecHash`, `stale`, and `provenance: host-reported-not-authenticated`.
- Added Commander-derived per-command help options, so `team --help` and existing command help expose registered flags without a hand-maintained flag inventory.
- Added focused real compiled-CLI tests, including generation-fenced lost-member recovery and revalidation of the handoff artifact at bind time.

## TDD evidence

Initial required RED command:

```text
npm run build && npx vitest run tests/cli/codex-team.test.ts
exit 1: No test files found, exiting with code 1
```

After the first test was written, RED was observed against the real compiled CLI:

```text
exit 1: error: unknown command 'team'
```

The recovery clarification also had a separate RED: a generation-2 bind incorrectly accepted the generation-1 `handoff-one` record (`TEAM_RECORDED` instead of the expected `CONFLICT`). The green change requires the handoff endpoint to be at the member's current generation and reads/checks that handoff artifact only at bind time.

## Verification

Passed:

```text
npm run build && npx vitest run tests/cli/codex-team.test.ts && npm run typecheck
3 tests passed; build and both TypeScript checks passed.
```

The focused cases use isolated fixtures and fresh compiled CLI processes for roster replay, messages/acks, idempotent replay, altered request IDs, lineage, stale Spec, symlinked artifacts, recovery fencing, changed handoff artifacts, and real help envelopes.

One concurrent broad run was intentionally not treated as final acceptance. It finished with 134 passing tests and 9 failures: eight existing governance cases exceeded their 5-second per-test timeout while the full suite was contending for CPU, and the then-unmodified `vertical-slice` command-list assertion still expected fifteen commands. The integration owner subsequently updated that command-list assertion and will run the final suite serially. This report makes no whole-suite-pass claim.

## Diff provenance

The repository has no usable HEAD and these project files are untracked. Pre-edit owned controller/index copies are retained at:

```text
/private/tmp/leo-dev-codex-team-before/
```

Actual before/after `diff -u` shows controller: +37/-4 and index: +15/-4. New files have no prior counterpart:

- `packages/cli/src/team/types.ts`
- `packages/cli/src/team/protocol.ts`
- `packages/cli/src/commands/team.ts`
- `tests/cli/codex-team.test.ts`

No host agent was spawned by this CLI seam, and this result does not claim installed-plugin readiness or authenticated host identity.
