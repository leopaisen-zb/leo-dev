# MIT and package delta review

Date: 2026-09-14  
Baseline: `/private/tmp/leo-dev-publish-h12rft9b` at `0f8c5467294aea74c1dabe7347554e1f78556ddd`  
Reviewed source: `/Users/leo/plugins/leo-dev`

## Result: PASS

The bounded MIT/package delta is internally consistent. No source change is required from this review.

The user has explicitly authorized preserving the existing Git history and its author-email disclosure; no history rewrite is needed. This review did not change Git state, source, package output, or network state.

## Delta checked

The review compared these 16 intended paths with the baseline: `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `assets/README.md`, `docs/installation.md`, `docs/release-evidence.md`, `package.json`, `package-lock.json`, `packages/cli/package.json`, `package.yaml`, `.codex-plugin/plugin.json`, `scripts/build-adapters.mjs`, `scripts/verify-packages.mjs`, and `tests/adapters/walking-skeleton.test.mjs`.

`LICENSE` is the one new path. The other 15 paths differ only as part of the MIT/public-package follow-up. All 19 pinned files below `skills/develop/references/upstream/` are byte-identical to the baseline commit.

## License and documentation

- `LICENSE` contains the standard MIT grant.
- `README.md`, `CONTRIBUTING.md`, `NOTICE`, and package/plugin metadata consistently identify original Leo Dev code and documentation as MIT-licensed.
- `NOTICE` preserves the upstream notices and makes the asset boundary explicit. `assets/README.md` identifies the Shin-chan image as fan art excluded from the MIT grant, without claiming character or trademark rights. The asset notice is carried with the Codex package.
- Root `package.json` and `packages/cli/package.json` retain `private: true` as the npm-publication guard while declaring `license: MIT`. `package.yaml` is intentionally `private: false` and `license: MIT`; the lockfile records MIT for the root and CLI workspaces; `.codex-plugin/plugin.json` also records MIT.

`docs/release-evidence.md` states that the GitHub repository is public. This review did not inspect GitHub UI state, so that factual statement must be true when the documentation is published; confirming the final visibility operation remains an operational release check, not a source-code defect.

## Package integrity

`build-adapters.mjs` now treats `LICENSE` and `NOTICE` as required regular, non-symlink release files and copies them into every adapter: Codex, Claude, Cursor, and Open Agent Plugin. It separately requires the Codex artwork notice and copies it alongside the logo.

`verify-packages.mjs` includes these files in each strict inventory and compares their SHA-256 values to the source. For Codex it also validates the logo hash and the byte-identical `assets/README.md` notice. Existing path-confinement, symlink refusal, and unknown-file inventory rejection remain in place.

The walking-skeleton delta asserts the four bundle copies and their hashes, Codex asset-notice bytes, missing/symlinked release-file refusal, tampered/missing `LICENSE` or `NOTICE` refusal, and tampered artwork-notice refusal. Existing path-escape, symlink, and unknown-file refusal coverage remains unchanged.

## Verification boundary

No tests, builds, packages, network actions, Git mutations, or broad controller review were run for this audit. Adapter-test execution is ongoing separately, and clean package validation is owned separately. This is a static delta review, not a replacement for those results.
