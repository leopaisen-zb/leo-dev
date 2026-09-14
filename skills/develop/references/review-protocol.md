# 审查协议

Review specification compliance before code quality. 先审范围、已批准规格、契约、门槛与证据；再审兼容性和回归。

## 输入与判定

协调者提供绑定规格/适用宪法与项目事实、任务范围、候选/完整 diff、验证命令与结果、producer/资源消费报告，以及明确缺失的输入。允许 reviewer 按具体问题读取被引用的证据；不能只给片段又要求判断整个包。工作区未提交改动属于候选，不能用空 commit diff 代替。

- **实际违反**：引用需求/规则与候选位置，说明可复现冲突或必需行为缺口；按影响确定严重度与阻塞，不因作者解释而免检。
- **证据不足**：列缺少的具体路径/结果，向协调者补取；无法验证必要条件就保持未验证，不把“未提供/未获准读取”直接判作“没有实现”，也不默认通过。
- **可选改进**：说明收益与成本，单独列出；不能升级成未获批准的新验收条件。

双向比较契约：既查放松要求，也查无依据加严。例：已批准成功输出允许 JSON 内部空白，只要求字段/值和单行时，用解析结果与行约束验证；不能另要求字节序列、键顺序固定。反之，原契约要求精确字节的输出仍须精确验证。跨文件已覆盖的义务不必在每个工件重复；内容覆盖必须实际核对。

审查返回 missing / partial / contradicts / unrequested 的具体项及证据，不为填满表格强造问题。草案或实现缺陷在原范围内修复；意图/架构/验收变更交回用户决定并重验相关产物。方法报告缺失先补证据，不制造失败后要求作者改正确的代码。

Lite allows clearly labelled self-review; actual independent review must be labelled accurately. Standard/Full requires a distinct platform session from the recorded implementer or a human receipt; a missing implementer session cannot prove platform independence. Full also requires current, candidate-bound architecture, security, and NFR assessments with their own IDs, provenance, findings hashes, timestamps, and expiry. Otherwise remain review-required. 不能把同一上下文的角色扮演称为独立审查，也不能把真实的独立审查误记为自审。Manager retains final-response ownership.

通过或拒绝都按当前 reviewContext 绑定 task、revision、generation、Run 和候选哈希，保留实际 findings。`REVIEW_REJECTED` 表示失败已记录并进入修复/阻塞，不是成功交付。被策略拒绝的 receipt 不消耗修复次数。本地 receipt 的 provenance/session 字段是未经认证的声明；独立性以实际会话或人类证据为依据。

已通过[待审接续](lifecycle.md)恢复时，回执还须携带当前 recoveryId，时间不能早于该恢复记录；先重新核对当前候选再签发本地审查声明。未恢复的回执不带此字段。接续 ID 不授予写代码权限，也不改变原 Run/租约代次；不能把旧的未接续回执当成当前审查。诊断用 reviewRecovery 不属于回执字段。

审查通过不替代 release evidence，也不消除未执行或 blocked 的验收项。
