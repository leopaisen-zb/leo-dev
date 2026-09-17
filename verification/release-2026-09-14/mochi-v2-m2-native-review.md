# Mochi Board v2 — Independent M2 Native Review

**Disposition: PASS**

## Submitted review context

- Candidate envelope: `mochi-v2-m2-submit.json`
- Task: M2, revision 2; submitted state: `review-required`
- Review context: run `run-7c5ba8a5-74ce-4f78-a2ae-d0f56cba84c6`, lease generation 3, task hash `2c0901c138d9f3d6937176cd0bad88abc10e0001ddf6862e87e88133f04d4a6d`, tree hash `19f3cc0cd15181c393c6c64281d1df449f7658bb3ec9b40693df20369a46e234`
- Active specification: `docs/spec-v2.md`, SHA-256 `63d8e80779df469aad6ada4996a6330f7d923447c90c22e51c6db87f9ed659a3`
- Producer recorded by the envelope: `/root` (remediation attempt). This review is a fresh review and does not reuse the earlier v1 result.

## Reviewed source

Actual SHA-256 values at review time:

- `server.mjs`: `6eb5eeecd67466de94d9c7fb943bc72a4b116dc8a98b6d8ef8387ed43461ed01`
- `lib/store.mjs`: `1a37c342f0578e5a12bcaf8cebbde28af44b734d9a86c7f727a258827bf52cb5`

They match the corresponding source entries in the submitted candidate envelope.

## Specification compliance

The current M2 implementation accepts only a nonempty subset of `title`, `notes`, `status`, and `priority` on the task PATCH route; validates each supplied field; preserves `id` and `createdAt`; sets `updatedAt`; and returns 404 for a missing task. The repaired status-only PATCH path applies the supplied status.

Successful create, update, and delete mutations append persisted, uniquely identified activity records, and the store retains the newest 100. DELETE emits a bodyless 204. Rejected mutation inputs are validated before store mutation. The handlers enforce JSON media type for POST/PATCH, reject malformed JSON and oversized JSON bodies with the specified statuses, reject explicit foreign origins, and expose static assets through a fixed allowlist without wildcard CORS.

The store's persisted-task validation measures trimmed title length without rewriting the stored title. Thus a persisted or imported title with surrounding whitespace is not rejected solely for that whitespace, consistent with the stated contract. Import/export behavior and browser title-or-notes search are outside M2 and were not treated as M2 defects.

## Code quality

`server.mjs` keeps HTTP parsing, validation, response generation, and static routing explicit and narrow. `lib/store.mjs` serializes mutations, persists a complete candidate board through a temporary file and rename, commits memory only after persistence, clones outward-facing values, and bounds activity in every task mutation. Error paths avoid state publication on validation or persistence failure. No confirmed M2 code-quality defect was found.

## Fresh runtime evidence

Command run with the required Node binary:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node /Users/leo/plugins/leo-dev/verification/release-2026-09-14/mochi-backend-review/m2-supplemental.mjs
```

Exit status: `0`.

Observed final output:

```json
{"ok":true,"temp":"/var/folders/lj/7ggg6r2s1c13mgmnwf8bhmc00000gn/T/mochi-m2-independent-VLrMME","failures":[],"checks":["patch-status","patch-subset","patch-invalid-preservation","patch-boundaries","unknown-routes","activity-bound-and-restart","static-allowlist","delete-204"]}
```

The harness copied the app to an isolated temporary directory, exercised the server over loopback HTTP, restarted it against isolated data, and passed all listed checks. Unmodified command output is retained in `mochi-v2-m2-native-review.log` beside this report.

## Limitations

This bounded review covers M2 requirements and current `server.mjs`/`lib/store.mjs` only. It does not make M3 browser-search or M4 import/export claims, and it did not run controller, gate, claim, submit, review, or revise actions.
