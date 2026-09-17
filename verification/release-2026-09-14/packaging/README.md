# Packaging verification

## Focused checks

| Requirement | Command | Result | Evidence |
| --- | --- | --- | --- |
| Doctor accepts omitted optional configuration and preserves plugin status semantics | `python3 -m unittest tests/test_doctor.py` | Passed: 9 tests | This report; executed 2026-09-14 |
| JavaScript packaging scripts parse and release metadata is valid JSON | `node --check scripts/build-adapters.mjs && node --check scripts/verify-packages.mjs && node --check scripts/create-codex-marketplace.mjs && node -e "JSON.parse(require('fs').readFileSync('package.json')); JSON.parse(require('fs').readFileSync('.codex-plugin/plugin.json')); JSON.parse(require('fs').readFileSync('components.json'))"` | Passed | This report; executed 2026-09-14 |
| Release patch has no whitespace errors | `git diff --check` | Passed | This report; executed 2026-09-14 |

## Package checks after R1 stable-source signal

| Requirement | Command | Result | Evidence |
| --- | --- | --- | --- |
| Marketplace first creation, owned repeat, unowned preservation, and symlink preservation | `node --test --test-name-pattern='generates a self-contained local Codex marketplace' tests/adapters/walking-skeleton.test.mjs` | Passed: 1/1 | `marketplace-test.log` |
| Fresh isolated adapter build | `node scripts/build-adapters.mjs --out /private/tmp/leo-dev-release-packaging.TAgP8P` | Passed | `isolated-build.log` |
| Fresh isolated package verification | `node scripts/verify-packages.mjs --dist /private/tmp/leo-dev-release-packaging.TAgP8P` | Failed: `Runtime trusted inventory mismatch` | `isolated-verify.log` |
| Fresh isolated marketplace generation | `node scripts/create-codex-marketplace.mjs --dist /private/tmp/leo-dev-release-packaging.TAgP8P --out /private/tmp/leo-dev-release-packaging.TAgP8P/marketplace` | Failed closed because package verification failed with `Runtime trusted inventory mismatch` | `isolated-marketplace.log` |
| Plugin-creator manifest validator on source root | `python3 /Users/leo/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .` | Blocked: local Python lacks the validator's `yaml` module | Command output in this session |

The failing runtime trusted inventory is outside the packaging worker's owned files. The generator intentionally calls package verification and did not create a marketplace from the unverified build. Rerun `npm run build:adapters`, `npm run verify:packages`, `npm run build:marketplace`, and the focused test after the runtime inventory is corrected.

The generator only creates a repository-local marketplace directory. It does not install, register, or modify global Codex configuration. Installed-client discovery remains a separate root-owned check.

## Review finding awaiting final package test

Root review found that a missing first-run marketplace destination was incorrectly classified as unowned. The generator now treats a missing target as new, permits a repeated update only after it verifies the generated marketplace shape, and recursively rejects symlinks in an existing target before evaluating ownership. The adapter test now covers first creation, repeated owned replacement, and refusal to overwrite an unowned directory. This behavior is pending the deferred build-dependent test above.

The first-run regression test was added after the review finding, so no pre-fix RED result exists. Its final test result will be recorded without claiming a test-first failure observation.

`git diff --check` was run while repository changes were untracked, so it does not prove whitespace validity for those files and is not used as release evidence.

## Root verification checkpoints

The first runtime mismatch was caused by an overlapping source build. No verifier checks were weakened. A root harness then accidentally called `build(output)` instead of its object parameter `build({output})`; verification refused the empty isolated destination. This was an orchestration error, not a successful isolated build. The corrected invocation built and verified all packages and the marketplace at `/private/tmp/leo-dev-release-bundle-gpFr5P`. That checkpoint predates the five independent-review fixes and is not the final runtime build.

The plugin-creator validator passed on the source root and that Codex package using the existing marker-pdf Python environment (PyYAML 6.0.3); no dependency installation was necessary. The doctor suite passed 9/9 again. Codex CLI 0.154.0 discovered `leo-dev@leo-dev-release` version 0.2.0 as available and not installed through a process-local marketplace override. This establishes discovery only; installed-session acceptance remains pending.
