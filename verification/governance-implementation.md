# G1.1 governance-admission implementation evidence

Date: 2026-09-07

## Scope delivered

Implemented only the bounded local CLI admission slice. `route` accepts optional
`--assessment <path>` and evaluates caller-supplied, unauthenticated YAML/JSON
under `.leo-dev/runtime/<change>/`. It does not discover architecture debt,
execute assessment text, schedule repairs, create new lifecycle states, or
authorize material work.

The normalized immutable decision projection is versionable:
`.leo-dev/changes/<change>/assessments/<assessment-fingerprint>.yaml`.
The raw input remains runtime-only and is therefore excluded from the canonical
source tree hash. The supplied `subjectTreeHash` is checked before this
projection is written and is historical afterward.

## Concrete public/input contract

`architecture-assessment` schema version 1 requires:

```text
schemaVersion, assessmentId, changeId, taskId, specHash, subjectTreeHash,
coverage: complete|partial,
findings[]: { id, severity: low|medium|high,
  relation: worsened-by-change|required-by-change|unrelated,
  boundary, rationale, evidence[]: { path, sha256 },
  repairScope: local|material|unknown }
```

Optional successor fields are `previousAssessmentFingerprint` and
`resolutions[]: { findingId, rationale, evidence[] }`. Unknown fields, duplicate
finding/resolution IDs, non-contained or symlink files, hash mismatches, and
oversized input/evidence are rejected. Limits are 256 KiB input, 1 MiB per
evidence file, 128 evidence references, and 8 MiB total evidence bytes.

The shared `state.assessmentContext` exposed by route/status/inspect is:

```text
{ changeId, specHash, subjectTreeHash, status,
  latestAssessmentFingerprint, recordedSubjectTreeHash, latest }
```

`subjectTreeHash` is current canonical-tree identity. `recordedSubjectTreeHash`
is the immutable latest assessment's historical admission binding (or `null`).

Disposition precedence is material relevant finding -> `approval-required`
(exit 6), then partial/unknown relevant scope -> `assessment-required` (exit
7), then relevant high/local -> `local-remediation-required` (exit 7), else
`ready`. Unrelated findings remain recorded but do not block. A material
decision remains terminal in this slice. Once any assessment exists, omitting
the option returns assessment-required (or approval-required for material) and
cannot re-enter legacy routing.

Successors name the latest fingerprint. A prior relevant/high finding is only
considered retained if its same ID remains relevant/high. Removal, downgrading,
or marking it unrelated requires a resolution with rationale and at least one
new evidence hash; mere same-ID retention at lower severity is rejected. This
checks accountable linkage and fingerprints, not semantic truth of the repair.

## Files changed

- `schemas/architecture-assessment.schema.json` (new)
- `packages/cli/src/governance/assessment.ts` (new focused parser,
  normalization, evidence binding, classification, history validation)
- `packages/cli/src/schema/load.ts`
- `packages/cli/src/controller/batch.ts`
- `packages/cli/src/commands/route.ts`
- `packages/cli/src/controller/controller.ts`
- `tests/cli/governance.test.ts` (new compiled CLI coverage)

`npm run build` also refreshed ignored/local `packages/cli/dist` output; it was
not treated as a source or install artifact.

## TDD evidence

RED was run before production changes:

```text
npm run build && ./node_modules/.bin/vitest run tests/cli/governance.test.ts
4 tests failed:
- legacy route had no assessmentContext
- each --assessment invocation exited 2 (unknown option), rather than ready/
  local refusal/anti-bypass behavior
```

GREEN after implementation:

```text
npm run build                                      PASS
vitest run tests/cli/governance.test.ts            PASS (13 tests)
npm run typecheck                                  PASS
```

The 13 real CLI cases cover legacy status, ready persistence, local refusal,
partial and unknown scope, low/medium material precedence, unrelated debt,
omission bypass, stale tree/evidence, malformed/missing/outside/symlink input,
supersession downgrade/resolution freshness, dry-run zero writes, immutable
projection tamper detection, and crash recovery of the assessment+route batch.

## Self-review and boundaries

- Assessment record and route/task projections share one controller batch when
  ready; refusal records only the immutable assessment batch and no route or
  lifecycle transition.
- Ordinary `readEvents` verifies every committed assessment projection and
  recomputes immutable linkage/disposition; this is reached by status, inspect,
  and resume.
- Existing task/gate/review current-tree freshness was not weakened. The
  historical admission hash is not reused as a perpetual claim-time guard.
- No full suite, deployment, network call, installation, commit, push, or
  upstream/controller replacement was performed by this implementation worker.

Remaining limitation: this is provenance-bearing admission only. It neither
performs automatic architecture analysis nor proves evidence/repaired code is
semantically correct; configured gates and reviews remain required.

## R1 audit-integrity follow-up (2026-09-07)

Independent review reproduced an admission defect: the initial-assessment branch
returned after checking only `previousAssessmentFingerprint`, while successor
validation iterated only previous relevant/high findings. Consequently,
non-empty initial `resolutions` and successor resolutions for unknown, low, or
unrelated previous finding IDs were ignored.

Root-cause RED (compiled CLI, before the fix): `npm run build &&
./node_modules/.bin/vitest run tests/cli/governance.test.ts` produced 3 expected
failures. An initial orphan resolution admitted with exit 0; unknown and
low/unrelated successor resolution IDs proceeded to their ordinary exit-7
refusal rather than schema-invalid exit 2.

The minimal fix in `packages/cli/src/governance/assessment.ts` rejects any
non-empty initial resolution list. For successors it builds the latest prior
relevant/high ID set, rejects every resolution outside that set, then retains
the existing removal/downgrade/fresh-evidence loop unchanged. Empty arrays
continue to normalize away. No additional semantic repair restriction was
added.

Added compiled CLI tests in `tests/cli/governance.test.ts` for dry-run and
actual initial-orphan zero-side-effect rejection, unknown successor ID, and
prior low/unrelated ID. The pre-existing valid high-finding resolution test
continues to pass.

R1 GREEN:

```text
npm run build                                      PASS
vitest run tests/cli/governance.test.ts            PASS (16 tests)
npm run typecheck                                  PASS
```

R1 precise source/test diff: `packages/cli/src/governance/assessment.ts`
adds two validation branches inside `requireSupersession`; `tests/cli/
governance.test.ts` adds three public-CLI regression cases. This verification
record is the only documentation file changed for R1.

## R2 prospective immutable-history follow-up (2026-09-07)

Independent review found that duplicate `assessmentId` values were rejected
only when the next ordinary read replayed the just-committed assessment event.
An immediate duplicate could therefore be committed with a route/task, return a
schema error while responding, and leave subsequent status unreadable.

RED: two new public CLI tests reproduced this. An immediate duplicate passed
dry-run with exit 0; an earlier-history duplicate appended a third
`governance-assessment` batch before its test observed journal drift.

The bounded controller fix constructs the candidate `RecordedAssessment`, then
calls the existing `verifyRecordedHistory([...history, recorded])` before
returning from the shared `governanceAdmission` seam. Thus dry-run and actual
route take the same preflight validation before projection or batch creation.
No migration or repair of already-corrupt reviewer fixtures was added.

R2 GREEN:

```text
npm run build                                      PASS
vitest run tests/cli/governance.test.ts            PASS (18 tests)
npm run typecheck                                  PASS
```

The two regressions cover immediate duplicate ID in dry/actual ready-candidate
paths and an earlier historical duplicate in a partial-refusal path. They
assert journal/tasks/assessment-projection stability and readable status. R2
precise diff: `packages/cli/src/controller/controller.ts` adds the one
prospective-history call; `tests/cli/governance.test.ts` adds two real CLI
tests; this record is updated with evidence.

## R3 immediately-previous evidence freshness follow-up (2026-09-07)

Independent review found that the required “fresh” resolution proof was tested
only against the prior relevant/high finding's evidence. A resolution could
therefore recycle a hash already present in an unrelated finding or a prior
resolution of the immediately preceding assessment and still clear a high
finding.

RED used two public-CLI dry-run reproductions. Both returned exit 0: first,
resolution evidence recycled a latest unrelated finding hash; second, it
recycled a hash in the latest assessment's resolution list. Each test also
asserts that dry and actual rejection leave journal and tasks unchanged.

The minimal fix computes one set of evidence content hashes from **all**
findings and resolutions in the immediately previous assessment, then reuses
that set in the existing mandatory-resolution freshness test. This is not a
whole-history detector and does not purport to prove semantic repair truth;
existing material/R1 linkage rules remain unchanged. The earlier test with a
genuinely new evidence hash remains green.

R3 GREEN:

```text
npm run build                                      PASS
vitest run tests/cli/governance.test.ts            PASS (20 tests)
npm run typecheck                                  PASS
```

R3 precise diff: `packages/cli/src/governance/assessment.ts` broadens only
the previous-assessment evidence set used by the existing freshness branch;
`tests/cli/governance.test.ts` adds the two recycled-evidence regressions;
this record captures separate RED/GREEN evidence. Source is frozen for the
main thread's final integration suite and independent closure review.

## R4 retained-high/resolution consistency follow-up (2026-09-07)

Audit review identified a contradiction in the same-ID retention branch. A
successor resolution passed the prior-relevant/high ID allowlist, then the
same current finding remained relevant/high and the retention `continue`
skipped resolution validation. This admitted a record that both claimed the
finding resolved and retained it as blocking.

RED: a compiled CLI dry-run with a current same-ID relevant/high finding and a
non-empty, fresh resolution exited 7 (ordinary local-remediation refusal)
rather than schema-invalid exit 2. The regression also checks the actual
command leaves journal and task artifacts unchanged.

R4 adds one guard immediately before the existing retained-high `continue`:
such a finding remains accepted only when it has no resolution. A merely
retained high finding without a resolution keeps its existing disposition and
behavior.

The R3 prior-resolution fixture was also corrected into a valid chain: an
initial A/B high assessment; a successor that resolves A with fresh evidence
and retains B high; then an attempted B resolution that recycles A's prior
resolution evidence. This preserves R3 coverage without relying on the
contradictory record now rejected by R4.

R4 GREEN:

```text
npm run build                                      PASS
vitest run tests/cli/governance.test.ts            PASS (21 tests)
npm run typecheck                                  PASS
```

R4 precise diff: `packages/cli/src/governance/assessment.ts` adds the single
contradictory-resolution guard; `tests/cli/governance.test.ts` adds the
dry/actual zero-write regression and corrects the R3 fixture; this evidence
record adds the separate RED/GREEN receipt. Source is frozen for main's final
suite and independent review closure.
