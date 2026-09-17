# Independent C3.3 source review

Scope: the expired submitted-review recovery implementation in `implementation-brief.md`, existing approved C3.3 specification, and the narrow API reference update. This is not a review of the whole unfinished v1. Repository has no HEAD; original files are untracked. Compare production/schema/tests against `/private/tmp/leo-dev-review-recovery-before.5OZhSJ` where needed; never invent a commit range.

Read the implementation report and actual changed code. Verify requirements independently; a worker's PASS is not proof. Main owns final combined regression and original live fixture. Do not run broad suites concurrently, edit source/tests/specs, mutate the live fixture, install, invoke network, perform Git writes or spawn children. Own only `verification/review-recovery/independent-review.md` and optional small read-only reproduction evidence in that directory. Use apply_patch for reports. Preserve every existing file.

Prioritize correctness/security/concurrency findings with a concrete admission path or counterexample:

- Review-only epoch, no execution authority, generation/expiry rewriting, Gate replay or budget reset. Global serial writer reservation persists until actual review.
- Exact historical claim/candidate/successful Gate-result/submit and terminal identity; committed single-operation batch provenance; reject invented/direct/orphan/duplicate recovery events. Historical verification must remain valid after pass/reject and subsequent attempts/tasks.
- Unchanged current Spec/task/route/Gate/evidence/source and unique succeeded Run; reject ambiguous or unknown/in-flight histories. A reconciliation-only path must not infer a missing successful Gate result.
- Fresh exact recoveryId receipt, causal timestamp and normal freshness/provenance. Pre-recovery ID, missing/wrong/stale ID and stale-time receipt reject before any writes.
- Same checks for dry-run with zero writes/repair; invalid clean requests must not rewrite snapshots. Real interrupted batches recover the originally prepared ID. Concurrent requests cannot publish two epochs, double-release, double-count or bypass expected-tail CAS.
- Public options/results and separate reviewContext/reviewRecovery agree with the source guidance; all pre-existing no-recovery behavior retained.
- Tests reach valid real Gate/submission prerequisites; distinguish injected journal/process faults and actual command behavior. Identify uncovered material branches without demanding unrelated scope expansion.

Report findings by severity with file/line and evidence, not generic preferences. A clean review is acceptable. Do not change the acceptance threshold or recommend hiding failed evidence. State exactly what you inspected/tested, remaining limits, and whether any edits/processes remain active. Do not claim the live A→B→C continuation, installed-client discovery, Linux runtime or full autonomous pipeline has passed; those need separate actual evidence.
