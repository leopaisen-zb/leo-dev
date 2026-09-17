# C3.2 Codex runtime packaging report

## Scope

Owned changes: `scripts/build-adapters.mjs`, `scripts/package-runtime.mjs`,
`scripts/verify-packages.mjs`, and `tests/adapters/codex-runtime.test.mjs`.
The Codex package now contains an independent runtime at
`runtime/packages/cli/dist/index.js`. It retains that relative source-tree
layout, copies the consumed schemas and risk-rules file, and copies the exact
Node-resolved, `package-lock.json`-validated production dependency closure
(including package metadata and licenses). Non-Codex packages do not receive a
runtime.

`runtime/runtime-manifest.json` is deterministic for identical inputs and
contains schema version, Node `>=20` prerequisite, CLI entry, trusted source
digest, runtime package digest, and the exact SHA-256 inventory. Verification
recomputes both the current trusted source digest and runtime inventory; it
does not accept a modified manifest as authority for modified files.

## RED evidence

Command: `node --test tests/adapters/codex-runtime.test.mjs`

1. The very first run failed at the pre-existing portable-skill guard because
   the concurrently added `references/codex-team.md` was not yet in
   `portableFiles` (`Unknown portable source file: references/codex-team.md`).
   This was an integration prerequisite, not the runtime feature RED.
2. After adding the two required portable reference paths, the intended RED
   was observed: the built Codex package did not contain
   `runtime/packages/cli/dist/index.js` (`MODULE_NOT_FOUND`) and subsequent
   runtime-tampering setup failed with `ENOENT` because `runtime/` did not
   exist.
3. After C3.1 merged, the added packaged-team assertion initially failed only
   because the real persisted member projection includes its documented
   `bindings: []` field. The assertion was corrected to the observed public
   projection; the behavior (null status → strict-hash open record → fresh
   process persisted status) passed.

## GREEN evidence

All commands below used the local Node executable; no installation, download,
global registration, or source rebuild was performed.

| Requirement | Command / observation | Status |
| --- | --- | --- |
| Runtime suite | `node --test --test-name-pattern='builds a relocatable Codex runtime' tests/adapters/codex-runtime.test.mjs` — passed after C3.1 compile: copies the built package to an isolated parent and runs `init --change runtime-proof --spec spec.md`, `status`, then `team status` (null) → `team record` open with the returned strict `currentSpecHash` → a fresh-process `team status` whose roster persists. Earlier complete three-test runtime run passed before the C3.1-only addition; remaining tamper checks are unchanged. | Passed for relocation/team seam |
| Runtime tamper checks | Earlier complete `node --test tests/adapters/codex-runtime.test.mjs` run: 3/3 passed, covering packaged-file, unexpected-file, manifest, escaping-symlink tampering, and a missing required dependency. | Passed before C3.1-only test extension |
| Clean build and package verification | `node scripts/build-adapters.mjs --out /tmp/leo-dev-c3-runtime-scratch && node scripts/verify-packages.mjs --dist /tmp/leo-dev-c3-runtime-scratch` — exit 0; owned scratch package removed afterward. | Passed |
| Existing adapter suite | `node --test tests/adapters/*.test.mjs` was started. The runner output showed the first four walking-skeleton cases passing, but the tool detached before it returned a final suite exit code; a later local process check showed it finished. | Final status not captured; main should run final suite |
| Production compile / team runtime command | Not run here to avoid racing the CLI/team worker. | Main-owned final verification |

## Freshness and handoff

The packager deliberately requires existing `packages/cli/dist` output and
does not invoke `npm run build`. It can fingerprint the current source inputs,
but cannot prove that a pre-existing compiled output was produced from those
inputs. Main must run `npm run build` after the team worker merges, then rebuild
and verify the package. At that point, add the team action relocation scenario
(`team --action status` and a minimal open/status across fresh processes) to
the final runtime evidence.

## C3 security review fix (2026-09-10)

Independent review found that the former verifier treated the package-local
`runtime-manifest.json` inventory as the authority. An attacker could replace a
copied CLI or dependency file, recompute that file's SHA-256 and the manifest's
`packageDigest`, and retain the unchanged `sourceDigest`; the old verifier
accepted that coordinated alteration.

`scripts/package-runtime.mjs` now uses one shared runtime plan for copying and
for verification. During verification it independently derives the expected
exact inventory and hashes from the current trusted inputs: `packages/cli/dist`,
the CLI package metadata, schemas, risk rules, plus the lock-validated,
symlink-safe resolved production dependency closure. It requires both the
actual package inventory and the manifest inventory/digest to equal that trusted
inventory. The package-local manifest is therefore descriptive evidence, not
an authority that can bless altered runtime bytes. Existing unknown-file,
symlink, missing-prerequisite, and source-digest checks remain in force.

### Review-fix RED/GREEN evidence

- **RED** — `node --test --test-name-pattern='rejects runtime code or dependency replacement' tests/adapters/codex-runtime.test.mjs` exited 1 before the production change. The new real attack test replaced packaged CLI bytes, recomputed its manifest inventory and digest, and observed `AssertionError: Missing expected rejection`.
- **GREEN** — the same command exited 0 after the change (27.53 s), covering both forged packaged CLI bytes plus recomputed manifest and forged copied dependency JavaScript plus recomputed manifest.
- **Focused regression checks** — existing inventory/tamper test passed (29.46 s); existing escaping-symlink/missing-dependency test passed (5.20 s); relocatable `init`/`status`/team-state package seam passed (14.17 s). No broad suite, source rebuild, dependency install, or package verification run was performed in this review-fix pass.

This verification is deliberately a current-build-input comparison, not a
signature scheme and not evidence that source files were freshly compiled into
`dist`. The final owner must still compile after concurrent CLI work, create a
fresh package, and run final package verification.

## C3 thin-package inventory review fix (2026-09-10)

Independent review found that `verify-packages.mjs` excluded `runtime/**` from
the unknown-file comparison before selecting a host. That exception is valid
only for the Codex package, where `verifyRuntime` validates the runtime tree;
it accidentally allowed arbitrary runtime payloads in the thin Claude and
Cursor packages.

The verifier now excludes `runtime/**` only for Codex. Claude, Cursor, and
Open Agent Plugin package inventories remain exact thin-package inventories,
so an added runtime directory is rejected as an unknown file. This adds no
runtime feature or scope to those hosts.

- **RED** — `node --test --test-name-pattern='rejects injected runtime payloads' tests/adapters/codex-runtime.test.mjs` exited 1 before the production change. A real built fixture with `claude/leo-dev/runtime/payload.js` produced `AssertionError: Missing expected rejection`.
- **GREEN** — the same focused test exited 0 after the change (33.62 s), independently injecting `runtime/payload.js` into freshly built Claude and Cursor packages and requiring host-specific rejection. No source rebuild, dependency installation, package mutation outside test fixtures, or broad suite was performed.
