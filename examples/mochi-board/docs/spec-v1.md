# Mochi Board — requirements v1

This is a local development acceptance project for Leo Dev's Codex-first release. The user delegated its design as a substantial demonstration; the coordinator authored these requirements. It is not an additional specification for the Leo Dev plugin.

## Introduction and boundary

A person manages a small task board on their own computer. Build a working localhost HTTP service and responsive browser interface with persistent tasks and activity. Use Node >=20 built-ins, HTML, CSS and browser JavaScript. No package dependencies, accounts, cloud sync, background service installation or deployment.

## Requirement 1: safe persistence and task creation (M1)

Objective: As a user, I want saved tasks to survive restarting the server.

1. When started with `node server.mjs --port 0 --data /absolute/board.json`, the server shall bind to `127.0.0.1` and emit one JSON line containing `event: "listening"` and its HTTP `url`. Default port is 4173; default data is `.data/board.json` relative to the example directory.
2. When the data file is absent, the server shall start with an empty board. If an existing data file is corrupt or invalid, startup shall fail without overwriting it.
3. `GET /api/board` shall return HTTP 200 JSON `{schemaVersion:1,tasks:[],activity:[]}` with current data. `POST /api/tasks` shall return HTTP 201 with the created task, with stable unique ID, ISO timestamps, trimmed title and default status `todo`, priority `normal`, notes `""`.
4. A task is exactly `{id,title,notes,status,priority,createdAt,updatedAt}`. Titles have 1–120 trimmed characters; notes have at most 2000 characters; status is `todo|doing|done`; priority is `low|normal|high`. Client create input accepts only title, notes, status and priority; invalid types, unknown keys, empty titles or invalid enums shall return 400 JSON `{error: <useful message>}` without changing state.
5. Successful writes shall be serialized and atomically replace the data file. Concurrent valid requests shall not lose tasks. A saved task shall remain after a new server process opens the same file.

## Requirement 2: task updates and history (M2)

Objective: As a user, I want to update my work and see what changed.

1. `PATCH /api/tasks/:id` shall accept a nonempty subset of title/notes/status/priority, apply the same validation as creation and return the updated task (200). Keep ID and createdAt; update updatedAt. Unknown task IDs return 404.
2. `DELETE /api/tasks/:id` shall remove the task and return 204 with no response body; unknown IDs return 404. Invalid requests shall preserve both tasks and history.
3. Each successful create/update/delete/import shall append a history item with nonempty unique `id`, ISO `timestamp` and `action` (`create|update|delete|import`); task actions also include `taskId` and the task title in `title`. An import item may additionally include `count`. Keep the newest 100 entries. History persists across restart.
4. The service shall reject malformed JSON (400), JSON-body mutations (POST/PATCH) without application/json (415); bodyless DELETE requires no Content-Type, JSON bodies over 1 MiB (413), and mutating requests with an explicit foreign Origin (403). No wildcard CORS. Static routes shall use a fixed allowlist, never arbitrary file paths. This is a loopback-only single-process app, not an authenticated multi-user service.

## Requirement 3: usable browser board (M3)

Objective: As a user, I want a clear board that works with mouse and keyboard.

1. The root page shall show To do, In progress and Done columns, visible task counts, Add task, Search tasks, a Priority filter, Import and Export actions, and recent activity. Loading and failure states shall be visible.
2. An accessible task dialog shall support title, notes, status and priority. Saving creates or edits a task; Escape/Cancel closes; focus returns to the triggering control. Cards have named Edit and Delete controls and an accessible status selector. Delete shall allow a local confirmation before the data mutation.
3. Text search shall be case-insensitive and match task titles. Priority and text filters combine. Clearing filters restores all tasks; no matches shows an explicit empty state. Task counts describe visible cards.
4. User strings shall be rendered as text, not executable HTML. Dynamic success/error messages shall use a live region. Controls have visible keyboard focus and labels. At 390px width the page shall have no horizontal overflow; reduce motion when requested.
5. Use the design in `design.md`. Visual polish is part of the deliverable; a real browser screenshot and actual interaction verification are required.

## Requirement 4: portable JSON board snapshots (M4)

Objective: As a user, I want to move a board between local runs without corrupting it.

1. `GET /api/export` shall return `{schemaVersion:1,tasks:[...]}` (200 JSON) and preserve task values exactly, including notes, IDs and timestamps. Object key order and whitespace are not part of the contract. The browser Export action shall download this JSON.
2. `POST /api/import` shall accept exactly that snapshot shape, validate all tasks first, then replace the task list atomically and append one import activity item. Return the current board (200). Keep existing history subject to the 100-item limit. The browser Import dialog shall accept pasted snapshot JSON and describe that it replaces current tasks.
3. Import shall accept at most 500 tasks. Every task must have the exact task fields, an ID matching `[A-Za-z0-9_-]{1,80}`, valid fields and valid ISO date-time strings with createdAt <= updatedAt. Duplicate IDs, unknown schemaVersion/keys, malformed data or any invalid member shall reject the whole import (400), preserving existing task/history/disk bytes. Importing an empty valid snapshot clears tasks.

## Requirement 5: aggregate integration (M5)

Objective: As a maintainer, I want evidence that the complete app works after independent task reviews.

M5 is verification-only and depends on M1–M4. Run all frozen API checks, a separate real browser review (create/edit/move/filter/delete, import/export, invalid-input recovery, narrow viewport), restart persistence and source review. Keep unrelated dirty sentinel content unchanged. An intentional coordinator-injected defect, independent rejection/repair and a fresh-context interrupted-work continuation are workflow evidence, not product features.

## Task ownership and gates

- M1: server.mjs and storage support; create/read/persistence tests.
- M2: server task handlers and activity support; update/delete/history/input tests. Root injects a disclosed status-update defect after the candidate is produced, then independent review decides the outcome.
- M3: public/index.html, public/app.js, public/styles.css and public/mochi.svg. Fresh producer may stop after a visible source write; successor must inspect the actual dirty state before continuing. Before M3 acceptance, an independent browser reviewer must supply a candidate-bound review report with screenshots and observed create/edit/status/delete, keyboard Escape and focus restoration, text/priority filters, injection-safe text, error recovery, and 390px overflow checks. The syntax Gate alone cannot accept M3.
- M4: import/export handlers plus related UI bindings if necessary. Snapshot tests.
- M5: no implementation changes during its claim; one aggregate gate and independent whole-change review.

Acceptance tests are owned by a separate author; implementers may read them but not edit them. A later v2 amendment extends search to notes and requires fresh evidence for all tasks; it is authored under the user's delegated example scope and must not be labelled as a new direct human decision.
