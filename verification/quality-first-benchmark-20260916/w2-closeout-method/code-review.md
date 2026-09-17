# W2 candidate B closeout method: independent code review

## Verdict

**REVISION REQUIRED.** The upstream resources, license/provenance closure, and
candidate binding are sound, but two host-binding defects remain. They can
change when closeout runs and leave a real late gap without the approved next
authority path.

## Blocking findings

### 1. Closeout is exposed as an every-task rule instead of the approved last-ordinary-task rule

`skills/develop/SKILL.md:23` sends the final or remediation candidate of a
nontrivial ordinary task to closeout, and
`skills/develop/references/review-protocol.md:19` likewise applies to “a
nontrivial ordinary task's final submitted candidate.” Read normally, both
cover every nontrivial ordinary task. That conflicts with the approved plan's
single insertion point—the last ordinary implementation task—and with the
more specific statement at `skills/develop/references/upstream-methods.md:33`.

This is behavioral scope, not editorial wording. An actor can follow the public
skill entry and review protocol without resolving the contradiction in favor
of `upstream-methods.md`, producing repeated intent inventories and extra
review ceremony. Narrow both entry points to the last ordinary task's submitted
candidate and its remediation replacement. Keep this inside the existing
review required by the current risk policy: do not create a second reviewer
session merely for the method, and do not accidentally invalidate the explicit
Lite self-review rule at `review-protocol.md:25`.

### 2. The out-of-authority result omits the approved revision-proposal path

`skills/develop/references/review-protocol.md:23` correctly confines repair to
the current task's approved scope and allowed paths and forbids reopening a done
task, using the verification-only integration task for edits, and fabricating a
revision or approval. It does not state what the reviewer/coordinator must do
when the last live ordinary task cannot legally repair the finding.

The general handoff at `upstream-methods.md:38` only sends an implementation
error back to implementation/task, while the concrete `revise` guidance at
`upstream-methods.md:40` is framed around a Spec or constitution change. Neither
clearly covers a late implementation gap in an earlier path that the remaining
task does not own. The approved plan requires reporting that real authority
boundary and preparing the existing revision proposal; it forbids appending an
upstream convergence task or inventing a reopen. Add that positive fallback to
the closeout binding, while keeping proposal activation and approval under the
existing controller/user authority.

## Verified implementation properties

- Candidate A's lifecycle correction remains byte-identical to its accepted
  hash: `3731aa651f10e55d44d741faa2ae758bf73d4dd6b46e7804d4c5aa3c4a64812d`.
- The two cc-sdd resources at
  `29aee950f4addc36f9aeecb9881c46540e71ecc9`, Spec Kit `converge.md` and its
  license at `1d5106f59e1b148ee23ab136638932dd790ff1b6`, the reused cc-sdd license,
  and the older Spec Kit `analyze.md` plus license at
  `4a7341a93d944d6efe153b71da4a1adb9c2b578c` matched the exact pinned GitHub
  bytes. The recorded SHA-256 values are correct.
- `validateUpstreamResources('./skills/develop')` accepted the closed
  21-resource inventory. The verifier rejects unknown, missing, duplicate,
  malformed, escaping, symlinked, and hash-mismatched paths, and the second
  Spec Kit license has a revision-qualified package path.
- `NOTICE`, `components.json`, and provenance distinguish the two Spec Kit
  revisions, retain both licenses, reuse the correct cc-sdd license, and keep
  all five original cc-sdd `SKILL.md` resources renamed to byte-identical
  `RESOURCE.md` files under the single public `develop` entry.
- The local binding otherwise overrides the material raw-resource conflicts:
  controlled-tree inventory includes untracked files; Git is auxiliary and no
  `HEAD` or empty diff proves an empty change; hooks, scripts, task/checklist
  writes, automatic commits, completion dispatch, extra ledgers and duplicate
  review sessions are disabled; `FEATURE_GO`, boot smoke, and GO language have
  no task/integration/release authority; only `TASK`, `FIX`, and
  `TEST_OR_BUILD` apply.
- The existing candidate-bound receipt is retained and binds task/revision,
  Run, lease generation, specification/task hashes and submitted tree, with
  the change context supplied by the controller. A replacement candidate must
  receive fresh claim, Gate and submission evidence plus a complete closeout
  or an explicit re-evaluation of every inventory item and prior finding.
- Original approved intent remains authoritative. The adapter preserves stable
  requirement identifiers, legal implementation alternatives, justified
  comments, project-specific evidence, and the distinction between missing
  evidence and a reproduced defect.

## Independent checks

- `npx vitest run tests/skill-contract/develop.test.ts`: 6 tests passed.
- Direct resource validation: 21-resource inventory passed.
- Direct SHA-256 and byte comparison against the six pinned GitHub source and
  license files listed above: passed.
- Before-image comparison covered all seven edited existing files. The four new
  resources are the only new production resource files in this bounded delta.

The shared distribution was not rebuilt and the full regression was not run;
those remain with the root acceptance owner. These checks establish source
identity, packaging closure, and most static host bindings. They do not show
that an installed DEV actor reads or applies the methods to the current
candidate, or that Candidate B improves behavior. That requires the later
installed A+B DEV trials and their consumption traces after these blockers are
repaired.

## Narrow re-review after wording repair

**ACCEPTED.** Both blocking findings above are resolved. This decision preserves
the initial rejection and covers only the two-file wording repair.

- `skills/develop/SKILL.md:16,23` and
  `skills/develop/references/review-protocol.md:19` now consistently restrict
  closeout to the last ordinary implementation task's submitted candidate and
  its replacement after remediation. The review protocol expressly inherits
  that task's existing risk and provenance policy; it no longer implies a new
  independent session, and the existing Lite labelled-self-review rule remains
  unchanged at line 25.
- `skills/develop/references/review-protocol.md:23` now directs the coordinator
  to prepare the existing revision proposal and report the real missing
  authority when the live task's scope or allowed paths cannot admit the
  repair. The same sentence block still forbids reopening a done task, product
  edits in the verification-only integration task, fabricated revision or
  approval, and any second receipt or ledger.
- The retained `before-fix/` files match the initially reviewed hashes
  `a985f8f1ef434f218429a766a3ab0f64727784fd7279e07ccfb59b39a4edb47f`
  and `1b273212a4591f1da88ed7b074ba9b8b35350a96a4bf5e484e608a1a50267b0a`.
  The accepted repaired files hash to
  `e85114656ef5e0a4d35e087014c206229a26ee9942c6b377eddb75dbc36a5474`
  and `045129d7d5471ffb3ed1ea2ca355272a33404788d0f0ba3d301647b268d6e4f3`
  respectively.

The worker records 6 focused skill-contract passes, a deterministic temporary
portable-package check, and the unchanged 21-resource validation. I did not
repeat the broader source-byte, packaging, or regression checks because their
inputs did not change; the root acceptance owner is running the full suite.
Installed DEV consumption and any behavioral benefit remain unverified until
the planned A+B actor trials inspect actual resource reads and current-candidate
application.
