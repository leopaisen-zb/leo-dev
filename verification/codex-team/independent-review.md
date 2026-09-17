# Independent C3.1/C3.2 acceptance review

Date: 2026-09-10

Reviewer: `/root/codex_team_acceptance_review`, separate from the C3 team/runtime implementers, live-sample actors, and review-fix workers.

## Verdict

No remaining Critical, High, or Medium finding was identified in the bounded C3.1 durable-team seam, C3.2 Codex runtime/package seam, or the scoped live Codex correspondence sample after the fixes below. This closes the final reconciliation-aware Gate-barrier finding at source hashes:

- `packages/cli/src/controller/controller.ts`: `b73c1468845c04c9193b7cf4a1d6405d7fd932eebaaf5346d6dddf789218f344`
- `tests/cli/codex-team.test.ts`: `468eb9584232422c5f5ce2d4a8ec65644f7b42e172f68ff772ecc32ca7b6c3a8`

This verdict is scoped acceptance, not a whole-C3 or complete-v1 readiness claim.

## Review basis

The review compared current code with the retained pre-C3 files at `/private/tmp/leo-dev-c3-before.O5cgW6`, the C3 amendment and active plan, `implementation-brief.md`, `runtime-brief.md`, the implementation/runtime/review-fix reports, `live-protocol.md`, `skills/develop/references/codex-team.md`, and the retained `live-20260910/` artifacts.

The public team seam has strict payloads, generation and Spec fences, pending-versus-delivered correspondence, handoff revalidation, exact replay, local revision CAS, existing-journal projection, and no team-owned lifecycle/lease/candidate/receipt authority. Status remains diagnostic during Spec drift. Record and dry-run share validation and recovery barriers.

The packaged Codex runtime uses an exact, symlink-safe dependency and file inventory derived from current trusted build inputs. Thin Claude, Cursor, and Open Agent packages retain exact inventories and do not inherit the Codex runtime exception.

## Findings closed

- **High — coordinated runtime-file and manifest replacement:** the old verifier trusted the package-local manifest. It now independently derives expected runtime bytes from current trusted build inputs and rejects forged CLI/dependency bytes even when the manifest and digest are recomputed.
- **High — team append during Gate or unknown-effect barriers:** team record could append between Gate `prepared`/`started`/`released` phases and break the Gate's next journal-tail CAS. Record and dry-run now refuse active Gate phases and unresolved unknown Runs; read-only team status remains available.
- **Medium — reconciliation false positive introduced by the first Gate fix:** a verified standalone indeterminate attempt can legitimately retain a nonterminal raw Gate phase after public Run reconciliation. The final predicate clears that phase only for exactly one same-Run `run.unknown.context`, the exact Gate event hash, and reduced Run state `succeeded`, `failed`, or `abandoned`. Missing, wrong-hash, duplicate, nonterminal, aborted-awaiting-successor, and second-current-unknown cases remain fenced. The public regression exercises actual `run-gates` indeterminacy, public reconciliation, then dry-run and actual team record while preserving Gate hashes and lifecycle.
- **Medium — controller-owned correspondence artifact:** referencing the journal, snapshot, lock, or lease as a message artifact could make the accepted operation invalidate its own evidence. Those exact runtime state paths are rejected case-insensitively; ordinary runtime correspondence remains allowed.
- **Medium — thin-host runtime inventory bypass:** the runtime-path exclusion was initially applied to every adapter. It is now Codex-only, so injected Claude/Cursor runtime payloads are rejected.
- **Correctness fixes:** stale team batch CAS is mapped locally to `CONFLICT`, and help parsing no longer mistakes values consumed by known options for command names.

The initial generic team dry-run routing concern was retracted after source inspection: `team` correctly stays outside generic state-changing dispatch and performs its own validated dry-run plan. No dispatch rewrite was required.

## Evidence assessment

The live sample contains two actual independent actor threads, preserved first opinions, a targeted challenge/reply, host-observed response bodies before acknowledgement, and a fresh third thread that reconstructed the logical member from persisted handoff context. Artifact hashes match the copied journal evidence. Provenance is **controller-verified journal provenance plus coordinator-reported host evidence**, not authenticated host identity or a signed/full thread transcript.

The reports accurately identify the exercise as simulated logical loss plus real reconstruction, not an actual host crash. They also retain the failing application fixture, triage lifecycle, empty tasks/runs/leases, and no review/completion receipt. No role disagreement was required or manufactured.

## Verification and residual limits

The reconciliation fix worker reported a valid behavioral RED followed by focused `2/2`, full team `15/15`, build, and typecheck success. Runtime workers reported focused relocation, coordinated-tamper, symlink/missing-dependency, and thin-host injection checks. I inspected the final source, tests, evidence, and exact source hashes, but did **not** personally rerun the broad test suite.

The integration owner must complete the final serial regressions, rebuild from the settled source, create a fresh package, and verify that package against current trusted inputs. The runtime verifier is a current-build-input comparison, not a signature or proof that an earlier `dist` was freshly compiled.

Still outside this verdict: an actual host crash, installed-client loading, statistically established team reliability, authenticated transport, full candidate/review/expired-lease continuation, complete C3.3 recovery, C3.4 convergence/governance vertical, C3.5 domain evidence and distribution, and complete-v1 release readiness. The integration owner separately owns the active-plan progress update; temporary stale checklist text is not treated as a source-code defect.
