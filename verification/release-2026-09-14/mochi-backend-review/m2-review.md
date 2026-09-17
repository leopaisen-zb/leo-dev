# M2 independent backend review — NEEDS_FIXES

This review is bound to the injected M2 submission `mochi-m2-injected-submit.json`, SHA-256 `2fbb5639bab402be7e622ee08a2355eb43b0c72cc49ef9d5dfe5cf93b857abf7`.

| Candidate context | Value |
| --- | --- |
| Candidate tree | `8e61190a2e5ca63133bc9a420d8950c659a9e25f0f166d85b454f61a38b8180a` |
| Run | `run-ef8ca8f6-9f86-4f95-b661-627394e3e8d1` |
| M2 lease generation | `1` |
| M2 task hash | `1553878ffbf3599407b7d6090aa7f53994a8f94fc4762d8d23992b58795df076` |
| Approved v1 spec | `a30e650e40f8228f88555d92c940b7071a452293e9c27657a1b322f2824c350d` |
| `server.mjs` | SHA-256 `6eb5eeecd67466de94d9c7fb943bc72a4b116dc8a98b6d8ef8387ed43461ed01` |
| `lib/store.mjs` | SHA-256 `aa064e333085400454a28b83158853ffd064e6c7d8765878d4ab7a2d033be538` |
| Producer context | Supplied context identifies producer `/root/mochi_m2_writer` and logical producer `mochi-m2-writer`. |

## Reproduced defect

`PATCH /api/tasks/:id` with the nonempty valid subset `{ "status": "done" }` returned 200 but stored and returned `status: "doing"`. The isolated response contained the requested task ID and unchanged title/notes/priority, but `status` was `doing`.

The cause is the injected branch at `lib/store.mjs:114`:

```js
if (Object.keys(changes).length === 1 && changes.status === 'done') task.status = 'doing';
```

Requirement 2.1 requires the supplied validated subset to be applied. Status `done` is a valid value and must remain `done`. This is a behavioral contract failure, so the M2 candidate cannot be accepted despite the recorded frozen Gate result.

## Independent runtime evidence

I ran the following private harness against an isolated copy and temporary board data with authorized loopback binding:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node \
  /Users/leo/plugins/leo-dev/verification/release-2026-09-14/mochi-backend-review/m2-supplemental.mjs
```

It exited 1 solely for the reproduced status-only PATCH defect. Its remaining focused checks passed:

- An individual priority PATCH changed only priority and retained the other task fields; ID and `createdAt` were retained and `updatedAt` was monotonic.
- Empty, unknown-key, null-field, invalid-enum, malformed JSON, missing Content-Type, over-1-MiB, and foreign-Origin PATCH requests returned the required failures without changing task or activity state.
- Unknown PATCH and DELETE returned 404. `Origin: null` DELETE returned 403.
- 100 retained activity entries had unique IDs and valid actions; activity persisted exactly across restart. Successful PATCH activity was present.
- Unknown and traversal-like static paths returned 404 with no wildcard CORS header. The bodyless DELETE returned 204 without a body or Content-Type, removed the task, and appended delete activity.

The raw runtime output is preserved in [m2-supplemental-red-output.json](m2-supplemental-red-output.json). The private harness SHA-256 is `b69f27469b1fcfecb3baf68867bf5cb28db6a1b39103ea3936edb66838ab1f4c`.

## Scope

M1’s repaired behavior is preserved context and was not re-adjudicated. M3 UI and M4 import/export were not considered missing M2 functionality. No attempt was made to alter the candidate, frozen tests, controller, or the disclosed injection record.
