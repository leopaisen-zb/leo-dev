---
date: 2026-09-08
status: proposed-after-source-audit
authority: research recommendation only; no controller replacement or installation authorized
---

# 裁决建议：一个主流程，受控复用上游，而不是拼装多个总指挥

## 结论

建议优先验证 **cc-sdd 主流程的受控衍生与跨端封装 + 按需 BMAD 工程审查资源 + 项目验收/证据内核**。这是有依据的优先候选，尚未证明整合成本最低；P0 必须同时用固定 fixture 对照 Spec Kit custom-step 路线后再定版。它不是直接装齐所有上游，也不是继续把它们读一遍后全部自行重写。

这是研究后的架构建议，尚未实施，也没有重绑旧 spec 的批准记录。尤其“主流程由原先自写协调层转向上游受控衍生”属于需要明确接受的实质设计决定。

## 先纠正此前的判断

| 旧判断/隐含假设 | 本次纠正与证据 |
|---|---|
| 统一工具就要自研完整生命周期控制器 | 不成立。统一的是入口、规格权威、完成语义和升级渠道，内部可以直接调用/打包成熟资源。 |
| Superpowers 只有方法提示，没有大任务/持久化 | 当前 SDD 已有连续执行、分计划 ledger 和真实辅助脚本；但连续循环仍由宿主执行，breaker/Git 策略与你的要求冲突。[SP1–SP3](superpowers-speckit-openspec.md) |
| cc-sdd 有一个可以直接接入的后台执行器 | 当前 CLI 主要安装/渲染模板；kiro-impl 是有独立实现/审查/调试分支的宿主执行协议。它仍有直接复用价值，不能因不是 daemon 就丢弃。[cc-sdd 追踪](kiro-gsd.md) |
| BMAD 只是角色/生命周期理念 | 当前有具体的 spec、架构、review、customize 等资源；独立 bmad-loop 更有真正执行状态机。但 clean-tree、commit/merge、宿主适配有条件。[BMAD 追踪](bmad.md) |
| Spec Kit 只有规范生成 | 当前有 Python workflow engine、custom steps、overlay、持久状态和 resume；但普通暂停、嵌套恢复、突然退出语义不同，已通过探针区分。[SK1–SK4](superpowers-speckit-openspec.md) |
| OpenSpec 的图可以直接当任务调度/发布门禁 | 它主要是工件图；文件存在、checkbox 与实际测试/审查证据不是同一件事。[OS1–OS3](superpowers-speckit-openspec.md) |
| GSD 只有 Markdown 编排、ECC 只有技能集合 | GSD 当前 SDK 有真正的 phase/milestone runner，但 auto/session 路径绑定 Claude SDK；ECC2 有真实进程/session supervisor，但会话退出/重跑不等于任务验收/续跑。[GSD](kiro-gsd.md)、[ECC](ecc.md) |
| 测试数多意味着整个插件交付了 | 现有 controller route 仍只生成一项 Lite task、无依赖、通用 acceptance；局部测试不能替代自主三任务与三端加载。[本地 route](../../../packages/cli/src/controller/controller.ts) |

原始文章中“规范可解析就不存在理解偏差”“生成类型完全消灭契约腐化”“SLA 异常就自动加 Retry”也不能成为验收承诺。结构校验不证明业务正确；运行时验证、兼容性、事务/幂等和副作用策略仍需明确。对于训练/Agent，结果还有随机性与评测误差。目标是可观测、可拒绝、可恢复的交付流程，而非保证 AI 推理确定或零技术债。

## 目标职责图（不是当前已实现架构）

```text
用户 / Claude Code / Cursor Agent / Codex
                  │ 同一个 develop 入口
                  ▼
          已批准规格引用 + 项目上下文
                  │
                  ▼
       唯一流程入口（P0 对照后选定实现）
       首选试片：cc-sdd 受控执行资源
     需求/设计/任务 → 单任务实现 → 独立审查
          ▲                         │
          └── 有界调试/调整 ← 实际门禁结果
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   领域验收与证据内核       按需专家资源
   当前树测试/审批/恢复     BMAD 架构/审查视角
   状态与未知副作用        选定 TDD/debug/eval 材料
        │
        ▼
 集成验收 + 架构/契约复查 + 如实交付
```

宿主 Agent 负责执行与子代理能力，内核不冒充沙箱；独立 CI/平台权限才承担相应强制边界。

## “结合上游”必须变成可检查的交付物

### 1. 主要复用 cc-sdd 的具体流程资源

候选资源不是只写“参考 cc-sdd”，但分两层，避免一开始引入第二个规格生命周期：

- **已有批准规格的默认试片：**仅选 kiro-impl、implementer/reviewer/debugger 及实际读取的最小 shared rules；完成核验资源按依赖追踪纳入。不运行 spec generator，不创建 `.kiro/specs` 或第二 approval state。
- **没有批准规格的新项目，另行评估：**kiro-spec-requirements、kiro-spec-design 的 discovery/synthesis/design-review、kiro-spec-tasks 的 task-graph sanity review；输出必须映射到项目 canonical spec/task 位置。kiro-steering 与 Implementation Notes 同样只能更新既有知识位置，不另起状态权威。

**集成形式建议：**锁定上游 SHA，构建时从同一快照选取必要资源，保留原文来源与 MIT notice，应用显式 patch，再生成三个客户端薄包。资源仅由 develop 入口按需读取；不同时注册整套上游公共命令。每项复制/修改记录 upstream path、提交 SHA、源文件 hash、patch 和生成产物 hash，并加入 upstream-update diff 与禁止第二 spec authority 的契约测试。不要在运行时从 main 拉最新文本。

下列七类是候选适配边界，**尚未证明 patch 很小**；必须先记录 canonical source、共享依赖、每端生成产物和逐类语义差异，再决定是否采用：

1. 输入路径不强制独立 .kiro/specs；读已有 specRef 和原有批准，禁止重访谈、自动改 approvals=true。
2. 把每任务自动 Git commit 改成当前树证据 checkpoint；提交/推送仍单独授权。
3. 任务 complete 必须绑定当前测试与要求的审查证据，不能只改 checkbox。
4. 按用户策略统一修复预算；不得由不同 Skill 分别累计隐形重试、越限 park 高风险债务、放宽测试。
5. fresh reviewer 不可被静默降为同上下文后仍称独立；缺能力时明确记录未验证/阻塞。
6. 主动调整实现细节；涉及职责/公共契约/共享数据所有权变化时返回批准边界。
7. feature flag 与模型建议按项目/宿主能力处理，不强制对每次行为修改添加临时开关，不改变用户全局模型配置。

### 状态单写者裁决（拟议接口，不是已实现）

此处 controller 指持久完成裁决的职责，不预设必须保留当前类或全部实现；P0 允许替换实现，但不能同时留下两个可写的任务完成权威。

- **controller 独占 durable task transitions**：ready/claimed/attempt/blocked/accepted 与修复计数、审批和证据。cc-sdd 资源负责提出/执行下一步，不直接改这些状态。
- **任务定义只有一份批准计划**：保持原需求 ID、specRef、边界和验收引用。runtime 中的定义是绑定该版本/hash的派生投影，不是第二份可以人工修改的计划。
- **checkbox 不是完成权威**：原 kiro-impl 的直接勾选、以勾选挑下一项、以 commit 恢复均需替换为 controller 的 next/submit/status。需要显示 checkbox 时只能由状态投影生成，不接受反向写入。
- **claim 覆盖实际实施派发**，不只是末尾测试；独立 reviewer 返回候选 verdict，controller 检查所需来源与新鲜证据后才能接受。局部文件标签不能认证真实人或会话身份，宿主能力缺口照实报告。
- **输入与候选分开绑定**：claim 固定 `inputTreeHash` 和允许写集；实施后登记 `candidate/outputTreeHash`。门禁和审查绑定候选，不要求输出等于输入。审查 `fail` 是持久有效结果，进入有预算的 remediation，不是过期收据错误。
- **依赖与完成由全计划计算**：只有任务 accepted 才解锁下游；全部任务验收才进入 integration-review。不能沿用单任务 Lite 的硬编码。
- **代码已改但状态未写时**：先核对当前树/原attempt/输出证据；已确认副作用与结果只能补记一次，未知外部效果不能自动重派。无跨进程 lease 的上游入口必须受同一外层互斥保护。

因此“唯一流程负责人”指一个 Agent 层的协调入口，不是允许 cc-sdd 与 controller 同时裁决持久完成状态。这是实质适配工作，不应继续描述成仅换几个路径。

这已经是**受控衍生版**，不能宣传为“原版 cc-sdd 已验证直接集成”。同样，若 patch 扩散到重写大部分主流程，应停止并重新选型，不能继续挂上游名义。

### 2. BMAD 提供按需工程深度，不再拥有第二套主流程

选择架构约束、风险/NFR、需求覆盖、审查 lens 等具体资产作为输入或专家任务；有适用正式 customization 接口时优先使用，否则按锁定资源加有限适配。

P0 至少验证一个具体接口：受控复用 `bmad-code-review` 的 [diff/spec 上下文收集](https://github.com/bmad-code-org/BMAD-METHOD/blob/abe4eb1bce919c9d22cd18b3519353d5824c4b75/skills/bmad-code-review/steps/step-01-gather-context.md) 与 [逐条核实/归类](https://github.com/bmad-code-org/BMAD-METHOD/blob/abe4eb1bce919c9d22cd18b3519353d5824c4b75/skills/bmad-code-review/steps/step-03-triage.md) 接缝。以下是**拟议 adapter 契约，不是上游原生 schema，也未实现**：

- 输入：固定 spec/task/candidate revision、实际 diff/file list、相关 ADR/API/schema/migration 边界；无 HEAD 或有 untracked 文件时必须覆盖真实改动，不能只取空的 Git diff。
- 输出：每项 finding 的 severity、path/line（适用时）、evidence、verdict、`needs-authorization`，以及缺失的 review layer；绑定同一个 task attempt，不另建 BMAD task/approval。
- 触发：Standard/Full，或公共契约、数据所有权、依赖、迁移变化必须进入相应工程审查；Lite 按风险选择。相关高风险旧债不得靠标记 defer 就通过当前验收，需明确阻塞或授权决定。
- 独立性：真实 distinct session/human/platform-attested 来源如实记录；缺能力标 blocked/not-run，不将角色扮演写成独立审查。
- 适配成本：上游 `_bmad` resolver/config、人工 checkpoint、triage/defer 策略都须逐项记录；本插件拟保留真正决策/授权停点，不继承每个阶段的机械确认。无法有限适配时退为选定 review prompts，不再称接入完整 BMAD review 流程。

不把完整 bmad-spec（以 .memlog.md 为 canonical、SPEC.md 为 derived 的单写者制度）与既有规格权威并行运行；不同时引入 bmad-build-auto 或 bmad-loop 接管执行。已有原生 BMAD 项目则可以反过来以其规格为权威，develop 只引用。

默认路径没有第二轮需求访谈、第二套 approval 或第二个 runtime。BMAD 完整流程是否优于 cc-sdd 仍可做后续小试验，不以主观“更工程化”直接决定。

### 3. Superpowers / ECC 为可选资源，不构成依赖套娃

- Superpowers 保留有价值的 TDD/根因调试/验证资源；如果 cc-sdd 对应协议已覆盖且验证不差，不同时强制再跑一轮。不要启用两个 subagent-driven-development 总指挥。
- ECC 的具体运行时/领域资产需按 [ECC 审计](ecc.md) 选择；不因它现在有控制面就整包接管会话、记忆、hooks 或全局设置。
- 全栈、训练、Agent 的资源按项目配置选中；可选资源缺失要准确报告，不自动安装新服务。

### 4. 现有 leo-dev 代码：冻结扩建，逐项保留而非推倒

**候选保留并重新验证：**已有文件/规格引用、脏树基线、gate argv/环境策略、当前树证据、审查/授权收据、journal/projection 与诊断能力。已有恢复证据仅覆盖 controller/gate 内部指定故障窗口，未验证实现阶段与真实客户端任务恢复。不是因为已经写了就全部保留：以 P0 接缝证明不可替代职责，能安全复用成熟实现的部分可以退役，但不在本研究中删除。G1 assessment 只检查传入的判断与证据，不是自动发现债务；继续如实标注。

**停止扩大：**通用 workflow DSL、再造所有上游角色、没有真实任务驱动的抽象状态层、提前增加并行/headless 调度与更多 receipt 类型。

**已查实的接线缺口：**当前 claim 将树绑定到 `inputTreeHash`，run-gates/submit/review 要求它不变；真实实施后的修改会被拒绝。review 只接受 pass，且把唯一 Lite task 完成后直接置 integration-review。见 [独立适配性审查](independent-fit-review.md) 和 [controller 源码](../../../packages/cli/src/controller/controller.ts)。因此下一步不只是加 tasks 数量，而须先验证 input→candidate handoff、失败审查→有限修复、全计划依赖解锁，再提供串行 next/resume。不能先改代码再 claim 冒充覆盖实施恢复，也不能把每项 task 各开一个无关联 change 冒充大任务。

P2 建立 keep/use/retire 候选表：只有被公共 develop 入口真实消费、且通过故障测试的 primitive 才进入稳定内核；未消费分支冻结。若现有抽象不合适，允许另行提出缩减/替换，不为沉没成本继续扩建；实际删除仍须在后续批准范围内。

原始代码与旧证据完整保留。本轮 12 个核心冻结文件 hash 仍匹配；这不是全仓文件未变化的证明，研究目录本身有新增。

## 单一事实源与输入输出

| 输入/输出 | 唯一权威与写入规则 |
|---|---|
| 用户需求/批准规格 | 原有 spec 文件/issueRef；引用源内容与 hash，不生成平行 requirements 真源 |
| 架构与关键契约 | 项目已有 ADR/设计/契约位置；新提议与已批准内容区分，变更触发影响分析 |
| 可执行 tasks | 一份人可审阅任务计划；每项有来源需求、依赖、边界、交付物、验收命令引用 |
| runtime 状态 | 从已批准 tasks 生成的只读定义投影 + 执行事件；不能允许模型同时手改两份状态 |
| 实现产物 | 实际代码/迁移/配置/训练与评测产物，由分配路径的执行者改动 |
| 完成证据 | 当前 tree/spec/task revision 的命令结果、独立 review、未运行项与风险；不是 commit 或 checkbox |
| 演进知识 | 已证实的项目经验写 Implementation Notes/现有项目知识；架构变化走 ADR/审批，失败猜测不能自动变成永久规范 |

所谓 Kiro 式自我迭代应该是 **失败证据 → 修复或设计变更提案 → 重验 → 更新可信项目知识**，不是让 Agent 每次绕过失败后把规范改成能过的版本。

## 自主能力分层，避免两次误交付

- **A1 会话内连续执行：**批准后宿主 Agent 自动推进整个任务序列，只在真实授权/决策/阻塞处停，不逐项询问“继续吗”。
- **A2 跨会话恢复：**新会话读持久记录，核对树/规格/剩余任务/未知副作用，再继续；不能仅凭上一条 completion 自述。
- **A3 无人在线后台持续调度：**独立 daemon/headless runner、费用/会话/进程管理。这是额外产品范围，不能让它阻挡 A1+A2 先交付，也不能将 A1+A2 宣传成 A3。

本需求明确需要先做到 A1+A2。A3 是否需要，应在实际使用暴露必要性后决定。Spec Kit、BMAD Loop、GSD/ECC 执行层保留为有证据的候选，而不是永久排除。

## 按领域验收，不承诺“一个测试框架包治所有项目”

| 项目 | 必须按相关性配置的证据 |
|---|---|
| 全栈 | 类型/单测/构建，接口契约与兼容性，迁移/事务/并发，真实浏览器关键流；UI 通过不替代后端验证 |
| 算法训练 | 固定数据划分与基线、数据/配置/代码版本、随机性范围、指标阈值、断点续训与资源预算；微型 smoke 通过不等于正式训练有效 |
| Agent/LLM | eval-first 数据集与单 Agent 基线、工具契约/检索/权限、trace、失败样本、成本延迟、逐项消融；开发期子代理不等于产品多 Agent |

这些是拟议 profile 的验收契约，本轮未实现、更未在真实项目验证。具体框架命令放项目内，不向全局 AGENTS.md 堆积规则。

## 可验收的下一阶段，不再先堆基础设施

| 关卡 | 实际交付 | 必须阻止的伪完成 |
|---|---|---|
| P0 复用契约与对照 | 先定 candidate handoff/review-fail/依赖解锁契约；临时试片落盘最小资源及 provenance manifest，用同一无模型 fixture 比较 cc-sdd 与 Spec Kit custom-step 对接成本，验证一个 BMAD review 接口；胜出后才进入产品源 | 只有“借鉴”二字；先锁架构再做对照；悄悄重绑旧 approval |
| P1 三端最小包 | 同一 develop 入口、同一源 hash、按需加载；Claude/Cursor/Codex 分别真实发现与调用 | 三份 manifest 静态合法就叫三端可用 |
| P2 自主三任务切片 | 同一 A→B→C 在三端分别真实执行；B 测试/审查失败后有限修复，accepted 才解锁 C；实现写入后中断、新会话核对恢复；脏文件和 Git index/log 不变 | 仍只有单任务 Lite；没有实现改动；拿打包代替自主执行；同上下文扮演独立 reviewer |
| P3 真实项目试用 | 一个真实全栈变更完整交付，并检查架构/契约差异；基于实际失败收缩 patch | 用插件自身单测代替实际开发体验 |
| P4 扩展域和发布 | 小型训练/Agent fixture验证后分别真实项目试用；安装卸载只碰owned files；GitHub按批准权限发布 | 声称三个领域全覆盖；没有remote就说已能从自己的GitHub装 |

P1/P2 是同一 walking skeleton 的两面，不能等整个复杂 controller 做完才加载客户端。P0→P2 完成前不新增并行执行、总控 UI、自动学习全局规则或后台守护进程。

先在一个 reference host 做完整 RED/GREEN，再在另外两端跑同一 fixture；某端能力不足就标该端 blocked，不以另两端通过替代。必须包括“实现已写入、候选尚未登记”的中断窗口，并区分未开始、候选待验收和未知结果，先核对再决定是否可重派。P2 仅证明 A1+A2 最小软件切片，不代表 P3 真实全栈或 P4 训练/Agent 完成。

P0 的固定对照边界：A→B→C、B 两轮修复后按预算调试/阻塞、dirty tree、双 resume、已完成结果补记、未知副作用拒绝重放、规格 hash 变化后旧证据失效。用 stub worker 驱动，不做付费模型调用。两候选都必须通过相同不变量；stub 通过仍不能替代 P1/P2 的真实宿主验证。比较记录必须列出新依赖/模块/状态映射、七类 patch 的实际范围、上游升级冲突和每端适配差异；不以总行数或测试数量直接打分。硬性淘汰条件是第二个可写完成权威、需要默认放宽权限、隐式 Git 写、真实独立 review 无法保留，或为适配必须再造通用 workflow DSL。若两路都不过，缩到可复用的 reviewer/debugger 资源并公开缺口，不扩写第三套大框架。

BMAD Loop 作为有真实引擎的基线：当前 clean/commit 条件证明的是原样采用不合格，不证明 cc-sdd 总成本更低。若不能通过有限 adapter 满足硬约束则记录淘汰原因，不为了加入对照修改其核心安全/恢复语义。

## 反方与明确不确定性

1. **为什么不直接用 BMAD + bmad-loop？**它是有状态机的强候选，不是“没人做”。但现在的无自动 Git/脏树/三端约束，不能仅靠改一项配置达成；见反方复核。[BMAD 接缝](bmad.md)
2. **为什么不让 Spec Kit 做 engine 再接 Gate？**技术上可行，custom step 只会局部化重放责任，并不天然幂等；仍需 owner-state/lease/未知效果协议、受审 Python step 加载与 headless adapter 审计。P0 就用同一 fixture 对照，不等 P2 已投入很多才比较。
3. **cc-sdd 也要修改，岂非换名自研？**因此必须保留源文件、可审阅 patch 和回归契约，按上游升级跑同一测试。若核心流程差异越来越多，受控衍生选型就失败了。
4. **不装全套真的能用到 BMAD？**只有交付了具体资源调用/构建导入证据才算，概念参考不能再写“已集成”。本轮没有完成导入。
5. **能保证无技术债吗？**不能。只能把相关高风险问题、配置的架构/契约规则、当前测试/审查与未验证部分变成显式门禁。语义判断和评测覆盖仍会错。
6. **样本是否等于当前稳定发行版？**不是。包含 BMAD next、Spec Kit dev、GSD canary。研究固定了默认分支快照；生产采用前还须选择稳定发行版并复跑关键机制，不能直接把研究 SHA 自动装给用户。
