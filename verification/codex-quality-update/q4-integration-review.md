# Q4 independent integration review

Date: 2026-09-16

## Final verdict

**PASS. The frozen source/code/package candidate passes final integration review with no code, packaging, test, or Q3 process blocker found.** The post-build `npm test` reached a passing terminal result, the separate independent Q3 evaluation passed all mandatory result/process criteria, and the final source/installed-package hash check found no drift.

I did not implement Q1 or Q2 and did not modify product code, configuration, tests, oracle inputs, thresholds or results. This review compares filesystem bytes and recorded commands because the repository has no usable committed-HEAD baseline for this candidate.

## Candidate identity and review continuity

- All 192 paths in `source-candidate.json` exist and match their recorded SHA-256 values. This is an allowlisted product/source manifest; it does not claim to inventory workspace-only specifications, experiments, generated output or verification records.
- The accepted Q1a hashes still match the final candidate for `design-events.ts`, `validate.ts`, the decoder/schema tests and the continuation-integrity test. The four Q1b fix2 manifest entries (`controller.ts`, `design-admission.ts`, `codex-design.test.ts` and `codex-claim-continuation.test.ts`) also match exactly. There is no post-review drift in either accepted Q1 slice.
- Each package root named by `package-candidate.json` contains exactly 1,316 files with zero missing, extra or mismatched entries. The isolated installed root at `/private/tmp/leo-dev-quality-discovery-3ze85dr6/home/plugins/cache/leo-dev-release/leo-dev/0.2.0` independently has the same 1,316/1,316 file set and hashes.
- The compiled final `controller.js`, `design-admission.js`, `design-events.js` and `validate.js` bytes in the source build are identical to the installed runtime copies. The installed package contains one skill entry, `skills/develop/SKILL.md`; source-pinned cc-sdd entries are packaged as `RESOURCE.md`, and the intended cc-sdd, Spec Kit and BMAD provenance/license resources are present.
- The fresh catalog result contains one enabled `leo-dev:develop`, with plugin identity `leo-dev@leo-dev-release` and a path under that exact installed root. The separate Q3 evaluation confirms actual structured selection and reads of that installed path, pinned cc-sdd/Spec Kit resource consumption, and installed public-controller behavior.

## Spec and code integration

The candidate implements the bounded v1.10.0 Q1/Q2 scope without adding the deferred portability architecture or another state owner.

- `design-events.ts` decodes only the two selected event types, schema-validates receipt shape without reevaluating historical wall-clock expiry, preserves both writer envelopes, rejects malformed latest relevant events, and ignores unrelated kinds. The controller maps decode failures to the existing exit-7 `BLOCKED` public boundary.
- `design-admission.ts` gives the four selected design decisions one home with explicit change, route, authority, context, receipt and reuse inputs. It does not import journal, batch, snapshot, lease or lock modules and performs no persistent write.
- Source capture/currentness remains in the pre-existing `design-policy` helpers. The controller still owns option parsing, receipt/path acquisition, revision-receipt reservation, batch and journal commit, projections, snapshots, leases and recovery. The extraction creates no alternate ledger, migration or completion authority.
- Ordinary receipt acquisition retains caller-working-directory resolution and arbitrary readable-path compatibility. Fresh claim acquisition retains repository-root realpath/containment, then checks current authority/source before a single receipt read and byte capture. The exact refusal order and byte-binding behaviors are fixed by public counterexample tests.
- Existing command modules, public schemas, journal/batch/lease/snapshot implementations and runtime dependency map are unchanged from the recorded baseline. `engines.node` remains `>=20`; ESLint/coverage additions are development-only and are absent from the packaged runtime. Public command names, event names, batch/recovery kinds and valid JSON/exit-code meanings are therefore not broadened by this change.

The added tests are behavior-facing rather than helper mirrors: malformed latest history cannot resurrect an older approval; a historical prepared receipt can outlive current wall time; an empty readable design survives status and recovery; ordinary caller-CWD resolution is preserved; and a combined escaping-path/source-drift input retains prior public error precedence without writes. Q1's independent repair history records the real counterexamples instead of weakening old assertions or time limits.

## Quality, fault and compatibility evidence

Q2's accepted evidence applies to these unchanged source hashes: scoped lint and typecheck passed, and the explicit quality run passed 8 files / 123 tests in 555.23 seconds. Its V8 percentage remains reporting-only because compiled CLI child processes are not attributed to the Vitest worker. The fault matrix maps prepared writes, third-value refusal, journal-tail commit, incomplete-tail recovery, stale-generation fencing, duplicate-effect refusal and initialization cleanup to named executable cases. Per-system-call ENOSPC/EIO, machine power loss and complete orphan-temp reclamation remain disclosed limits rather than implicit passes.

Recorded Q4 checks currently show:

- `python3 -m unittest tests/test_doctor.py`: exit 0, 9/9 passed.
- Mochi example tests: the first sandboxed run exited 1 because loopback listen returned `EPERM`; the authorized loopback-capable rerun used the same two files and passed 10/10. The current 13 example files still match the `original_sha256` entries in `fixture-provenance.json`, so the passing rerun is attached to the preserved reference application rather than the seeded Q3 mutation.
- `npm run build:marketplace`: exit 0 and includes `npm run build:adapters`.
- `npm run verify:packages`: exit 0.
- Initial `npm test`: exit 1 only on the existing 5-second transient-entry tree-hash case while the package build was active; 178/179 tests in that stage passed. The retained targeted reproduction passed 7/7, with the affected case taking 618 ms. That supports I/O contention as a plausible diagnosis but does not turn the failed broad run into a pass. No source, retry policy, assertion or timeout was changed.
- Post-build `npm test`: exit 0; the complete command passed **482 tests**: core Vitest 10/10 files and 179/179 tests, Node adapter/package 20/20 tests, and serialized CLI/skill Vitest 16/16 files and 283/283 tests. The last stage took 1576.96 seconds. `q4/npm-test-after-build.log.json` records the 2026-09-15T17:33:22Z start, 18:02:07Z finish and terminal exit. This clean rerun after package build resolves the initial concurrent-build timeout without changing source, retry policy, assertions or thresholds.
- Independent Q3 result/process evaluation: PASS with no blocker. Its fixed oracle passed all five mandatory backend obligations through three grouped checks; unchanged actor and Gate suites passed 10/10; calibrated review, installed-path/method consumption, real interruption/replacement, generation fencing, stale/current review behavior, source preservation and cleanup all passed. Provider execution attestation and dollar cost remain unknown, and the exercise makes no efficiency claim.

## Documentation and support claims

README, CONTRIBUTING, installation and release-evidence text distinguish the Node 22 development/CI host from the Node 20-or-newer packaged runtime, distinguish package build from installed discovery, and disclose worker-only coverage. The earlier 472-test statement remains tied to its earlier release candidate. Current documents do not claim Linux-equivalent quality, universal host support, model superiority or remote GitHub Actions execution.

The verification index/progress/method-coverage documents may still label Q3/Q4 as pending. Their final narrative update is root-owned bookkeeping now that the executable gates have passed; it is not a product or Q4 acceptance blocker.

## Final integrity and limits

After the terminal test and Q3 verdict, `q4-final-bindings.json` records a fresh PASS at 2026-09-15T18:03:01Z: all **192/192 source paths** match; the Codex, marketplace, and isolated installed roots each match **1,316/1,316 package files**; and all **18/18 frozen consumer source files** match. No additional build or broad test rerun is indicated. Evidence/plan/status documents outside the package may continue to change as root finalizes reporting; they do not alter these frozen inputs.

The initial broad-run timeout remains retained evidence of concurrent package-build I/O sensitivity, not a product failure or a passing run. The clean serialized run does not establish immunity to arbitrary machine load. Q3 remains a single bounded Codex/macOS exercise and does not establish GUI, Linux, cross-host, power-loss or unattended-recovery reliability. Fault-injection limits documented in the fault matrix remain limits.

No measured Q4 evidence suggests a need for a stronger model, higher reasoning effort, RAG or more orchestration.
