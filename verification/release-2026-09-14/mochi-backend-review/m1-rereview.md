# M1 independent backend re-review — PASS

This re-review is bound to the remediation submission `mochi-m1-repair-submit.json`, SHA-256 `0548aeaad3d66a554cb29249c2a1cebe75e4a91fe81f37ca554d0997c70eab48`.

| Candidate context | Value |
| --- | --- |
| Candidate tree | `7fac8cf995dae46678768746426bdb213f597dd5ab1ba3eb7f0959df4159a76d` |
| Run | `run-56829857-c2d1-4bf9-925c-e3a3819de377` |
| M1 lease generation | `2` |
| M1 prior consumed failures | `1` |
| Approved v1 spec | `a30e650e40f8228f88555d92c940b7071a452293e9c27657a1b322f2824c350d` |
| M1 task hash | `3d9ed6d5572d48145e2046af14074f9896f13eff3298d5da55fd4aec9f44ae91` |
| `server.mjs` | SHA-256 `131b4ef9d826ad0e340f4aa3a2e665d14fc0d233288fa68bb8279dc9e15b9b13` |
| `lib/store.mjs` | SHA-256 `0308435a9ce945b43e0e6db44bfc9a3a460570777266dc20f97da40fa331742f` |

The reported frozen M1 Gate passed for this candidate. I independently ran the completed supplemental harness against an isolated copy of the current app with:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node \
  /Users/leo/plugins/leo-dev/verification/release-2026-09-14/mochi-backend-review/m1-supplemental.mjs
```

The process exited 0. Its outcome fields were (the isolated temporary path is omitted):

```json
{"ok":true,"contractFailures":[],"strictValidationFailures":[],"checks":["default-port-and-data","parseable-invalid-bytes-preserved","strict-persisted-field-validation","null-fields-rejected","null-origin-rejected","sigterm-drain","sigint-drain"]}
```

The isolated run verified the default `127.0.0.1:4173` listener and example-relative `.data/board.json` after a create. It verified that both a parseable structurally invalid board and a board with `2026-02-30T00:00:00.000Z` timestamps fail startup with exact input bytes preserved. It verified that `notes`, `status`, and `priority` explicitly supplied as `null` return 400; `Origin: null` returns 403. Finally, an already-established POST with headers sent before either signal completed as 201 and persisted its task after both SIGTERM and SIGINT.

The source changes address the rejected findings directly: `Object.hasOwn` distinguishes omission from `null`, the null-Origin exemption is gone, and calendar day/month/leap-year checks precede persisted timestamp acceptance. Serialized mutations and same-directory temporary-file rename remain intact.

The original RED evidence remains in this review directory. The harness error handling was repaired only for expected startup rejection: a rejected `listening` promise no longer creates an unhandled derived rejection inside `Promise.race`; startup rejection, nonzero exit, and byte-preservation assertions remain mandatory.

M2 PATCH/DELETE/history, M3 UI, and M4 import/export were not evaluated as M1 features. The shutdown probe exercises an established request without instrumenting private handler state; it is bounded supplemental evidence for the required drain behavior, not a performance test.
