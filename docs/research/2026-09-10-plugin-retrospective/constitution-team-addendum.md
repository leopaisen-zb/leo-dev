# 补充复盘：宪法、Spec 收敛与团队流水线

日期：2026-09-10。性质：对用户质疑的源码核对及理解修正，不是生产架构批准、实施计划或完成声明；不修改既有规格、审批、代码和安装缓存。

## 为什么前一版不完整

用户要的是完整软件工程流程、统一入口、内部团队协作与对抗，以及长期可迭代的规范。前一版为避免继续扩张控制器，过度聚焦实现/审查/恢复，把“降低使用和编排负担”混同成“削减上游生命周期职责”。此前源码审计侧重 build-auto、执行状态和恢复，未充分覆盖宪法、完整 SDD 与团队协作，因而不足以支撑完整产品范式结论。

## 本轮新增源码依据

沿用 sources.json 的固定提交，均为官方单源静态观察，不是上游运行验收。

- Spec Kit `templates/commands/constitution.md:77–125`：宪法独立更新、版本/修订日期、治理程序和变更影响报告；不能把其他业务实现意图混进修宪。
- Spec Kit `templates/commands/analyze.md:54–60,135–151`：对 spec/plan/tasks 做矛盾、覆盖和宪法一致性检查；分析范围内不允许稀释宪法原则。
- Spec Kit `templates/plan-template.md:39–43`：设计前后检查宪法。
- Spec Kit `templates/commands/converge.md:59–88,145–160,196–215`：实现后以 spec/plan/tasks 为意图依据，补充 missing/partial/contradicts/unrequested 的可追溯任务；只追加 tasks，不改 spec/plan 来迎合实现。这是实现收敛，不等于 Spec 可以自行变更目标。
- cc-sdd `tools/cc-sdd/templates/agents/codex-skills/skills/kiro-steering/SKILL.md:28–75`：项目记忆 bootstrap/sync、漂移检查、保留用户内容。Steering 含模式/原则，但不等同有明确修订权与优先级的项目宪法。
- cc-sdd 同目录 `kiro-discovery/SKILL.md:167–201`、`kiro-spec-requirements/SKILL.md:59–64`、`kiro-spec-design/SKILL.md:108–110`：roadmap/brief → requirements → design 的边界连续性，包含依赖、职责及再验证触发因素。
- cc-sdd 同目录 `kiro-spec-batch/SKILL.md:56–113`：按依赖波次派发规格任务，跨 Spec 审接口、实体、重复职责与边界；重要问题修复后复审，分解问题回 discovery。源码中 auto-approve 和固定模型配置不能自动继承到 Leo Dev。
- BMAD `skills/bmad/references/help.md:100–140`：项目级完整规划路线、epic/story 实施、复盘及 significant-change 的 correct-course。
- BMAD `skills/bmad-party-mode/SKILL.md:41–50`、`customize.toml:40–47`：session/auto/subagent/agent-team 四种机制，默认 session 是一个上下文模拟角色；agent-team 在该版本说明中限定 Claude Code。
- BMAD `skills/bmad-party-mode/references/mode-subagent.md`、`mode-agent-team.md`：真实代理复用、分轮独立观点与反应、消息传递、团队状态维护。Party Mode 是可选讨论能力，不是其必经开发流水线或完成权。

Spec Kit constitution/converge 的公开 raw 页面读取成功；BMAD Party Mode 与 cc-sdd batch 的网页工具请求失败，结论依据已有固定提交的本地源码，不把失败网页作为已读证据。web-access 使用静态公开渠道，未启动会改配置/常驻 CDP 的检查脚本。两位 Terra/high 子代理分别补核 BMAD team 与 cc-sdd SDD；主线程核对宪法、产品缺口及关键接口。

## 修正后的目标理解

完整范式：项目宪法约束下，由角色化团队协作与证据化对抗推动 Spec 持续收敛，再通过可恢复的流水线完成实施、验证、整体验收和经验反馈。

应区分四种反馈，而不是统一叫“修改 Spec”或“重试”：

1. 宪法治理：长期原则/边界/变更程序。按明确决定修订，不能被工作代理为过门禁而自行降低；项目宪法不能越过平台权限或用户授权。
2. 规格收敛：需求、架构、接口、任务与测试设计相互校验。发现未决意图向用户求解，技术事实与方案缺陷回对应阶段。版本变化要识别受影响下游，不能只刷新哈希。
3. 实现收敛：实现/测试/独立审查的真实差距回到代码或补充任务；不把错误实现写回规格使之合法。
4. 团队学习：已验证事实可更新项目记忆；长期规范变更通过修订程序，不把每次临时绕过固化成惯例。

角色需要明确责任、输入工件、输出、写入范围、独立性、权限和验收边界：协调/裁决者、需求分析/产品、架构/领域专家、实施者、测试/评测者、独立对抗审查者。角色按阶段组合，不等于全部常驻并行，也不等于必须使用不同模型。实际宿主能力不足须明示，不能把模拟角色标为独立审查。

对抗机制以具体反例、调用路径、失败证据和约束冲突为输入；组织者裁决并保留未决分歧，不能用多数投票、强制共识或无限审查代替证据。团队讨论记录不是完成状态。

流水线不仅是执行测试命令：需能推进 discovery/spec/design/readiness/task execution/review/convergence/integration 各阶段，并保存阶段结果、派发依赖就绪工作、处理失败回退和中断恢复。语义审查由 Agent 执行，能形式化的条件由程序核验，只有一个完成账本。

Superpowers 可复用完整工程方法中的有效部分，但不应成为不可覆盖的总控或要求所有任务全量加载。判断“臃肿”应落在重复上下文、冗余阶段和僵硬操作上，而不是无证据断言整个项目不符合现代 Harness。

## 与当前实现的差距

当前有部分指导原则、评估准入、候选/证据绑定和 Lite 串行执行，但尚未形成独立宪法版本治理、跨 Spec 收敛/影响传播、完整阶段团队编排和通过实测的恢复闭环。C2 计划不可追加重路由，且 plan + governance assessment 不支持；因此不能直接执行上游 converge 追加任务并声称生产控制器已支持。

若进入实现，须先在现有规格中补齐这些缺失责任及验收边界，并明确适配上游资源；不能只修租约后宣布交付，也不能未经批准更换生产引擎或开第二套规格/账本。
