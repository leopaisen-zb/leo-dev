# Mochi Board

A small task board that keeps its data on your computer. It is the worked example for Leo Dev's development, review and recovery workflow.

## Run

Use Node.js 20 or newer. No package installation is needed.

```sh
node server.mjs
```

Open `http://127.0.0.1:4173`. The default data file is `.data/board.json` beside the server. Choose another file or port when needed:

```sh
node server.mjs --port 4174 --data /absolute/path/board.json
```

The server binds to loopback. This example has no account system or cloud sync; run one server process per data file. Export a JSON snapshot to move your tasks. Import validates the entire snapshot before replacing the task list, and keeps recent activity.

## Verify

```sh
node --test tests/*.test.mjs
```

These HTTP tests cover creation, validation, concurrent writes, persistence, updates, deletion, activity, static-path boundaries and atomic snapshot import/export. Browser behavior, default startup and shutdown checks are separate acceptance evidence; the HTTP test count alone does not establish complete UI conformance.

The timestamp regressions also import future-dated tasks, edit them, restart the server, and export and re-import the result. Editing must preserve a valid stored snapshot when an imported timestamp is ahead of the local clock.

The [v2 requirements](docs/spec-v2.md) define title-or-notes search, keyboard access and the 390px layout. [Design](docs/design.md) maps requirements to implementation and review evidence. The earlier [v1 requirements](docs/spec-v1.md) are retained to explain the deliberate specification-revision exercise.
