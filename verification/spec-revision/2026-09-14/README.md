# P3 closeout — 2026-09-14

Status: accepted within the P3 conservative-revision scope. Scope is the existing spec v1.7.0 conservative revision
contract, the two findings in the preceding source review, and the bounded
two-task revision exercise. This is a verification record, not a new spec.

## Acceptance record

| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-01: a thrown-indeterminate Gate result after revision preserves ownership and readable recovery state | [Worker RED/GREEN](worker-recovery-closeout.md) and [independent review](independent-review.md) | Passed |
| FR-02: a pending revision cannot consume an already used receipt ID, before any recovery write | Prepared/projected zero-write regressions and [independent review](independent-review.md) | Passed |
| Unrelated legacy receipts and stale-result fencing remain supported | Focused regression plus independent source review | Passed |
| Current source builds and passes its configured Node regression/typecheck | [full-test-final.log](full-test-final.log): 424/424; [typecheck-final.log](typecheck-final.log): exit 0 | Passed |
| Python installation-check behavior | [python-tests.log](python-tests.log), 6 tests, exit 0 | Passed |
| Local toolkit paths, pinned sources and enabled plugins | [doctor.json](doctor.json), 15 checks, exit 0 | Passed; installation/path checks only |
| Relocated Codex runtime and all generated package inventories | [package-final.md](package-final.md), source/package digests verified | Passed |
| V1→V2 revalidates both tasks through fresh Gates and real independent reviews, with unchanged application/tests | [live-final.md](live-final.md) and four task/revision review reports | Passed |
| A fresh entry consumer follows the shipped revision contract | [live-entry-consumer.md](live-entry-consumer.md) | Passed |
| Historical evidence, historical approval and installed cache remain intact | [preservation-final.json](preservation-final.json), 478/478 unchanged | Passed |

## Provenance and limits

- [before.json](before.json) records the pre-edit source snapshot and hashes of
  historical evidence and installed cache files. [additional-protected.json](additional-protected.json)
  also freezes the historical approval and current source plugin manifest.
- The parent `verification/spec-revision/README.md` is part of the protected
  historical evidence set and therefore still describes its earlier in-progress
  checkpoint. This dated record and the sole project plan carry the current status.
- [environment.json](environment.json) records macOS/arm64 and actual executable
  versions. [delegation.json](delegation.json) records the successful task routing.
- The prior temporary live directory and its V1 copy no longer exist. The
  September 11 reports are retained; this run creates a new fixed sample and
  cannot claim to have recovered that missing directory.
- Fixture approval receipts are explicitly synthetic test grants. Candidate
  review receipts must derive from actual independent agent judgments. Neither
  kind provides cryptographically authenticated issuer identity.
- Full C3.4 governance/development/retrospective, Standard/Full lifecycle,
  domain-specific cases, installed-client loading, Claude Code/Cursor client
  use and external publication are outside this closeout's completion claim.
