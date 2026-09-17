# Q3 standalone app-server client review

Reviewed `codex-session.py` against the locally generated Codex 0.154.0
app-server schemas under `/private/tmp/leo-dev-quality-protocol-O0INXX`. No
app-server, model, installation, or configuration operation was run.

## What is protocol-correct

* It sends `initialize` and waits for response id `1` before sending the
  `initialized` notification (lines 89–109). This is the required JSON-RPC
  handshake ordering.
* It transparently records `thread/start`, `turn/start`, and `turn/interrupt`
  requests and the server notifications. `v2/TurnInterruptParams.json`
  requires the `threadId` and `turnId` which the request writer must supply.
* It does not itself answer a host request: an inbound request is only logged
  at lines 112–113. Thus there is no automatic approval in the receive path.
* The normal `turn/completed` event includes the turn items in
  `v2/TurnCompletedNotification.json`; after recursive filtering, an exact
  `UserInput` of `{type:"skill",name,path}` remains available as evidence of
  the requested candidate skill path.

## Material gaps before treating a run as cancellation evidence

1. `{"control":"shutdown"}` immediately leaves the receive loop (lines
   131–132), closes stdin, and may terminate/kill the owned server after five
   seconds (lines 136–146). It neither tracks an active `(threadId, turnId)`
   nor requires a matching `turn/completed` notification with
   `status:"interrupted"`. Process exit is therefore *not* evidence that a
   particular turn was interrupted.
2. The final drain (lines 147–154) stops after one 100-ms empty queue read.
   The daemon stdout reader can still be parsing buffered stdout after the
   child has exited, so that last terminal notification can be lost. Wait for
   the reader's `None` sentinel (or join it) before closing `events.ndjson`.

For the current driver, do not append shutdown until events contain the
matching `turn/completed` record for the same `threadId` and `turnId` with an
`interrupted` status. A stronger implementation should enforce this and add
the observed terminal turn state (or `unknown-at-cleanup`) to
`client-result.json`.

## Approval boundary

The receive path does not auto-grant, but `requests.ndjson` is an unrestricted
JSON-RPC injection channel (lines 121–134). It will forward a manually written
response whose `id` matches a pending server approval request, including a
schema-defined `accept` / persistent-policy decision. The server-request
schemas include command, file-change, patch, and permissions approvals.

That is acceptable only if the requests file is considered a deliberate,
reviewed operator control. It is not a technical guarantee against an
accidental approval. For a consumer verification client, either allowlist only
`thread/start`, `turn/start`, and `turn/interrupt` request methods and reject
all response-shaped JSON-RPC messages, or implement a separate explicit,
reviewed response mechanism. Do not call the current script an
approval-enforcing client.

## Reasoning and isolation qualifications

* `record()` filters typed reasoning stream/items, including reasoning entries
  in a completed turn. It is not an exhaustive sensitive-data redactor:
  `stderr.log` is written unfiltered, and objects with a `reasoning` property
  but a different `type` survive the filter. The raw-response schema includes
  a `configuration_update` item with such a property. Consequently
  `reasoningRetained:false` is an intent, not yet a proven property. Do not
  retain raw stderr for the evaluation, or apply the same structural redaction
  before evidence is retained.
* `child_env = os.environ.copy()` (line 27) passes any ambient authentication
  variables to the child. With `--consumer-home`, `CODEX_HOME` is overridden
  for that child, which does not modify the parent shell; however that alone
  cannot establish "no credentials copied" if an auth/token environment
  variable exists. A true isolated-discovery launch must start from a scrubbed
  environment (without printing or inspecting credentials). The normal-auth
  actor is a separate process claim and should be recorded separately.
* If initialization returns an error, the code prints it then waits until its
  one-hour deadline. Mark initialization failure terminal immediately, so an
  invalid handshake cannot yield an ambiguous evidence bundle.

## Decision

The explicit-skill request path can be recorded accurately by this client, but
the current script alone cannot certify an interruption, enforce no approvals,
or guarantee reasoning-free retained artifacts. The Q3 protocol must impose
the terminal-event wait and operator-only request constraints above; otherwise
record the run as incomplete/unknown rather than passed.
