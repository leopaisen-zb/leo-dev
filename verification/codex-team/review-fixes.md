# C3.1 review-fix evidence

Date: 2026-09-10

## Scope

Changed only these task-owned files:

- `packages/cli/src/team/protocol.ts`
- `packages/cli/src/controller/controller.ts` (team-local handling only)
- `packages/cli/src/index.ts`
- `tests/cli/codex-team.test.ts`
- this report

## Behavior changed

- Team message artifacts now reject controller-owned runtime state paths, case-insensitively: `.leo-dev/runtime/<changeId>/snapshot.json`, `journal.ndjson`, `journal.ndjson.lock`, and `lease.json`. Other contained regular runtime artifacts remain eligible, including the live trial correspondence layout under `.leo-dev/runtime/team-live/`.
- Team handoff revalidation uses the same artifact validation function, so it receives the same reserved-path exclusion.
- Help selects a command only from positional arguments, skipping values consumed by known options. Thus `--repo team status --help` selects `status`, while `--repo team --help` remains root help.
- A stale team batch CAS is mapped locally to `CONFLICT`/5. No generic controller-batch error mapping changed.
- The existing controller fault-injection option is forwarded only through the team batch call so the pending-batch fail-closed path can be exercised. It is not a public CLI flag.

## Dry-run correction

The initial concern that team dry-runs were routed through generic dry-run handling was incorrect. `team` is intentionally absent from `stateChanging`; `team --dry-run` reaches `Controller.team()`, loads/parses the input, calls `planTeamRecord`, and returns its own no-write plan. No dispatch change was made. The added writer/artifact matrix verifies valid and invalid team dry-runs preserve journal bytes.

## RED evidence

Before rebuilding production output, the added help and controller-owned-artifact cases were run against the pre-fix compiled CLI:

```text
npx vitest run tests/cli/codex-team.test.ts
6 tests: 4 passed, 2 failed
```

Observed failures:

- `--repo team status --help` exposed `command: "team"` instead of the actual `status` positional command.
- A dry-run record referencing `.leo-dev/runtime/team/snapshot.json` returned `DRY_RUN`/0 instead of `VALIDATION_ERROR`/2.

The pending-batch case was separately red against source before the team batch call forwarded the existing `faultAt` test seam:

```text
npx vitest run tests/cli/codex-team.test.ts -t 'refuses a pending'
1 failed: the fault-injected `Controller.execute('team', ...)` resolved `TEAM_RECORDED` rather than leaving a pending batch.
```

## GREEN evidence

After `npm run build`, focused compiled CLI verification completed in two fresh bounded runs:

```text
npx vitest run tests/cli/codex-team.test.ts -t 'projects a durable|is idempotent|lost-member recovery|does not mistake'
4 passed, 5 skipped

npx vitest run tests/cli/codex-team.test.ts -t 'rejects controller-owned|uses revision CAS|applies strict writer|does not repair|refuses a pending'
5 passed, 4 skipped

npm run typecheck
exit 0
```

The nine focused cases cover durable team behavior, help parsing, reserved runtime artifacts (including a case-insensitive spelling), concurrent same-revision CAS, writer constraints and malformed JSON/YAML syntax, unknown fields, traversal/wrong-hash/oversize/unknown-generation artifact cases, valid/invalid dry-run byte preservation, corrupt/incomplete journal no-repair, and pending controller-batch no-append behavior.

No whole CLI suite, package acceptance, or live-host claim is made here; those remain with the integration owner.

## Integration coverage follow-up

An independent audit identified missing literal roster cardinality, parsed non-object shape and truly escaping symlink cases; the nine-case report must not imply those had run. Main subsequently added two retrospective compiled-CLI cases: empty/single/>12/duplicate rosters, member extra fields, invalid parsed JSON/YAML shapes, valid 12-member preview, a symlink to another temporary root and unknown members. Actual/dry-run refusals preserve journal/snapshot and external file bytes. Focused run exited 0 with 2 passed / 9 deliberately filtered; this was coverage of existing behavior, not a new production fix.

The first run of the escaping-link test had an invalid final oracle: ordinary status itself performs a whole-tree scan and refuses the intentionally unsafe symlink. That assertion failed (1 passed / 1 failed). The corrected test establishes healthy lifecycle before inserting the link, then proves the exact journal/snapshot remain unchanged after refusal, without removing the link or weakening production checks.

A later independent review found the separate in-flight Gate / unknown-Run journal barrier gap. That finding and fix are tracked in `gate-barrier-fix.md`; the nine-case worker closeout above does not close it.
