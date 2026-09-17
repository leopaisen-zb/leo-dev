# W4 execution after environment preflight

This addendum supersedes only the executor named in the W4 evaluation
checklist. All cases, models, prompts, budgets, permissions, ordering, scoring
and acceptance criteria remain frozen.

`w4-readiness.json` is bound by SHA-256
`be9e1c6d0269bfc2e36539e8f57295a707d755c45710f2eb28a0049ca0712eac`.
It records the selected installed package, exact 22-attempt schedule, completed
regression/browser evidence and both layers of process-local skill exclusion.

The original frozen inputs predate two global skills. The accepted original
supplement excludes `humanizer`; a separate, independently reviewed adapter
adds only the observed `eli5` exclusion. Neither changes the user's daily
configuration. The retained ELI5 failure and successful derived discovery are
unscored, zero-model preflights, not extra coding attempts.

Before every scheduled attempt, verify the readiness pins and that entry in
`w4-base-supplements.json` and `w4-eli5-supplements.json`. The latter is bound
by SHA-256 `f3177f490b8d050da4ab9f17f53214c65384ee2a590750605c820261cfd000ea`.
The new accepted helper lock is bound by SHA-256
`17d69cbe44cb6ae044a9249efd255f8a2e36ddaffeab5c9d2e3a50add98970ec`.

Use `eli5_isolation_supplement.py launch --out <derived-out>` to verify, then
the same command with `--execute` to run. Each derived directory is under
`w4-eli5-isolation/<attempt-id>`. This rechecks the original humanizer and W4
guards before execution. Do not execute through the older helpers directly.

Each actual app-server launch must explicitly use the tool's
`sandbox_permissions: require_escalated` so the local server can use normal
host authentication and stdio. This does not change the actor's frozen
workspace-write, network-off, on-request configuration. A filename or prose
label saying “host” is not execution-permission evidence. Do not inspect or
copy authentication files.

Only after terminal cleanup confirms no active turns and no owned process
group may the frozen scorer run. Retain its exit-1 results. The next attempt
follows the exact schedule array, without reruns or feedback from independent
evaluation. Both Leo cohorts share the old arm label; bind every result to its
cohort, pair, index, stage and identity hashes. The DEV-F1 contract-v2 scorer
does not apply to HOLD cases.

The first derived preflight discovered exactly 15 assigned skills, no extra
skills or errors, no thread/model turn, and confirmed process cleanup. It does
not establish task completion or quality. Those judgments require the actual
22 runs and independent review.
