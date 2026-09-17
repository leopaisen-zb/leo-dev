# Real Codex team sample — 2026-09-10

Status: bounded host correspondence and reconstruction observed; final post-review package checks are separate.

Frozen protocol: [live-protocol.md](../live-protocol.md). Fixture: `/private/tmp/leo-dev-team-live.JYxzv6`. No installation, external writes, Git changes, application edits or lifecycle approval.

## Actual run

| Check | Observed outcome |
| --- | --- |
| Independent first takes | Real `/root/codex_team_live_architect` (Sol/high) and `/root/codex_team_live_reviewer` (Terra/high), explicit successful spawn configurations, fork none. Reviewer explicitly reported not reading another role's opinion before its first response. |
| Cross-questioning | Coordinator forwarded original reviewer opinion, obtained architect's acknowledgment and exact question, then forwarded architect originals to reviewer. Reviewer returned a substantive response. No invented disagreement. |
| Delivery evidence | Three messages moved pending → delivered only after recipient body responses were retained. `hostReference` locates originals by recipient/generation/path/hash; not authenticated transport. |
| Durable records | Fresh CLI processes read team revision 11, original opinions and handoff. Source CLI coordinated first operations; fresh consumer found the interim relocated Codex package using its skill/reference and explicit Node 22 entry. |
| Recovery | Controlled simulation declared old logical architect unavailable to this exercise. Real new `/root/codex_team_live_recovered` (Sol/high, fork none) reconstructed facts from hash-checked files, correctly distinguished proposed repair from actual faulty source. Coordinator then bound architect generation 2; team revision 12. |
| Old-generation fence | An explicitly injected late generation-1 message returned exit 5/`CONFLICT`. Journal SHA before and after identical: `8c3dc0ee6e80f38d57e73f2c0519950eec4f30211ea8c3ad23f9fa94bcc3cb49`. No fake response was attributed to the old agent. |
| No hidden completion | Ordinary status remained `triage`; tasks, runs, leases empty, no review context. Original Spec/source/tests/unrelated note hashes unchanged. Runtime correspondence addition left current subject tree hash unchanged. |
| Engineering judgment | Both roles diagnosed local guard defects and rejected an unnecessary architecture rewrite. Reviewer reported 34 in-memory proposed-guard checks; these are not counted as production suite passes. Existing fixture source remains faulty (1 pass/2 fail), as required by this read-only protocol. |

## Evidence and limits

Original role responses are adjacent files: architect-first, reviewer-first, architect-cross-response, reviewer-cross-response and recovered-assessment. [Initial host/CLI evidence](host-and-cli-evidence.json) and [recovery operations](recovery-and-cli-evidence.json) preserve coordinator-observed tool/results. Agent responses preserve their own command observations; this is not a signed host audit or full private thread export.

The interim package used here is `/private/tmp/leo-dev-c3-accepted.a2SHv9/codex/leo-dev`, CLI hash `5e4f37d9ce87d32bec33f0e4d65fda3b0ae3ed6487e32cde8f664adb9a5c07f8`. It predates review fixes; matching its self-recorded manifest is not a claim that its original verifier prevented coordinated tampering. Final package verification must use the fixed verifier against trusted current inputs.

Host checks are one controlled behavioral sample, not statistically proven error reduction. Simulated logical member loss is not an actual host crash; thread survival is not promised. Pending generation-1 response/handoff records were not silently re-addressed or acknowledged by generation 2. Fresh reconstruction does not prove installed-client loading, candidate submission/review, expired-lease recovery, full Spec convergence or multi-domain readiness.
