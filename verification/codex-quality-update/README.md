# Codex quality update — September 2026

Status: complete. Q1–Q4 passed their required independent reviews and final acceptance checks. Authority: specification v1.10.0 and Q1–Q4 in the existing implementation plan. No publication or live-cache synchronization is included.

## What changed

- Typed decoding checks the two persisted design-review event forms, including pending-batch inputs. Current corrupt evidence cannot fall back to an older approval; structural validation remains separate from time-dependent admission.
- A small design-admission module owns design decisions. The controller still owns receipt acquisition, reservations, journal/batch commits, projections, leases and recovery. Public receipt path bases, captured bytes and validation order are preserved.
- Focused correctness lint, explicit source-test discovery and reporting-only V8 coverage are wired into existing CI. The runtime dependency/Node contract remains unchanged; development quality checks use Node 22.
- English source/install guidance explains these checks and distinguishes runtime support from development tooling. Existing artwork and upstream attribution are retained.

## Evidence

| Deliverable | Recorded result | Evidence |
| --- | --- | --- |
| Q1 code boundary | Accepted after independent reviews and compatibility repairs | [Final Q1 rereview](q1b-rereview2-20260915.md), [order reassessment](q1b-order-reassessment.md) |
| Q2 quality feedback | Lint/typecheck passed; 8 files / 123 required tests passed, 555.23 seconds | [Independent Q2 review](q2-review-20260916.md), [quality baseline](quality-baseline.md), [fault matrix](fault-matrix.md) |
| Candidate installation | 1,316 regular files matched; exactly one enabled qualified skill at the expected installed path | [Package identity](package-candidate.json), [official discovery](q3-discovery/catalog-result.json) |
| Q3 bounded exercise | Actual native threads, independent first contributions, interruption/replacement, stale/current refusal/progress, unchanged original tests and fixed oracle recorded and independently accepted | [Independent Q3 evaluation](q3-evaluation.md), [execution index](q3-execution.md), [host summary](q3-host-summary.json), [method coverage](method-coverage.md) |
| Q4 integration | Independent PASS; npm 482/482, doctor 9/9 and original example 10/10 passed; final source/package hashes matched | [Final integration review](q4-integration-review.md), [test results](q4/results.json), [final bindings](q4-final-bindings.json) |

The full npm result comprises 179 core Vitest tests, 20 Node adapter/package tests and 283 CLI/skill tests. Doctor and example checks are separate. The passing full command ran from 17:33:22Z to 18:02:07Z on September 15 (September 16 locally).

Coverage is not a repository-wide score: child-process CLI execution is not fully attributed to Vitest worker source coverage. The 123-test quality suite overlaps the full regression and is not added to its count.

## Retained failures and limits

Q1 review found and repaired empty-design, caller-working-directory and fresh-receipt validation-order regressions. Their failing outputs and the accepted-version counterexample remain retained. Q2's initial parallel run hit receipt timing; the existing serial CLI convention passed without changing lifetimes or assertions.

The first full Q4 run overlapped package building and timed out one existing file-tree race test. Its isolated reproduction and complete post-build rerun passed without repair. The I/O-contention explanation is plausible, not proven. Example HTTP tests first failed at sandbox loopback binding and then passed with scoped permission; no test or source was weakened.

Q3 used separately owned authenticated CLI actors and explicit installed-skill paths, with isolated installation/discovery. Normal-home catalog metadata could coexist; the exact candidate reads are retained. The manager performed coordination and receipt recording. Local issuer labels are unauthenticated; task completion reached integration-review, not release-ready. The controlled interruption occurred before any implementation write. All actor processes exited cleanly after terminal events.

Only Codex/macOS received this update's actual-host exercise. Linux, Claude Code, Pi and DeepSeek Harness adapters, GUI refresh, per-syscall disk failures and machine power loss remain unverified. No benchmark here establishes universal reliability, Linux-equivalent certification or cost/latency superiority.

The source repository had no committed HEAD. [Original snapshots](baseline.json), [frozen source identity](source-candidate.json), package hashes and consumer snapshots preserve reviewable evidence without resetting the dirty workspace. Source code, the installed consumer and historical release evidence are distinguished throughout.
