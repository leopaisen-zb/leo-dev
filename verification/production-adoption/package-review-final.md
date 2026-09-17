# P1 package validator — scoped final re-review

## Verdict

**PASS for fix round 1.** The prior Medium blocking finding about invented JSON
property/source-entry ordering has been resolved. No new defect was found in the
reviewed validator change or its focused regression test.

This verdict is limited to the provenance manifest comparison fix. It does not
restate broad package acceptance, installed-client behavior, the controller
implementation, or the intermediate consumer smoke as cleanly passed.

## Code review evidence

- `scripts/upstream-resources.mjs:36-40` now defines the exact top-level and
  seven-field resource contracts without using serialized-object equality.
  `exactFieldSet` requires every declared own field and rejects extras, while
  remaining insensitive to JSON property order.
- `scripts/upstream-resources.mjs:65-76` treats `sources` as an unordered set keyed
  by the unique `packagedPath`. It preserves the fixed count and scope, rejects
  duplicate/unknown/missing paths, validates the derived source-to-package path,
  and compares all seven pinned values against the fixed inventory.
- `scripts/upstream-resources.mjs:77-90` retains the existing independent fixed
  inventory, path confinement, regular-file/symlink, packaged-hash, source-hash,
  and declared-transformation checks. The semantic-order fix does not weaken
  resource-byte integrity.
- `tests/adapters/walking-skeleton.test.mjs:139-156` exercises both dimensions of
  the original defect: it reverses the complete source list and rewrites every
  resource object with a different key order while preserving all values, then
  requires validation to succeed.
- The appended package report records an actual pre-fix RED for that test and a
  post-fix focused run of the reordered-manifest case plus the existing relocation,
  tamper/path-negative, packaged-tamper, and single-sentinel cases: **5 passed,
  0 failed**. The syntax check also passed.

## Evidence limits

The reviewer inspected the scoped code, regression test, and recorded RED/GREEN
evidence only; the focused tests were not rerun during this re-review. The
coordinator's restarted full npm run remains separate evidence and no timeout or
threshold change is inferred here. The consumer addendum preserves the controller
correction and partial-sample status; the disputed F2 interpretation is not
re-adjudicated by this code-fix verdict.
