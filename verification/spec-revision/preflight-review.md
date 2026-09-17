# P3 independent preflight — 2026-09-11

Reviewer: `/root/revision_contract_review`, explicitly dispatched `gpt-5.6-sol` / `xhigh`, fork none, read-only. Returned `DONE_WITH_CONCERNS`; no edits or tests. This is design review, not source acceptance.

Load-bearing finding: the ordinary canonical tree includes `.leo-dev/changes/**`, but an interrupted revision may already have written some of its projections. A raw comparison to the pre-activation full tree would reject legitimate recovery. Persist a canonical remainder identity excluding only exact batch projection paths, and verify it plus each projection's prior/desired bytes, type and mode. Do not globally ignore change artifacts or introduce another engine.

Other required seams: latest validated revision authority/routes; revision-aware stale task/lease/run rejection; stable-ID cumulative failures/debug provenance; current evidence separated from history; explicit current-epoch team opening and prior-epoch request-ID refusal. Exact receipt fingerprint mapping was agreed and inserted in the implementation brief.

Lifecycle finding: `state/transition.ts` requires `designArtifactResolves` and `reviewReceiptMatches` for the design-review/design-approved edges; `Controller.planChangeTransition` does not supply these inputs. The supported path is `spec-approved → task-ready → executing`. Main's isolated v1 setup genuinely encountered the unsupported design-review edge; that failed command is retained, then setup continues on the Lite path. It is not a P3 feature RED and not a reason to add Standard/Full seams.

Main adjudication: accepted after checking `repository/tree-hash.ts` (path/mode/raw-content entries, only runtime globally ignored) and the concrete controller/transition behavior. Brief and sole plan corrected before worker dispatch. Existing source ownership and batch architecture remain unchanged.
