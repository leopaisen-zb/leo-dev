# Q3 independent evaluator preflight — correction rereview

Date: 2026-09-15 (Asia/Shanghai)  
Role: independent evaluator, Sol/high  
Scope: read-only rereview of the B1–B3 oracle corrections, fresh proofs, and fixed-input manifest against the unchanged Q3 protocol and product contract. No actor result is evaluated here.

## Verdict

**Approved: the corrected evaluator-controlled inputs are ready to freeze for Q3 actor execution.** The three prior blocking findings are resolved without changing the product requirements, calibration outcomes, timeout values, or acceptance thresholds.

The coordinator still owns two dispatch-time steps already required by the protocol: freeze each exact consumer root and dispatch prompt alongside this static manifest, and retain actual authenticated host evidence that the actor selected the exact isolated installed candidate path. This approval permits freezing and actor execution; it does not count that future runtime evidence as already passed and does not approve Q3 completion.

## Prior blockers

### B1 — resolved: no literal timestamp-equality false positive

`assertUpdatedImportedTask` now grades the observable contract (`behavior-oracle.mjs` lines 110–121): exact public task keys, stable ID and `createdAt`, unchanged title/notes/priority, requested status `doing`, a finite `updatedAt`, and ordering at or after both imported timestamps. The import itself still requires exact preservation (`lines 130–132`). Restart/export and re-import compare against the actual PATCH result (`lines 133–140`) instead of reconstructing a reference-specific timestamp.

The focused proof creates two isolated implementations that return legal later values, `.001-23:59` and `.999-23:59`; both pass. The ordinary reference also passes. The oracle therefore accepts literal retention and later accepted timestamps without prescribing the store helper's algorithm.

The product's public re-import validates the emitted timestamp again during the same round trip. Broader timestamp-input grammar remains covered by the unchanged public suite; duplicating every validation case in this focused oracle is unnecessary.

### B2 — resolved: persisted invalid-import state is checked exactly

After creating the sentinel, `atomicInvalidImport` reads the data-file bytes (`behavior-oracle.mjs` line 167). After the invalid mixed snapshot returns 400 and the live board/activity are shown unchanged, it compares the persisted `Buffer` exactly (`lines 169–173`). This directly covers the frozen contract's disk-byte preservation and does not impose JSON key-order or serialization rules on successful output.

A separate restart assertion is not needed: exact post-response disk bytes plus the unchanged live board establish the required refusal state, while the valid path already performs a real restart.

### B3 — resolved: startup failure cleans up the owned child

`start()` now creates `stop()` before awaiting readiness (`behavior-oracle.mjs` lines 68–77). The readiness failure path awaits that cleanup and rethrows the original error (`lines 78–84`). Cleanup retains the existing five-second SIGTERM bound and uses SIGKILL only after that bound.

The focused proof launches an owned process that deliberately never announces readiness, records its PID, observes the expected readiness failure, and confirms that the PID no longer exists. The proof also checks the ordinary corrupt-data startup refusal without overwriting its input bytes.

## Deterministic evidence

The fresh evidence records:

- Reference oracle: exit 0 with all three focused checks.
- Unchanged seed: exit 1 at the future imported-task edit, with the expected invalid-timestamp refusal.
- Focused B1–B3 proof program: exit 0 for both later timestamp alternatives, corrupt-data preservation, invalid-import byte-check execution, and readiness-child termination.
- Syntax checks: both oracle programs parse successfully.

The initial red/green logs and original preflight/report remain retained at the hashes listed in `oracle-input-manifest.md`; the correction report explicitly supersedes only the original timestamp interpretation.

I independently recalculated all 41 path/byte/SHA-256 rows in `oracle-input-manifest.md`: **41 matched, 0 mismatched**. The manifest covers the protocol, provenance, every seeded fixture file, complete calibration contracts/context/artifacts, both evaluator oracle programs, the calibration oracle, the full original reference consumer, and retained initial evaluator evidence.

Current rereview evidence hashes are:

```text
oracle-input-manifest.md          9f49f07728b8b59565546def0f15eaa48e65ed8de73877c9ba8ee6e530a94cd8
oracle-fix1-report.md             cf3688df3e349e046b8c41e84934102d9232edee810edb3c4fdd062ed50e6de0
oracle-fix1-green.log             543db9f5c863206d16ce0e865a41add3886b2f2f358b8a629c097218ef0870f6
oracle-fix1-red.log               a6bb02780ae348b00b63a6b923eeaaa467e8b412e9f4fd8353f198bc9b159617
oracle-fix1-preflight-proofs.log  6d591e52c4f389c30f37a389152e9bc94e60349c64d2d06afa7030b7a2f5473c
```

These correction outputs are evidence rather than actor inputs. Root should retain their hashes with this rereview when sealing the execution record. Dispatch prompts are correctly absent from the static manifest because they are coordinator-owned and not yet frozen; each must be added to the dispatch-specific freeze record before its actor starts.

## Remaining runtime conditions

No static-input blocker remains. During execution, the evaluator must still grade actual traces for candidate-path consumption, tool use, handoffs, source preservation, interruption/continuation, stale/current fencing, final answers, latency, and any host-reported usage/cost. Unknown model attestation or cost must remain unknown rather than inferred.

The actor and calibration-reviewer roots must exclude the evaluator-only calibration oracle, prior evaluator reports, and other reviewers' conclusions. No evidence at this stage supports changing models, reasoning effort, retrieval, orchestration, or the bounded backend scope.
