# View a change in the local board

The connected board reads Leo Dev's existing task history. It shows recorded
task state, assignment sessions, Run and lease state, blockers, team activity,
and Gate/review evidence. It has no task-editing or agent-control buttons.

Build the controller from the source checkout, then select an existing change
in the repository you are developing:

```sh
npm run build
node packages/cli/dist/index.js board \
  --repo /absolute/path/to/your/project --change your-change-id
```

Open the printed `http://127.0.0.1:<port>/` address. Keep the command running
while viewing the board; press **Ctrl+C** in its terminal to stop it. The server
chooses a free loopback port and stays bound to the selected repository and
change. It does not open a browser automatically.

For a built plugin package, use its controller entry instead:

```sh
node dist/codex/leo-dev/runtime/packages/cli/dist/index.js board \
  --repo /absolute/path/to/your/project --change your-change-id
```

The packaged path above is relative to the Leo Dev source checkout after
`npm run build:adapters`. An installed plugin has the same
`runtime/packages/cli/dist/index.js` path beneath its own package directory.
Local socket permission is required by the host. Use the same Node executable
that ran the recorded Gates: launcher identity is part of their validation.
For example, a history created with Node 22 at one absolute path can be
unavailable when viewed using a different Node executable. Keep that identity
consistent rather than editing stored evidence.

## Read the display

The three columns group tasks as 待办, 进行中 and 完成. Review is a badge on
the card (审查中 / 审查未过), not a fourth column. Each task also shows its
actual controller state. Select a card with a pointer, or focus it with **Tab**
and press **Enter**, to inspect its recorded details. The board is read-only:
it does not edit tasks, start agents, or write the journal.

**刷新** reads a new observation. It preserves the selected task when that
task still exists. There is no background polling or automatic agent execution.
If a refresh fails, the previous display is marked stale; its old green evidence
must not be treated as a fresh check. A first failed read shows unavailable
state instead of invented tasks.

Assignment sessions and member thread IDs come from recorded events. The board
does not query the host for live agent activity, so host liveness is **unknown**.
The last recorded activity is an event timestamp, not a heartbeat. Blocker
entries are recorded history for the current revision; the task state indicates
whether a task is currently blocked. A historical blocker entry does not by
itself mean that work is still blocked.

Gate and review verdicts are separate from their relationship to the current
candidate. `matches` means the displayed evidence has the required bindings and
its candidate tree matches the observed tree; `drifted` means the tree changed;
`unknown` means a current comparison is unavailable. A historical pass does not
prove that every requirement is met or that a release is ready.

## Inspect the same observation as JSON

```sh
node packages/cli/dist/index.js observe \
  --repo /absolute/path/to/your/project --change your-change-id --json
```

Check the observation's `availability` field in the command envelope. Corrupt
or incomplete history, invalid evidence, or an in-progress state transaction
can make the observation unavailable. Viewing does not repair that state;
use the existing controller diagnosis/recovery workflow separately when needed.

`board --json` emits an NDJSON lifecycle stream: a `BOARD_LISTENING` record with
the URL, followed by a `BOARD_CLOSED` command envelope after Ctrl+C. It is a
long-running command, unlike the one-shot `observe` command.

## Read boundary

Board reads do not create a journal lock, truncate an incomplete journal, or
start recovery. The observer checks journal identity and bytes around its
other reads. This is a best-effort observation across files, not an atomic
filesystem snapshot. Stored strings render as text; receipt and source-file
contents are not included in the observation response.

This board is separate from the editable **Mochi Board** example under
`examples/mochi-board/`. The example's tasks are not Leo Dev controller tasks.
