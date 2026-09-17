# C3.3 — 到期待审恢复与原现场接续验收

日期：2026-09-11（北京时间；原始操作时间保留 UTC）。状态：原现场通过，[最终独立证据复审通过](live-independent-review.md)。不是完整 C3 / v1 或已安装客户端交付。

## 本次结果

原现场 `/private/tmp/leo-dev-codex-live.Kp2bmq` 没有替换或重置。原 A 的到期待审阻塞已通过正式公开命令修复，随后实际 Codex 成员完成了 B 的拒绝/修复和 C 的新上下文接续。最终三个任务均 `done`，Change 为 `integration-review`，没有活动租约、running 或 unknown Run；B 的一次失败仍计入预算。没有发布、部署或升级安装缓存。

| 原现场步骤 | 实际观察 |
| --- | --- |
| A 恢复 | `resume --task a --recover-review` 产生一个审查恢复 epoch；原 Run、lease generation/expiry、候选、Gate、submit 全部保留，没有重跑 A Gate 或重写 A |
| A 独立审查 | 新 Terra/high 线程重新检查完整契约、固定测试及边界，真实 pass 回执被 controller 接纳，才解锁 B |
| B 初始实现 | 真实 Terra/medium writer 完成代码；协调者随后按预先协议单独注入数量 coercion 缺陷，不能归咎于原 writer |
| B 拒绝/修复 | 固定公共 Gate 通过，但不知注入细节的独立 reviewer 找到字符串/布尔值等反例并 reject；C 保持 pending，领取被拒绝，预算计数 1；新 Run 的一行修复通过定向复审后才解锁 C |
| C 上下文接续 | 不同 writer 实现 C 后停止；真正新建的只读上下文核对现存代码和 Run；协调者以同一 Run/lease 完成 Gate 和 submit，没有再生成代码或再领取 |
| 最终验收 | C 独立 pass 被接纳；固定 6 个应用测试与预先固定的 evaluator oracle 全部通过；原不可变输入、原 A 证据和 Git 状态保持 |

最终状态：[lifecycle](final-status.json)、[team](final-team-status.json)。团队 revision 14：真实 coordinator、writer、reviewer、continuation 绑定；writer 由 generation 1 计划性移交至 generation 2；4 条消息均有实际正文接收证据。团队通信与回执发行者仍是 `host-reported` / `agent-asserted`，不是身份认证，也不代替 controller 的完成判定。

## 源码变更与职责

新增公开 `resume --task <id> --recover-review [--dry-run]`，只恢复具有完整成功 Gate/候选/提交证据的到期待审任务。严格绑定新 recoveryId，拒绝旧 epoch 回执、漂移、未知结果及未提交的伪造恢复历史；普通 resume 不隐式续租。重复/并发请求和支持的中断批次收敛到同一记录。仅 reconciliation 声明成功、没有成功 Gate 的提交不在本次支持范围。

生产变更集中在 `packages/cli/src/controller/controller.ts`、`commands/resume.ts`、`controller/types.ts`、`schemas/review.schema.json` 及两份流程引用文档。没有新增执行引擎、依赖、daemon 或第二份完成账本，没有重写 GateRunner / lease 状态引擎。测试扩展了独立 recovery matrix，并在既有 candidate 测试中新增一个 refusal case。

[独立源码审查](independent-review.md)接受该 bounded seam，无 confirmed production finding。controller 源 SHA-256 `d97718d30ce4517195aeadaa3fcf14c4bbaa1c3d10cb00408d19e333cfe30d81`；源码编译件与实际构建包的 controller SHA 均为 `107e2078d4a57be10aa3babde98f82b943da857270cf8b6b47f2696c6fd664fb`。

## 测试证据与失败保留

| 检查 | 结果 / 范围 |
| --- | --- |
| build + typecheck | 通过，见 [最终主线程原始记录](cli-regression.json) |
| Recovery matrix | 13/13，336.92s，[完整最终输出](test-matrix-vitest-raw-output.txt)；含真实过期、并发恢复/回执、不同候选 epoch、漂移、故障点、unknown/released lease |
| Reconciliation-only refusal | 新增独立选择运行 1 pass / 10 filtered skips；随后完整 candidate 文件 11/11 通过，[首次原始记录](reconciled-submission-test.json) |
| 其余完整 CLI | 8 文件 151/151，839.88s；仅排除已单独完整验证的 recovery matrix，[原始记录](cli-regression.json) |
| 分发/运行包回归 | 13/13，exit 0，与上述 CLI 同一串行主命令；篡改、路径/符号链接、运行依赖与搬移检查均在内 |
| Shared core / Gate / schema / Skill | 初次 166 pass、1 次既有 tree-race 用例超出未修改的 5000ms；[原失败](core-regression-initial.json)。未改源码/测试/阈值，原 tree 文件重跑 7/7，[原复跑](tree-hash-rerun.json)。不得称该初次组合运行全绿 |
| Python 历史兼容 | 19 通过，[记录](python-regression.json)；不是本次 live 或安装验收 |
| 新构建包 | 四适配包校验、Codex manifest/Skill 官方验证通过；[包校验](package-verification.json)、[实际 help](packaged-smoke.json)、[当前源码再核对](package-source-recheck.json) |
| 原应用全链路 | 固定 6/6 + 固定 oracle PASS，[原始命令和输出](final-application-tests.json) |

以上是明确分组及重跑记录，不是单次全仓零失败声明，也不叠加重复选择运行来制造测试总数。早期有效 RED、无效前置尝试、测试作者修正和中间 typecheck 错误保留于 [RED](red-evidence.json)、[实现交接](implementation-report.md)、[matrix](test-matrix-report.md)、[中间诊断](intermediate-typecheck.json)。

实际现场还纠正了两类非生产缺陷：

- 协调者预期 C 领取拒绝码为 `BLOCKED`，实际正确返回 `TRANSITION_FORBIDDEN` / exit 3；原输出保留，没有改产品或验收来迎合断言。[说明](coordinator-probe-note.md)
- 新接续 Agent 把本地日历日期与 UTC 日期混比，误报 C lease 过期。协调者用实际 UTC 时间和 public dry-run 反证，成员随后自行计算 remainingMs=225399、expired=false 并撤回推断。保留[原误判](c-continuation.md)与[纠正](c-continuation-correction.md)。C 最终仍用原 Run 在原有效期内通过，不把这个过程宣传为不需要协调者判断的全自主成功。

## 可核查证据链

- [冻结现场协议](live-protocol.md)及[无预设 verdict 的 reviewer brief](live-reviewer-brief.md)。最初 C2 失败记录继续保留于 `verification/codex-execution/live-20260910/`。
- [本次现场主线程 controller CLI 操作索引](live-operations-index.json)：共 55 条，最初 12 条在 `live-operations.json`，后续逐条保存原始 tool 输出。它只是取证索引，不是第二个状态机。
- [A 恢复前后证据](a-recovery-preservation.json)、[新 A 审查](a-fresh-review.md)及对应 commands/receipt；[B writer 原字节](b-writer-source.json)和[协调者注入字节](b-injected-source.json)分别保留。
- [B 初审](b-initial-review.md)、[实际修复](b-remediation.md)、[B 复审](b-rereview.md)、[C 实现](c-implementation.md)、[C 新上下文核对](c-continuation.md)及更正、[C 独立审查](c-review.md)。各 review 的完整 probe 与原始输出在同名 `-commands.json`。
- [最终不可变性检查](final-preservation.json)包含可重跑的精确只读命令：原 journal 字节前缀完整、原 A 四个 Gate event hash 相同、7 个不可变输入/原 A 源/Git/历史 approval 保持；claims 为 A1/B1/B2/C1，4 candidates、4 Gate terminal，review 顺序 A-pass/B-reject/B-pass/C-pass，只有 A 的一个 recovery epoch。

## 运行位置与适用边界

源码：`/Users/leo/plugins/leo-dev`。此次实际使用的独立 Codex 包：`/private/tmp/leo-dev-c33-delivery.NPQxMO/codex/leo-dev`；其 CLI 位于 `runtime/packages/cli/dist/index.js`。完整版本/哈希见 [runtime-selection.json](runtime-selection.json)。控制器始终使用原 Node22 绝对路径，Gate registry 的 Node25 路径未修改。没有修改系统 Node、模型、权限或 MCP 默认值。

实际路由：生产绑定初稿 worker 为 Sol/high，recovery matrix worker 为 Terra/high，最终接线与集成由主线程完成；源码及最终证据审查由不同于实现者的 Sol/xhigh reviewer 执行；应用 B/C writer 为两个独立 Terra/medium 线程，candidate reviewer 为非实现者 Terra/high，C continuation 为新建 Terra/medium。源审查、应用审查与实现责任分离。没有可用 token/费用计数，因此不编造节省幅度。

本次只证明这一个本地、宿主协调的 Lite 依赖链和 submitted-review 恢复。不是客户端/OS 真崩溃、长期无人值守可靠性、身份认证、Node20/Linux 实机、安装后自动发现、Claude/Cursor 实际加载、全栈/训练/Agent 域质量或 release-ready。安装缓存仍为旧版本，源码与构建包不可混称已安装。

下一阶段仍是原计划 C3.4：宪法版本治理、需求/设计/契约连续收敛、组合任务治理和影响传播，再做完整工程纵切。C3.5 领域与安装/分发验收仍开放；不能因本次 A→B→C 走通而缩减这些用户需求。
