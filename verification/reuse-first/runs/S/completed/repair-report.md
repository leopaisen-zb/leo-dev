# Targeted Repair Report

## Status and Scope

The single authorized repair addressed independent-review finding M1 only. The proposal remains unapproved and planning-only. No requirement, source implementation, test implementation, approval state, archived initial artifact, `actor-report.md`, or `consumption.json` was changed.

M2 was not applied. The coordinator explicitly rejected its broad absence claim because the frozen contract places method/adaptation disclosures in the already-existing `actor-report.md` and `consumption.json`, which the initial reviewer omitted from its read list. This repair does not duplicate that evidence into the proposal artifacts or silently introduce a new acceptance condition.

## Observed UTC Window

- Start: `2026-09-11T03:08:00Z`
- End: `2026-09-11T03:11:19Z`

## Actual Changed Files

- `artifacts/design.md` — replaced categorical batch process bullets with a 23-row Literal Batch Process Vectors table. Every row binds exact user argv to exact stdout including newline, process status, and empty stderr. It includes literal/deterministic fixtures for repeats, zero price, 50 and 51 items, strict-type/range failures, line overflow, malformed JSON, wrong argument counts, and two individually safe maximum-safe-integer lines whose aggregate is unsafe.
- `artifacts/tasks-draft.md` — constrained task 2.1 to implement each design-table row as a distinct process assertion and repeated the required repeat, zero, 50-item, strict-type, and individually-safe-lines aggregate-overflow bindings.
- `repair-report.md` — recorded this bounded repair and its evidence.

No other file was intentionally changed. One initial patch-construction attempt failed with a JavaScript syntax error before invoking the patch tool; it caused no workspace mutation.

## Preserved Semantics

- Requirement IDs and acceptance statements are unchanged.
- Success remains one JSON line, status 0, and empty stderr.
- Every invalid case remains exactly `{"error":"INVALID_INPUT"}\n`, status 2, empty stderr, and no partial success line.
- The 1–50 bound, strict primitive numeric rules, zero/repeat/order behavior, line/aggregate safe-integer rules, legacy compatibility checks, no-side-effect boundary, and mandatory-test status are unchanged.
- No implementation, new dependency, source edit, test execution, approval, or finalized `tasks.md` was added.

## Read-Only Verification

The final verification command read the repaired process-test and task sections, scanned for the key literal rows and contract terms, asserted absence of `artifacts/tasks.md` and proposed implementation files, and observed the end time.

Observed evidence:

- The vector table contains 23 data rows: 6 success rows with status 0 and empty stderr, and 17 invalid rows with status 2 and empty stderr.
- Design contains explicit rows for one item, repeats, zero price, 50 items, representative strict-type invalid input, malformed JSON, wrong argument counts, and unsafe aggregate.
- The aggregate-overflow argv contains two `{ "priceCents": 9007199254740991, "quantity": 1 }` items; each line is individually safe, while the row expects only the exact invalid-input line, status 2, and empty stderr.
- Task 2.1 references `process.argv.slice(2)`, requires every table row as a distinct assertion, and repeats the exact M1-critical bindings.
- `artifacts/tasks.md`, `src/batch-cart.mjs`, and `src/batch-cli.mjs` remain absent.
- Proposed Node tests were not run because implementation remains unauthorized and those files do not exist.

## Handoff

This is the sole author repair. It now stops for a non-author repair review. The evidence above is not independent approval or permission to implement.
