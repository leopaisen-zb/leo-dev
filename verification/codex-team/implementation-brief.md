# C3.1 implementation brief

Read the normative C3 amendment in `.scratch/unified-development-plugin/spec.md` and active C3 plan. This brief fixes the first team seam's API, not full product acceptance.

## Ownership and constraints

Own new `packages/cli/src/team/{types,protocol}.ts`, `packages/cli/src/commands/team.ts`, narrow registration/delegation edits in `controller/controller.ts` and `index.ts`, and `tests/cli/codex-team.test.ts`. Write your report to `verification/codex-team/implementation-report.md`. You are not alone: main owns skills, adapter packaging, specs and acceptance artifacts. Preserve others' changes. No subagents, Git mutations, installs, new dependencies, network or global defaults. Before changes save owned existing source/test copies in a task-specific temporary directory for an actual uncommitted diff; repo has no HEAD and all files are untracked. Use apply_patch.

## Public interface

Expose `leo-dev team --change ID --action status` and `leo-dev team --change ID --action record --input REPO_RELATIVE_JSON_OR_YAML [--dry-run]`. Usual `--repo`/`--json` envelope. Return code `TEAM_STATUS` for read; `TEAM_RECORDED` after new append; `TEAM_REPLAYED` for exact idempotent replay; `DRY_RUN` for valid nonmutating record. `--help` discovery must advertise the team command and its actions/options without pretending the current general help lists flags. Do not change other command semantics.

`state.team` is null before open, else `{schemaVersion:1,teamId,specHash,revision,members,messages}`. `revision` increments once per accepted new team operation; not when unrelated journal events arrive. The response also exposes `currentSpecHash` and `stale` (current Spec differs from opened team); status is usable for diagnosis of drift, but no new team mutation may consume stale Spec. Team state is a projection from `team.operation.recorded` events in the EXISTING change journal. Do not create a second journal/snapshot/task authority. Include a clear `provenance: 'host-reported-not-authenticated'` response marker.

Every record is a strict object with `schemaVersion:1`, nonempty bounded `requestId`, `teamId`, `expectedRevision` (integer >=0), `specHash` (64 lowercase hex), and `operation` (one of below). Reject unknown fields, invalid lengths/types, impossible references and invalid operations. Return `VALIDATION_ERROR`/2 for invalid input and `CONFLICT`/5 for stale/reused identities. Never map ordinary malformed inputs to INTERNAL_ERROR. JSON/YAML input and referenced artifacts must be contained regular files, not symlink escapes; reuse existing containment checks. Check inputs before journal mutation, including dry-run.

1. `{type:'open', members:[{memberId,role,access:'read'|'write'}]}` — only when no team, expectedRevision 0; 2–12 unique members, descriptive role (bounded 160 chars), max ONE writer. No hardcoded models. IDs are bounded simple identifiers. A member begins generation 0 with no thread.
2. `{type:'bind',memberId,threadId,expectedGeneration,reason,handoffMessageId?}` — bind a real host-observed nonempty thread ID (bounded 256 chars) and advance member generation. Reject the same thread ever being used by two different logical members (independence); exact request replay remains idempotent. First binding expectedGeneration 0; replacing generation >=1 requires an existing handoff message addressed to/from that member at its CURRENT generation, plus reason. Revalidate that handoff artifact's current content/hash before accepting replacement; stale/overwritten handoff is not recoverable context. Rebinding the same handle is not lost-member recovery: use followup without a new bind. Preserve historical bindings and messages. A bound generation is a correspondence fence, NOT an implementation lease.
3. `{type:'message',messageId,kind:'contribution'|'challenge'|'response'|'handoff',fromMemberId,fromGeneration,toMemberId,toGeneration,artifact:{path,sha256},replyTo?}` — both distinct members currently bound at exact generations. Unique messageId; file's actual SHA256 must match. Require replyTo for response and verify it refers to a preceding challenge addressed to this sender from this recipient. Artifacts contain original bounded engineering content, not executable commands; max 32 KiB. Store ref/hash, not unbounded text or secrets. No automatic file-writing or transport. Message starts `pending`.
4. `{type:'ack',messageId,recipientGeneration,hostReference}` — receipt of actual host-observed delivery, nonempty bounded hostReference; message must be pending and both binding generations still current. Ack does not imply agreement or code acceptance. Messages for fenced threads remain visibly stale/pending; they are not silently re-addressed or delivered. Re-ack with another requestId may be refused as CONFLICT; exact request replay returns TEAM_REPLAYED.

Idempotency: same requestId and identical canonical payload must not append twice. A changed payload with that ID is CONFLICT. A retry of an already accepted operation may bypass outdated expectedRevision only for identical payload, but must not hide a changed Spec. All new operations validate current expectedRevision, member generations and Spec. Serialization must ensure two concurrent operations based on one team revision cannot both commit.

## Integration

Use existing controller context/read initialization and projection checks plus journal CAS/batch infrastructure. Preflight initialized change and complete committed journal; no append after a pending batch, incomplete tail, unknown-effect or other unsafe recovery barrier. Reusing the normal protected context is preferred over recreating it in a parallel controller. The team command cannot emit lifecycle/approval/candidate/lease operations or edit application source. Ordinary inspect/status/resume must continue to work after team events. Team record is not a gate and cannot bypass Standard/Full restrictions.

Keep policy/state reduction in team/protocol, not hundreds of unrelated lines added to controller. The controller may pass validated context (logical events, actual spec identity, journal and expected tail) into it and commit its one operation. No team-specific model API client/process manager. No arbitrary callable command dispatch expansion.

## RED/GREEN acceptance (literal behavioral expectations)

Use real compiled CLI in isolated fixtures and actual journal, not mocked team operations. Run `npm run build && npx vitest run tests/cli/codex-team.test.ts` before implementation and retain why RED fails.

- Fresh initialized fixture: status team null; open at revision0 → revision1; bind architect and reviewer to distinct IDs → revisions2/3. Fresh CLI process status retains these identities, and ordinary lifecycle status/tasks/runs/leases are unchanged.
- Record contribution artifact, then status message pending; ack with observed host ref makes delivered. Each mutation increments revision once. Same request retry changes no journal bytes; changed-payload same ID refused.
- Follow-up response requires correctly reversed challenge lineage; unrelated/missing replyTo and unbound/unknown sender/recipient refused without writes.
- Lost-member bind requires handoff and new thread, increments generation; old generation message/ack refused. Handoff remains visible across fresh CLI processes; thread reuse by another member refused.
- Reject zero/multiple writers as applicable (zero writers is valid), duplicate members, >12 members, extra fields, traversal/escaping symlink artifact, wrong hash, oversized artifact, invalid JSON/YAML shape; preserve journal/lifecycle on refusal.
- Current Spec drift: status exposes stale; record refuses without overwriting old spec/team evidence. Dry-run same rules but no filesystem changes.
- Concurrent record requests with same expectedRevision: exactly one accepts, other conflicts; repeat old request after success remains idempotent.
- Pending controller batch/incomplete tail/corrupt journal: no team append or implicit repair. No init-on-status for nonexistent changes.
- Team-only conversation never completes a task, produces a review receipt, renews a lease, resets retry budget or changes candidate hash. Runtime correspondence files do not pollute candidate tree hashing.

After focused GREEN, run `npm run typecheck` and `npx vitest run tests/cli tests/skill-contract`. Main runs final whole suite after integration. Report real commands/counts/failures and before/after diff location, not a claim of live host or installed-plugin readiness.
