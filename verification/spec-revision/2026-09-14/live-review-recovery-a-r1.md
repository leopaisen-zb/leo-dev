# V1 task A expired-review recovery

Task `name-normalizer` revision 1 reached `review-required` with a succeeded
Gate and an independent PASS report, but its lease expired at
`2026-09-14T03:39:12.630Z` before the receipt was ingested.

The coordinator ran the relocated package CLI:

```text
resume --change p3-live-retry1 --task name-normalizer --recover-review --dry-run
resume --change p3-live-retry1 --task name-normalizer --recover-review
```

The dry run returned `DRY_RUN` with `plannedRecovery: true` and no writes.
The actual call returned `REVIEW_RECOVERED` at
`2026-09-14T03:40:02.842Z`, preserving the original
`run-e1d9b458-475f-4587-a27b-78547fcf8ec7`, task revision 1, lease
generation 1, candidate tree
`f1df939a597cc77f25fe95072a2bdcff94e522070d639f5d1b6146a3e7a578f3`,
and succeeded `name-normalizer-gate` evidence. It produced recovery ID
`3cf29446-eab4-4922-ac39-c450e6bcda04`.

The accepted replacement receipt retained the original independent report hash
`3d7148c728f0bbd1b13e2a5acee738aa85604f0a2dcbc40d42b962befb30abb3`
and added that recovery ID. Journal sequence 29 records the prepared recovery;
sequence 30 commits it; sequence 31 prepares the review ingestion. The
controller then reported task A `done` and released its lease. No candidate or
Gate was rerun.

Issuer identity remains agent asserted and is not cryptographically
authenticated.
