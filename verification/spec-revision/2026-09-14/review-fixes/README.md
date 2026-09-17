# P3 review fixes — 2026-09-14

Status: RF-01 and RF-02 fixed and verified within the existing P3 contract.
The user authorized fixes for the two confirmed findings in
[review-before.md](review-before.md). This record supersedes the preceding P3
acceptance conclusion while retaining every earlier report unchanged. The broader
governed workflow and installed-client acceptance remain open.

RF-01 reserves a consumed revision receipt ID across public receipt writers and
pending recovery without changing unrelated legacy duplicate behavior. RF-02
requires exact recovery validation before any incomplete-tail truncation. Both
use the existing P3 contract and controller; no schema or workflow redesign.

The sole plan records ownership and acceptance steps. Before-edit source and
historical-evidence inventories are recorded in [before.json](before.json).
The [worker report](worker-report.md) records the three pre-fix failures, five
new focused passes and three adjacent regression passes. The worker's later
whole-file run had no captured final result and is not counted as passed.
[Independent review](independent-review.md) found no blocking issue in the final
source/test hashes. Main's fixed [acceptance script](acceptance.mjs) reproduced
both defects before the fixes and now passes all three cases against source and
the freshly built isolated package, including valid incomplete-tail recovery.
See [source results](acceptance-source-green.jsonl), [package results](acceptance-package.jsonl)
and [package metadata](package-verification.json). Typecheck passed. The final
configured `npm test` exited 0: 175 core + 18 package/adapter + 236 CLI/skill
tests, **429 passed, no failures or skips**. See [full-test.log](full-test.log)
and [full-test-result.json](full-test-result.json); source/test hashes were
unchanged throughout that run and match the independent review. All 523
protected evidence/cache/approval entries matched their recorded hashes in
[preservation.json](preservation.json).

## Changes and evidence

| Requirement | Actual evidence | Result |
| --- | --- | --- |
| Public ordinary approval cannot consume an already used revision grant; state stays usable | Fixed source and packaged acceptance; new public CLI regression | Passed, `CONFLICT` before file changes, then readable status and usable resume |
| Pending ordinary receipt collision cannot corrupt committed revision authority | New pending-batch regression and independent source review | Passed, `BLOCKED` before journal/snapshot writes |
| Invalid revision recovery preserves its incomplete tail and projection state | New source-drift/third-value regressions; fixed source and packaged source-drift acceptance | Passed, dry-run and actual refusal preserve bytes |
| Valid recovery and legacy receipt compatibility remain | Positive incomplete-tail case, existing prior/desired/mixed and legacy cases in full suite | Passed |
| Reviewed changes are the delivered source | [source-test.diff](source-test.diff), [verification-results.json](verification-results.json), full-run hashes | Matched |

Only `packages/cli/src/controller/controller.ts` and its CLI revision test file
change production behavior or regression coverage. Current README/spec/issue/plan
entries update status; the original review and old closeout reports remain intact.
The ordinary receipt guard and pending-history counting share the existing receipt
and journal model. Recovery adds preflight before truncation and retains the
existing lock/CAS validation before committing; no new recovery engine or schema.

The final isolated package is `/private/tmp/leo-dev-p3-review-fixes-package.273z3d1w`.
Its runtime source digest is
`e460eefb29193b5bb82c29b350244b4cedcb70c120b30ad599f9cdfd769b2957`, and
package digest is `4aa4d78477306d2a06c59cf1580184fe74993eb937883d27307a75da8c7d36f0`.
The fixed acceptance script hash remained
`797b2d897d6ced980a64c60e9a7f460ba1a64d7d9272a9dec83498a369a0fd0b`
from the pre-fix RED through both GREEN runs.

## Limits

No installed cache, global setting, historical receipt or previously corrupted
fixture history was rewritten. These fixes prevent the reported invalid writes;
they do not add automatic repair of already invalid committed histories. Python
installation checks and the earlier complete two-task real-agent live exercise
were not rerun in this repair; their earlier results remain historical. Browser,
native-device and product-model evaluations are not applicable to this controller
patch. The new package was built and exercised locally, not installed or published.

The earlier live entry-consumer report was read-only and recommended a revision
proposal while task B still awaited review; the active lease must first settle.
Its old-review replay used an already consumed receipt ID, so that particular
refusal proves duplicate rejection rather than fresh-ID/stale-version rejection.
These limitations remain disclosed; this repair does not claim a new complete
governed workflow or installed-client acceptance.
