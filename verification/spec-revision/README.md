# P3 — conservative approved revisions

Status: implementation in progress, not yet accepted. The user approved preserving
code/history while revalidating all old tasks after a Spec/constitution revision.
Normative authority remains the existing spec v1.7.0 and sole implementation plan.

Source: `/Users/leo/plugins/leo-dev`; preimplementation snapshot:
`/private/tmp/leo-dev-spec-revision-before.Zjd5S0`.

## Evidence so far

- [Implementation brief](implementation-brief.md) and [independent preflight](preflight-review.md): exact approval/version/recovery contracts; corrected mixed-projection recovery and Lite lifecycle boundaries before code.
- [Entry baseline](entry-baseline.md): old guidance correctly reports missing revision capability; not a model-discipline failure or reasoning-performance baseline.
- [Live protocol](live-protocol.md): unchanged correct application, two dependent tasks, then explicit Spec/constitution revision and fresh verification.
- V1 actual Gate/independent-review baseline is complete: [A](live-review-a-v1.md), [B](live-review-b-v1.md), [raw CLI calls](live-v1-commands.json), [frozen files](live-v1-freeze.json). Synthetic fixture approval is not genuine human issuance; actual separate reviewer judgments are used for review receipts. The failed unsupported design-review setup call is retained, followed by the correct Lite path.
- [Intermediate entry consumer](entry-consumer.md) retrieved the proposal/assessment/grant context after one corrected command error. This is not final-source or installed-client acceptance.
- Initial source is undergoing [hardening](hardening-brief.md) after [independent review](source-review-initial.md), with a sole Sol/high runtime/test owner following the first writer's explicit handoff. Main's [42-case state regression](state-check-main.json) passes, but does not cover away the identified source defects. The [wrong supplied grant preview](wrong-receipt-preview-red.json) is an actual failing refusal assertion; main's [first-group recheck](wrong-receipt-preview-first-green.json) now observes the required conflict and unchanged journal. The recheck's initial incorrect working directory is retained separately as a [setup failure](wrong-receipt-preview-recheck-setup-failure.json), not a product failure or passing case.
- [Historical preservation check](historical-preservation-check.json) rechecks 63 protected history/cache files and 24 old experiment inputs; all match the earlier frozen hashes. The separate [read-only live checker](check-live-preservation.mjs) verifies the new V1 fixture and later journal-prefix preservation; it is evidence tooling, not shipped runtime.

Live fixture: `/private/tmp/leo-dev-spec-revision-live.3H1JOk`; immutable V1 copy:
`/private/tmp/leo-dev-spec-revision-live-v1-before.TJswuK`. The old P1/P2 relocated
package established V1. Two real existing host handles were explicitly bound
after review and before freezing; this does not invent retrospective team messages.
V2 documents/plan are staged separately; application/tests are unchanged.

P3 runtime/source review/full regression/package/current-version exercise remain
pending. No installation/cache update, Git publication, Standard/Full activation,
or claim of full autonomous development delivery follows from this baseline.
