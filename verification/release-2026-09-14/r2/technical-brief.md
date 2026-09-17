# R2 release-finalization technical brief

Date: 2026-09-14  
Scope: public release evidence and archival transition, following R1's
task-plan, claim, Gate and review work.

## Immutable inputs and one completion authority

R2 uses the existing `Controller`, append-only journal, controller batch
projections and `GateRunner`. It does not introduce a second runner, a task
counter completion shortcut, or a release side effect.

The only task eligible to produce release evidence is the route with
`role: integration`. Admission must find exactly one such route and prove it
is final: it has every other route as a transitive dependency and no route
depends on it. A plan with no integration role remains valid for normal work,
but cannot transition out of `integration-review`.

The selected route must have all of the following durable, committed facts:

1. a `run.claimed` payload for its current revision and generation containing
   `inputEntries` and `lease.inputTreeHash`;
2. a candidate registered for that same Run, with candidate tree equal to the
   claim input-tree hash. This makes the aggregate task verification-only;
3. a `GateRunner` settlement that is successful, current, and bound to that
   Run/candidate/gate definition, rather than a task state or reconciled guess;
4. an accepted independent whole-change review. The integration review policy
   is at least Standard even when the route declares `risk: lite`:
   `agent-asserted` is always insufficient; only an independent
   `platform-attested` review or an existing-policy `human-confirmed` review
   may accept the integration candidate.

The frozen source baseline is the immutable `run.claimed.inputEntries`. R2
uses the current `canonicalTreeHash` v1 policy unchanged. It compares its
entries with the frozen entries after removing only exact
`projectJournalEvents(raw).committedProjections[].relativePath` paths. Those
projection bytes are already independently verified by `readEvents`; no broad
`.leo-dev`, `.leo-dev/changes`, or arbitrary metadata exclusion is allowed.
The existing v1 policy already ignores `.leo-dev/runtime`; runtime receipt and
evidence bytes are validated by their referenced path and SHA-256, rather than
being added to the mutable source subject. Historical claims without
`inputEntries` are ineligible; R2 must never reconstruct them from the current
tree.

The authority source (`currentAuthority`) remains separately current: its
source hash must equal the recorded authority hash when release proof is made
and when archive is requested. This prevents an unchanged candidate tree from
standing in for a drifted referenced spec/source.

## Public transitions and projections

`transition --scope change --to release-evidence` has no external effect. It
validates the preceding facts, then commits one controller batch that writes
`.leo-dev/changes/<changeId>/release.yaml`. The proof contains its own ID and
hash, change/task/run/revision/generation IDs, claim and candidate tree hashes,
spec/plan/source hashes, exact integration Gate settlement/evidence reference
and evidence hash, accepted review receipt ID/hash/provenance/session, and its
creation timestamp. The command returns `RELEASE_EVIDENCE_RECORDED` with an
`archiveContext` that binds the proof and current subject.

`transition --scope change --to archived --receipt <ci-receipt> --archive
<manifest>` reads inputs before committing one batch that writes
`.leo-dev/changes/<changeId>/archive.yaml`. It does not deploy, publish, upload
or call a provider. `archived` remains terminal.

The transition command needs public `--archive <path>` support. Receipt and
archive input paths are repository-contained runtime/evidence paths in normal
use, so they do not make release or archive proof self-referential source
subjects. A supplied path must not collide with a generated projection.

## Frozen receipt and archive shapes

Proposed concise CI/verifier receipt fields (schema rejects extra properties):

```json
{
  "receiptId": "ci-uuid",
  "provenance": "platform-attested",
  "actorLabel": "GitHub Actions release verifier",
  "sessionId": "verifier-session-id",
  "provider": "github-actions",
  "verifierRunId": "provider-run-id",
  "changeId": "change-id",
  "specHash": "<sha256>",
  "candidateTreeHash": "<sha256>",
  "releaseProofHash": "<sha256>",
  "evidenceRef": ".leo-dev/runtime/change/evidence/ci.json",
  "evidenceHash": "<sha256>",
  "status": "passed",
  "timestamp": "2026-09-14T00:00:00.000Z",
  "expiresAt": "2026-09-14T01:00:00.000Z"
}
```

`provider` is a label, not authentication. `github-actions` is distinct from
`local-verifier`; an accepted independent local verifier is recorded as local
and must never be presented as GitHub CI. The controller rejects a receipt if
its session equals the integration producer/reviewer session, if it reuses a
receipt ID, is expired, has a wrong proof/source/spec/candidate binding, or its
referenced evidence no longer hashes to `evidenceHash`.

`evidenceRef` names an inspectable JSON verifier result, not arbitrary bytes.
Its exact schema rejects extra properties and is:

```json
{
  "schemaVersion": 1,
  "changeId": "change-id",
  "specHash": "<sha256>",
  "candidateTreeHash": "<sha256>",
  "sessionId": "verifier-session-id",
  "verifierRunId": "provider-run-id",
  "provider": "github-actions",
  "status": "passed",
  "checks": [{
    "name": "integration-gate",
    "argv": ["node", "--test"],
    "exitCode": 0,
    "gateDefinitionHash": "<sha256>"
  }]
}
```

`checks` is nonempty; every entry has a nonempty name and argv array and an
`exitCode` of zero. At least one entry binds the release proof's exact
`integrationGateDefinitionHash`. The result must repeat the receipt's change,
spec, candidate, session, verifier-run and provider fields and have
`status: "passed"`. These fields are still unauthenticated local attestation
metadata. A `status: "failed"` report, a nonzero check, a mismatched field or
a report whose bytes no longer match `evidenceHash` refuses archival even if a
receipt claims `status: "passed"`.

The archive manifest is an input document with `schemaVersion`, `changeId`,
`releaseProofHash`, `artifacts` and `retrospective`. Each artifact is a
repository-contained `path` plus `sha256`; `retrospective` is one such
path/hash pair. It cannot name generated archive/release projections as input,
and every listed artifact must exist and hash exactly at archive time.

## Frozen public tests

`tests/cli/codex-release.test.ts` is the release contract. The completed
matrix must cover:

| Contract | Required observation |
| --- | --- |
| Legacy/no-role | completed ordinary tasks stop at `integration-review`; release has no journal write. |
| Finality and binding | malformed/non-final role and changed integration candidate refuse with no write. |
| Aggregate success | a verification-only final candidate, settled Gate and independent Standard review create release proof; an independent fresh verifier receipt and exact manifest archive it. |
| Source and authority drift | changed application or authority source after review/proof refuses without overwriting proof. |
| Artifact/evidence drift | changed manifest artifact or CI evidence refuses without a write. |
| Receipt policy | agent-asserted integration review; wrong, expired, replayed, same-session/same-producer, or non-passed receipt refuses without a write. |
| Inspectable CI result | a failed/nonzero/mismatched structured result refuses even when a matching-hash receipt claims passed; a passing result names the integration gate definition hash. |
| Recovery safety | an interrupted prepared/projection release or archive batch resumes only through existing recovery; an injected third projection value is never overwritten. |
| Terminality | no transition can leave `archived`; no command performs an external effect. |

The tests assert command envelopes and journal/projection bytes, not private
helper implementation. Until R2 production ownership is handed over, tests
are intentionally RED against the currently compiled CLI.
