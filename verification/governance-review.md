# G1 governance admission — independent final review

Date: 2026-09-07

## Outcome

**Architecture/code verdict: APPROVE for the bounded G1 Lite admission slice.**

No G1-blocking finding remains after the four review fixes below. This verdict is
limited to caller-supplied assessment validation, disposition, durable admission
history, route/refusal atomicity, and the related portable reference. It is not
approval of the unfinished controller roadmap, an installed release, automatic
architecture discovery, semantic repair certification, Standard/Full routing,
or authenticated governance.

The review used the real pre-edit comparison packet
`/private/tmp/leo-dev-governance-review.k1dHz4/g1-final-review.diff`; the
repository has no usable HEAD baseline and an empty Git diff is not evidence of
no change.

## Findings and closure

### R2 — P1 — duplicate assessment identity could poison committed state

**Original defect.** Identity uniqueness was checked only during history replay
in `packages/cli/src/governance/assessment.ts:140`, after a successor had already
been admitted. A schema-valid successor could reuse an earlier `assessmentId`,
commit its assessment projection plus a ready route/task, then fail while
constructing the response. Every later `status` failed with
`Recorded assessment history has duplicate immutable identities`.

**Reproduction.** Through the compiled CLI, record `assessmentId: duplicate-id`
with partial coverage, then submit a complete successor with the same ID and the
latest fingerprint. Before the fix, the second command returned exit 2 only
after `tasks.yaml` already contained the ready task; later status also returned
exit 2.

**Closure.** `governanceAdmission` now validates the prospective full history
before any projection or batch can be built
(`packages/cli/src/controller/controller.ts:633`). Immediate and earlier-history
duplicate tests assert unchanged journal, tasks, assessment inventory, and
readable status (`tests/cli/governance.test.ts:214`). **Closed.**

### R1 — P2 — dangling and ineligible resolutions were accepted

**Original defect.** An initial record could contain a resolution for a finding
that never existed, and a successor could add resolutions for unknown, low, or
unrelated prior findings. This did not change disposition, but made the immutable
audit record internally misleading.

**Reproduction.** A first complete assessment with an unrelated finding and
`resolutions[{findingId: never-existed}]` returned `ROUTED_LITE` before the fix.

**Closure.** Initial nonempty resolutions are rejected; every successor
resolution ID must name a relevant-high finding in the immediate predecessor
(`packages/cli/src/governance/assessment.ts:91`). Dry-run and actual regressions
assert zero writes (`tests/cli/governance.test.ts:176`). **Closed.**

### R3 — P2 — already-recorded evidence could satisfy freshness

**Original defect.** Freshness compared resolution evidence only with evidence
on the one high finding being removed. An unchanged hash already recorded on an
unrelated finding or prior resolution in the latest assessment could therefore
clear the blocker mechanically.

**Reproduction.** Record a high/local finding with hash A and an unrelated
finding with hash B; remove the high finding and cite unchanged B as its
resolution. Before the fix, the successor returned `ROUTED_LITE`.

**Closure.** A clearing resolution now needs at least one current content hash
absent from all finding and resolution evidence in the immediate predecessor
(`packages/cli/src/governance/assessment.ts:101`). The tests cover unrelated and
prior-resolution recycling and assert dry-run/actual zero writes
(`tests/cli/governance.test.ts:258`). This is deliberately not whole-history
deduplication or semantic proof. **Closed.**

### R4 — P2 — one record could retain and resolve the same high finding

**Original defect.** A successor could keep a finding relevant/high while also
recording a resolution for it. The disposition remained blocking, but the
immutable record simultaneously claimed opposite audit states.

**Closure.** Retain-or-resolve is now exclusive
(`packages/cli/src/governance/assessment.ts:106`). The regression covers both
dry-run and actual zero-write rejection (`tests/cli/governance.test.ts:303`), and
the R3 prior-resolution fixture now uses a valid two-finding A/B chain. **Closed.**

## Final compliance assessment

- Assessment input is schema-bounded, contained under the change runtime, and
  binds change, task, initialized spec hash, current subject-tree hash, and
  byte-checked evidence. Paths are normalized in the immutable projection.
- Disposition precedence is correct: relevant material at any severity is
  terminal; partial coverage or relevant unknown scope precedes relevant
  high/local; unrelated findings are retained without blocking; otherwise the
  assessment is ready.
- A ready assessment projection, recorded event, route, and task transition use
  one controller batch. Refusals commit only the assessment and create no route,
  task, or lifecycle transition. Dry-run shares admission validation and writes
  nothing.
- Assessment participation is sticky after the first record. Omission cannot
  return to the legacy path. A prior material disposition remains terminal even
  after an ordinary receipt or later ready-looking assessment.
- Committed projection hashes and normalized assessment history are replayed by
  ordinary reads and resume. Pending batch recovery preserves prior/desired/
  third-value behavior. Tampered immutable projection reads fail closed.
- `assessmentContext.subjectTreeHash` is recomputed for the current tree, while
  `recordedSubjectTreeHash` remains the historical pre-projection identity. The
  admission hash is not reused as later Gate/review freshness evidence.
- References and README distinguish source CLI, generated thin packages, and
  installed cache, and do not claim semantic detection, automatic repair,
  Standard/Full support, real-client loading, or release readiness.

## Reviewed edge rulings

- A complete linked successor may remove a prior low/unknown finding without a
  resolution. The approved accountability rule is specifically for prior
  relevant-high findings; incomplete/unknown assessment can be reassessed.
- The parser accepts a canonical absolute evidence path only when it remains
  repository-contained, then stores a repository-relative normalized path.
  Documentation prescribes relative input. This leniency does not weaken
  containment or artifact portability and is not a defect in G1.
- A current tree hash differing from the recorded admission hash after the
  immutable projection is expected. Treating those fields as interchangeable
  would be the bug; the implementation and references keep them distinct.
- Existing broad Lite allowed paths and generic task acceptance remain explicit
  limitations. G1 is an admission guard, not a repair scheduler or filesystem
  isolation mechanism.

## Verification evidence

Independent final checks after R1–R4 source freeze:

- `./node_modules/.bin/vitest run tests/cli/governance.test.ts`: exit 0,
  **21/21 passed** in 35.58 seconds.
- `shasum -a 256 -c /private/tmp/leo-dev-governance-review.k1dHz4/g1-final.sha256`:
  exit 0, **12/12 frozen implementation/portable files matched**.
- Static re-review of the final assessment evaluator, prospective-history seam,
  controller batch integration, recovery/coherence checks, schema, tests, and
  references: no open G1 blocker.

Main-thread final integration evidence, reported separately from the independent
narrow run above:

- `npm test`: exit 0, **276/276 passed**: 161 domain/controller, 8 adapter,
  and 107 Skill/CLI tests. The 54-case crash-atomicity file completed in
  216.6 seconds with no failure.
- `npm run typecheck`: exit 0.
- Python regression: exit 0, **6/6 passed**.
- Final adapter package build and static package verification: exit 0.
- Forward fixture: 2 functional tests, explicit boundary check, and final
  local/material status rechecks passed.

These checks establish the final local source regression gate and static package
integrity; they are not installed-client execution or release evidence.

No network operation, install, Git write, deployment, external publication, or
production-source edit was performed by this reviewer.
