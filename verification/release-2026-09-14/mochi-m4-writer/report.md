# Mochi Board M4 writer report

Date: 2026-09-14 (UTC)

Installed development skill used: `/Users/leo/.codex/plugins/cache/leo-dev-release/leo-dev/0.2.0/skills/develop/SKILL.md`.

The local browser smoke also followed: `/Users/leo/.codex/skills/playwright/SKILL.md`.

## Controller read-only status

Command:

```sh
/Users/leo/.nvm/versions/node/v22.22.2/bin/node /private/tmp/leo-dev-continuation-bundle-9aoDoh/codex/leo-dev/runtime/packages/cli/dist/index.js status --change mochi-board --repo /private/tmp/leo-dev-mochi-OjZ5Xy --json
```

Result: `changeState=executing`; M4 `state=implementing`, revision 2, lease generation 1 active; run `run-79d6ecbd-7f71-4a53-843f-887a9247f323`; expiry `2026-09-14T13:45:29.759Z`.

## Source hashes

Before implementation:

```text
6eb5eeecd67466de94d9c7fb943bc72a4b116dc8a98b6d8ef8387ed43461ed01  server.mjs
1a37c342f0578e5a12bcaf8cebbde28af44b734d9a86c7f727a258827bf52cb5  lib/store.mjs
c6c11a2e16e0ec142cc88abf93caad24c2b2f5742b33d01ee48a47930eb5420f  public/index.html
ac9fc97174b5a653ff7c1bb945721211c207cff222b9cc7bc69153b505254a0f  public/styles.css
c5618a520c78c4cc98d87c98b3a1cad36a9a8b2783dd6a8458f3d2d702df877e  public/app.js
13c4400b7ea1f54879c25e595e55abec2c8ffb99640ff93810fc00b712016ab6  public/mochi.svg
```

After implementation:

```text
13fc5203b84394bab128f668f9d4a9047210f7de69ca0bfa5259c43f7507c160  server.mjs
4a46edaf51d733590be53b92c45b3c8759fc9641f15cca9aece9615d223b4308  lib/store.mjs
8fac1bb4c487604d25d66f106e3ad99ecf6bf2a434eb46bc18b8320a84cb9187  public/index.html
982bc24c1a6e78b1b66583b0e407c1fa6c15f35f6944d824c02fd7c4d3fbc893  public/styles.css
cf96d12f1078c7546f9d0dd514db402a6598785f0e79bb02374ac9510a7c2890  public/app.js
13c4400b7ea1f54879c25e595e55abec2c8ffb99640ff93810fc00b712016ab6  public/mochi.svg
```

Protected bytes after the work remain unchanged: `tests/acceptance.test.mjs=152ab74d2ffca5632d8f75e175408cf99f97eb337e1fbcd7c39bca90e91d576e`; `notes/keep.txt=7a1b301c428dd9dc3d581d78ac1c4e7a538cac8d276bf0580c4294d08489e7b9`.

## Commands and results

| Check | Exact command | Result |
| --- | --- | --- |
| Frozen RED in sandbox | `/Users/leo/.nvm/versions/node/v22.22.2/bin/node --test tests/acceptance.test.mjs` | Loopback binding is sandbox-blocked (`listen EPERM`); all HTTP groups except corrupt-data startup could not start. |
| Frozen RED with host loopback | `/Users/leo/.nvm/versions/node/v22.22.2/bin/node --test tests/acceptance.test.mjs` | 5 passed, M4 export/import and invalid-snapshot groups failed at the missing routes (404). |
| Syntax + frozen GREEN | `/Users/leo/.nvm/versions/node/v22.22.2/bin/node --check server.mjs && /Users/leo/.nvm/versions/node/v22.22.2/bin/node --check lib/store.mjs && /Users/leo/.nvm/versions/node/v22.22.2/bin/node --check public/app.js && /Users/leo/.nvm/versions/node/v22.22.2/bin/node --test tests/acceptance.test.mjs` | Exit 0; syntax passed and all 7 frozen groups passed. |
| Supplementary HTTP boundaries | Node `http.request` writer smoke against temporary `127.0.0.1:43123` server | `{"foreign":403,"loopback":200,"contentType":415,"large":413}`. The foreign case used `Origin: http://foreign.invalid:43123` with spoofed `Host: foreign.invalid:43123`. |
| Browser smoke | `/Users/leo/.codex/skills/playwright/scripts/playwright_cli.sh -s=mochi-m4-writer ...` from `/private/tmp/mochi-m4-playwright` | Opened local app, opened Import, imported a valid snapshot, and triggered a real `mochi-board.json` download. Invalid JSON showed an alert while textarea value remained `{broken`; Escape closed the dialog and focus returned to Import. Browser/data artifacts stayed outside the fixture. |

## Supported controls and behavior

- `GET /api/export` supplies `schemaVersion` and task values only.
- `POST /api/import` validates the entire snapshot first, limits to 500 exact-shape tasks, then replaces task data through the serialized store queue and appends one bounded import activity item.
- Origin checking is listener-port-bound and permits only exact `http://127.0.0.1:<bound-port>` or `http://localhost:<bound-port>` origins, plus no-Origin CLI requests.
- Import/Export toolbar controls are enabled. Export uses a Blob download. Import uses a labelled native dialog; Cancel/Escape/focus restoration work; failures retain input and visible board state; successful responses replace the rendered authoritative tasks/activity.

## Remaining concerns

This is writer-side evidence only, not a controller Gate, submission, review, or acceptance result. Root retains independent probing and candidate review. No source or controller artifacts outside the assigned M4 paths were changed.
