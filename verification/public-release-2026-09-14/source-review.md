# Public source and history review

Date: 2026-09-14  
Scope: read-only audit of `/private/tmp/leo-dev-publish-h12rft9b` before changing the visibility of `leopaisen-zb/leo-dev`. This is a code-visibility review; it does not grant an open-source license or determine third-party asset rights.

## Result

**CODE VISIBILITY: PASS.** The committed source and all reachable Git content contain no detected credentials, private-key material, raw verification/session/approval directories, or unexpected prior private source history.

**METADATA DECISION REQUIRED BEFORE PUBLICATION:** commit `0f8c5467294aea74c1dabe7347554e1f78556ddd` has a direct author address at the `qq.com` domain. Making the repository public will expose that address in Git history. The other reachable commit uses GitHub's `users.noreply.github.com` address. Preserve this history only if that disclosure is intended; otherwise rewrite the release commit's author metadata before changing visibility. No email address is reproduced in this report.

## Reachable history examined

| Commit | Tree paths | Finding |
| --- | ---: | --- |
| `0f8c5467294aea74c1dabe7347554e1f78556ddd` | 204 | Current `main` release tree |
| `5eaf4c054513012f40f6707ee6aaf976c697f20e` | 1 | Initial README-only commit |

`refs/heads/main` is the only local branch ref; its remote-tracking refs point to the same release commit. The reachable graph has two commits and 205 unique blobs. The initial commit adds only `README.md`; the release commit adds the 203 other paths and modifies that README. No alternate reachable branch, tag, or private-history path was present.

Three unreachable loose objects were reported locally by `git fsck`; they are not reachable from any ref and are outside the requested reachable-history/public-branch scope. They were not treated as publishable Git history.

## Exposure checks

- All reachable filenames were inspected. There were **0** paths in raw `verification/`, `.scratch/`, `session(s)/`, or `approval(s)/` directories. Expected schema, command, and test names containing similar words were not treated as raw operational records.
- Static scanning of all 205 reachable blobs found **0** private-key headers, **0** common provider-token shapes, **0** absolute user-home paths, and **0** payment-card candidates passing Luhn validation. No candidate value was emitted during review.
- The scanner found one generic `password`-keyword hit at `tests/gates/runner.test.ts:57`; it is a test-only command fixture and has no provider-token shape. The only committed source email literal is the `example.com` fixture at `tests/repository/tree-hash.test.ts:63`.
- The previous exact committed-blob comparison, [`publication-committed-blob-comparison.json`](../release-2026-09-14/publication-committed-blob-comparison.json), records that all 204 release-tree blobs match the reviewed SHA-256 manifest with no mismatch. The accompanying [`final-rereview.md`](../release-2026-09-14/publication-final-audit/final-rereview.md) records the managed-path and privacy allowlist review. Those results were inspected here; tests and builds were not rerun.

## Notices, resources, and licensing boundary

`NOTICE`, `assets/README.md`, `assets/shinchan-logo.png`, `skills/develop/references/upstream/provenance.json`, and all three upstream license files remain in the release tree. The Shin-chan fan-art asset remains a user-requested asset; this review makes no ownership or redistribution-rights conclusion beyond preserving the repository's existing notice/attribution material.

The tree has no root `LICENSE`/`LICENCE`/`COPYING` file. Changing a private repository to public changes access only; it does **not** grant an open-source license for the original code. Selecting and adding an intended license is a separate, outstanding release action.

## Audit limits

No source, checkout, Git history/configuration, network setting, or existing evidence was changed. This audit does not replace GitHub-side visibility/metadata checks, legal review, or the already-recorded test and CI evidence.
