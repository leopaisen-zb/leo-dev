# Leo Dev v2 — 跨宿主编程插件规格

Status: approved  
Version: 2.1.1  
Date: 2026-09-21  
Source: 2.1.0 于 2026-09-20 访谈批准；2026-09-21 用户指定「先用 Grok 代替 Codex」，随后确认「再改规格正文」。本修订只改第一期运行/验收宿主与 A9 表述。2.1.0 其余设计决定不变。  
Implementation plans: `docs/superpowers/plans/2026-09-20-v2-develop-loop.md`, `docs/superpowers/plans/2026-09-20-v2-workbench-board.md`  
Historical authority: 0.2.0 与 `.scratch/unified-development-plugin/spec.md` v1.11.1 仍是其原范围的证据。本文件不重绑那些批准指纹，也不把 W1–W4 结果当成 v2 已完成。第一期执行结果在 `.scratch/modern-harness/acceptance.md`，不在本文件复写成发版。

目录名 `modern-harness` 是历史路径，产品不是自研 Harness。

## Problem Statement

Leo 写代码时不想挑选 BMAD、Spec Kit、cc-sdd、OpenSpec、Superpowers。要一个入口 `develop`，把那些做法里有用的部分吸收进自己的流程，用户侧不再出现这些品牌名。

0.2.0 在 Codex 上交付了入口和证据账本，但日常仍像在完成一本厚作业：Skill 强制读长文、点名上游方法、无条件走 TDD skill。看板是四列只读投影，和「待办 / 进行中 / 完成」的工作台不是同一件事。`examples/mochi-board` 是被开发的示例应用，不是插件工作台。

需要保留的是：完成必须绑当前树、独立审查、失败如实记。需要去掉的是：用强制 skill、worktree、提交仪式去剪裁模型怎么写代码。

## Solution

leo-dev 仍是装进现有编程宿主的插件。会话、工具、模型选择、权限、沙箱属于宿主。插件提供：唯一入口 `develop`、本地生命周期账本、以及接账本的三列工作台。

实现者和审查者分开。插件通过宿主现成的子代理（例如 Codex thread/agent、Claude Task）拉起，用户不必手开审查窗口。插件不自建会话调度，不替代宿主的模型路由和沙箱。

阶段固定：规格 → 计划 → 实现 → 独立审查 → 完成证据。阶段内模型自己选实现和调试做法。不强制 TDD、worktree、品牌 skill。硬门禁仍是程序：产物在、证据绑当前树、审查独立、不能把未跑写成通过。

第一期验收不是再打 W4 分，也不是四宿主同时过关。第一期在 Grok Build 上，用这套循环把插件自己的三列工作台做出来。Codex 仍是设计名单上的宿主，不是本轮完成门禁。

## Out of Scope

- 自研 Harness；替代宿主的模型路由、权限、沙箱。
- 把 0.2.0 / W4 重新解释成 v2 已完成。
- 本规格批准不等于授权改代码。实现计划在规格批准之后另写。
- 官方蜡笔小新角色授权。小新素材是同人，排除在 MIT 之外。
- 自动 push / PR / merge / 部署 / 扩权 / 付费开通。
- 共享 checkout 并行任务、后台 daemon、托管看板服务。
- 用 C 重写；Linux 是纪律参照，不是部署目标。
- 整包嵌入上游 workflow 引擎；用户侧暴露 BMAD / Spec Kit / cc-sdd / OpenSpec / Superpowers 品牌入口。
- 不把下列事项当作第一期完成条件：Claude Code、Qoder、DeepSeek Harness、Cursor 的新会话闭环；Codex 新会话；Grok 插件市场浏览安装。Grok Build 本机插件的新会话发现属于第一期。
- 把 `examples/mochi-board` 改造成工作台。它仍是示例应用。
- 看板上改任务、拖拽改状态、开停代理。

## User Stories

1. 作为使用者，我只记一个 `develop`，不必挑选工作流插件。
2. 作为使用者，我看不到 BMAD 等品牌名；有用的做法已经写进 `develop`。
3. 作为使用者，只问不改时直接得到回答，不进入账本。
4. 作为使用者，一开始就要改代码时，走完整循环。
5. 作为使用者，目标和范围在对话里对齐并说「开工」之后，不必再批规格才能改代码。
6. 作为开发者，阶段内我自己选怎么实现和调试，不被指定 skill / worktree / TDD 绑死。
7. 作为审查者，实现者和审查者不是同一会话；自审不算独立审查。
8. 作为使用者，审查不过就继续修，直到通过，或因环境/目标不清卡住再问我。
9. 作为使用者，通过后可以本地 commit；没有我说，不能 push。
10. 作为使用者，打开工作台就能看见待办 / 进行中 / 完成，审查是徽章，内容和账本一致。
11. 作为使用者，失败、未跑、阻塞必须如实显示，不能用旧的通过记录冒充当前状态。
12. 作为维护者，第一期是否做成，看 Grok Build 上这张工作台是不是用完整循环交出来的。

## Implementation Decisions

### 产品边界

- 宿主 = 编程 Harness / Agent 产品。第一期运行和验收宿主是 Grok Build（2.1.1 修订；2.1.0 原写 Codex）。
- 插件 = Leo Dev。负责 `develop`、方法（无品牌名）、控制器命令、journal、三列工作台。
- 适配器只映射：包装格式、入口拼写、如何发现 Node CLI、如何用该宿主的子代理、如何记录宿主 session。
- 目标宿主（设计名单，不是第一期完成门禁）：Codex、Claude Code、Qoder、Grok Build。DeepSeek Harness（`deepseek-ai/deepseek-harness`）预留适配器形状，实现后做。Cursor 不列入本轮名单。

### 入口与真源

- 用户只面对 `develop`（写法随宿主）。
- 完成权威只有控制器 journal 与当前树。
- 上游框架只做机制来源，蒸馏进 `develop` 的阶段、产物和门禁。包内不得再要求用户或模型「去跑 BMAD / Spec Kit / …」。
- Superpowers 若仍出现在本仓库的开发过程里，那是开发 leo-dev 自己用的外置过程，不是产品运行时的一部分。产品 Skill 不得强制调用它。

### 何时进账本

- 不进账本：纯问答、只读解释、只读查代码。
- 进完整循环：任何产品代码或行为改动，包括「很小」的修改。
- 不再提供「微小明确编辑走轻量、不建规格」的旁路。这是相对 0.2.0 Skill 的故意收紧。

### 开工与自主

- 「开工」批准的是这次已经对齐的目标（做什么、不做什么），不是一份你已经逐字批过的规格文件。
- 开工之后，插件写入规格和计划，拉实现子代理，拉独立审查子代理，在卡住之前连续推进。
- 必须停下来问人的情况：目标变了；需求不清；测试环境不可用；权限/沙箱不够；准备 push / 部署 / 扩权。
- 审查失败不是停问条件。换独立审查会话继续修，直到通过或卡住。
- 不设 2+1 次数上限。这是相对 0.2.0 的故意放宽。循环必须能被「卡住」打断。同一条审查意见在一次修补后仍原样出现、且没有新的针对证据，记为卡住并问人；不是靠报数停，是靠「没有新进展」停。每次修补仍要新的独立审查，不能沿用旧审查或自审。

### 硬门禁（程序强制）

- 候选绑定当前树；过期证据失效。
- 改代码的任务：必须有规格产物、计划产物、测试/验收证据、独立审查通过记录。
- 独立审查：不同宿主会话/子代理，或 `human-confirmed`。`agent-asserted` 自审不够。
- 预存在脏文件保留归属。
- 交付状态只能是：通过、失败、未执行、阻塞、不适用。
- 不自动 push / PR / 部署 / 扩权。
- `integration-review` 不等于 release-ready。
- 独立审查通过且证据绑当前树之后，插件可以本地 `git commit`。没有用户明确要求，不准 push。

### 不限制模型（阶段内）

允许：选算法与实现顺序；用不用 TDD；用不用 worktree；不使用任何品牌 skill 名。

禁止：改测试过门；自审当独立审查；未跑写成通过；跳过适用的规格/计划/审查产物；跳过适用验收。

0.2.0 Skill 下列行为视为限制，v2 取消：

- 开工前必须读完 lifecycle / components / gates / acceptance / review-protocol / upstream-methods 全文。
- 有行为改动则无条件走 Superpowers TDD skill。
- 把「包内存在上游 Markdown」当成该方法已被使用。
- 用户或模型必须挑选或点名上游品牌才能开工。

### 蒸馏进 develop 的能力（无品牌名）

写进阶段和门禁，不写进用户可见品牌：

- 风险无关：改代码就走完整循环；只问不改才跳过。
- 规格与计划先于实现产物存在；已有合格规格则复用，不无故重开访谈。
- 任务可串行、可恢复；中断后从账本继续。
- 实现者与审查者分开，审查输入绑定当前候选。
- 完成前核对需求与当前树，遗漏不得改规格来就代码。

「用上」的判定：实际写入的产物 + 对当前候选的行为证据。打包或仓库里有上游原文不算。

### 工作台看板

- 三列：待办、进行中、完成。
- 审查不是第四列，是进行中卡片上的徽章（审查中 / 审查未过）。
- 列映射：`pending|ready` → 待办；`done` → 完成；其余进行中（含 leased、实现中、审查、blocked）。
- 只读投影，数据来自现有 `observe` / journal。刷新读取新观察。不在看板上改任务、不启动代理、不写 journal。
- 刷新失败必须显示陈旧或不可用，不得把旧的通过记录画成当前绿灯。
- 视觉：蜡笔小新同人风。`assets/shinchan-logo.png` 及后续同人图排除在 MIT 之外；README 必须说明角色权利仍归原权利人。
- `examples/mochi-board` 保持示例应用，不接这张工作台的完成定义。
- 现有四列（Queued / Active / Review / Done）在第一期工作台中废止。

### 现有 CLI：keep / change

**硬门禁命令保留：** `init` `inspect` `status` `route` `transition` `claim` `run-gates` `submit` `review` `approve` `resume` `reconcile` `doctor`

**工作台：** `observe` `board` 只读。`board` 的列投影改为三列。

**保留但非每任务强制：** `revise` `team` `waive` `resolve`

**行为变更：** 取消代码改动的 Lite 旁路；取消 2+1 修补上限；允许本地 commit（新命令或现有交付路径上的显式步骤，不得暗含 push）。

### 宿主适配

| 宿主 | 第一期 | 之后 |
|---|---|---|
| Grok Build | 运行 + 验收 | 不回退本轮已证明的本机插件发现与循环 |
| Codex | 不挡验收 | 包装解析到同一 CLI；用该宿主子代理跑同一循环 |
| Claude Code | 不挡验收 | 包装解析到同一 CLI；用该宿主子代理跑同一循环 |
| Qoder | 不挡验收 | 按其当时插件/Skill 契约适配 |
| DeepSeek Harness | 不挡验收 | 只要求适配器形状可接当前扩展接口 |
| Cursor | 不做 | 除非另改规格 |

## Testing Decisions

- 主缝：CLI JSON / 退出码；看板观察与 journal 一致。
- 第一期验收：在 Grok Build 上，从已安装插件发现 `develop`（新会话；skill 文件存在不算），从对齐目标 + 开工，把三列工作台交到可打开、列与账本一致、独立审查通过、证据绑当前树。本机 `grok plugin install` 后的新会话发现算；Grok 插件市场浏览安装本轮不测。
- 对照：问答不建账本；改代码不走轻量旁路；自审不能批准；过期证据不能通过；看板刷新失败不能显示为完成。
- 不重打 W4 分，不改其冻结 oracle。W4 不是第一期门禁。
- Codex / Claude / Qoder / DeepSeek 的新会话闭环本规格不测。测了只能记「额外观察」，不能拿来代替 Grok 工作台验收。

### 验收表

第一期结果如下。证据在 `.scratch/modern-harness/acceptance.md`。两笔账本均为 `integration-review`，不等于 release-ready。Grok 插件市场浏览安装、Codex / Claude / Qoder / DeepSeek 新会话本轮不测。

| ID | 条款 | 第一期 |
|---|---|---|
| A1 | 单一 `develop` 入口，用户侧无第二工作流品牌 | 通过 |
| A2 | 只问不改不建账本 | 通过 |
| A3 | 改代码走规格 → 计划 → 实现 → 独立审查 → 证据 | 通过 |
| A4 | 开工后不必再批规格文件；目标变更才打断 | 通过 |
| A5 | 阶段内不强制 TDD / worktree / 品牌 skill；跳过审查或自审被拒绝 | 通过 |
| A6 | 审查失败继续独立审查直到通过或卡住；无 2+1 上限 | 通过 |
| A7 | 通过后可本地 commit；无用户要求则无 push | 通过 |
| A8 | 三列工作台与 journal 一致；审查为徽章；只读 | 通过 |
| A9 | 在 Grok Build 上用完整循环交出该工作台 | 通过 |
| A10 | 交付状态诚实（含未执行、陈旧、不可用） | 通过 |

## 与旧稿和已暂停工作的关系

- 本文件 2.1.0 取代 2.0.1-draft。旧稿把四宿主即插即用当完成门禁，2.1.0 否决。2.1.1 只把第一期宿主从 Codex 改为 Grok Build。
- 小新三列看板从「另记、非一期」改为第一期验收产品（插件工作台）。
- W4 合同可追溯等质量切片：不是第一期门禁；需要时另开评测协议。
- 实现计划在本规格批准前不写。实现时拆成可独立验收的切片，至少包括：循环/Skill/门禁行为变更，以及工作台本身。

## Further Notes

- 非规范对照：`.scratch/unified-development-plugin/spec.md`、`docs/board.md`、`docs/platform-capabilities.md`、`verification/quality-first-benchmark-20260916/REPORT.md`。
- 开发本仓库时仍可走外置 Superpowers；那不使它成为产品运行时。
