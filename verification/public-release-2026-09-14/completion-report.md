# Public MIT release

The original repository is public at https://github.com/leopaisen-zb/leo-dev. GitHub recognizes the MIT license. The original history and author email were retained with the owner's explicit authorization.

Publication commit: `69c5de5ab448fa39e4559f79998810e79a41cf06`.
Parent: `0f8c5467294aea74c1dabe7347554e1f78556ddd`.
Tree: `9fe2246244bffceb2bf79d8b1855e71f88ce02dc`.

## Changes

The 16-file follow-up adds the standard MIT license, aligns package metadata and English documentation, and includes byte-identical `LICENSE` and `NOTICE` files in all four adapter packages. The Codex package also carries its artwork notice. Original upstream files and their licenses remain unchanged; the Shin-chan fan-art asset is excluded from the MIT grant. Controller and Mochi Board behavior did not change.

## Actual verification

- Independent source and MIT delta review: passed. All 19 pinned upstream files match the preceding commit.
- Adapter suite: 20 passed, 0 failed. The final metadata rejection assertions also passed in a focused run.
- Clean publication copy: typecheck, marketplace build, four-package integrity verification, source plugin validation and generated Codex plugin validation passed.
- The first plugin-validator attempt failed because the selected system Python lacked PyYAML. The retry used an existing Python environment with PyYAML 6.0.3 and passed; no dependency installation was needed. Both attempts remain in `publication-checks.json`.
- All 205 committed Git blobs match the recorded source hashes. Only the reviewed 16 paths changed. The publication clone is clean, and the push to `main` succeeded.
- GitHub's settings UI confirmed public visibility. Anonymous API requests returned HTTP 200 for the repository, main ref, license and current Actions run at `2026-09-14T16:08:19Z` (`2026-09-15 00:08:19` Asia/Shanghai). They used no Authorization header, cookies or credential helper. The remote main ref and license bytes match the checked commit and source.
- The repository page displays Public and MIT license. The three README images loaded successfully: Shin-chan logo 1254 × 1254, workflow diagram 1000 × 280, and Mochi Board screenshot 1185 × 924. The repository tab was retained as a deliverable. This browser session was signed in; anonymous access was established separately by the API requests above.

## Remote CI boundary

The push started CI run https://github.com/leopaisen-zb/leo-dev/actions/runs/34866069518 for `69c5de5ab448fa39e4559f79998810e79a41cf06`. It was still `in_progress`, with no conclusion, at the anonymous verification checkpoint. This report does not claim that run passed. The preceding implementation commit's successful full CI and 472-test result remain historical evidence for that commit.

The requested visibility and MIT publication are complete. Remote CI's eventual result is separate from the completed local checks above.

## Evidence

- `history-disclosure-decision.md`
- `source-review.md`
- `mit-delta-review.md`
- `package-support/after.md`
- `publication-inputs.json`
- `publication-checks.json`
- `committed-source-verified.json`
- `anonymous-public-verification.json`

The original source workspace, historical evidence, installed personal plugin and global settings were preserved. No npm publication, additional installation, Git history rewrite, repository replacement or new Goal was performed.
