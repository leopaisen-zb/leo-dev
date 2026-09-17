# Q1b bounded rereview — 2026-09-15

Scope: independent read-only comparison of the Q1b repair, Q1a accepted controller snapshot, current extraction, targeted RED/GREEN, and the three public CLI logs. I did not implement Q1, alter source/tests/evidence, or rerun the whole suite.

## Finding

### Important — fresh-claim path-validation precedence still differs from Q1a

The caller-CWD repair itself is correct and minimal. For an ordinary `transition --to design-approved`, `acquireDesignReceipt` now computes metadata with `resolve(reference)` and passes the original reference to `readReceipt` (`controller.ts` lines 1455–1470). Because `readReceipt` retains `resolve(path)`, a relative receipt resolves from the invoking process cwd; absolute and symlinked arbitrary readable paths remain readable. The shadow-file public regression is meaningful: the same relative name is invalid under `--repo` and valid under the distinct caller cwd, so its RED and GREEN distinguish the two resolutions.

For fresh claims, the same method correctly retains `realpath(resolve(repositoryRoot, reference))`, repository containment, and reading of the canonical path. The captured `Buffer` is passed directly to `claimDesignReceiptPlan`, which hashes and Base64-encodes those exact bytes; the file is not reread. The existing read-race test exercises that property.

However, the extraction changed the ordering of fresh-claim path errors relative to current design/source errors:

- In the accepted Q1a controller, `claimDesignReceiptPlan` first refused Lite/no-prior-approval, then performed repository-root `realpath` and containment, and only then called `designTransitionPlan`, which checked current authority/context and design-source drift before reading/parsing the receipt (`q1a-accepted/.../controller.ts.txt` lines 1488–1505).
- In the current code, `planFreshClaimDesignReceipt` calls service `claimDesignReceiptPlan`. After the Lite/prior-approval checks, that service calls `approveDesignReview`, which checks current authority/context and source drift before invoking the acquisition callback (`design-admission.ts` lines 83–92 and 59–67). Repository-root realpath/containment now occurs inside that later callback (`controller.ts` lines 1458–1468).

Therefore, when a fresh claim simultaneously has stale/drifted design evidence and an unreadable or repository-escaping receipt reference, Q1a returned exit 2 / `VALIDATION_ERROR` for the receipt path, while the extracted code returns exit 5 / `CONFLICT` for design authority/source first. The accepted plan explicitly requires preserving current admission-check precedence and the realpath/containment/readReceipt error mapping. The passing 25-test set has separate containment, source-drift, and byte-capture cases, but no collision case that distinguishes this order.

Smallest next repair: preserve the Q1a sequence for fresh claims without moving receipt parsing earlier: non-Lite and prior-approval check → canonicalize/contain the path → current context/source checks → read and capture the canonical file once → receipt checks. A focused public collision regression should assert the prior exit/code and no writes. Ordinary transition acquisition must keep the caller-CWD behavior now proven by the new test.

## Evidence assessment

The targeted caller-CWD regression is a valid RED→GREEN:

- RED: one selected test failed because the repository shadow receipt was parsed (`SCHEMA_INVALID`).
- GREEN: the same selected test passed after the four-line acquisition-path repair.
- The diff from the saved Q1b candidate is confined to choosing caller-CWD metadata/read reference for ordinary acquisition and canonical repository-root reference for contained acquisition. `design-admission.ts` is byte-identical to the saved Q1b candidate.

The recorded typecheck and build completed successfully. The authoritative source-only run completed 3 files / 25 tests. The overlapping wrapper run also completed 25/25 and is retained only as duplicate corroboration, not additional coverage.

## Assessment

Q1b still has one Important compatibility blocker, so I cannot state “no remaining Q1b blocker” or recommend starting Q2 yet. The caller-CWD defect is repaired; the remaining scope is only the fresh-claim error-precedence collision above. No broader test run, policy change, threshold change, or new module is indicated before a targeted RED→GREEN and bounded rereview.
