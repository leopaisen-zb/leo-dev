# Release evidence

Release 0.2.0 has passed its final clean-checkout test suite and independent whole-change review. The Codex development exercise also completed independent verification and public-controller archive admission. The records below state the scope of each result.

The counts below describe that release, not every later source edit. The local Codex quality update records its candidate hashes, scoped checks and actual-host results in `verification/codex-quality-update/README.md` in the development checkout. That local evidence must be checked separately before attributing an earlier release result to a new package.

## Environment and results

The recorded host is macOS on Apple Silicon, with Node.js 22.22.2 and Codex CLI 0.154.0. The same explicit Node executable is used throughout each controller change. Local HTTP checks use temporary data and loopback listeners. Actual host sessions perform implementation and independent review; journal labels record those identities without authenticating them.

| Check | Recorded result |
| --- | --- |
| Clean publication checkout | Dependency installation with `npm ci --offline` and `npm run typecheck` passed. Its test inputs match the reviewed source. |
| Complete controller and package suite | The final `npm test` run passed all 472 tests: 175 core, 19 Node runner tests, and 278 CLI/skill tests. All 171 recorded inputs were unchanged in the publication checkout and matched the source after the run. Earlier failures remain recorded separately. |
| Doctor | 9 tests passed from the publication checkout. |
| Continuation integrity | Independent critical review passed 39 fresh probes and 20 selected existing tests. The public continuation matrix passed 9 cases; 4 additional durable tests cover preparation expiry, receipt/source races and raw-event refusal. These overlap the full-suite coverage and are not an additive benchmark score. |
| Codex package and installed consumer | Final clean-checkout adapter/marketplace build and package checks passed. All 1,309 installed files matched the final distribution package. A real fresh Codex session loaded that installed `develop` skill and implemented M4. |
| Mochi Board HTTP behavior | All 10 tests passed on the repaired application: the unchanged 7-group acceptance oracle plus 3 separately frozen timestamp regressions. An independent reviewer reran all 10. |
| Browser behavior | Full UI acceptance passed, including actual downloads, import/error recovery, keyboard/focus, literal text rendering, notes/priority filters, 390px layout and reduced motion. After the store-only repair, a fresh real-browser import/edit/export/restart check also passed; unchanged UI evidence remains explicitly attributed. |
| Whole-change review | M1–M4 passed again under the revised implementation plan. M5 architecture, security, NFR and primary reviews passed in four distinct sessions; the public controller accepted the Full receipt and created release evidence. |
| Release verifier and archive | A distinct local verifier passed all 10 HTTP tests on both the live source and the extracted 13-file artifact. The public controller accepted the verifier evidence, exact artifact manifest and retrospective and reached `archived`. |
| English documentation and artwork | README, installation, contribution and comparison guides are present. The generated Shin-chan logo, workflow illustration and actual desktop/mobile screenshots were visually inspected. |
| GitHub | The [repository](https://github.com/leopaisen-zb/leo-dev) is public, with original code licensed under MIT. The included CI workflow checks each push; consult [GitHub Actions](https://github.com/leopaisen-zb/leo-dev/actions) for its per-commit result. Local checks above are separate from remote CI. |

## What the development exercise demonstrated

[Mochi Board](../examples/mochi-board/README.md) is a local HTTP application with durable storage, a browser UI, task history and JSON snapshots. Its original acceptance tests were frozen before implementation; implementers did not own the oracle. The final integration task depends on every implementation task and permits no application source edits.

**Real rejection and repair.** The M1 reviewer rejected explicit-null handling, invalid calendar dates and an Origin case. A new claim repaired the candidate and passed re-review. For M2, the coordinator preserved the writer's correct output, introduced one disclosed status-update defect, and obtained an independent rejection even though the existing Gate passed. The fix retained the consumed failure. Both tasks kept that history through later plan revisions.

**Specification convergence.** An approved v2 requirement clarified case-insensitive title-or-notes search. The public revision operation preserved task identities and failure counts, required fresh design approval, and invalidated prior completion evidence. The same specification artifacts remained authoritative.

**Interrupted work.** The initial M3 writer deliberately stopped after visible source edits. A fresh session inspected and preserved those files. When the pre-Gate lease expired, ordinary continuation correctly refused. The repaired public supersession command fenced the old Run, preserved allowed source and budgets, and admitted a fresh generation with a new independent design review. Browser findings about focus and retry behavior were fixed before acceptance.

**Review recovery after an actual host interruption.** A later clamshell sleep expired M5's submitted-review lease. Public review recovery retained its original Run, candidate and Gate evidence. Reviewers inspected the new recovery binding before issuing new assessments. The journal and lease were not edited manually.

**Cross-feature failure caught by final review.** Primary and security reviewers independently found that a valid future-dated import could be edited into an invalid timestamp order, causing restart to fail. M5 was formally rejected. A new implementation-plan revision reopened the owning task under the unchanged v2 specification and preserved the failure history. The repair keeps timestamps from moving backwards and validates the complete board before writing it. Three new regression cases cover future creation, future update and a calendar-boundary time-zone offset through edit, restart, export and re-import. All passed after the repair; the original seven-group oracle stayed unchanged.

The same review also exposed why a passing Gate alone cannot establish complete application correctness. Additional independent checks found an Origin/Host authority mistake and UI focus/retry defects, all corrected within their owning tasks.

## Earlier failed runs

The release retains failed and interrupted runs. A recovery timing fixture was corrected to wait for the recorded expiry without changing its refusal assertions. Nine missing-executable cases later exposed a host-specific test assumption: on macOS, a successfully started `sandbox-exec` wrapper reports a missing target as a determinate failure. Those tests now obtain exact test-only Gate approval for the nonexistent command, producing the intended direct-launch unknown outcome without network activity. Independent review and all nine focused cases passed. Six separate CLI timeouts and a runner timeout coincided with recorded host sleep; no timeout thresholds were raised to hide them. The final unchanged-input run passed all 472 configured tests. Archive preflight also correctly refused an over-detailed verifier JSON; a schema-conforming projection of the same two executed checks was accepted, with the original report preserved.

## Reproduce and interpret

Use [CONTRIBUTING](../CONTRIBUTING.md) for the configured checks, [installation](installation.md) for package and host discovery, and the [example guide](../examples/mochi-board/README.md) for its ten HTTP tests. Raw sessions, user histories and approval records are retained locally and excluded from this distribution. Published summaries do not substitute historical counts for current results.

Codex is the first acceptance host. Other client adapters are packaging outputs; complete client acceptance has not been established for them. Native-mobile and AI/RAG verification are outside this example. A local verifier is not GitHub Actions. This exercise demonstrates the recorded workflow on one source/task/host configuration; it does not establish statistical reliability or a speed, cost or quality advantage over [the upstream methods](benchmarks.md).

## Public licensing follow-up

The owner approved public visibility and the MIT license on 2026-09-14, after the private release checks above. That follow-up changes licensing, documentation and package notices; it does not change controller or Mochi Board behavior. The 472-test result above belongs to the preceding implementation commit; consult GitHub Actions for each later commit. Upstream notices remain intact, and the Shin-chan fan-art asset is excluded from the MIT grant.
