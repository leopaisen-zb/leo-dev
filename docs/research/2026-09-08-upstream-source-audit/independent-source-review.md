---
date: 2026-09-08
status: independent-adversarial-review
scope: Superpowers / Spec Kit / OpenSpec report, probes, sources, and proposed decision
---

# 独立反方复核：不能把“有流程文本”或“有小内核”当成整合已解决

本记录只审查证据和选型推理，不授权实现、安装或客户端配置。所有上游结论仍是官方锁定仓库的 Tier 1 / Single-source；它们不是彼此独立的交叉佐证。Claude Code、Cursor、Codex 的真实发现、子代理隔离、权限和端到端恢复均**未运行**。

## 复核执行证据

四个 checkout 的 HEAD 与 `sources.json` 一致：Superpowers `b36e0829`、Spec Kit `4a7341a9`、OpenSpec `e062b957`、cc-sdd `29aee950`（**locally-reproduced**）。以下测试都在锁定临时 clone / 临时环境中执行，没有安装客户端、调用付费模型或改动全局配置：

| 运行项 | 观察 | 结论边界 |
|---|---|---|
| `superpowers/tests/claude-code/test-sdd-workspace.sh` | 13 PASS、exit 0 | 只验证临时 fake Git fixture 的 workspace/brief/review-package；不验证模型循环或用户仓库 Git 行为。 |
| Spec Kit `TestRunState` + `TestResumeWithInputs` | 32 passed | 覆盖所选状态/恢复单测，不是跨进程或真实客户端测试。 |
| `probe-speckit.py` | 4 passed | 复现顶层暂停、嵌套重放、`running` 拒绝 resume、Cursor argv 构造；不是 Cursor 启动或副作用 exactly-once。 |
| OpenSpec artifact-graph/task-progress 的四个测试文件 | 72 passed | 与被审报告的命令和数量一致；不是全仓 `npm test` 或客户端 E2E。 |
| `probe-openspec.mjs` | 6 assertions passed | 只刻画构建产物所导入的 graph/state/task parser。 |

因此，被审报告的 13 / 32 / 4 / 72 / 6 数字和锁定版本未发现不一致。其对 OpenSpec “parser 不读测试，不推出整个产品没有验证”、对 Superpowers helper 测试“不等于模型循环”的限定也是恰当的。以下是仍需修订的实质问题。

## 发现与最小修订

| 严重性 | 位置 | 独立发现 | 最小修订 |
|---|---|---|---|
| 高 | `superpowers-speckit-openspec.md:63`；`decision.md:150` | “一个 custom step 委托外部内核即可避免嵌套重放业务副作用”说得过强。Spec Kit 的 `resume()` 明确从 `current_step_index` 取 remaining steps，并重新调用该步骤；`StepBase.can_resume()` 在此路径没有被使用。custom step 只是把幂等/attempt/未知副作用的责任移到该 step 或其外部内核，不会获得精确一次。 | 改成“可局部化重放，不会自动避免”；任何 custom step 必须在副作用前持久化 attempt/lease/幂等键，在副作用后持久化可核验收据，未知结果 fail closed。把这个条件加入后续 P2 的 crash fixture。 |
| 高 | `decision.md:11, 38-50, 93-100, 105-113, 149-151` | “cc-sdd 衍生主流程是唯一流程负责人”与“existing controller 持有任务状态、审批、证据、恢复边界”尚没有一个单写者协议。cc-sdd `kiro-impl` 以 `tasks.md` checkbox、Implementation Notes、每任务 commit 作为完成/恢复事实；当前 controller 又对自己的 task artifact、journal、lease、snapshot 做状态约束，且目前强制恰好一个 Lite task。二者若都能把 task 标完成/阻塞，恢复会有两个互相独立的裁决者。 | P0 前写一页接口契约：唯一 task-state owner、cc-sdd 资源是否可直接写 canonical task、controller 何时 claim/release、证据与 checkbox 的映射、crash 在“代码已改但状态未写”时的处理。二选一：让 controller 独占 durable transition、cc-sdd 只输出结构化候选；或移除 controller 对任务状态的所有权。没有此选择，不应称“唯一主流程”。 |
| 中 | `superpowers-speckit-openspec.md:55,63`；`decision.md:150` | Spec Kit 没有被完全排除，这是正确的；但“之后若 P2 接入成本过高再比较”是不可判定的触发条件，容易低估既有 controller 的改造面。当前 controller 及其直接状态模块约 1,924 LOC，已有 journal/lease/CAS/tree-hash/recovery；把它从单 Lite task 扩为依赖 DAG、attempt、review/recovery同样是实质产品工作，而不是天然“小内核”。反例是：若只需串行工作流 + gate + 可恢复审批，Spec Kit 已提供成熟 YAML engine、pause/resume、fan-out 和 overlay，外围现有 lease/evidence 可作为副作用 guard；其代价应与 cc-sdd patch 实测比较，而非由默认 Shell/Cursor 策略直接否决。 | 将路线写为有门槛的暂定选择：先做同一无客户端 fixture 的设计/成本对照（cc-sdd 衍生+controller 与 Spec Kit custom-step+controller），比较新增文件/状态映射、dirty tree、双 resume、未知副作用和三端 adapter。通过预先设定的维护阈值而非“感觉 P2 太贵”裁决。此建议不授权实现。 |
| 中 | `superpowers-speckit-openspec.md:63` | “custom StepBase 注册”虽是实际接缝，却不是纯 YAML 适配：CLI run/resume 会从 `.specify/workflows/steps/<pkg>/` 动态执行 `__init__.py`，并对导入/验证失败静默跳过。它会新增项目内 Python 执行代码、供应链/版本锁与故障可见性要求；直接库调用还须自己保证加载步骤。 | 在“最小集成面”明确列出 custom-step package、Python ABI/dependency 锁、加载失败必须显式失败（不能依赖默认 silent skip）、其代码的审查与许可。若不能接受这些，custom step 不是低成本接缝，应只用 built-in/gate 或不选该 runtime。 |
| 中 | `superpowers-speckit-openspec.md:55,70`；`decision.md:150` | 报告只说“未做跨进程压力测试”，但源码已足以给出更具体的风险：`RunState` 的锁是进程内 `threading.Lock`；save 的注释明确 racing writers “only contend to be last”。两个进程可同时 load 同一 paused run、都设为 running、都重放当前 step。原子单文件写不等于 run lease。 | 在候选表补充“无跨进程 run lease/互斥；并发 resume 不支持”，并把双进程 resume 作为 Spec Kit 直接采用前的必测项。若由现有 controller 保护，接口契约须保证其 lease 覆盖实际 step dispatch，而不只覆盖事后 gate。 |
| 中 | `decision.md:67-77` 与 `kiro-gsd.md:67-74` | 决策已列出至少七类 cc-sdd 改动（spec/approval、Git、完成证据、retry、reviewer、架构授权、feature flag）；这比“只改两个 patch 类型”的早期表述宽得多。更重要的是，这些不是只改同一份文本：cc-sdd 三端各有 17 skill，`kiro-impl` 在三端副本中都写死 spec 路径、checkbox、commit 和恢复前提。若分别 patch，会发生三端漂移；若先抽 canonical source 再生成，生成器/差异测试本身也是新增控制面。 | 决策保留“受控衍生而非原版”是对的，但应把“明确且有限”改为待量化假设：列出 canonical source、每端生成产物、逐端 patch 计数和 golden-diff/三端 load 验收。超过预设文件/语义阈值即退回“只复用 reviewer/debugger resources”。 |

## 关键源码依据（source-traced）

- Spec Kit 的恢复从当前 index 重跑当前 step：[`engine.py:1077-1159`](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/engine.py#L1077-L1159)，实际调用 `step_impl.execute`：[`engine.py:1177-1253`](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/engine.py#L1177-L1253)。
- `RunState` 只使用线程锁，且源码说明 racing writers 最后写入者胜出：[`engine.py:698-706,740-787`](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/engine.py#L698-L787)。
- custom step 是项目目录 Python 动态导入，失败会被跳过：[`workflows/__init__.py:85-211`](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/__init__.py#L85-L211)；CLI run/resume 才显式加载它：[`_commands.py:1308-1338`](https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/src/specify_cli/workflows/_commands.py#L1308-L1338)。
- cc-sdd 的恢复前提是 checkbox + commit，非 durable attempt/lease：[`kiro-impl:84-86,129-145,267-269`](https://github.com/gotalab/cc-sdd/blob/29aee950f4addc36f9aeecb9881c46540e71ecc9/tools/cc-sdd/templates/agents/codex-skills/skills/kiro-impl/SKILL.md#L84-L145)。

本地现有 controller 的只读核对显示：`route()` 目前创建一个 `dependsOn: []` 的 Lite task，而其 lease manager 用 journal exclusive section、generation 和 tree hash 进行串行 claim/CAS。前者说明现有能力尚未是多任务调度；后者说明把它描述为“很小、可随手替换的内核”也不准确。该内部源码不是上游独立来源。

## 选型结论（反方之后）

我不建议因 Superpowers/cc-sdd 的 auto-commit 或 Spec Kit 的默认 adapter 旗标就排除成熟运行时；这些是默认策略冲突，和“无法配置/必须重写核心”不同。反过来，也没有证据表明当前 cc-sdd 衍生 + existing controller 已是低改动方案：它需要解决规格/批准投影、task state 单写、Git、证据、恢复和三端生成六个以上交界。

可维持“cc-sdd 受控衍生为暂定主路线”，但只能在上述单写者契约与固定对照门槛写入 P0 后。否则较稳妥的结论应是：cc-sdd、Spec Kit 都是候选；现有 controller 的 lease/evidence/recovery 是应保留并验证的边界，不能既称为非流程内核又让它隐含地承担流程状态机。BMAD/Superpowers/OpenSpec 可继续按其报告所述作为资源或工件权威，不能据本复核宣称已集成。

## 处置状态复核（2026-09-08 后续窄审）

本节只核对文档是否消除了初审指出的夸大，并不把 P0/P1/P2 的未来方案误报为已实现或已通过。

| 初审项 | 处置状态 | 窄复核结论 |
|---|---|---|
| custom step “避免重放” | 已处置 | `superpowers-speckit-openspec.md:63` 改为“局部化重放责任，但不会自动避免重放”，并要求 attempt/互斥覆盖实际 dispatch、未知结果阻塞；`decision.md:163` 保持同一限定。与锁定 `resume()` 路径一致。 |
| Spec Kit 线程锁、跨进程 lease 与动态 Python step | 已处置 | 报告 `:65` 明确区分线程锁和跨进程 lease，记录 dynamic import/静默失败及正式加载失败必须阻塞；裁决 `:84,158,163` 将外层互斥、受审模块和同一 fixture 纳入门槛。没有把双 resume 尚未实测说成已经安全。 |
| 过早认定 cc-sdd 路线最低成本 | 已处置 | 裁决 `:11` 改为优先候选而非已定版，`P0:150,158` 要求同一无模型 fixture 比较 cc-sdd+controller 和 Spec Kit custom-step+controller，并声明 stub 不替代真实宿主验证。 |
| durable task state 的双写 | 已处置 | 裁决 `:78-86` 明确 controller 独占 durable transition，cc-sdd 只提出/执行候选，checkbox 为单向状态投影，claim 覆盖实际 dispatch。该接口仍是“拟议、未实现”，标注诚实。 |
| 七类 cc-sdd patch 被低估 | 已处置 | 裁决 `:68-88` 明说尚未证明 patch 很小；`P0:158` 要求记录实际范围、升级冲突和各端差异，并列出第二完成权威、默认放宽权限、隐式 Git 写等硬淘汰条件。 |
| 现有 controller 因沉没成本被默认保留 | 已处置 | 裁决 `:104-110` 变为候选保留并重新验证，明确可安全复用上游实现时可退役，且本研究不删除代码。 |

本轮未发现处置文本重新引入“跨三端已验证”“custom step exact-once”或“P0 fixture 已通过”的暗示。残余不确定性仍是实质性的：状态单写协议、P0 对照、三端真实能力和稳定发行版选择都尚未发生；在其完成前，结论只能是研究建议与明确的淘汰门槛。
