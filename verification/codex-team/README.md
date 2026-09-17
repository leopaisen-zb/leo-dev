# Codex team implementation — C3 checkpoint

Date: 2026-09-10. Status: the approved C3.1/C3.2 team and runtime seam and bounded correspondence/reconstruction portion of C3.3 are accepted. Final reconciliation-aware barrier review and main verification passed; this is not full-C3 or installed-client acceptance. [Final verification and limits](final-verification.md).

## What is implemented

One `develop` entry conditionally reads the [Codex team reference](../../skills/develop/references/codex-team.md). Actual Codex host tools create members and carry messages. The existing CLI records versioned membership, thread bindings, hash-bound opinions, challenge/response lineage, delivery acknowledgments and current-generation handoff in the existing controller journal. There is no second task scheduler, role-play replacement for an independent reviewer, or daemon.

```text
develop / coordinator
  ├─ actual Codex members and targeted host messages
  ├─ team record/status → existing journal → durable correspondence/reconstruction
  └─ existing candidate/Gate/review path → task acceptance and dependency unlocking
```

The team path does not grant approval, complete tasks or reset retry budgets. A shared tree permits at most one declared writer; this is protocol validation, not a filesystem sandbox. Thread and acknowledgment provenance is explicitly `host-reported-not-authenticated`.

Team mutation respects active Gate and unknown-outcome barriers. Records validate revision CAS, Spec freshness, both member generations, strict payloads, repository-contained regular opinion files and their hashes. Controller-owned runtime files cannot serve as opinions; dry-run must apply the same validation without writes.

The Codex build includes a relocatable Node runtime, schemas and lock-validated resolved dependencies with package metadata/licenses. Verification compares package bytes to trusted current build inputs, not merely to a package's self-reported manifest. A fresh compile is still required before building. Claude Code/Cursor remain thin packages; no new runtime integration is claimed for them.

## Upstream use

This is a selective adaptation of BMAD's independent first contributions, persistent logical roles, cross-response and reconstruction protocol, mapped to actual Codex tools. The source commit, two original file hashes and adaptation scope are in [components.json](../../components.json); the preserved license is distributed with the reference. It is not execution of BMAD's complete workflow engine. cc-sdd/Spec Kit convergence and constitution work remain on the existing plan, not hidden inside this team milestone.

## Evidence index

- [Approved implementation plan](../../docs/superpowers/plans/2026-09-04-unified-development-plugin.md) and [single specification](../../.scratch/unified-development-plugin/spec.md).
- [Team implementation](implementation-report.md), [review fixes](review-fixes.md), [Gate barrier correction](gate-barrier-fix.md), [runtime implementation and tamper fixes](runtime-report.md).
- [Frozen real-host protocol](live-protocol.md) and [actual host sample](live-20260910/README.md), including original role responses and CLI operations.
- [Final independent review](independent-review.md), [216 final-source regression passes](final-source-regression.json), [current-source built package verification](final-package-verification.json) and [final delivery summary](final-verification.md).
- [Pre-review checks](pre-review-verification.json), [combined run with three timeout failures](post-review-combined-run.json), [unchanged-timeout serial rerun](serial-partitions-before-reconcile-fix.json). Preserve these as dated snapshots, not final-source verification.

The real-host sample used two independent actual actors, substantive forwarded replies and an actual fresh replacement thread. Logical member loss was simulated; a host crash was not. The replacement reconstructed from hash-checked persisted material; an explicitly injected old-generation message was refused. Application source, tests, Spec and unrelated note stayed unchanged; the change remained in triage with no task approval or completion. This is one behavioral sample, not a measured general reduction in AI errors.

## Remaining delivery gates

1. Safely recover the pre-existing expired submitted-review lease and rerun the unchanged dependent implementation/rejection/recovery case. The team handoff is not that recovery fix.
2. Connect actual team candidate review to the existing review receipt path; finish constitution, iterative Spec/design convergence, composite governance and the complete vertical pipeline.
3. Add separate full-stack/training/Agent evidence; build and exercise installed-client entry only after installation authority. GitHub publication has its own destination/authorization gate.

Source: `/Users/leo/plugins/leo-dev`. The installed cache was not upgraded; no Git commit/push, installation, global configuration, deployment or external publication was performed.
