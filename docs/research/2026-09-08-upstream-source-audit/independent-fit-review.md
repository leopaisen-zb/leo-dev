---
date: 2026-09-08
status: independent-review-complete
scope: decision.md fit review against README commitments
authority: review findings only; no implementation authorization
---

# 独立适配性评审：裁决方向可试，但主流程选型尚未被证据定胜负

## 总体裁决

`decision.md` 已正确守住了一个 `develop` 入口、单一规格权威、无自动 Git/权限副作用、分领域验收和“不把会话恢复当任务恢复”等边界，也明确把当前内容标为研究建议而非已交付架构。这比再次罗列上游理念前进了一步。

但当前证据只足以支持：

> **以 cc-sdd 的可移植执行/审查协议作为首个低耦合候选，和当前 gate/evidence 内核做受控试片。**

尚不足以支持 `decision.md` 第 11、38 行已经画定的“cc-sdd 衍生主流程（唯一流程负责人）”。cc-sdd 没有可执行调度/恢复引擎，本地未运行其测试，三端真实执行也未验证；相反，BMAD Loop 和 Spec Kit 有实际引擎与局部本地恢复证据。它们与脏树、自动 Git、权限和双状态源的冲突是有力反证，却不自动证明 cc-sdd 的总适配成本更低。

**独立结论：**

- 对“立即锁定 cc-sdd 为主流程”：**NO-GO，降为待反证假设。**
- 对“冻结 controller 扩建、做 P0–P2 walking skeleton”：**有条件 GO**，但必须补上本文所列 implementation-candidate 边界、review-failure 路径和同一 fixture 的三端 E2E。
- 对“用户完整目标已被回应”：**设计覆盖，交付未覆盖。** P0–P2 最多证明核心切片；真实全栈项目、训练与 Agent 项目仍分别需要后续验收。

证据等级沿用研究 README：上游仓库事实为 Single-source/source-traced，本地命令为 locally-reproduced；真实 Claude/Cursor/Codex E2E 均未运行。

## Findings

### Important 1 — 当前 controller 的 tree binding 不能直接承载真实“实现后验收”，P2 不是只补 tasks 依赖即可

`decision.md` 第 99 行把下一步概括为“把批准 tasks 的明确依赖与 acceptance 投影接入当前单任务执行边界”。这低估了真实缺口。

当前 `claim()` 在 Task 进入 `implementing` 时记录当前 `inputTreeHash`（[controller.ts L1079-L1117](../../../packages/cli/src/controller/controller.ts)）；随后 `run-gates` 要求当前树仍等于该 input hash（同文件 L1240-L1249），`submit` 又把 candidate tree 认定为同一个 input hash，并拒绝任何漂移（同文件 L902-L923）。因此：

- 如果 implementer 在 claim 后真的改代码，Gate preflight 会把它当 stale tree 拒绝。
- 如果先改代码、再 claim，controller 的 `implementing` run 实际只覆盖验证过程，无法记录实现阶段中断、写集或未知副作用。
- 当前“真实 Lite vertical slice”测试从 claim 直接运行 gate，没有任何实现写入；review 使用 `agent-asserted`、未认证的 self-review（[vertical-slice.test.ts L227-L258](../../../tests/cli/vertical-slice.test.ts)）。它不是自主开发切片。

review failure 也未接线：`assertReviewCandidate()` 只有 `verdict === 'pass'` 才接受，否则作为 stale/conflict 拒绝（[controller.ts L887-L899](../../../packages/cli/src/controller/controller.ts)）；`review()` 之后直接把唯一 Task 置 done、Change 置 integration-review，并把 risk 硬编码为 Lite（同文件 L1340-L1366）。这不能实现 P2 要求的“B 审查失败→有限修复→重审→才解锁 C”。

**必须动作：**P2 前先确定并实现一个明确的 candidate seam：

1. claim 绑定 `inputTreeHash` 与允许写集；implementer 完成后提交 `candidate/outputTreeHash`，从 implementing 进入 verifying。
2. GateRunner 对 output candidate 运行并把 evidence 绑定到该 output hash；不得要求 output 等于 input。
3. review `fail` 必须作为有效、持久的结果进入 remediation，消耗统一 budget；不是 schema conflict。
4. 只有当前 Task `done` 才解锁依赖项；是否进入 integration-review 必须从整个任务计划计算，不能硬编码 `allTasksDone: true`。
5. 中断恢复必须区分“尚未开始”“已产生候选但未验收”“结果未知”，不能仅恢复 controller 元数据。

没有这条 seam，cc-sdd implementer/reviewer 文本与 controller 是两条脱节流程，P2 即使多出三个 Task 也不可用。

### Important 2 — cc-sdd 胜出目前是适配成本假设，不是证据优胜

锁定样本给出的证据强弱是：

| 候选 | 已证实能力 | 关键不适配 | 目前能推出什么 |
|---|---|---|---|
| cc-sdd | `kiro-impl` 明文规定逐任务 implementer→fresh reviewer→bounded debugger；三端有不同安装映射 | 全部循环由宿主遵守 Markdown；任务依赖只是文本；默认每任务 commit；本地 Vitest和真实三端均未运行 | 可移植协议候选；不能称已验证主流程。[固定源码链](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/templates/agents/codex-skills/skills/kiro-impl/SKILL.md#L80-L169) |
| BMAD Loop | 有 phase machine、state/journal/lock、验证、独立 review、bounded cycles；三个 recovery 分支本地通过 | run 启动拒绝脏树；核心流程自动 commit，Cursor 未验证；需 BMAD artifact/runtime | 引擎成熟度证据强，但按当前授权直接接入不合格。[clean gate](https://github.com/bmad-code-org/bmad-loop/blob/c47333d1bf3f1f779445fa70378685831610cf5b/src/bmad_loop/cli.py#L2000-L2038)、[phase table](https://github.com/bmad-code-org/bmad-loop/blob/c47333d1bf3f1f779445fa70378685831610cf5b/src/bmad_loop/statemachine.py#L9-L38) |
| Spec Kit | 有 YAML engine、custom step、overlay、落盘 state/resume；本地 32 项相关测试和 4 项恢复探针通过 | 嵌套恢复重放；running crash 不能直接 resume；Shell/Cursor 默认权限语义不合要求；会引入 Python/.specify owner-state | 仍是可配置 engine 候选；可用单个 custom step 隔离业务副作用，尚未与 cc-sdd 做同 fixture 对比。[engine](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/engine.py#L971-L1177)、[custom step](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/__init__.py#L85-L194) |

BMAD Loop 的 clean/commit 冲突足以否决“原样采用”，却不能证明“受控衍生 cc-sdd”比“Spec Kit custom step + 现有 Gate”更少维护。`decision.md` 第 85、150 行其实承认仍需小试验，和第 11、38 行的已定主流程存在张力。

**必须动作：**把结论语义改为“首选试验候选”，并在 P0 加一个短期 bake-off，而不是先锁架构后只测试 cc-sdd。三个候选使用同一已批准 specRef、同一 A→B→C fixture、同一 GateRunner；比较：

- 实际 vendored/patch 文件数与非注释 diff；
- 是否产生第二规格或第二 runtime truth；
- dirty tree、review fail、普通暂停、进程突然退出时的状态；
- 三端 host adapter 所需代码与不可执行能力；
- 升级时可自动验证的契约，而非主观“更轻”。

BMAD Loop 若不修改 clean/commit 核心即可直接判当前授权条件不合格；Spec Kit 应至少做“一个 custom step 委托整个 Task 给现有 controller”的小探针。只有 cc-sdd 在同 fixture 上达到最小 patch、单一真相源和三端可执行，才升级为主流程。

### Important 3 — “实质复用”目前仍是清单；默认导入 spec 资源还可能重新制造平行生命周期

`decision.md` 第 59–65 行列出 requirements/design/tasks/impl/steering 等具体名字，这是可追踪候选，不再是纯理念；但本轮没有 vendor 文件、source manifest、patch、生成产物 hash 或真实调用，所以尚不能回答“已经结合成熟机制”。P0 才是第一次可能形成实质复用。

同时，cc-sdd 自身以 `.kiro/specs/<feature>/spec.json` 管 approvals/phase，tasks 依赖也只是 Markdown 注释（[init schema](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/templates/shared/settings/templates/specs/init.json#L1-L22)、[tasks template](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/templates/shared/settings/templates/specs/tasks.md#L1-L24)）。把 requirements/design/tasks 都列为默认主流程资源，需要比 reviewer/debugger prompts 更广的 spec-path/approval patch，容易与 README 第 18 行“避免重复规格与维护负担”冲突。

**必须动作：**P0 分成两层并实际落盘：

- 默认已批准规格路径只引入 `kiro-impl`、implementer/reviewer/debugger 与它们实际读取的最小 shared rules；不运行 cc-sdd spec generator，不创建 `.kiro/specs`。
- 仅对没有已批准规格的新项目，另评估 requirements/design/tasks；产物必须写入项目既有 canonical spec/task 位置，不能生成第二 approval state。
- 每个复用文件记录 upstream path、固定 SHA、原文件 hash、MIT notice、patch、生成后 hash；加入 upstream-update diff test 和禁止第二 spec authority 的契约测试。

如果为了改 specRef、approval、Git、complete、retry、review provenance 与三端语法而重写 `kiro-impl` 的主干分支，cc-sdd 应降级为 prompts 资产，不应继续称“主流程衍生”。

### Important 4 — “按需 BMAD 架构审查”若没有调用契约，仍会退回理念参考

README 第 15–17 行把架构稳健、技术债优先和分领域验收列为核心需求。`decision.md` 第 45–47、79–85 行只写“BMAD 架构/审查视角”和“选择 lens”，尚未选定文件、触发条件、输入输出、阻塞语义或 evidence binding。现有 G1 assessment 也只校验调用方提交的判断/路径/hash；它不会发现漏报的架构问题，这一点 decision 第 95 行已正确承认。

**必须动作：**P0 至少选择一个真实 BMAD review 接口并定义 adapter，例如 `bmad-code-review` 的 diff/file 输入与结构化 findings 输出（[上游接口](https://github.com/bmad-code-org/BMAD-METHOD/blob/abe4eb1bce919c9d22cd18b3519353d5824c4b75/skills/bmad-code-review/SKILL.md#L28-L84)）：

- 输入绑定 spec/task/tree revision、ADR/API/schema/migration 边界和实际 diff；
- 输出固定 severity、path/line、evidence、verdict 与 `needs-authorization`；
- Standard/Full 或契约/数据所有权/依赖/迁移变化时必须触发，Lite 可按风险选择；
- reviewer 必须是 distinct session/human/platform-attested，缺少独立能力时标 blocked/not-run；
- findings 与修复后证据进入同一 task attempt，不能另建 BMAD tasks/approval 真相源。

否则“架构稳健”仍依赖主 Agent 自觉，BMAD 只是参考资料，不满足用户要求的实质复用。

### Important 5 — P0–P2 可形成工程 walking skeleton，但按当前验收还不能证明三端自主执行

P1 只要求三端“发现与调用”，P2 只要求一次 A→B→C；二者组合并未明确要求 **同一个自主切片在 Claude/Cursor/Codex 各跑一次**。安装/发现成功不能证明子代理、上下文隔离、结果回传、权限停止和恢复语义一致。cc-sdd、BMAD、ECC、Spec Kit 的审计都指出这些能力存在端差异且没有 real-client E2E。

**建议将 P0–P2 收敛成一个可用切片：**

1. 同一 canonical fixture：A 产出 B 所需接口，B 首次 deterministic gate 或 review 失败，自动执行一次受限修复，C 只有 B accepted 后才开始。
2. 预置无关 dirty 文件，结束后 byte/hash 不变；Git log/index 不变，无 commit/push/merge/stash/reset。
3. 在 implementer 已写 candidate、controller 尚未记录 candidate 的窗口中断；新会话必须先判定未知写入并核对，不得盲目重跑。
4. reviewer 使用真实独立上下文；同会话 role-play 只能报 self-review/not-verified。
5. Claude、Cursor、Codex 各自真实执行同一 fixture；端能力不足则该端 P2 blocked，不以另两端通过替代。
6. P2 只宣称 A1+A2 的最小软件切片。一个真实全栈项目仍属于 P3；训练和 Agent fixture/真实项目仍属于 P4，不得从通用 task engine 推导三领域已完成。

这样 P0–P2 是可验收的技术切片，不是完整产品完成。若成本过高，可先指定 reference host 做完整 RED/GREEN，再在其余两端完成同 fixture 后才宣称跨端可用。

### Moderate 1 — 保留 controller 有事实基础，但必须用 P2 “消费测试”防止沉没成本继续扩张

现有 controller 不是纯沉没成本：

- Task schema 已有 `dependsOn`、`allowedPaths`、`acceptance`、`gateIds`、risk（[task.schema.json L1-L17](../../../schemas/task.schema.json)）。
- transition 层已有 dependency、lease、candidate、review provenance、remediation 与 unknown outcome 的 fail-closed 规则（[transition.ts L39-L85](../../../packages/cli/src/state/transition.ts)）。
- GateRunner、tree hash、journal/lock、prepared/committed batch、evidence/receipt binding 与 unknown reconciliation 直接服务脏树保护、当前证据和恢复要求；synthetic crash tests也覆盖了部分内部原子性（[crash-atomicity.test.ts L281-L328](../../../tests/cli/crash-atomicity.test.ts)）。
- 三端构建脚本能从一个 portable source 确定性生成包，并做 symlink/inventory/hash 防护（[walking-skeleton.test.mjs L35-L72](../../../tests/adapters/walking-skeleton.test.mjs)）。

但这些结构大量仍是 dormant capability：`route()` 硬编码一项 Lite、空依赖、`allowedPaths: ['.']` 与通用 acceptance（[controller.ts L1004-L1048](../../../packages/cli/src/controller/controller.ts)）；review failure 和真实 implementation candidate 未接线。冻结是合理的，但“保留”不能变成永续维护全部抽象。

**必须动作：**为 P2 建立 keep/use/delete 表。只有被 walking skeleton 从公共 `develop` 入口实际消费并有故障测试的 primitive 才进入稳定内核；未被消费的状态/receipt/CLI 分支保持冻结，不再增加变体。P2 失败若来自现有抽象不合适，应允许缩减/替换，而不是因已投入代码量强行保留。

“12 个冻结文件 hash 匹配”只证明研究期间这些文件未变；`decision.md` 第 101 行已作了限定。它不得作为架构质量或保留价值的证据。

### Moderate 2 — 测试证据总体表述谨慎，但“已验证 recovery/三端包”必须持续限定范围

本次独立复跑的相关小测试：

```text
./node_modules/.bin/vitest run tests/state/transition.test.ts
# 11/11 passed；只证明纯 transition 规则

node --test tests/adapters/walking-skeleton.test.mjs
# 8/8 passed；只证明临时目录内的打包、manifest/inventory/hash/symlink 规则
```

没有复跑 controller 全套，也没有启动真实客户端或模型。现有 `vertical-slice.test.ts` 是 CLI fixture，未运行 implementer，且用 self-review；`crash-atomicity.test.ts` 用 fault injection 验证 controller/gate journal 与 projection，不验证真实 Agent 修改代码后的恢复、外部副作用去重或新会话 handoff。

因此 `decision.md` 第 95 行的“已验证 journal/recovery”应在后续实施说明中始终写成：

> **已本地验证 controller/gate 内部 journal/projection 的指定故障窗口；实现阶段与真实客户端任务语义恢复未验证。**

上游测试数字也只能按机制使用：cc-sdd 本地测试未运行；BMAD Loop 是三条 recovery fixture；Spec Kit 是 32 条状态/resume 测试加 4 条自定义探针；ECC 的 177 条 JS 测试没有覆盖 Rust resume；OpenSpec 的 72+6 覆盖工件图/parser。它们都不能证明最终组合、架构质量、三端自主或三个领域通过。现有研究报告多数已准确写出这些限制，没有发现把这些数字直接宣称为产品 E2E 通过的文本。

## 对 README 研究承诺的逐项判断

| 承诺 | 当前 decision 状态 | 独立判定 |
|---|---|---|
| 一个入口、一个源 | 明确唯一 `develop`、pinned source、三端薄包 | **方向满足；真实三端未验证。** |
| 完整生命周期/架构稳健 | 有 target lifecycle、BMAD lens、Gate/evidence | **模型覆盖；BMAD 调用契约与 candidate seam 缺失。** |
| 大任务自主/独立审查/调试/恢复 | P2 描述 A→B→C、失败修复、新会话恢复 | **验收方向正确；现有 controller 无实现候选和 review-fail 路径。** |
| 三端/三领域 | P1 三端，P3 全栈，P4 training/Agent | **合理分期；P0–P2 不代表完整满足。** |
| 实质复用 | 列出 cc-sdd/BMAD 资产与 vendor 方法 | **已定位真实单位，尚未导入/调用；仍是 P0 待办。** |
| 避免重复真相/维护负担 | 禁止第二 spec/runtime，冻结 controller | **原则正确；是否真更轻须由 bake-off 和 patch budget 证明。** |
| 测试证据不夸大 | 明确 E2E 未运行、P0–P4 未实现 | **总体通过；recovery 与 adapter 测试需使用上节限定语。** |

## 建议后的最小决策门

不要求在研究阶段继续扩写 controller。下一步只应批准一个时间受限、可回退的 P0/P2 spike：

1. 先定义真实 candidate handoff、review-fail/remediation、dependency unlock 三个缺失契约。
2. 用同 fixture 比较 cc-sdd 受控资源与 Spec Kit custom-step；BMAD Loop 按当前 Git/dirty-tree硬约束记录为不合格基线，除非能在不破坏核心语义下提供受控 adapter。
3. 选定方案后才 vendor/patch 具体上游文件；P0 交付必须是可执行资源与 provenance manifest，不是架构描述。
4. 通过一个 reference host 的完整切片后，再做另外两端同 fixture；未通过前不宣称跨端自主。
5. P2 每个保留的 controller primitive 都必须出现在真实入口 trace；否则冻结或移除，不为沉没成本继续扩张。

满足这些条件后，`cc-sdd 协议 + 小型现有内核 + 按需 BMAD review` 仍是有吸引力的候选；在此之前它应保持“可证伪的集成假设”，而不是既定的唯一主流程。

## 修订处置复核（2026-09-08）

本节只复核 `decision.md`、`README.md` 与 `validation.md` 对上述 finding 的文本处置；没有重新审计上游、修改产品或复跑测试。

| 原 finding | 处置状态 | 窄复核证据与剩余边界 |
|---|---|---|
| Important 1：缺少 input→candidate、review fail/remediation 与全计划依赖接线 | **已在裁决契约中处置；未实现** | `decision.md` 第 78–88、120、162–172 行明确 claim 覆盖真实实施、input/output 分离、fail 是有效持久结果、accepted 才解锁、未知实现窗口先核对，并把这些列为 P0/P2 前置。controller 源码仍未改，真实实现恢复未验证。 |
| Important 2：cc-sdd 被过早定为唯一主流程 | **已处置** | `decision.md` 第 11、39–40 行和 `README.md` 第 12–18 行降为“优先试验/首选试片”，P0 要求 cc-sdd 与 Spec Kit custom-step 使用同一 fixture；BMAD Loop 只作为受硬约束检验的真实引擎基线。选型尚未定版。 |
| Important 3：实质复用仍是清单，默认 spec 资源可能产生第二真相源 | **已在交付契约中处置；未导入** | `decision.md` 第 61–68 行把已有批准规格路径缩为 `kiro-impl`、implementer/reviewer/debugger 与最小依赖，明确不运行 spec generator、不创建 `.kiro/specs`；同时要求 upstream path/SHA/source hash/patch/generated hash/MIT notice 和禁止第二 spec authority 测试。当前仍无 vendored resource 或生成产物。 |
| Important 4：BMAD 架构审查仍可能只是理念 | **已具体化；未实现** | `decision.md` 第 92–106 行选定 `bmad-code-review` 的 gather-context 与 triage 两个固定文件，并明确拟议输入、输出、触发、独立性、阻塞和适配成本；文本也明确这不是上游原生 schema。尚未运行该 adapter 或真实架构审查。 |
| Important 5：P0–P2 不足以证明三端自主 | **已在验收中处置；E2E 未运行** | `decision.md` 第 162–170 行要求同一 A→B→C 在 Claude/Cursor/Codex 分别真实执行，包含失败修复、accepted 解锁、实现写入后中断、dirty/Git 保持；某端不足必须标 blocked。P2 仍只代表 A1+A2 软件切片，P3/P4 才覆盖真实全栈、训练与 Agent。 |
| Moderate 1：controller 保留可能受沉没成本驱动 | **已处置** | `decision.md` 第 114–124 行把“保留”改为候选保留，要求 P2 keep/use/retire 表，只有被公共入口真实消费且有故障测试的 primitive 才稳定保留；允许后续提出缩减/替换。冻结 hash 明确不作为架构质量证据。 |
| Moderate 2：测试证据范围可能被放大 | **已处置** | `decision.md` 第 116 行、`README.md` 第 14–18 行及 `validation.md` 第 8–26、28–47、55 行明确区分内部状态/打包/探针与产品 E2E；cc-sdd 测试、ECC2 Rust、真实三端、真实训练/Agent 均明确未运行。 |

**处置裁决：**上一轮 finding 在研究文档层均已到位，未留需要再次改写裁决文本的开放项。P0 对照、上游资源导入、candidate seam、失败审查修复、三端同 fixture、真实全栈及训练/Agent 验收仍全部是**待实现/待运行**；本处置状态不能写成架构已选定、controller 已修复、三端可用或用户完整目标已交付。
