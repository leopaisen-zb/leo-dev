# Current Codex entry update — 2026-09-15

The bounded Codex/macOS entry update is complete and installed locally. Claude Code, Linux, cross-host teams and a connected workbench remain deferred by the user. This iteration improves entry presentation and diagnosis; it does not establish improved model quality, speed or universal reliability.

## Changes

Five source files changed: README/install guidance, plugin default prompts, the Codex skill interface metadata and the Codex prompt emitted by the adapter builder. The display name is now `Leo Dev` and Codex examples use the observed qualified selector `$leo-dev:develop`. Portable frontmatter remains `name: develop`. The controller, skill body, upstream methods, dependencies and acceptance policy were not changed.

See [exact delta](source-entry.diff), [before hashes](before-source.json), [after hashes](after-source.json) and [independent review](independent-review.md). The Luna/medium worker made the mechanical edit; the separate Terra/high auditor reviewed it. Root clarified two installation sentences and performed integration/verification. The repository's existing uncommitted work was retained; no commit, push or publication was made.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | Passed | [commands/results](checks.json) |
| Current-source skill contract | 6 passed, 0 failed | [log](skill-contract-source.log) |
| Runtime/adapter suite | 20 passed, 0 failed; 410.12 seconds | [complete log](adapters-complete.log) |
| Marketplace build and package verification | Passed | [commands/results](completion-checks.json) |
| Official skill/plugin validators | Passed for the source skill/plugin and generated plugin | Tool results recorded in this conversation |
| Independent code/docs review | Passed for the five-file scope | [review](independent-review.md) |
| Official local install | Installed `leo-dev@leo-dev-release`, version `0.2.0+codex.20260914190739` | [install result](install.json) |
| Fresh official Codex catalogs | Both home/project catalogs contain one enabled `leo-dev:develop`, updated display/prompt/path, no errors | [after catalog](fresh-catalog-after.json) |
| Installed controller | Exit 0, JSON `ok=true`, `code=HELP`, expected commands | [help output](installed-controller-help.log) |
| Installed package integrity | All 1,312 files match the generated package; only two metadata files differ from the prior install | [verification](installed-verification.json) |
| Runtime/method preservation | All 1,277 runtime files, skill body and method resources unchanged; full backup retained | [verification](installed-verification.json) |
| Configuration preservation during reinstall | All 20 sections match the immediate preinstall snapshot | [after hashes](config-section-hashes-after.json) |

## Retained interruptions and limits

- The first standalone catalog probe could not initialize Codex SQLite state inside the default filesystem sandbox. A scoped authorized retry passed. Neither probe connected to the existing application or called a model. [Initial record](fresh-catalog.json), [authorized baseline](fresh-catalog-authorized.json).
- Computer Use refused access to the Codex application. No alternative GUI access, app restart or disruption of existing sessions was attempted. A successful fresh CLI catalog does not prove that an already-open GUI conversation refreshed.
- The first adapter run was interrupted by a root-added 240-second wrapper deadline. The identical Node command was run to completion without that ad hoc outer deadline; production code, test files and assertions were unchanged. [Initial interruption](adapter-initial-interruption.json), [initial partial log](adapters.log).
- Broad Vitest path matching also selected six tests in a preserved old-cache backup. These are not counted as additional current-source coverage. The final source-specific run excluded `verification/**` and passed the six actual source tests.
- The initial help probe incorrectly expected `Usage:` text. The existing controller returns a valid JSON HELP envelope. The probe was corrected against the existing source contract and passed; no product behavior or tests changed. [Correction](help-probe-correction.json).
- Before reinstall, `service_tier` differed from the initial configuration snapshot. Its origin was not established. The current value was retained; all other initial sections matched, and the complete immediate preinstall configuration matched after installation. [Drift record](configuration-drift-before-install.json).
- No model-executed development comparison, GUI refresh, Claude Code or Linux acceptance was run in this iteration. Historical release results remain historical and are not counted as new verification.

## Use

Start a new Codex conversation in the project and select **Leo Dev**, or invoke:

```text
$leo-dev:develop Continue the approved work in this repository.
```

The shorter marker was not demonstrated to be invalid. The qualified selector matches the entry exposed by the tested Codex CLI 0.154.0 on macOS 15.7.7 arm64.
