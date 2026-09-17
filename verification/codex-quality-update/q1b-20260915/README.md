# Q1b design-admission extraction evidence

Environment: macOS local workspace, `PATH=/Users/leo/.nvm/versions/node/v22.22.2/bin:$PATH`.

## Extracted decisions

`packages/cli/src/changes/design-admission.ts` now owns:

- decoding the design-admission history through Q1a's decoder;
- request capture, approval binding, current approved-design admission, and
  fresh-claim receipt planning;
- the former controller `claimDesignEvidence` predicate as
  `validateClaimDesignEvidence`.

The latter is pure decision ownership: it validates decoded historical context,
authority/route binding, embedded design bytes, receipt independence and the
given preparation time. `controller.ts` retains `validateClaimBatch`, the
prepared-time proof, exact operation fingerprint, receipt-byte parsing,
recovery-source equality, batch commit, locks, leases and error adaptation.

The controller continues to parse CLI options, read receipts, acquire fresh
claim sources once, adapt receipt-ID reuse/reservation checks, and translate
`DesignAdmissionError` to unchanged public `ControllerError` codes. Ordinary
`design-approved` transitions retain their pre-existing arbitrary readable
receipt path; repository containment/canonical path handling remains confined
to fresh-claim receipt-source proof acquisition.

## Characterization and repair evidence

- `baseline-typecheck.txt`, `baseline-build.txt`, and
  `baseline-source-only-focused.txt`: Q1a source-only baseline passed, 5 files
  / 41 tests.
- `final-source-only-focused.txt`: the first extracted candidate failed 8
  `codex-design` cases because common acquisition incorrectly required ordinary
  transition receipts to be repository-contained. The assertions and raw log
  are preserved.
- `typecheck-after-acquisition-fix.txt` and `build-after-acquisition-fix.txt`:
  passed after restoring the existing path boundary.
- `final-source-only-focused-after-acquisition-fix.txt`: passed, 5 files / 41
  tests, excluding `**/verification/**`.
- `final-typecheck.txt` and `final-build.txt`: passed after removal of the
  unused service parameter; this cleanup does not alter runtime behavior.

No separate service test was added because the existing public CLI tests
exercise the extracted decisions through child CLI processes. They do not by
themselves establish in-process coverage for the new module; this is recorded
for the planned scoped quality work instead of adding a mirror test solely for
coverage.
