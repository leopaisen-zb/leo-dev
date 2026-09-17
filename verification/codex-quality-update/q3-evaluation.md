# Q3 independent result and process evaluation

Date: 2026-09-16 (Asia/Shanghai)  
Evaluator: independent `gpt-5.6-sol` / high role; not a product, oracle, or actor implementation author  
Contract: `experiments/codex-quality/protocol.md` and Q3 of Leo Dev specification v1.10.0

## Verdict

**PASS. No Q3 blocker remains.** The frozen candidate satisfies all five mandatory backend behaviors, the calibrated reviewer makes both required initial judgments without adding a byte-order rule, and the actual-host trace meets the required installation, role separation, method consumption, interruption/replacement, fencing, review, and cleanup controls.

This verdict is limited to the one frozen backend exercise on Codex/macOS. It does not establish unattended recovery, cross-host reliability, or a latency/cost advantage.

## Mandatory behavior grading

| Criterion | Grade | Independent evidence |
| --- | --- | --- |
| Valid import preserves future/calendar-boundary values | **Passed** | The frozen behavior oracle returned exit 0 for `future-round-trip`. Its preflight proves exact imported-field preservation and accepts any later valid `updatedAt`, so it is not coupled to the reference helper or literal timestamp choice. The unchanged clock-skew suite also passed all three future/offset cases. |
| Status edit preserves ID/`createdAt` and never moves `updatedAt` backward | **Passed** | The oracle checks exact public keys, stable identity/creation time, requested `doing` status, finite timestamps, and ordering at or after both imported timestamps. The one-line store change selects the later instant and retains the prior accepted string on ties/future values. |
| Restart, export, and re-import preserve the edited result | **Passed** | The oracle performs a real child-server stop/start and compares restart/export/re-import with the observed PATCH result. The public clock-skew tests exercise the same path and passed 3/3. |
| Invalid import refuses atomically | **Passed** | The corrected frozen oracle checks the 400 response, unchanged live board/activity, and exact persisted file bytes after the refusal. Its final run passed. Consumer manifests and snapshots show no unrelated source change. |
| Ordinary create/edit/export behavior remains valid | **Passed** | The unchanged original acceptance suite passed 7/7 in Writer B's final run, the distinct reviewer's combined 10/10 run, and the installed controller Gate. The oracle's separate `ordinary-behavior` check also passed. No original test was edited or removed. |

The evaluator-controlled oracle was frozen before actor execution, was preflighted against an unchanged correct reference (pass) and the seeded defect (fail), and was corrected before freezing to avoid a false requirement for literal timestamp equality. `q3-oracle-final.log.json` records the final command and exit 0; `q3-oracle-final.log` records all three grouped checks. This is independent of the actor tests and implementation reports.

## Candidate, retrieval, and method binding

- `package-candidate.json` freezes 1,316 package files. The installed root is `/private/tmp/leo-dev-quality-discovery-3ze85dr6/home/plugins/cache/leo-dev-release/leo-dev/0.2.0`; its package bytes were independently matched to that manifest during the Q4 package review.
- The isolated preinstallation control had no Leo Dev entry. The isolated official `skills/list` result then contained exactly one enabled `leo-dev:develop`, plugin ID `leo-dev@leo-dev-release`, at the installed path, with no catalog error.
- Each actor's first `turn/start` contains the structured skill input with that exact installed `SKILL.md` path. The actor command traces then read that path and the installed runtime manifest. This establishes selected-candidate consumption even though authenticated actor processes correctly report the normal Codex authentication home; discovery and authenticated execution are kept distinct in the record.
- The installed runtime fingerprint reported by the actors agrees: source digest `38b014b2...15fdb8b`, package digest `c4d12f96...92e30f8`, and CLI SHA-256 `77cb2c...a3c5d1`.
- The reviewer command trace reads the actual pinned cc-sdd design `RESOURCE.md`, `design-discovery-light`, design principles, synthesis, review gate, design/research templates, upstream provenance, and Spec Kit `analyze.md`. The reported revisions match installed provenance: cc-sdd `29aee950f4addc36f9aeecb9881c46540e71ecc9` and Spec Kit `4a7341a93d944d6efe153b71da4a1adb9c2b578c`.
- The reviewer applies those resources to the fixed requirements/design/tasks/rules/facts set and explicitly avoids claiming that an upstream workflow engine ran. No second `.kiro` or `.specify` tree was created.

A command-path scan found zero actor commands reading evaluator-only oracle files, evaluator calibration sources, or `verification/codex-quality-update`. Writer A and Writer B read no review packets. The reviewer read only the complete neutral `case-a` and `case-b` aliases. Reading the public Q3 protocol was allowed contract consumption.

## Review accuracy and independence

Writer A and the reviewer started separate native threads and both initial turns began at 17:31:14Z. The writer completed at 17:32:30Z and the reviewer at 17:33:17Z; neither initial dispatch contains the other's hypothesis. Forwarding began only in later turns. Both independently located the same store update defect and retained the original 7/7 acceptance result alongside the 3/3 intentional clock-skew failures.

The six calibration files are byte-identical between their evaluator sources and neutral actor aliases. The reviewer received complete packets without the source labels or expected verdicts and returned:

- Case A: **ACCEPT**, because the parsed fields and required method report satisfy the contract despite different JSON order/whitespace.
- Case B: **REJECT**, because `state` replaces required `status` and two mandatory checks are made optional.

Both match the held-out calibration oracle. The reviewer did not require successful-output byte order, did not treat supplied external context as missing, and did not invent a stricter timestamp grammar.

The manager stored a calibration-stripped excerpt of the initial reviewer report in controller evidence before forwarding it to Writer A. `provenance.json` marks this as `excerpt: true`; the complete initial reviewer answer remains separately retained. This preserves both the full initial verdict and the writer's calibration isolation.

Writer B is a third native thread and a replacement for Writer A, while the final review is performed by the original distinct reviewer thread. The reviewer inspected the current code and reran both unchanged suites before returning PASS. There was no forced disagreement and no post-review repair loop.

## Interruption, handoff, and controller correspondence

- The host received a real `turn/interrupt` for Writer A's read-only handoff turn. The matching terminal event is `interrupted`, has no items, and completed after 111 ms. The task had not been claimed and source had not been edited.
- The manager then deliberately closed only that owned ephemeral server. A separate `thread/resume` returned `no rollout found`. The record accurately attributes the failure to ephemeral-server closure and does not call it a spontaneous crash, timeout, or mid-write recovery.
- The logical writer binding advanced from generation 1 to generation 2. The generation-1 handoff stayed pending; the same hashed handoff was explicitly addressed to generation 2 and acknowledged through Writer B's actual final turn.
- A controlled generation-1 late acknowledgement returned exit 5 / `CONFLICT` with `ack references a fenced member generation`. It is correctly labelled a coordinator probe rather than an old actor delivery.
- The installed controller routed the task as Standard, accepted existing specification authority and the independent design receipt, claimed the task for Writer B, ran the configured Gate, and required review. The Gate returned `GATES_PASSED`; its retained stdout is 10/10 for the unchanged acceptance and clock-skew suites.
- The stale-candidate review used the real final report against the pre-repair tree and returned exit 5 / `CONFLICT`. Journal and snapshot SHA-256 values are identical before and after that refusal. The fresh tree-bound receipt then returned exit 0 and state `integration-review`, task `done`, inactive lease, `issuerAuthenticated:false`, and `releaseReady:false`.
- The success code `LITE_REVIEW_ACCEPTED_UNAUTHENTICATED` is a misleading historical label for this Standard route. The surrounding state is internally consistent, and the execution record discloses the label rather than treating it as proof of Lite routing or authenticated release approval.

## Source and artifact integrity

Before replacement, `q3-source-before-replacement.json` reports all 18 original consumer inputs matching and no change. The final consumer manifest and an independent hash comparison against `fixture-provenance.json` show exactly one seeded-fixture delta: `lib/store.mjs`. Original acceptance and clock-skew tests, `server.mjs`, UI files, and unrelated `notes/keep.txt` retain their frozen hashes. There is no added source file.

All archived final consumer and controller files listed in `q3-consumer-snapshot/manifest.json` match their declared hashes. Completed actor answers match the retained report files after the archive's terminal newline convention. The controller's reviewer-initial artifact hash intentionally identifies the calibration-stripped excerpt, while the full report hash identifies the exact complete actor answer.

Six of seven dispatched turn texts are byte-for-byte equal to their frozen prompt files. The interrupted Writer A handoff text is the same 513 characters but omits the frozen file's final newline (514 bytes). This is a non-semantic archival discrepancy and does not expose an expected verdict or alter the instruction. It means the evidence should claim content identity for that prompt, not seven-of-seven byte identity.

## Host metrics, failures, and guardrails

The host evidence contains three actor threads, seven turns (six completed, one interrupted), and 34 completed command executions. Recalculated totals match the execution index:

- summed actor turn duration: **328.907 seconds**;
- host cumulative usage: **2,807,041 tokens**;
- input: **2,789,641**, including **2,353,152 cached input**;
- output: **17,400**, including **5,985 reasoning output tokens**.

These are cumulative host counters across repeated context and broad method reads. Initial turns overlapped, so summed duration is not wall-clock duration. No provider execution attestation or dollar-cost field is available; both remain unknown. The run has no matched single-agent or reduced-context baseline, so it supports no cost, latency, or multi-agent superiority claim. The 2.8M-token total is material overhead for this instrumented one-line repair, but it is not a regression without a frozen baseline.

Retained representative failures are accurately classified:

- the seeded product behavior failed all three clock-skew tests and was fixed by one in-scope code change;
- sandboxed loopback tests failed with bind restrictions, then the same commands ran under scoped authorization;
- Writer B's first manifest lookup used a nonexistent relative consumer path, exited 1, and was corrected to the installed absolute path before editing;
- the real interruption and both controller stale probes failed as designed.

No failed remediation loop was hidden. All three owned app-server processes exited 0 after terminal turns, reader completion was joined, deadlines were not reached, and `unknownAtCleanup` is empty. Request files contain only deliberate thread/turn/interrupt operations plus shutdown; they do not inject approval responses. The manager, not Leo Dev, performed installation, dispatch, forwarding, receipt creation, Gate execution, and final state control.

## Limits, evaluator uncertainty, and next experiment

The exercise covers one bounded backend repair, one reviewer calibration pair, Codex CLI 0.154.0, Node 22, and macOS. It does not test GUI refresh, Linux, other agent hosts, machine power loss, release/live-cache synchronization, or unattended autonomous recovery. The interruption happened before claim/edit, so it establishes native interruption plus generation-safe replacement, not mid-write crash recovery. The old-generation acknowledgement is a controlled controller input, not a naturally delayed message from the terminated actor.

The same independent evaluator reviewed the oracle preflight and this final result. That preserves separation from oracle and product authors but introduces possible confirmation bias toward the previously accepted oracle design. The deterministic red/reference preflight, exact hashes, unchanged public tests, and raw host events reduce that risk; one exercise still cannot measure repeatability.

No stronger model, RAG layer, or additional agent topology is justified by the measured result. If recovery coverage is desired, the smallest next experiment is to reuse this frozen consumer and oracle with a persistent actor, interrupt one post-claim read-only turn, restart the host, and test same-thread resume before allowing any edit. That isolates the documented resume limitation without expanding the backend behavior contract. It is optional and not required for the Q3 PASS.
