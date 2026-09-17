# C2 frozen-source final review

Date: 2026-09-09  
Scope: bounded C2 candidate identity, immutable Lite plan/serial lifecycle, shared Gate/review failure budget, unknown reconciliation, crash handoff, and corresponding source guidance. This is a static source review against `/private/tmp/leo-dev-c2-baseline.D6NyCk/`; no HEAD/commit comparison was used and this reviewer ran no build, test, Controller command, live Agent, install, network, Git, or cleanup operation.

Reviewed frozen identities:

- `packages/cli/src/controller/controller.ts`: `f8dbd2c572fd2b45745e55257d5db94c740ad831ee894c2ad2033825a5f7d440`
- `packages/cli/src/state/snapshot.ts`: `ef7947fda4ada339dfc75ba172e7b1d19c5db2063dd17a229631244a8536f61d`
- `packages/cli/dist/controller/controller.js`: `a806b227993793f341d382b074a0160e450f030a91af38108a77c59eee0849db`
- Baseline controller: `962942cdb1705f1b0077bbb58f1461dfb014bfe2a4be8a7726581480068649ae`

Final full regression completed on these exact post-guard hashes. The pre-guard history and final-hash evidence are separated below.

## Resolved final finding

### Important — safe-abandoned reconciliation was broader than the zero-cost recovery allowed by the four-attempt policy

The distinct normative abandoned transition justifies zero budget consumption when the durable Gate phase history proves argv was never released and the receipt says `sideEffectDisposition: not-started`. The earlier frozen implementation accepted every schema-valid safe-abandoned receipt without examining that disposition or phase boundary, so a post-release unknown attempt could be repeatedly returned to ready without consuming the nominal fourth/fresh-debug attempt.

Closed in the final source. Shared dry/actual `reconciliationPlan` now permits safe abandonment only when the receipt says `not-started` and no `gate.attempt.released` event for the exact task/Run has a hash in the already-validated unknown context (`controller.ts:1062-1093`). Other safe-abandoned combinations fail closed without changing the journal or being reclassified as failed. Existing `resolvedRunState: failed` remains the only branch that consumes the shared failure budget and releases the lease.

### Follow-up — valid unreleased abandonment was falsely unsettled during `resume`

The first narrow guard exposed a separate recovery conflict in the pre-existing `resume` scan. A successful safe-abandoned reconciliation intentionally leaves the raw Gate prefix nonterminal: fabricating `gate.attempt.aborted` would overwrite what is actually known. Its committed reconciliation instead terminalizes the Controller Run as `abandoned`, fences the exact old lease, returns the Task to ready, and resumes the Change. The former blanket unfinished-Gate check still required an `unknown` Run, so an otherwise valid later `resume` returned `BLOCKED`.

Closed with a per-attempt administrative-settlement predicate, not a global relaxation (`controller.ts:1726-1777`, `1856-1868`). It is reached only after the existing Gate-history verifier has accepted the exact standalone-unknown history. Every unfinished attempt must independently contain only one prepared and at most one started phase, with no release or raw terminal; bind to the claimed Run and unknown context; project as an abandoned Run; and have one matching committed `reconcile` batch. That batch must contain exactly one safe `abandoned`/`not-started` receipt, one matching Run `unknown -> abandoned`, one Task `blocked -> ready`, and one `lease.abandoned` whose old Lease payload and task/revision/generation match. Any unrelated unfinished attempt makes the whole predicate false. The check correctly uses the old fencing event rather than requiring the task's current lease to be inactive, so a later higher-generation claim does not invalidate the administrative closure.

## Closure of earlier independent findings

| Prior finding | Frozen-source disposition |
| --- | --- |
| Changed-candidate terminal handoff resumed against Lease input | Closed. Historical verification, dry resume, complete-tail resume, and incomplete-tail resume pass the candidate selected by exact task/Run into settlement inspection (`controller.ts:896-923`, `493-533`, `1826-1854`). |
| Existing candidate registration let a changed retry omit `--run` | Closed. Both dry and actual paths re-evaluate changed output before returning the existing registration and require the matching active Run (`controller.ts:563-586`, `1353-1362`). |
| Pre-registration reconciled success could submit but never review | Closed with a narrow compatibility migration. Only a historical claim lacking the C2 entry baseline can synthesize an unchanged candidate, and current tree, lease input, unknown context, task, revision, generation, spec, and task hashes must match before the candidate is durably registered and submit re-admitted (`controller.ts:1013-1032`, `1034-1059`, `1574-1591`). It does not refresh changed or stale evidence. |
| `run-gates` dry-run omitted lease/generation/expiry and binding checks | Closed. Dry and actual validate the same active task/Run, live lease generation/expiry, supplied Run, existing candidate binding/drift, first-registration scope, and Gate preflight (`controller.ts:558-594`, `1496-1526`). |
| Failed unknown reconciliation neither spent budget nor released the lease | Closed. Remaining budget is recomputed from current failure events, and the reconciliation batch records exactly one failure plus lease release before remediation or fourth-failure blocking (`controller.ts:1062-1093`, `1696-1723`). Replay cannot reapply because the addressed Run is no longer unknown. |
| Mixed missing/present prior session labels certified fresh debug | Closed. The fourth claim requires every prior claim to have a nonempty label, then requires the new label to differ from every prior label (`controller.ts:1247-1264`). Labels remain explicitly unauthenticated metadata. |
| Reused review receipt ID could spend budget again | Closed. Review admission rejects any previously ingested review receipt ID before candidate/verdict processing, and the rejection failure and receipt remain in one CAS batch (`controller.ts:993-1010`, `1615-1648`). |
| Claim dry-run diverged from remediation/serial/budget/session admission | Closed. Dry and actual share `claimAdmission`, covering ready/remediation state, routed task identity, four-attempt limit, complete fresh-session provenance, and the single active-lease owner (`controller.ts:588`, `1247-1275`). |
| Plan dry-run required legacy task/gate and skipped plan/governance checks | Closed. Dry and actual enforce mutually exclusive route modes, contained plan/registry paths, schema/DAG/initial-state semantics, every Gate binding, no incremental route, and the C2 assessment prohibition before writes (`controller.ts:534-558`, `1161-1217`). |

## Supported architecture and regression quality

- Plan admission rejects empty, duplicate, missing/self/cyclic dependencies, precompleted or otherwise invalid initial states, non-Lite risk, empty acceptance, non-normalized paths, and gate cardinality other than one. Route records all task authorities and the identical tasks projection in one Controller batch; snapshot seeding retains dependent `pending` states (`controller.ts:136-160`, `1190-1214`; `snapshot.ts:104-107`).
- Claims use journal-derived task identity and one serial active lease. Review pass releases the current owner and unlocks only successors whose complete dependency set is done in the same batch; integration is emitted only after every routed task is done. Rejection releases the same owner without unlocking successors (`controller.ts:1247-1312`, `1615-1677`). No duplicate authority or cross-task candidate/review selection was found.
- Gate failure, review rejection, and resolved unknown failure write the same per-task/revision failure authority. Ordinals 1-3 lead to remediation/fresh-debug admission; ordinal 4 blocks Task and Change. The task definition/hash is immutable because second/incremental route is refused (`controller.ts:115-123`, `1471-1488`, `1624-1648`, `1705-1721`).
- Candidate scope compares the complete canonical entry set, so addition, removal, content, and mode changes are detected; protected spec, registry, and Controller state paths are refused before allowed-path matching. Registration is immutable per Run and later tree drift conflicts rather than replacing its hash (`controller.ts:1330-1383`).
- The eight-line crash-test adjustment does not loosen an outcome assertion. It first faults and recovers the newly separate candidate-registration batch, then applies the original fault at the Gate-result/unknown handoff boundary; the original recovery assertions remain (`tests/cli/crash-atomicity.test.ts:362-374`, `477-491`).
- The source guidance accurately limits enforcement to C2 Lite, describes exact/`src/**` path authority rather than treating literal `src` as recursive, distinguishes accepted rejection from completion, retains unauthenticated session/receipt labels, and stops multi-task governance and Standard/Full at unsupported boundaries. The forward-check report is correctly labelled source-only, not live execution.

## Evidence adjudication

The earlier pre-guard `final-cli-regression.json` reports 137/137, but it is not represented as final-hash evidence. On the final source/dist hashes, retained focused artifacts report: post-release safe-abandoned refusals plus the other execution-budget cases 8/8; the safe pre-release crash/reconcile/resume case 1 passed with 54 intentionally filtered; and the existing positive safe-abandonment case 1 passed with 25 intentionally filtered. The positive fixtures are explicitly synthetic, hash-linked no-release histories; they are not labelled as real launcher-interruption trials. They exercise committed and crash-recovered reconciliation, byte-idempotent repeated resume, two historical administratively settled attempts, and monotonically higher successor generations.

Final native artifacts on the frozen hashes report `final-core-v2.json` 161/161, `final-cli-v2.json` 141/141 with no failures or skips, and `final-adapter-v2.tap` 8/8. The CLI total includes plan 10/10, C2 baseline 5/5, candidate 10/10, execution 8/8, crash atomicity 55/55, vertical 26/26, governance 21/21, and skill contract 6/6. Main additionally reports build/typecheck, Python doctor 6/6, and the historical experiment 13/13 passed. This is 310 passing Node/TypeScript checks plus the separately reported Python checks.

The crash setup change targets the intended post-registration boundary rather than weakening assertions. Synthetic approvals/reconciliations are labelled test-only and unauthenticated. The controlled real-Codex fixture stopped before approval: no approval receipt, claim, implementation, Gate, submit, or review occurred. The installed develop entry remained unchanged; generated packages were not installed or loaded. The source-only guidance forward check is not a live Agent acceptance result.

## Bounded verdict

**Accepted for the bounded C2 source seam at the final hashes above; no actionable finding remains in the reviewed scope.** The four candidate findings, five plan/budget findings, safe-abandoned budget guard, and narrow resume compatibility issue are closed without refreshing stale evidence or relaxing unrelated Gate recovery. The final build/typecheck and retained regression artifacts are green, including the full 55-test crash-atomicity suite.

This verdict does not label the whole plugin, installed adapters, Standard/Full workflows, release flow, or real Codex execution ready. Real controlled execution remains blocked on explicit approval and was not performed.
