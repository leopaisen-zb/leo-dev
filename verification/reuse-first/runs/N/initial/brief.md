# Batch cart quote — experimental feature brief

This is a coordinator-authored controlled planning fixture, not a request to deploy a real product. Produce a proposed requirements/design/task package; do not implement it or claim human approval. All behavior below is fixed for this experiment. Source files are copied from the previously accepted local quantity/cart/CLI fixture; the original project must never be changed.

## Existing system

Node.js ESM; no dependencies or build step. `src/quantity.mjs` validates a primitive numeric integer in [1,10]. `src/cart.mjs` exports `totalCents(priceCents, count)` and rejects invalid inputs and unsafe totals. `src/cli.mjs` is the established single-item JSON CLI. Read these files as the actual brownfield context. No web, HTTP server, database, UI, distributed transaction or model API belongs to this extension.

## Requested extension

Add a separate batch quotation CLI, proposed path `src/batch-cli.mjs`, without altering the legacy single-item CLI's accepted input/output or error behavior.

1. Accept exactly one command-line argument: a JSON object with an own `items` array containing 1 through 50 item objects. Each item has own `priceCents` and `quantity` fields. Unknown object fields are ignored, matching the existing CLI policy.
2. Prices must be primitive numeric nonnegative safe integers. Quantities must be primitive numeric integers from 1 through 10. Never coerce strings, booleans, arrays or null into numeric values.
3. Reuse existing item validation and multiplication semantics. The sum of all line totals must also be a safe integer. Zero-price items are valid. Array order does not change the result; repeated items count separately.
4. On success, stdout contains exactly one JSON line `{ "totalCents": <sum>, "itemCount": <length> }`, with these property names and numeric values, exit 0, and no stderr. Whitespace inside JSON is not a wire-format requirement, but the terminating newline is.
5. On any invalid input, malformed JSON, wrong argument count, invalid line, line overflow or aggregate overflow, stdout is exactly `{"error":"INVALID_INPUT"}\n`, exit 2, with no stderr and no partial result line. The operation is read-only and performs no file or external writes.
6. Preserve the original three source modules' public behavior. A small batch domain function may be added if it gives the CLI and unit tests a clear boundary; do not introduce a generic plugin engine, service layer, new dependency or duplicate quantity validation.
7. The plan must include executable Node test commands and literal observable cases: one valid item; two repeated items; zero price; 50 items; 0/51 items; missing/non-array items; string/boolean/null quantity; negative/fractional/unsafe price; quantity 0/11; malformed JSON; wrong argument count; unsafe aggregate; exact legacy CLI success/error compatibility. Separate domain tests from process/stdout/exit checks.
8. Feature scope ends at local implementation/validation planning. No Git operations, package install, delivery deployment, kernel/Linux-only requirement, financial policy, or UI work. Document unrun implementation tests honestly.

## Output boundaries

Write `artifacts/requirements.md`, `artifacts/design.md`, and an UNAPPROVED `artifacts/tasks-draft.md`; optionally `artifacts/research.md`. Numeric requirement IDs and traceability must stay consistent. Record scope, ownership, permitted dependencies and concrete revalidation triggers. Do not create a parallel `.kiro`, `.specify`, `_bmad`, approval database or executable state machine. An independent task/readiness review will occur after you stop writing. A semantic ambiguity must be reported, not silently guessed. All outputs remain proposals, not implementation permission.
