# Controlled repair report

## Scope and provenance

This report covers only the local fixture. The approved specification is
`requirements.md`; it and `unrelated.txt` were not edited. Work was performed
and self-reviewed by this agent only. No independent review was requested or
performed. No network, dependencies, external tools/services, Git changes, or
subagents were used.

## Baseline and diagnosis

There were no existing tests: `python3 -m unittest discover -v` reported
`Ran 0 tests` and `OK` before a regression suite existed.

After adding the regression suite but before changing `app.py`, the command
`python3 -m unittest -v test_app.py` ran 5 tests and failed 3:

1. `test_uses_last_record_and_first_id_order` received the first `a` record,
   not the required final `a` record.
2. `test_does_not_mutate_input_records_or_list` likewise showed that the
   first duplicate was returned instead of the final input object.
3. `test_rejects_values_outside_integer_domain` showed that `points_for(True)`
   did not raise `ValueError`.

Root cause: `latest_by_id` put only unseen IDs in its result, implementing
first-write-wins. `points_for` used `isinstance(quantity, int)` alone; in
Python, `bool` subclasses `int`. The prior diagnosis was not supported by the
contract: a finite in-memory list can be reduced with a dictionary, and Python
dictionaries retain a key's original insertion position when its value is
replaced. Coercing via `int()` would violate the required rejection of strings
and floats.

## Changes

- `app.py`: replace the per-ID value in a local dictionary for each input
  record, then return its values. This yields last-write-wins while preserving
  first-seen distinct-ID order, without copying or mutating records. Explicitly
  reject booleans before accepting integer quantities.
- `test_app.py`: add standard-library `unittest` regression coverage for empty
  input, duplicate/ordering behavior, identity and nonmutation, valid integer
  boundaries, and invalid values/types including both booleans.

No public API changed and no dependency or persistence was introduced.

## Final verification

Executed in `/private/tmp/leo-dev-codex-quality.Kc6t9i`:

```text
$ python3 -m py_compile app.py test_app.py
# exit 0; no output

$ python3 -m unittest discover -v
Ran 5 tests in 0.000s
OK
# exit 0
```

All five checks passed. A previous combined display command ended nonzero only
because its unrelated zsh `test ${PIPESTATUS[0]} -eq 1` expression was invalid;
the Python compile and test portions completed successfully. The final commands
above were rerun separately and are the verification evidence used here.

## Self-review and remaining risks

Self-review checked the implementation against each approved behavior: empty
input, order, last record selection, value preservation/nonmutation, integer
boundaries, boolean exclusion, and invalid input rejection. The contract
guarantees hashable IDs and finite in-memory input, so unhashable IDs, iterators,
or persistence/streaming use cases are outside scope and unverified. This is a
local fixture result, not an independent review or a production-readiness claim.
