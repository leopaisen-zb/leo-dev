# Local Leo Dev synchronization

Completed: 2026-09-14T16:31:31.831021+00:00.

Installed and enabled `leo-dev@leo-dev-release`, version `0.2.0+codex.20260914162244`, from the complete package built from published commit `69c5de5ab448fa39e4559f79998810e79a41cf06`. The local version suffix refreshes Codex's cache; repository version 0.2.0 and all 205 release-source files remain unchanged.

The persistent local marketplace is `/Users/leo/plugins/leo-dev/dist/marketplace`. The 1,312 installed files match the verified package byte for byte. Runtime package verification and the installed controller's root, route, run-gates and claim JSON HELP contracts passed.

The old `leo-dev@personal` installation was removed only after its 3,239 cache entries were backed up and the new package passed its checks. The source directory and personal marketplace entry remain available; other plugin configuration, marketplace entries and global defaults are unchanged. Exactly one Leo Dev installation is enabled.

A fresh, ephemeral, read-only Codex session `01a0a0c0-9600-7b73-86e9-865d64add1fd` ran with `gpt-5.6-luna` / `medium`. It discovered one develop entry at `/Users/leo/.codex/plugins/cache/leo-dev-release/leo-dev/0.2.0+codex.20260914162244/skills/develop/SKILL.md`, read the installed manifest and skill, and executed the packaged controller's help command successfully. The trace's actual command result was checked independently. This confirms new-session discovery and basic invocation; the existing user conversation is not hot-reloaded.

The published commit's full GitHub CI also passed: https://github.com/leopaisen-zb/leo-dev/actions/runs/34866069518. See the public-release directory's `github-ci-final.json` for all job steps.

During verification, an initial call to the source build verifier refused the installed cache path because it lies outside the verifier's canonical build roots. Verification then used its supported package location plus an exact comparison of every installed file. A separate probe initially expected a textual Usage banner; source inspection confirmed the real contract is a JSON HELP envelope, which passed. Product code, path checks and security settings were not changed to address these probe errors.

To use the synchronized plugin, open a new Codex conversation in the target project and invoke `$develop`. Future local updates should rebuild and verify the package, refresh only the generated marketplace plugin's cache suffix with the plugin-creator helper, reinstall `leo-dev@leo-dev-release`, and verify discovery in a new session. Keep the marketplace directory available.

Evidence: `build-checks.json`, `install-payload.json`, `installed-package-verification.json`, `configuration-verification.json`, `fresh-session-execution.json`, `fresh-session-verified.json`, and `previous-personal-cache-manifest.json`. The old cache backup is in `previous-personal-cache/`.
