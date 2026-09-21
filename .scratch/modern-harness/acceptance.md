# v2 第一期验收

Spec: `.scratch/modern-harness/spec.md` **2.1.1**（第一期宿主 Grok Build）。  
Host: **Grok Build**。  
Controller: `node packages/cli/dist/index.js` on `/Users/leo/plugins/leo-dev`.  
HEAD after A7: `1fe8ede` (`docs: replace four-column board screenshots with the three-column workbench`). Parent merge: `daf0e4a`. `package.yaml` 仍 0.2.0。未 push。

Changes:

| change | 任务 | 结果 |
|---|---|---|
| `grok-a9-workbench` | `workbench` | done；change `integration-review`。Gate typecheck。审查 `LITE_REVIEW_ACCEPTED_UNAUTHENTICATED`（租约过期后 `resume --recover-review`）。producer `grok-producer` / reviewer `grok-reviewer`。本轮无产品源码改动。 |
| `grok-a9-closeout` | `screenshots` | done；change `integration-review`。先独立审查 reject（四列英文截图），修补后 `grok-reviewer-closeout-2` pass。`leo-dev commit` → `1fe8ede`，`pushed: false`。 |

| ID | 条款 | 结果 | 证据 |
|---|---|---|---|
| A1 | 单一 `develop` 入口，用户侧无第二工作流品牌 | 通过 | 重建包装后重装 `leo-dev-8c6c03cc`，安装副本 SKILL 与源码 v2 一致。空目录 `/private/tmp/leo-dev-a1-discovery` 上 `grok inspect`：`develop` 的 `source.type=plugin`，`plugin_name=leo-dev`。新会话 `854e3282-a697-4b85-98a5-92d626676550` 注入该路径并读了安装副本。未建 `.leo-dev`。Grok 插件市场浏览安装本轮不测。 |
| A2 | 只问不改不建账本 | 通过 | closeout 开工前：`observe grok-a9-workbench` + 读 `columns.ts` 后，`.leo-dev/changes` 仍只有 `grok-a9-workbench`。之后新建 `grok-a9-closeout` 是因为要改产品文件，不是问答。记录：`/tmp/a9-closeout/a2.txt`。 |
| A3 | 改代码走规格 → 计划 → 实现 → 独立审查 → 证据 | 通过 | closeout 规格/计划在 `.scratch/modern-harness/a9-closeout-spec.md` 与 `a9-closeout-plan.md`。实拍替换 `assets/leo-dev-board.png`、`assets/leo-dev-board-mobile.png`，改 README 说明。Gate typecheck。独立审查 pass。 |
| A4 | 开工后不必再批规格文件；目标变更才打断 | 通过 | 两轮都是 `start --goal` 后无 spec-approval 人签即 `spec-approved` → `executing` → `claim`。 |
| A5 | 阶段内不强制 TDD / worktree / 品牌 skill；跳过审查或自审被拒绝 | 通过 | closeout 未强制 TDD/worktree。自审 `agent-asserted` + 同一 session `grok-producer-closeout` → exit 5 `CONFLICT`（独立会话无法证明）。回执 `/tmp/a9-closeout/a5-self-review.json`。 |
| A6 | 审查失败继续修到通过或卡住；无 2+1 | 通过 | 独立审查 `grok-reviewer-closeout-1` reject 四列截图 → `REVIEW_REJECTED`，任务 `remediation`，`attempts.consumed=1`，`maximum=null`。修补后新 session `grok-reviewer-closeout-2` pass。未按次数封顶。 |
| A7 | 通过后可本地 commit；无用户要求则无 push | 通过 | `leo-dev commit` → `COMMITTED` `1fe8ede`，`pushed: false`。`main` 无 upstream。本轮未执行 `git push`。暂存仅 README + 两张 PNG。 |
| A8 | 三列工作台与 journal 一致；审查为徽章；只读 | 通过 | 实拍：待办/进行中/完成，奶油底，红头，刷新，无 Review 列。observe：`review-required` → doing/reviewing；`remediation` → doing/rejected；完成后 done/none。看板 HTTP GET-only。截图时任务已 re-claim 为 implementing，卡片上无「审查未过」徽章（徽章只在 remediation/blocked）；审查结果写在卡片 evidence 行。 |
| A9 | 在 Grok Build 上用完整循环交出该工作台 | 通过 | 规格 2.1.1 将第一期宿主改为 Grok Build。工作台代码在 `daf0e4a`，截图与 README 在 `1fe8ede` 用完整循环交出。本机插件新会话发现见 A1。 |
| A10 | 交付状态诚实 | 通过 | 两 change 均为 `integration-review` ≠ release-ready。规格 2.1.1 下 Codex 新会话与 Grok 插件市场为不测，未写成通过。 |

## 本轮未声称

- Codex 新会话（2.1.1 起不再是第一期门禁）
- Claude / Qoder / DeepSeek 即插即用
- Grok 插件市场浏览安装
- 官方小新授权
- 发版、push、W4 重跑

## 过程备注

- 默认 claim 租约 5 分钟不够审查；closeout 使用 `--ttl 3600000`。
- 截图用本机 Chrome headless，看板 `http://127.0.0.1:53489/`；Chrome 会拉 GoogleUpdater 导致进程不退，截图文件已写入后结束进程。未用 Playwright，未用 `agent-chrome-profile`。收尾 `ps` 无残留。
- README 正文里仍有一处英文 **Refresh**（命令说明），`docs/board.md` 已写 **刷新**。独立审查记为非阻塞。
