# W3 board: independent real-browser review

Date: 2026-09-16 (Asia/Shanghai). This is a local, isolated CLI-fixture review. It is **not** a benchmark-state acceptance: the benchmark consumer, inputs, traces, and held-out assets were not opened or modified.

Candidate served: `packages/cli/dist/index.js` SHA-256 `b17b725a94997820377e5ae365a472f64b1df366640ee98cef285bd2bf8801fe` (the browser first loaded it at 2026-09-16T03:57:22Z). Board URL: `http://127.0.0.1:54756/` for the normal/corrupt fixture; the real empty and missing history URLs were `http://127.0.0.1:55151/` and `http://127.0.0.1:55198/`.

## Method

I created `/private/tmp/leo-dev-board-browser-20260916-s6Wy12` and used the already-built CLI to run `init`, `route`, lifecycle transitions, `claim`, `run-gates`, `submit`, `review`, and `team record`. The resulting normal history contained one queued task, one active task, one done task with CLI-produced Gate/review evidence, and two recorded team members. The normal fixture is deliberately separate from the benchmark.

The browser was the cached Playwright CLI browser, not jsdom or a hand-written DOM. It loaded the local loopback board at desktop and a 390 x 844 viewport. The incomplete journal case was an explicitly injected corrupt tail in this disposable fixture only.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Desktop board loads actual CLI state | PASS | Queued, Active, Done cards displayed from `GET /api/observation`; Gate/review status, run, candidate status, tree hash, and evidence reference were visible. [desktop initial](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/desktop-initial.png) |
| Keyboard focus and detail | PASS | `Tab` reached Refresh then a task card; `Enter` opened its recorded state, revision, run, last activity, requirements, Gate, and review detail. |
| Refresh reads real changed state | PASS | After legal `team record` commands, Refresh showed team revision 3, both recorded members and bindings, and literal `host liveness unknown`. [desktop recorded team](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/desktop-recorded-team.png) |
| Candidate/evidence relationship | PASS | The done task showed its bound historical Gate and review evidence. The fixture correctly labelled both candidates `drifted` after later local fixture changes, rather than inventing a current match. |
| Empty real history | PASS | A separate `init`-only CLI consumer produced four empty columns and no recorded team. [empty 390px](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/empty-390.png) |
| Missing real history | PASS | A board bound to an absent change showed an unavailable warning and empty columns. [missing 390px](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/missing-390.png) |
| Corrupt-tail refresh and stale preservation | PASS | After appending `{"sequence":999` to the disposable journal, Refresh displayed the incomplete-tail warning while retaining cards, selected detail, and recorded team. The journal stayed 42,378 bytes with SHA-256 `e2f99daad0d11ba64d83008c8efa4cdc165e2eeae442edce8320b0d758f09959`; no repair or journal lock was created. [stale 390px](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/mobile-stale-corrupt.png) |
| Normal Refresh has no task-history write | PASS | Before and after an unchanged browser Refresh, the `.leo-dev` tree, every file digest, byte length, and mtime matched. The only lock present was the pre-existing `.leo-dev/runtime/.initialize.lock`; no `journal.ndjson.lock` appeared. |
| Stored-text safety | PASS | A real `team record` stored role text `<img src='/sentinel' alt='unsafe'>`. The browser displayed that exact literal text; `img[src="/sentinel"]` count and `/sentinel` resource requests were both zero. |
| CSP and local network | PASS | Browser-side fetch returned `200` / `available`; resources were only board CSS, JS, observation requests, and the browser favicon request. The HTML response set `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. |
| Narrow layout at 390px | FAIL | `window.innerWidth` was 390 while both `document.documentElement.scrollWidth` and `document.body.scrollWidth` were 524. Long unbreakable evidence/run/hash text forces horizontal overflow. [normal 390px](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/mobile-390.png) |
| Selected detail after a successful Refresh | FAIL | Selecting a task then performing a successful Refresh replaces the detail with “Select a task to inspect…”, instead of retaining the selected task and refreshing its data. A failed Refresh does preserve the previous selected detail. |
| Console clean | FAIL | The browser logged one error on each initial board load: `GET /favicon.ico` returned `404`. No CSP or script error was observed. Console files: `/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright/.playwright-cli/console-2026-09-16T03-57-22-624Z.log` and subsequent navigation logs. |
| Unsupported method/foreign Host in a browser | NOT RUN | The focused server tests cover those protocol cases; this review used browser-accessible loopback flows only. |

## Diagnosis

The mobile overflow is owned by the frontend asset boundary in `packages/cli/src/board/assets.ts`. Each card contains full evidence paths, run IDs, and 64-character hashes in a mono `.evidence` block. The mobile media query stacks columns but does not allow those strings to break, so the column retains a 524px minimum-content width. Add bounded wrapping/word breaking to evidence and card content, then rerun the 390px measurement.

The Refresh handler in the same asset calls `resetDetail()` on every successful observation. That explains why the selected detail disappears despite the task still existing. Preserve a selected task ID and rerender its current observation, or intentionally document the reset if that is the intended interaction.

The favicon error is owned by the local board server/static-asset boundary. Either provide a fixed favicon response or prevent the request through the document markup if a clean console is required.

## Reproduction / acceptance checks

1. Create an isolated repository, run the built CLI through `init`, `route`, the lite lifecycle to `executing`, `claim`, `run-gates`, `submit`, `review`, and `team record`; start `leo-dev board --change <id> --repo <fixture> --json`.
2. Open the emitted `127.0.0.1` URL in a real browser. Confirm recorded task state, evidence reference/run/candidate summary, last activity, members, and `host liveness unknown`; tab to a card and press Enter.
3. Make a legal CLI state change, press Refresh, and verify the board and selected detail show the new observation.
4. Capture the `.leo-dev` file tree, digests, sizes, and mtimes; press unchanged Refresh; require an identical result and no journal lock.
5. At 390px, require `document.documentElement.scrollWidth <= window.innerWidth` and no clipped evidence text.
6. Append an incomplete tail only to a disposable corrupt fixture; press Refresh; require a visible stale warning, preserved last good display, unchanged corrupt journal bytes, and no repair/lock.
7. Use an actual CLI `team record` with HTML-looking stored text; require literal rendering and no injected element/request.

## Second pass: frozen-candidate re-review

Date: 2026-09-16 (Asia/Shanghai). This pass used the frozen build without editing source, build output, or benchmark assets. Runtime hashes: `index.js` `b17b725a94997820377e5ae365a472f64b1df366640ee98cef285bd2bf8801fe`; `board/assets.js` `54c98caa1d0d52d455d6ff946e1b7a5e63c89e40f58d1fdfb70d1486757eb97a`; `board/server.js` `d40ae880b9f711fb1c474d5ff47403dd38996fe9a6c1fe16627cbe9fc2a9a432`.

I created a second disposable CLI fixture at `/private/tmp/leo-dev-board-browser-r2-20260916-4AfSYI`. It used real `init`, `route`, and `team record` commands; the displayed fresh-board URL was `http://127.0.0.1:56166/`. No benchmark consumer was opened or changed.

| Check | Result | Evidence |
| --- | --- | --- |
| Numeric change revision | PASS | The live browser status rendered `revision 1`, from the real observation rather than a formatted null/string. |
| Recorded members, activity, and participants | PASS | The browser rendered both real recorded members with bindings and `last activity`; it also rendered the real pending `builder → reviewer` contribution with timestamp. [desktop R2](/private/tmp/leo-dev-board-browser-r2-20260916-4AfSYI/output/playwright-r2/r2-desktop-team-revision.png) |
| Selected current detail survives successful Refresh | PASS | Selecting `work-task` then pressing Refresh retained `work-task` detail, requirements, revision, run/assignment/run-state/lease fields, and latest recorded values. |
| 390px layout | PASS for exercised state | Real browser measurement: `innerWidth=390`, document and body `scrollWidth=375`. The stacked board, selected detail, and recorded participant text were visible without horizontal overflow. [390px R2](/private/tmp/leo-dev-board-browser-r2-20260916-4AfSYI/output/playwright-r2/r2-mobile-390.png) |
| Favicon and console | PASS | `/assets/favicon.svg` returned `200 image/svg+xml; charset=utf-8`; browser resource entries contained favicon, board CSS/JS, and observation calls only. This navigation produced no console error event. |
| Read-only refresh | PASS | Before/after unchanged Refresh, the fresh fixture's `.leo-dev` file tree, SHA-256 values, sizes, and mtimes matched. No `journal*.lock` file appeared; the pre-existing initialization lock remained unchanged. |
| Genuine claimed assignment, run state, active lease, evidence wrapping | BLOCKED | The runner rejected a new `human-confirmed` fixture receipt as fabricated authorization. I did not recreate or bypass it. Per the safe reconstruction instruction, I copied the earlier disposable fixture only after verifying its known corrupt suffix (`{"sequence":999`, 15 bytes) and hash, then removed exactly that suffix in the copy. The relocated history itself was unavailable: `The current Gate has no unique prepared attempt`. The original first-pass fixture remained unchanged. Therefore the fresh candidate could not render the prior real claim/Gate/review data, so assignment/session/run/lease and long real evidence wrapping were not re-exercised in this pass. |
| Recorded blocker reason | BLOCKED | A real blocker-bearing lifecycle requires the same authorization-dependent claim/gate flow. The fresh queued fixture had no blocker record, and the relocated prior history was unavailable as above. |

The first-pass findings were fixed in the exercised browser flows: selected detail now persists across a successful refresh, 390px no longer overflows in the exercised content, and the favicon no longer causes a console error. Assignment/run/lease, blocker-reason, and long evidence-path regression checks remain explicitly unverified against this frozen candidate; they should be re-run on the actual Leo benchmark consumer once its authorized state is available.

## Third pass: original-path history restoration and active-state re-review

Date: 2026-09-16 (Asia/Shanghai). Frozen runtime hashes remained: `index.js` `b17b725a94997820377e5ae365a472f64b1df366640ee98cef285bd2bf8801fe`; `board/assets.js` `54c98caa1d0d52d455d6ff946e1b7a5e63c89e40f58d1fdfb70d1486757eb97a`; `board/server.js` `d40ae880b9f711fb1c474d5ff47403dd38996fe9a6c1fe16627cbe9fc2a9a432`.

### Restoration provenance

Before restoration, I copied all 37 regular files from the original first-pass fixture at `/private/tmp/leo-dev-board-browser-20260916-s6Wy12` to `/private/tmp/leo-dev-board-browser-r3-original-archive-20260916-jrlXju`. The archive manifest is `/private/tmp/leo-dev-board-browser-r3-original-archive-20260916-jrlXju/R3-ARCHIVE-MANIFEST.md`.

The archived journal was 42,378 bytes with SHA-256 `e2f99daad0d11ba64d83008c8efa4cdc165e2eeae442edce8320b0d758f09959`; its final exactly verified 15 bytes were the deliberately injected `{"sequence":999`. I removed only those 15 bytes at the original canonical fixture path, producing the known prior normal journal: 42,363 bytes, SHA-256 `ba9ed069f632ed588018e336e4156272bd0174c607998012fc6b3f396fd7724e`. No receipt, approval, candidate, source, or benchmark record was edited. This restores prior fixture state; it is not new human authorization.

### Results

| Check | Result | Evidence |
| --- | --- | --- |
| Existing real assignment, run, and lease | PASS | The original-path observation showed `review-task` as `implementing`, with recorded assignment `browser-review`, `running` run state, and `lease active true`. Its detail panel rendered every value. [active assignment detail](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r3/r3-detail-active-assignment.png) |
| Existing real Gate/review evidence | PASS | The done `active-task` card and selected detail showed its stored Gate and review status, run ID, candidate tree, evidence reference, and `candidate drifted`. The latter is accurate for this historical fixture after later fixture-tree changes; it was not displayed as a current match. [desktop active/evidence](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r3/r3-desktop-active-assignment-evidence.png) |
| Keyboard detail | PASS | `Tab` moved focus from the active card to the done evidence card and `Enter` selected it. The resulting mobile detail contained the actual recorded Gate and review evidence. |
| 390px long-evidence rendering | PASS | With real path, run UUID, 64-character hash, and evidence-reference text on screen: `innerWidth=390`, document/body `scrollWidth=375`; every evidence block had `scrollWidth === clientWidth` (307px card blocks, 325px detail blocks). [390px real evidence](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r3/r3-mobile-390-long-evidence.png) |
| Selected detail after successful Refresh | PASS | Refresh retained `active-task` selection and its current assignment/evidence detail while updating the observation timestamp. |
| Normal read-only Refresh | PASS | Before/after normal browser Refresh, `.leo-dev` tree entries, SHA-256 values, sizes, and mtimes matched. No `journal*.lock` appeared; only the pre-existing initialization lock remained. |
| Stale/error preservation and no repair | PASS | Re-appending the same archived 15-byte corrupt tail made Refresh show the incomplete-tail stale warning while retaining the selected done-task detail and prior board. Browser refresh left the journal at the archived failed-sample hash/size (`e2f99…`, 42,378 bytes) and created no journal lock. [390px stale preserved](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r3/r3-mobile-stale-preserved.png) |
| Stored-text safety on frozen candidate | PASS | The separate real CLI-recorded unsafe-looking role string `<img src='/sentinel' alt='unsafe'>` rendered literally. Browser measurement found `imgCount=0` and `/sentinel` request count `0`. |
| Favicon and console | PASS | The frozen candidate served its fixed favicon; browser loads in this pass emitted no console error event. The prior R2 browser fetch also verified `200 image/svg+xml; charset=utf-8`. |
| Recorded blocker reason | NOT APPLICABLE | This restored real history has no `blocker.recorded` event (`change.blockers` and all task blocker arrays were empty). No new lifecycle write was performed merely to manufacture a blocker. |

This is still fixture acceptance only. It does not replace the promised connection verification against the Leo benchmark-generated consumer state.

## Fourth pass: compact-card candidate and supplemental live benchmark connection

Date: 2026-09-16 (Asia/Shanghai). This pass was completed against the already-built candidate that the browser served before the subsequent controller-recovery rebuild: `packages/cli/dist/index.js` SHA-256 `b17b725a94997820377e5ae365a472f64b1df366640ee98cef285bd2bf8801fe`; `packages/cli/dist/board/assets.js` `18ad77ce5d7a3773e8511bc6dd55f23f8147c26879f792fe86bb8e679402baa0`; `packages/cli/dist/board/server.js` `d40ae880b9f711fb1c474d5ff47403dd38996fe9a6c1fe16627cbe9fc2a9a432`. The controller source changed after these captures while a recovery repair was being prepared, so no source hash is used to identify this browser candidate.

### Results

| Check | Result | Evidence |
| --- | --- | --- |
| Compact overview, full selected detail | PASS | The three overview cards rendered only task ID, recorded status/revision, and Gate/Review candidate status. The done card text was `active-task / done · r1 / Gate: succeeded · candidate drifted / Review: pass · candidate drifted`; it did not expose the run UUID, 64-character tree hash, or evidence reference. Selecting it revealed the full recorded run, assignment, run state, lease, tree hash, and both evidence references in the detail pane. [desktop compact/detail](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r4/r4-desktop-selected-detail-full-evidence.png) |
| 390px compact board and long selected evidence | PASS | At `innerWidth=390`, document and body `scrollWidth=375`. All three card boxes were `327/327` client/scroll width. Eight long evidence/detail boxes were either `307/307` or `325/325`; the actual UUID, hash, runtime path, and receipt text were visible without horizontal overflow. [390px selected evidence](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r4/r4-mobile-selected-long-detail.png) |
| Browser keyboard and selected-refresh behavior | PASS | The task card was selected from the browser via keyboard in the earlier live sequence, and selected details stayed present across the normal Refresh path exercised in this fixture and the benchmark refresh below. |
| Favicon, console, and CSP/network | PASS | The inspected fixture navigation had zero console messages (zero errors and warnings). Its visible API request was `GET /api/observation` with `200`, JSON content type, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and the restrictive self-only CSP. The resource set included the fixed static favicon rather than the former `/favicon.ico` 404. |
| Browser GET remains read-only | PASS | Before the final restoration, the normal journal was exactly 42,363 bytes with SHA-256 `ba9ed069f632ed588018e336e4156272bd0174c607998012fc6b3f396fd7724e`; it had no `journal*.lock`. The only lock was the existing zero-byte `.leo-dev/runtime/.initialize.lock` (mtime `1789530897`), predating this pass. The browser made only GET requests. |
| Original corrupt sample preserved | PASS | I re-verified the R3 archive and known normal suffix before testing. After stopping the local servers, I restored only the approved 15 bytes `{"sequence":999` to the original path. Final journal state is 42,378 bytes, SHA-256 `e2f99daad0d11ba64d83008c8efa4cdc165e2eeae442edce8320b0d758f09959`, exact final bytes `{"sequence":999`, with no journal lock. No receipt, approval, candidate, source, or benchmark record was changed. |
| Actual Leo benchmark state, initial observation | PASS (limited) | Read-only board/CLI observation of `/private/tmp/leo-dev-w1-20260916/w1-consumers/dev-r1-leo-v2`, change `dev-r1`, first showed `triage`, revision 1 and no recorded tasks at 04:59:04Z. During the authorized actor's subsequent work, the browser loaded the recorded `repair-contract` task in Queued with recorded engineering team revision 1. [benchmark initial state](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r4/r4-benchmark-triage-empty.png) |
| Actual Leo benchmark refresh into active state | PASS (limited) | Direct read-only CLI `observe` at 05:00:37Z reported `executing`, revision 1, `repair-contract` implementing, assignment `/root/implementer`, run `run-7541285a-bb46-4eed-84de-8cc7bccbdbf6`, `running`, lease active `true`, and engineering team revision 3 with two last-activity timestamps. Pressing the real browser Refresh showed the same active card and selected current detail (including assignment/run/lease) and team revision 3. [benchmark active after refresh](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r4/r4-benchmark-active-after-refresh.png) |

The live benchmark connection is deliberately limited to states actually observed while its authorized actor was running: `ready/queued` and `implementing/active`, with host live status explicitly rendered as `unknown`. It does not claim completion, Gate/review evidence, blocker reason, or the later benchmark outcome. No benchmark consumer file, receipt, control, requirement, actor session, or held-out input was opened or modified.

### Reproduction / acceptance checks

1. Use the built `leo-dev board` CLI against an existing CLI-generated fixture, then open only its emitted `127.0.0.1` URL in a real browser.
2. At desktop, ensure an overview card contains only status/candidate summary. Select it and require run, tree hash, and evidence reference in the detail pane.
3. At 390 x 844, select a long-evidence task and require document/body scroll width no greater than `window.innerWidth`; also require every card/evidence box `scrollWidth === clientWidth`.
4. Capture browser console and network. Require no error/warning, an observation GET returning 200, self-only CSP, fixed favicon, and no write request. Compare pre/post task-history file tree/hash/size/mtime and require no journal lock.
5. For an authorized live consumer, take a read-only CLI observation, use browser Refresh after a real actor transition, and require selected task details and recorded team values to match the later observation. Report only states actually seen.

## Fifth pass: final built candidate on the completed Leo benchmark consumer

Date: 2026-09-16 (Asia/Shanghai). This is the final real-browser check against the completed, authorized benchmark consumer `/private/tmp/leo-dev-w1-20260916/w1-consumers/dev-r1-leo-v2`, change `dev-r1`. It uses the exact Node runtime recorded for the Gate, `/Users/leo/.nvm/versions/node/v22.22.2/bin/node`, for both read-only `observe` and the local board server.

Final candidate hashes: source controller `0b7b99c80d26b580fdf5e438f450283475e4f1f0d731a3092b01b55386174131`; built controller `a39a3d39e5aad97229a4db50d8e4a616fe1caef42a9ee189566c8590361caf83`; source assets `bd6d97eac4617ac79e609c770fda6b5a08af992a68770ed4ddd892c8bc47ee0a`; built assets `6af0e9f24a7350bb5a2f246c7d431b8f1e08593eb102cfee19a182ff63d892b4`; board server `d40ae880b9f711fb1c474d5ff47403dd38996fe9a6c1fe16627cbe9fc2a9a432`; CLI entrypoint `b17b725a94997820377e5ae365a472f64b1df366640ee98cef285bd2bf8801fe`.

### Runtime identity note

An earlier fresh check accidentally launched the board with shell `node` at `/opt/homebrew/Cellar/node/25.8.2/bin/node`. That browser correctly rendered an unavailable observation: “The prepared execution policy is not bound to the reviewed Gate and launcher.” The browser API response and direct CLI observation agreed. This was a launcher-fingerprint mismatch with the historical Gate, not a frontend/API disagreement. It is retained as setup evidence in [the unavailable screenshot](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r5/r5-benchmark-final-unavailable-desktop.png); it is not used as final-candidate acceptance. Repeating with the recorded Node 22 runtime returned the available completed observation below.

### Results

| Check | Result | Evidence |
| --- | --- | --- |
| CLI observation and browser status agree | PASS | Exact-runtime `observe` at 05:14:53Z and again at 05:17:01Z returned `available`, change `integration-review`, revision 1, one `repair-contract` task in `done`, and host liveness `unknown`. The browser showed the same done card and explicit `host live status: unknown`; it did not infer a live host state. |
| Actual done-task evidence and candidate relationship | PASS | Browser task detail displayed assignment `/root/implementer`, succeeded run `run-7541285a-bb46-4eed-84de-8cc7bccbdbf6`, lease `false`, Gate `succeeded`, review `pass`, their common recorded tree `9ae91f1f…`, and their evidence references. Both detail records said `candidate drifted`, which matches the current observation and was not represented as a false current-tree match. [desktop final detail](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r6/r6-benchmark-final-desktop-detail.png) |
| Compact card plus keyboard detail | PASS | The overview card exposed task/state and Gate/Review candidate summaries only. `Tab`, `Tab` moved browser focus to `repair-contract`; `Enter` opened the full recorded detail. The run, tree hash, and evidence references remained in that selected detail rather than the compact card. |
| Selected detail survives actual Refresh | PASS | Clicking Refresh updated the recorded timestamp to 05:16:17Z while retaining selected heading `repair-contract` and current run, assignment, lease, Gate, review, and evidence detail. |
| Recorded team and activity | PASS | Browser rendered engineering revision 3 and the recorded implementer/reviewer roles, bindings, generations, and last-activity timestamps. |
| Final 390px completed-state layout | PASS | At 390 x 844, document/body `scrollWidth=375`. The actual completed card was `327/327` client/scroll width; four real long evidence/detail blocks were `307/307` or `325/325`. No horizontal overflow occurred. [390px final detail](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r6/r6-benchmark-final-mobile-detail.png) |
| Console, favicon, network, and CSP | PASS | Browser reported zero console errors and warnings. Network contained only local `GET /`, board CSS/JS, two `GET /api/observation` responses (200), and `GET /assets/favicon.svg` (200). Observation response headers included self-only CSP, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. |
| Browser/observation path is read-only | PASS | A manifest of every `.leo-dev` file's path, size, mtime, and SHA-256 was byte-identical before and after board load, keyboard detail, Refresh, mobile capture, and final observe. No `journal*.lock` appeared. The only lock remained the existing zero-byte `.leo-dev/runtime/.initialize.lock` with unchanged mtime `1789534678`. |
| Actual recorded blocker reason | NOT APPLICABLE | The completed observation has no change or task blockers. The asset's recorded-blocker label therefore had no value to render; no benchmark write was made to manufacture one. |

This fifth pass is an actual benchmark-consumer acceptance for the recorded completed state, unlike the isolated fixture evidence above. It does not claim a different live host status, write task history, or alter any benchmark receipt/control/requirement.

## Sixth pass: 390px screenshot-edge geometry check

Date: 2026-09-16 (Asia/Shanghai). A visual review questioned whether the 375-pixel-wide mobile PNG clipped the Refresh button or card borders. I repeated the completed benchmark page with the same final hashes and exact Node 22 runtime, selected the actual done task, and measured layout geometry in the real browser. No source, build, or consumer state was changed.

**PASS — screenshot width is the scrollbar-excluded visual viewport, not CSS overflow or clipping.** The requested browser window is `innerWidth=390`, while `visualViewport.width`, `document.documentElement.clientWidth`, and `document.body.clientWidth` are all 375. The 15px difference is the vertical scrollbar gutter. Playwright's CSS-scale full-page PNG consequently has intrinsic width 375px (both the previous R6 PNG and new R7 PNG), matching the layout viewport rather than `window.innerWidth`.

All measured boxes fit within that 375px layout viewport: header/main `0..375`, with 12px padding each side; Task board `12..363`; selected detail and recorded team `12..363`; actual task card `23..352`; Refresh button `285.25..363`. Each element's `scrollWidth` equalled its client width (header 375/375, main 375/375, board 351/351, card 327/327, detail/team 349/349). Thus the apparent right edge is 12px of intentional page padding after the Refresh button and main content, and the border is fully inside it. Document/body scroll width remained 375, with no horizontal overflow and zero console messages. [geometry screenshot](/private/tmp/leo-dev-board-browser-20260916-s6Wy12/output/playwright-r7/r7-mobile-geometry.png)
