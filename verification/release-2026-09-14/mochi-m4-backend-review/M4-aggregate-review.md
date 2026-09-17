# M4 aggregate primary review

Completed: `2026-09-14T13:02:17Z`

## Verdict: PASS for M4 scope

The frozen M4 candidate satisfies the M4 backend, HTTP-boundary, and browser import/export acceptance evidence described below. This is an independent primary review of the assembled evidence; it is not a controller review receipt, M5 integration result, release proof, or archive decision.

## Current public binding

At completion, public status for `mochi-board` reported:

```json
{
  "taskState": "review-required",
  "runId": "run-79d6ecbd-7f71-4a53-843f-887a9247f323",
  "taskId": "M4",
  "taskRevision": 2,
  "leaseGeneration": 1,
  "specHash": "13776dfb6f2167649877847d4852fc2f0b6d3abd53cfd875da86fd5f8c0675d4",
  "taskHash": "60c323eb2d7b3f2ab0c90d057c96c8e1a9717c5f8126ac8cebb20a6747152a2a",
  "treeHash": "4cfc6ce31ae17a6cb1808169721895889de99572318cf99bab6c9b81b2309bcd"
}
```

I independently recomputed canonical tree hash v1 as `4cfc6ce31ae17a6cb1808169721895889de99572318cf99bab6c9b81b2309bcd` before and after the backend review. The browser report independently records the same candidate hash and matching M4 source-file hashes.

## Evidence assessed

| Area | Evidence and result | Attribution |
| --- | --- | --- |
| Frozen public HTTP acceptance | Node 22 ran all seven M1–M4 groups: 7 passed, 0 failed. This included M4 exact export/import semantics and invalid snapshot atomicity. | Executed by this reviewer: [frozen-acceptance.log](frozen-acceptance.log), SHA-256 `2a469bd692dbda63ddd01dd7fc487d8ab1cba55332b6fed538e73b0b90723feb`. |
| M4 mutation boundaries | A copied supplementary harness observed a valid control import 200; wrong Content-Type 415; body above 1 MiB 413; foreign and `null` Origin 403. Each rejected request preserved tasks, activity and exact board-file bytes. | Executed by this reviewer: [result.json](result.json), SHA-256 `6a274c8a0ba1ab4ff6fa635951531cecb7af5b6801fd1e0b7188e8dd8d2a0792`. |
| Origin authority | No-Origin, exact `127.0.0.1:<port>`, and exact `localhost:<port>` controls returned 201. A foreign Origin with a matching forged request Host returned 403 with identical persisted bytes. | Executed by this reviewer: [origin-controls-result.json](origin-controls-result.json), SHA-256 `3ff1480df6d8305bd4d0de705101e357fcdef8f419e407b58b9b4aaec0a684e0`. |
| Store/source behavior | Whole-snapshot validation precedes serialized replacement; the store clones, temporary-file persists, then publishes the next board. Validation requires exact seven task fields, valid ordered dates, unique IDs, schema 1 and at most 500 tasks. | Read and assessed by this reviewer in [REPORT.md](REPORT.md), SHA-256 `be059eae7171ce4605b48b02c3ce6317083c607aea46e276e4d159154a3cf57d`. |
| Browser import/export and shared UI paths | The browser reviewer reports actual Playwright/Chromium evidence for Blob export/download, valid/empty import, literal text rendering, invalid-JSON and injected-500 recovery, dialog focus/Escape/Cancel, responsive 390px layout, reduced motion, and M3 create/edit/status/delete regression controls. | Performed and reported by the independent browser reviewer, not rerun by this reviewer: [browser REPORT.md](../mochi-m4-browser-review/REPORT.md), SHA-256 `43a4483e44c00f51c7be52de9d27d83a7221a3c7249afeb785b828496db112b9`. |

The backend implementation aligns with the browser evidence: UI export requests `/api/export`; valid import POSTs `/api/import` and renders the authoritative returned task/activity snapshot; import failure retains form input and the existing board. The server validates origin against listener port rather than request Host, and accepted replacements are serialized and durably published only after persistence completes.

## Remaining scope

This PASS is limited to M4. The public controller still requires an independent accepted review before M4 becomes done. M5 remains a separate verification-only integration task and must gather its own complete source, runtime, browser, architecture/security and NFR evidence.
