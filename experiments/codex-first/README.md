# Codex-first bounded experiment

This directory is **not a plugin, scheduler library or production implementation**.
It is outside the package/adapters inventory. Nothing here changes installed Codex
skills or fixes the production controller.

The fixed A→B→C fixture writes actual small Python modules. `trial.py` provides a
scripted implementer and mechanical review oracle to expose handoff/recovery
assumptions. `host-seam` means direct invocation of that fixture owner; it does
not execute cc-sdd Markdown. `speckit` invokes a real pinned WorkflowEngine via
one experimental custom step and the same owner. The shared owner is newly
written fixture code, not the current production controller.

Run using the already prepared research environment:

```bash
PYTHONPATH=/private/tmp/leo-dev-source-audit.5I999C/spec-kit/src:experiments/codex-first /private/tmp/leo-dev-source-audit.5I999C/python-env/bin/python -m unittest discover -s experiments/codex-first -p 'test_*.py' -v
PYTHONPATH=/private/tmp/leo-dev-source-audit.5I999C/spec-kit/src:experiments/codex-first /private/tmp/leo-dev-source-audit.5I999C/python-env/bin/python experiments/codex-first/comparison.py
```

The source checkout must match commit `4a7341a93d944d6efe153b71da4a1adb9c2b578c`.
These local paths are temporary, not portable installation instructions. If
removed, the environment/source must be restored explicitly; missing dependencies
are errors, not skipped passing tests.

`quality-case/` is deliberately faulty baseline input; do not fix it. Copy its
three files to an empty test-owned directory with `stage_quality.mjs`, then give
only that directory and the existing develop skill to a repair worker. Keep
`quality_oracle.py` separate until evaluation. Example generation:

```bash
mktemp -d /private/tmp/leo-dev-codex-quality.XXXXXX
node experiments/codex-first/stage_quality.mjs /private/tmp/leo-dev-codex-quality.REPLACE_WITH_CREATED_SUFFIX
```

`upstream/cc-sdd/` contains byte-identical original resources plus MIT notice and
per-file provenance. Flattened `.txt` snapshots are not registered skills and do
not form a complete runnable dependency closure. Their stage-only status and any
actual consumed resource are recorded in the verification report.

The fixture's process lock and atomic snapshot are not a security boundary,
general crash-safety proof or distributed lease/fencing implementation. Workers
and check commands are trusted fixed test data. A forbidden write is detected
after the effect and is not undone. Unknown outcomes stay blocked. No automatic
reconciliation of external services or arbitrary source writes is implemented.

The fourth `debug-attempt` is a labelled scripted attempt for checking the retry
budget. It is not a fresh-context debugger Agent and does not verify root-cause
debugging quality. Only the separately documented Codex quality sample exercises
model judgment.

Results and limits: [verification](../../verification/codex-first/README.md).
