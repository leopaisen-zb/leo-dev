# V2 M1 independent backend review — PASS

This is a fresh revision-2 review, bound to `mochi-v2-m1-submit.json`, SHA-256 `7320ad759d0bc3d2705e768849b7a19c1e7b29aeb812bb96d1295772bfb94a5b`.

| Candidate context | Value |
| --- | --- |
| Authority revision/spec identifier | `2` / `13776dfb6f2167649877847d4852fc2f0b6d3abd53cfd875da86fd5f8c0675d4` |
| V2 source hash | `63d8e80779df469aad6ada4996a6330f7d923447c90c22e51c6db87f9ed659a3` |
| Candidate tree | `19f3cc0cd15181c393c6c64281d1df449f7658bb3ec9b40693df20369a46e234` |
| Run | `run-dbaaaef9-7608-4801-a3cb-fac34165fb3a` |
| M1 revision / lease generation | `2` / `3` |
| M1 task hash | `2b38347fb81b1561545a03bba4c9a524fd5541a2d4fdf99f08b936e62f40efa6` |
| `server.mjs` | SHA-256 `6eb5eeecd67466de94d9c7fb943bc72a4b116dc8a98b6d8ef8387ed43461ed01` |
| `lib/store.mjs` | SHA-256 `1a37c342f0578e5a12bcaf8cebbde28af44b734d9a86c7f727a258827bf52cb5` |

The reported fresh v2 M1 Gate passed. I independently ran the private supplemental harness on an isolated current-app copy with Node 22.22.2 and authorized loopback binding:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node \
  /Users/leo/plugins/leo-dev/verification/release-2026-09-14/mochi-backend-review/m1-supplemental.mjs
```

It exited 0 with no contract or strict-persistence failures. It verified the default `127.0.0.1:4173` listener and example-relative data path, parseable invalid-board and impossible-date startup rejection with unchanged bytes, explicit null-field 400 responses, `Origin: null` rejection, and SIGTERM/SIGINT accepted-request drain behavior.

V2 changes M3 search semantics only. No new M1 feature was imposed. This report is independent of the earlier v1 M1 receipt and uses the fresh v2 candidate context above.
