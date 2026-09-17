# Architecture/debt admission — local slice G1

This reference describes the G1 implementation contract. Consult `verification/governance-admission.md` for actual validation status. It is not a claim of complete architecture governance or a three-client release.

## What this slice does

The existing `route` command accepts a caller-supplied, evidence-bearing assessment before admitting one Lite task. It validates format, current file fingerprints, decision precedence, and recorded history. It does not discover debt, validate semantic judgments, implement repairs, authenticate a reviewer, or schedule a multi-task repair dependency graph.

The command is additive: legacy calls stay usable but report `not-assessed`. Once a change has recorded an assessment, omitting it cannot take the legacy path. Standard/Full work remains unsupported by the Lite public route; do not downgrade it to use this feature.

## Inputs and sequence

Use an existing approved project specification and a reviewed gate ID from the project's gate registry. `tests` is not a universally installed gate. In this development checkout the CLI is run as `node packages/cli/dist/index.js`; the `leo-dev` shorthand below requires a separately installed CLI and is not evidence that it is on PATH.

1. Initialize a new change with `leo-dev init --change <id> --spec <project-spec>`.
2. Run `leo-dev inspect --change <id>` or `leo-dev status --change <id>`. Read `state.assessmentContext` for `changeId`, `specHash`, and the current `subjectTreeHash`. For a successor, use `latestAssessmentFingerprint`; `recordedSubjectTreeHash` describes the historical input, not the current tree.
3. Write the assessment input under `.leo-dev/runtime/<id>/`, which is excluded from canonical source-tree hashing. Put actual source/test evidence in normal versioned project files and hash its current bytes. Refresh the assessment context after source, spec, or evidence changes.
4. Run `leo-dev route --change <id> --task <task-id> --gate <gate-id> --assessment .leo-dev/runtime/<id>/assessment-input.yaml`. The optional `--registry` remains the project's reviewed gate-registry path. `--dry-run` performs the same assessment preflight without writing a record or task.
5. Follow the returned disposition. A ready admission does not skip the existing specification approval, claim, Gate execution, submit, or review requirements.

The schema is `schemas/architecture-assessment.schema.json`. Its normalized shape is:

```text
schemaVersion: 1
assessmentId: unique assessment identifier
changeId: initialized change identifier
taskId: task identifier supplied to route
specHash: current initialized specification SHA-256
subjectTreeHash: current hash from assessmentContext
coverage: complete | partial
findings:
  - id: unique finding identifier
    severity: low | medium | high
    relation: worsened-by-change | required-by-change | unrelated
    boundary: affected architectural boundary or behavior
    rationale: observed issue and how this change affects it
    evidence: [{path: repository-relative file, sha256: current file SHA-256}]
    repairScope: local | material | unknown
previousAssessmentFingerprint: previous record fingerprint, for a successor
resolutions:
  - findingId: previous relevant high-risk finding being resolved
    rationale: why it is no longer a blocker
    evidence: [{path: repository-relative file, sha256: current file SHA-256}]
```

This is a field reference, not runnable fixture data. `previousAssessmentFingerprint` and `resolutions` are omitted on an initial assessment. `complete` and an empty finding set are caller assertions, not proof of an exhaustive audit. Do not embed credentials, raw logs, or source contents in a rationale.

## Disposition and persistence

| Supplied evidence-bearing assessment | Result | Admission |
| --- | --- | --- |
| Any relevant repair is material | `approval-required`, exit 6 | No route/task; scope decision needed |
| Otherwise coverage is partial or relevant repair scope is unknown | `assessment-required`, exit 7 | No route/task; assess further |
| Otherwise a relevant high-risk repair is local | `local-remediation-required`, exit 7 | No route/task; perform authorized local repair first |
| None of the above | `ready`, normal Lite result | Existing Lite task is admitted |
| No assessment and no recorded governance history | `not-assessed`, legacy Lite result | No governance assurance |

Unrelated findings are retained without scheduling cleanup or blocking the feature. A material-scope finding cannot be evaded by labelling its severity low. A previously blocking local finding cannot be made ready merely by retaining its ID while downgrading severity or changing its relation: an explicit resolution with current evidence is required.

An initial record cannot contain nonempty resolutions. Each successor resolution must name a relevant-high finding in the immediately previous assessment. Retaining that same finding as relevant-high and claiming its resolution in one assessment is contradictory and invalid; partial remediation can retain the blocker without claiming it resolved. When such a finding ceases to block, at least one resolution evidence content hash must be absent from **all evidence in that previous assessment**, including other findings and previous resolutions; recycling an already-recorded unrelated file does not qualify. This is the precise mechanical meaning of fresh supporting evidence here, not a semantic repair proof or a uniqueness check across all older assessments.

The normalized record is immutable under `.leo-dev/changes/<id>/assessments/<fingerprint>.yaml`, with an atomic `architecture.assessment.recorded` journal event. Refusals record the assessment without fabricating lifecycle state changes; an admission decision called `approval-required` is not itself a new ChangeState transition. Source input stays under runtime and may be replaced for a successor. Ordinary reads/resume validate immutable record coherence.

The admission tree hash describes the tree before the record was written. The record itself changes the versioned tree, so its old hash must not be misreported as current verification. Later Gate and review evidence remains bound to the current candidate through the existing controller checks.

## Repair and scope boundaries

For local repair, keep changes inside the already approved module/contract scope, use regression evidence, then inspect again and submit a linked successor that accounts for the previous relevant high-risk findings. The controller checks the record/evidence linkage, not whether the claimed repair is semantically correct. Existing tests and review still matter.

The existing Lite route still creates a task with `allowedPaths: ['.']` and a generic acceptance entry; G1 does not derive a narrower file allowlist or executable acceptance from the assessment. The host Agent and reviewer must preserve the approved local repair boundary. Do not describe this admission check as filesystem isolation or automatic repair-scope enforcement.

For a material-scope refusal, stop. This slice has no automatic architecture-approval continuation. An ordinary unauthenticated receipt, a new ready assessment, or omission of the option cannot clear that decision. Obtain the actual user decision and replan an appropriately supported change; do not treat starting another Lite change as permission to evade the scope boundary.

## Verification boundaries

- CLI tests establish the encoded admission rules and persistence behavior, not a measured reduction in project debt.
- A Skill reference application exercise establishes that the command can be used from the guidance, not universal model compliance.
- Static package verification does not establish that Claude Code, Cursor, and Codex all loaded and executed the new workflow.
- No production application, training run, model provider, or installed plugin is modified by the admission command itself.
