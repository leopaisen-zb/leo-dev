# Archive-evidence shape projection

`archive-evidence.json` is the strict-schema projection of the same completed verifier run, not a rerun or a new success claim. It retains the required top-level identity/context fields and only the two actually executed test checks, each restricted to `name`, `argv`, `exitCode`, and `gateDefinitionHash`.

The detailed provenance report remains unchanged at `local-verifier-report.json`, SHA-256 `9b29ee66c85b3983dc5ba736abeb5ba61cef44883bd090984d1898e5f6f05cc9`. Its additional fields record the original test counts, artifact/sentinel/source comparisons, release context, and inspected prior evidence. No test output was relabelled or synthesized for this projection.

Field mapping: `schemaVersion`, `changeId`, `specHash`, `candidateTreeHash`, `sessionId`, `verifierRunId`, `provider`, and `status` copy unchanged from the original report. The two `checks` entries copy the executed live-fixture and private-extraction test `name`, `argv`, `exitCode`, and `gateDefinitionHash` unchanged; all other original fields are intentionally omitted because the archive schema rejects additional properties.
