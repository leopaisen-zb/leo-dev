# Leo Dev：上游源码、需求与实施偏移复盘

日期：2026-09-10（Asia/Shanghai）。性质：只读源码审计与产品复盘，不是新的实施规格、架构批准或安装授权。

后续深度调研：[框架、社区实践与 Codex 团队适配](../2026-09-10-framework-community-review/README.md) 补充当前官方宿主能力、社区原始案例/已修问题、GSD 迁移时效、完整目标范式及下一步验收建议。此链接不改变本文历史证据日期。

后续范围修正：用户进一步指出宪法、Spec 持续收敛和团队开发流程缺失。本报告的任务闭环建议不足以覆盖完整产品范式；新增源码核对与理解修正见 [宪法与团队补充复盘](constitution-team-addendum.md)。不改变下列历史源码/真实测试事实，也不将新理解标记为已实现。

## 结论

此前确实下载过八个上游仓库，也留下了关键执行路径的源码审计；不能说之前完全没读源码。但下载、阅读、直接复用、真实宿主验收是四件事。当前证据不足以声称“已经吃透并整合了这些框架”。本轮重新查读入口、状态、执行、审查、恢复及部分对应测试，而非仅复述旧报告。

Leo Dev 的目标没有变：统一使用、工程判断可靠、架构与相关技术债优先、已批准大任务持续推进、Codex 先可用。发生偏移的是交付重心：自建控制器的状态/证据完整性先做了很多，真实宿主的连续开发、故障恢复与安装体验仍未闭环。不是所有自研都错，也不是换成一个热门仓库就能解决。

本轮还补查并下载了独立的 `lihan3238/speckit-superpowers-bridge`；它不在此前八仓清单中。但用户写的 `speclit-superpowers`、`bmdp` 身份尚未确认，不能自动将它们纠正成这个 bridge 或 BMAD。

## 1. 仓库到底在哪里，哪些实际读过

历史快照根目录：`/private/tmp/leo-dev-source-audit.5I999C/`。本轮逐个执行 Git HEAD 与工作树检查：八仓均存在、与历史 SHA 一致、工作树干净，均为浅克隆，不代表掌握完整提交历史或最新稳定版。

| 仓库目录 | 本轮核实 SHA 前缀 | 新读的主要路径 |
|---|---|---|
| `superpowers` | `b36e0829` | Codex manifest、SDD 技能、ledger/brief/review-package 脚本、verification |
| `bmad` | `abe4eb1b` | 当前 build-auto 模板、plan/implement/review 路由、verification-gap、sprint parser |
| `bmad-loop` | `c47333d1` | Python model/statemachine/policy/verify/recovery 与运行前提 |
| `cc-sdd` | `29aee950` | 安装入口与 file executor、Codex manifest、kiro-impl/review/debug/verify |
| `ecc` | `5064474d` | ECC2 session runtime/manager、quality-gate hook |
| `spec-kit` | `4a7341a9` | workflow engine、custom step loader、默认流程、nested resume |
| `openspec` | `e062b957` | artifact completion detector、apply-change 指令 |
| `gsd` | `bdcaab2c` | SDK session-runner、phase-runner 的验证与继续接线 |

新增 bridge：`/private/tmp/leo-dev-bridge-audit.LroRTs/speckit-superpowers-bridge`，SHA `8204959a23fe774bff169350bb8804dbf1e2051e`；读了 Codex skill、handoff/guard/state 脚本和漂移测试。首次下载受沙箱内代理连接限制失败，经权限工具批准后原命令下载成功；未安装或运行上游脚本。

完整 SHA、路径、检查时间和范围见 [sources.json](sources.json)。已有 Superpowers 工作副本另在 `/Users/leo/plugins/superpowers`；不要混淆研究快照、工作副本与已安装缓存。研究快照目前在临时目录，**不是长期依赖管理机制**；后续若采用具体资源，需要版本锁定、许可证、适配差异与升级验证，不能仅依赖这些临时路径。

## 2. 源码带来的关键认识

### cc-sdd：真正值得复用的是明确的任务闭环

Node 入口选择 manifest 后执行文件部署，`plan/executor.ts` 的 executor 是写入模板文件，不是运行开发任务的常驻调度器。[安装源码](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/src/index.ts#L203)

`kiro-impl` 明确：不传任务号即处理所有待办；每轮只做一个子任务，重读 tasks；新实现上下文 → 独立审查 → 修复/新上下文调试 → 下一项。边界、依赖、规格引用和结构化状态都有具体协议。这里的自主性由宿主 Agent 遵循技能实现，不是后台进程保证。[实现协议](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/templates/agents/codex-skills/skills/kiro-impl/SKILL.md#L61)

不能原封不动采用：它含父代理自动提交、可关闭审查、两轮 debug 等默认值；Leo Dev 的禁止自动提交、审查要求和既有预算不能被上游覆盖。恢复依赖文件/提交记录，也没有证明副作用不会重放。

### BMAD：价值是工程判断，不是角色名字多

本次读的是所锁版本的 `bmad-build-auto`，不是依据旧版 XML 或角色介绍推断。其模板用 intent-contract、Always/Never、I/O 边界矩阵、Code Map 与验收固化问题；审查区分意图缺口、错误规格、局部 patch、延后项和误报，记录原因。它要求对通常的审查发现追踪调用链、核实实际坏结果，而不是看见建议就改；verification-gap 层有单独的预验证信任约定，不能概括成所有层都逐项复验。[模板](https://github.com/bmad-code-org/BMAD-METHOD/blob/abe4eb1bce919c9d22cd18b3519353d5824c4b75/skills/bmad-build-auto/spec-template.md#L18)、[审查路由](https://github.com/bmad-code-org/BMAD-METHOD/blob/abe4eb1bce919c9d22cd18b3519353d5824c4b75/skills/bmad-build-auto/step-04-review.md#L28)

verification-gap 特别贴合这次教训：沿改变的行为追到实际消费者，问“一个现实回归是否会让断言失败”，不能用字符串匹配、只有不抛异常、模拟掉集成的测试代替。[验证缺口协议](https://github.com/bmad-code-org/BMAD-METHOD/blob/abe4eb1bce919c9d22cd18b3519353d5824c4b75/skills/bmad-build-auto/review-prompts/verification-gap.md#L37)

也不能照搬全部策略：源码含干净工作树前提、部分审查分支的撤销重推导、最终自动提交/清理到干净状态。我们应复用判断资源并显式适配边界，而不是默认接入这些动作。

### Superpowers：方法与小工具有价值，不等于硬门禁

所锁 Codex manifest 的 hooks 为空。SDD 提供按计划隔离的持久进度、窄任务 brief、review package；这些比每次向 Agent 倾倒全部上下文更具体。恢复指令要求查 ledger，避免压缩后重复派发已完成任务。[SDD ledger](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/subagent-driven-development/SKILL.md#L131)

但 review-package 读取 `BASE..HEAD`，不自动包含用户的未提交修改；完整 SDD 又有 worktree、提交、清理等默认约定。Leo Dev 已有 journal，**不应该再加第二个 Superpowers 完成账本**。可复用方法、任务上下文与审查包思想，映射到已有记录与真实未提交候选。[review-package](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/subagent-driven-development/scripts/review-package#L32)

### 补查的 speckit-superpowers-bridge：职责分工的直接案例

它让 Spec Kit 持有设计工件，让 Superpowers 执行，桥只做 handoff/guard；已有设计时禁止第二次 brainstorming/writing-plans，Codex/Claude 有对应入口。这比“借鉴两个框架，再重造两套”更接近真正的集成。[Codex 入口](https://github.com/lihan3238/speckit-superpowers-bridge/blob/8204959a23fe774bff169350bb8804dbf1e2051e/.agents/skills/speckit-superpowers-bridge/SKILL.md#L17)

但它也不是现成答案：`update-handoff.sh` 写 complete 后，对设计工件哈希漂移和未勾选任务发 WARNING，最终 exit 0；对应漂移测试也验证告警/事件。这个取舍适合薄协议，却不能代替 Leo Dev 想保留的证据准入。不要把其 README 的 Verified 等同于本轮真实 Codex 试用结论。[更新脚本](https://github.com/lihan3238/speckit-superpowers-bridge/blob/8204959a23fe774bff169350bb8804dbf1e2051e/.specify/extensions/speckit-superpowers-bridge/scripts/bash/update-handoff.sh#L255)、[测试](https://github.com/lihan3238/speckit-superpowers-bridge/blob/8204959a23fe774bff169350bb8804dbf1e2051e/tests/test-bridge-status.sh#L572)

### 其他几个仓库，不能混称为一种“引擎”

| 上游 | 新查到的实际机制 | 对本项目的限制 |
|---|---|---|
| BMAD Loop | Python 状态机、verify/review/retry、持久 session、锁和恢复策略 | 依赖 BMAD/Git/CLI/终端复用器等；正常生命周期含 commit；没有直接对应我们 TTL 租约的现成解法 |
| Spec Kit | 实际 YAML workflow engine、自定义 Python StepBase、持久运行状态 | nested pause 后重跑父步骤/子体；不能直接保证开发副作用安全恢复；默认流程不等于独立审查闭环 |
| ECC | ECC2 Rust 捕获进程、心跳、状态和 resume；另有轻量质量 hook | session completed 在所读路径按 exit success 记录，不是软件验收；所读 quality-gate hook 主要告警/透传，不代表整个 ECC 都没有阻断门禁 |
| OpenSpec | 工件 DAG、文件存在检测、apply 指令与待办循环 | 工件完成不是代码通过，apply 的实现/勾选由 Agent 执行 |
| GSD | 实际 SDK session/phase runner、验证与继续 | 所读 SDK 路径直接调用 Claude Agent SDK，带 bypassPermissions 配置；不能据此宣称 Codex 可直接使用，更不能继承其扩权默认值 |

源码定位：[BMAD Loop 状态机](https://github.com/bmad-code-org/bmad-loop/blob/c47333d1bf3f1f779445fa70378685831610cf5b/src/bmad_loop/statemachine.py#L12)、[Spec Kit nested resume](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/engine.py#L1318)、[ECC runtime](https://github.com/affaan-m/ECC/blob/5064474d4d762dc9640234a41617cccb79185cec/ecc2/src/session/runtime.rs#L204)、[ECC hook](https://github.com/affaan-m/ECC/blob/5064474d4d762dc9640234a41617cccb79185cec/scripts/hooks/quality-gate.js#L140)、[OpenSpec detector](https://github.com/Fission-AI/OpenSpec/blob/e062b9572be933564ba3899d059377dfa1393e32/src/core/artifact-graph/state.ts#L14)、[GSD runner](https://github.com/gsd-build/get-shit-done/blob/bdcaab2c752d9a33a1a1ca9acf3a3c81fb991815/sdk/src/session-runner.ts#L106)。这是指定路径的静态观察，不是对各仓全部能力的穷尽判断。

## 3. 回到你最初要的产品

| 用户要的结果 | 不能偷换成 | 当前证据与缺口 |
|---|---|---|
| 长期只用一个入口 | 装好许多插件，再靠用户/经理手工拼接 | develop 入口有；依赖与 controller 尚未成一个验证过的安装单元 |
| Linux 式工程判断、架构稳健 | 用 C、仅支持 Linux、代码越短越好，或加更多状态表 | 已有原则/检查；尚无新增控制器降低语义错误的可靠比较证据 |
| 降低相关技术债 | 清理所有旧代码，或 assessment JSON 合法就算治理完成 | G1 验证提交者的结构/哈希/准入，不自动作出架构判断 |
| 已批准大任务自主推进 | CLI 有 resume 就算能恢复，或必须无人值守后台 daemon | Lite 串行依赖已实现；真实 review 到期不能继续 |
| 独立审查、根因调试 | 实现者自报通过，或所有审查建议都照单全收 | 方法已有；需在实际宿主闭环中验证拒绝、修复和重新审查 |
| 全栈/训练/智能体都适用 | 同一个 lint/test 分数证明所有领域可靠 | Codex 是第一阶段；真实跨层契约、训练复现/数据泄漏、Agent tool/eval 等未验证 |
| GitHub 单一维护来源、多客户端共用 | 三种 manifest 能生成就算三端能用 | 源码、薄包、已安装缓存不同步；GitHub 发布及其他客户端验收未交付 |

“重”应当意味着必要的调查、测试和审查可以深入，不应意味着每次开发都要重新决定用哪个工具或替插件料理内部状态。对“无法修复”“必须重写”的质疑，应落实成复现、调用链、反例和保留契约的修复比较，而不是预设每个问题都能几行解决。

规范的作用是让已知约束可检查，不能保证需求永远完整、AI 不再误解、技术债为零。原文章的“确定性”更适合理解为：确定哪些检查必须执行、哪些证据允许推进；不是确定代码一定正确。

## 4. Leo Dev 当前实际架构与接入层次

```text
用户的需求 + AGENTS + 已批准规格 + 实际工作树
  → develop 技能（宿主 Agent 读取、决策与调用工具）
      ├─ 外部 Superpowers 等按需方法
      ├─ 宿主实际实现 / 独立审查
      └─ 自研 TypeScript CLI
           ├─ route / assessment / claim / candidate
           ├─ Gate 子进程 + 证据 / submit / review
           └─ journal + task/run/lease + resume/reconcile
  → 代码候选、测试/审查记录、持久状态、交付说明

打包器 → 客户端 manifest + develop 技能文件
         （不打包 controller runtime，也不启动开发 Agent）
```

接线证据：[技能入口](../../../skills/develop/SKILL.md)、[生命周期人工/Agent 命令链](../../../skills/develop/references/lifecycle.md)、[打包器文件清单与复制](../../../scripts/build-adapters.mjs)、[CLI 入口](../../../packages/cli/src/index.ts)。实际 `run-gates` 会启动验证子进程，但这不等于 CLI 自主启动开发 Agent。

| 上游 | 当前产品 / 实验的真实复用程度 |
|---|---|
| Superpowers | develop 明确要求按需读取外部技能；已在受控样例实际消费，不是链接其 workflow engine |
| cc-sdd | 实验目录保存原始资源与许可证；C1 独立 reviewer 消费过 kiro-review；完整 kiro-impl 未运行、未接入生产主流程 |
| Spec Kit | 实验代码实际 import StepBase/WorkflowEngine 并执行过 custom step；回调拥有结果，未进入生产 CLI |
| BMAD/BMAD Loop | 源码调研与理念借鉴；生产 develop 未调用其角色/工作流/运行引擎 |
| OpenSpec/ECC/GSD | 调研参考；没有作为生产工作流接入 |
| speckit-superpowers-bridge | 本轮才补查，不是既有产品依赖 |

这些区别可直接在 [components.md](../../../skills/develop/references/components.md)、[实验 bridge](../../../experiments/codex-first/speckit_bridge.py)、[C1 接入证据与未执行项](../../../verification/codex-first/README.md) 核对。不能把模板落盘叫作完成集成，也不能把 Agent 读取技能说成根本没复用。

## 5. 发生了什么偏移，为什么

下面的事实有源码/记录支持；“原因”是对过程的判断，不是对模型内部心理、耗时或成本的测量。

### A. 统一使用，被过早落实成较完整的自研控制平面

9 月 4 日历史计划就把 change/task/run、租约、CAS journal、恢复、客户端适配等列为核心。与此同时，真实客户端加载仍未验证。后来用户收敛为 Codex-first，顺序已作调整，但底层继续占据主要交付物。[既有计划](../../superpowers/plans/2026-09-04-unified-development-plugin.md)

**原因判断：**架构先行覆盖了很多可能的故障，却没有先证明最小的真实使用路径。统一入口确实需要统一完成权，但不要求把成熟上游的工程判断和宿主循环都重新发明。反过来，不能因结果未完成就否认已批准的候选绑定、边界与持久性工作有价值。

### B. 可验证的记录完整性，代替不了工程判断

`captureBaseline` 记录 tree/Git/dirty 信息。`assessment.ts` 校验评估的 schema、文件哈希、历史衔接和 disposition；它不调查架构、证明没有技术债，也不验证修复在语义上成立。多任务计划又不能带综合 assessment，两个用户最重视的能力还没有合起来。[baseline](../../../packages/cli/src/repository/baseline.ts)、[assessment](../../../packages/cli/src/governance/assessment.ts)、[生命周期限制](../../../skills/develop/references/lifecycle.md)

**原因判断：**选择了更容易机械验证的代理指标。可信记录是必要基础，但架构质量还要靠理解实际行为、模块边界和反例的实施者与审查者；这些才是 BMAD 判断资源应服务的位置。

公平边界：G1 当时就是明确批准的局部准入工作，其文档也没有承诺自动发现所有债务。因此这里批评的是这些局部能力尚未组合成用户结果，而不是指控那一轮实现违背了自己的范围。

### C. 测了“错误时拒绝”，漏了“拒绝后怎样安全继续”

当前代码把已提交候选的 review 继续绑在实现租约有效期上（controller.ts:1008）。claim 只接 ready/remediation，并拒绝 active 租约（1247 起）；resume 做日志/批次/Gate 恢复，没有到期待审的公开恢复分支（1779 起）。默认 claim TTL 是五分钟，真实试用即使用十分钟也遇到了这条缺口。[控制器](../../../packages/cli/src/controller/controller.ts)

**原因判断：**安全拒绝条件有了，进展与交接条件没有成对定义。恢复能力不是“有个 resume 命令”，而是每个可达中断点都有保留候选、防旧执行者覆盖、不重复未知副作用的合法后继。加长 TTL 或直接忽略过期不构成完整修复；但也没有证据证明必须推翻控制器。

### D. 本地函数与命令测试，没覆盖宿主环境差异

真实实现代理使用 Node22 路径，主线程使用 Node25。历史 Gate 检查用当前 `process.execPath` 重新算启动器指纹，导致同一份历史在另一上下文 status 读取被拒。固定到原 Node 路径能读，不需要修改代码或证据。此外，技能要求通过 `--help` 查 flag，CLI 的 help 实际只列命令名。[runner.ts:729](../../../packages/cli/src/gates/runner.ts)、[index.ts:15](../../../packages/cli/src/index.ts)

**原因判断：**缺少稳定且可发现的产品运行入口；测试同一环境下的 CLI，不等于测试不同宿主会话里的一次完整交接。

### E. 原有基线已能修样例，却尚未证明新增复杂度改善代码质量

C1 中旧 develop 修复了两缺陷样例，独立 oracle 通过。这个结果证明基线有能力，不能证明新增 Harness 带来改善。C2 的 310 项 Node/TS 与 19 项 Python 是真实历史源码回归，但新的实际 A→B→C 试用只完成了 A 的代码与独立代码审查，随后租约卡住；B/C 未实现，固定完整应用测试 2 通过、4 失败。[C1 基线](../../../verification/codex-first/README.md)、[C2 真实失败](../../../verification/codex-execution/live-20260910/README.md)

**原因判断：**交付度量没有始终围绕用户结果。测试数量不是无效，只是回答了较窄的问题。对外进度应该首先说“你现在能否用它完成一次真实开发”，再说底层测试；不能把多轮局部成功累加成产品已成熟。

## 6. 接下来应采用什么判断标准

建议方向，不在本轮实施，也不新建第二套规格或账本：

1. **暂停扩展通用平台能力，保留已验证的基础。**保留候选/证据绑定、脏文件归属、独立审查记录、失败预算与必要恢复原语；不因发现问题就整仓重写，也不让其他引擎拥有第二套完成真源。
2. **把上游复用落实为可追溯资源适配。**cc-sdd 的单任务闭环、BMAD 的 intent/Code Map/审查分类与 verification-gap、Superpowers 的 TDD/根因调试/证据方法，各有一个明确责任。采用何文件、何 SHA、保留什么、删改哪项副作用、怎样升级，要可查。不能只把框架名字放进提示词；也不能未经验证直接导入完整框架。
3. **先补齐一条 Codex 真实路径所需的缺口。**从入口加载与 controller 版本/路径可发现性开始，明确源码加载与安装加载的差别；补齐到期待审的安全交接、可机器发现的下一步，再在已有失败现场/固定验收下证明继续推进。小租约修复有可能足够解决本次阻塞，但仅修它仍不能证明安装、上游消费、代码质量和完整产品都完成。恢复方案须明确旧代次隔离、候选与 Gate 身份保留、review 新鲜度、晚到结果拒绝及预算不被暗中重置，不能只增加一个无条件跳转。
4. **把“可用”冻结成用户行为验收。**真实 Agent 修改代码；独立审查能抓到一个已知缺陷；不改验收地修复；审查超时/会话更换后可续接；后继任务能解锁；旧回执/晚到写入不会被当成新成功；原有文件和 Git 状态不被破坏。源码回归和实际宿主执行分别报告。
5. **最终衡量收益而非框架数量。**以同一代表性小集合比较旧 develop 与整合版：错误“无法修复/必须重写”判断、过度重构、契约破坏、审查误报、重复执行、人工救援次数。记录失败，不根据结果降低标准。跨层应用、算法训练和 Agent 需要各自的验收样例，不能用本次整数样例代替。

这条方向可以保持一个宿主驱动的统一工作流，不要求新增后台 daemon。若后续确需改变生产控制器归属、引入 Spec Kit 真源或整套 BMAD Loop，那是需要另行裁决的架构替换，不能伪装成小修。

## 7. 方法、限制与证据质量

- 使用 deep-market-research 的溯源、矛盾记录、生成/校验分离方法，按技术源码审计裁剪；不做无关市场规模、用户口碑或虚构评分。web-access 用于公开静态检索与源码获取；其检查脚本会启动常驻 CDP/可能初始化配置，因此本轮没有执行它，也没有访问登录态浏览器。
- 两位独立 Terra/high 探索代理分别核读 cc-sdd/Superpowers 与 BMAD/BMAD Loop/Spec Kit；主线程读 Leo Dev、新 bridge、ECC/OpenSpec/GSD 的指定路径并抽读关键上游接缝。子代理没有实现代码，主线程保留需求与取舍裁决。事实/语料与需求适配两种反证审查见 [review-notes.md](review-notes.md)。
- 官方源码及同仓文档/测试属于同源证据（Tier 1 / Single-source），不是三个独立来源的交叉印证。SHA/文件存在/哈希比较是本机观察；行为结论分别注明静态检查与历史真实执行。没有全仓逐行读完，没有本轮重跑上游或全产品测试，没有统计可靠性/成本结论。
- 歧义仓库身份未定；新 bridge 是相关候选，不声称就是用户指定对象。没有把搜索未命中当作仓库不存在。
- 160 项生产文件与既有 live 前清单哈希一致；本轮只新增调研文档与隔离源码下载，不修插件、不改规格/审批、不升级已安装缓存、不提交/推送/部署。
- 核心未决项：选定资源的具体适配合同、到期交接安全语义、安装入口与真实验收结果。研究结论不是这些能力已经交付。
