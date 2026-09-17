# Q3 oracle preflight correction evidence — round 1

This report supersedes the timestamp-ambiguity interpretation in `oracle-report.md`; the original report and its initial logs remain retained unchanged.

The oracle now accepts either the imported `updatedAt` or any later accepted timestamp. It checks the edited task's exact public key set; preserves ID, creation time, title, notes, and priority; requires status `doing`; requires a finite, non-backward timestamp ordered after creation; then carries the actual PATCH response through restart, export, and re-import. It also reads and compares the exact data-file bytes before and after a rejected import.

`start()` establishes its `stop()` closure before awaiting readiness. Any startup/readiness failure terminates the owned child with SIGTERM, waits within the unchanged five-second bound, then uses SIGKILL only if necessary before rethrowing the original failure.

Fresh evidence:

- `oracle-fix1-green.log`: original reference passes.
- `oracle-fix1-red.log`: unchanged seeded fixture fails at the controlled future import/edit defect.
- `oracle-fix1-preflight-proofs.log`: owned temporary copies returning both `9999-12-31T23:59:59.001-23:59` and `.999-23:59` pass; a corrupt existing data file is refused without overwriting its bytes; the normal oracle run exercises exact invalid-import byte preservation; and a deliberately unannounced owned child is gone after `start()` returns its readiness failure.

No product, fixture, original example, protocol, timeout, or calibration packet was changed. The complete fixed-input manifest is `oracle-input-manifest.md`.
