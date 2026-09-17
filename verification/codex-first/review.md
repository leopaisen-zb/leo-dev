# Codex-first C1 独立审查

日期：2026-09-08  
任务：C1.3 独立裁决；仅审查本地实验、基线和单次质量样本，不修改候选实现、生产控制器或已安装插件。

## 裁决

- **规格符合性：APPROVED（限定范围）。** 当前产物可作为 Codex-first 缺口基线、脚本 fixture 与真实 Spec Kit custom-step 的局部对照，且对能力边界的表述基本准确。这不是完整的 cc-sdd `kiro-impl` 对照，也不是用户可见 Codex 验收。
- **修复质量：APPROVED。** `/private/tmp/leo-dev-codex-quality.Kc6t9i` 的修复满足 `requirements.md` 1.1–1.3；没有 API 变更、依赖、持久化或无关扩张。
- **证据充分性：APPROVED 仅用于下一步决策。** 证据足以排除“当前 Spec Kit bridge 直接作为首版持久执行引擎”这一具体方案，但不足以选定生产路线，更不能推导 cc-sdd 已胜出。
- **生产路线选定：REJECTED / NOT ESTABLISHED。** 未运行 cc-sdd 主执行协议，未进行 fresh installed-client E2E，也没有多次或受控 A/B 样本。

本轮没有 Critical 代码或安全发现。下述 Important 项是生产采用/证据外推的阻断项，不是要求在已冻结的 prototype 中扩建通用功能。

## 机械验证

| 检查 | 独立结果 | 含义 |
|---|---|---|
| 实验 Python | PASS；指定的 pinned Spec Kit/Python 命令退出 0，13/13 | 包含预期的负向特征，不等于 13 个产品能力通过 |
| 16 条观测可再生 | PASS；`comparison.collect()` 与 `comparison.json` 完全相等 | 加载源仓提交 `4a7341...b578c`，engine SHA-256 `2113d362...476f2c` |
| CLI 缺口特征 | PASS；build + 3/3 | 证明三个已知缺口仍能复现，不是理想行为通过 |
| TypeScript 类型检查 | PASS；`npm run typecheck`，退出 0 | 现有 TypeScript 边界 |
| 全量 Node/TypeScript 回归 | PASS；`npm test`，161 domain + 8 adapter + 110 Skill/CLI = 279 | 本地回归，不是 Agent E2E |
| 现有 Python 回归 | PASS；6/6 | doctor 单元测试 |
| 修复者测试 | PASS；5/5，`py_compile` 退出 0 | 样本自写回归 |
| evaluator-only oracle | 种子 FAIL（4 中 3 失败）；候选 PASS（4/4） | oracle 能捕获两个原始缺陷，候选修复后通过 |
| 输入/无关文件 | PASS | 候选与归档副本一致；`requirements.md` 与 `unrelated.txt` 分别保持 SHA-256 `3ee2e757...69c0c` 和 `79b85355...5453` |
| 冻结核心 | PASS；`shasum -a 256 -c verification/codex-first/frozen-core.sha256`，12/12 | 持久化的 pre-C1 清单与当前字节相符；它不是签名或全工作树零变更证明 |
| 已安装 `develop` 来源 | PASS | 当前 installed skill SHA-256 `d5ec3281...57266` 与质量样本 metadata 绑定值一致；本轮没有安装/替换操作 |
| 历史批准回执 | PASS | `.scratch/unified-development-plugin/approval.yaml` SHA-256 仍为 `ede9586...433c`，新范围没有回绑旧指纹 |
| cc-sdd 来源快照 | PASS | manifest 中 8 份 resource + MIT `LICENSE` 的 9 个字节哈希均与落盘文件一致 |
| 占位符/密钥/运行时静态检查 | CLEAN / SPOT-CHECKED | 指定变更文件未发现 `TBD/TODO/FIXME/HACK/XXX`、硬编码凭据或新运行时依赖 |
| 边界 | WITHIN | `review-input.patch` 只含实验、特征测试和隔离样本 diff；无 Git HEAD 时未伪造 commit-range 结论 |
| TDD RED | REPORTED, NOT INDEPENDENTLY REPLAYABLE | `verification/codex-first/README.md:39` 记录 8 tests / 17 failing subcases，但 scoped review 输入未保留原始 RED 输出或可重放的 no-op 状态；不影响当前 GREEN 正确性，但不应将该计数写成独立复验事实 |

## 所消费的 cc-sdd 审查资源

本审查实际读取并使用了 `experiments/codex-first/upstream/cc-sdd/kiro-review__SKILL.md.txt` 作为对抗性清单，而不是只将其列入候选。实测 SHA-256 为 `c68435ab6e7051226f235a75b616a47c78dc59ae93732c615ac2d2a2bea9940f`，与 `experiments/codex-first/upstream/cc-sdd/manifest.json:32-35` 一致。

调用适配如下：使用唯一已批准规格 `.scratch/unified-development-plugin/spec.md` 和其 Codex-first amendment，不创建/假定 `spec.json`；以中文输出；将明确允许的 scripted worker/oracle 视为实验 fixture，而非用“必须是生产实现”条款否定它；以供应的真实 patch/新文件取代不存在的 Git HEAD diff；不派生代理、不作 Git 写入。这只证明该 review resource 在本轮被实际复用，不证明 cc-sdd 执行协议已集成。

## Important 发现

1. **Spec Kit bridge 未满足已知已验证候选的跨进程恢复目标。** `experiments/codex-first/speckit_bridge.py:90-103` 忠实调用上游 `resume()`，不会隐式新建 run；当 owner 已把 gate/review 结果原子保存为 `verified`，但进程在 custom step 回传前退出时，上游 run 仍为 `running` 并拒绝 resume。`experiments/codex-first/test_trial.py:113-125` 及 `verification/codex-first/comparison.json:413-429` 保留了该失败。这是对当前 bridge 生产采用的阻断证据，而不是测试失败被隐藏。
2. **两路都通过 fixture 不是 cc-sdd 执行证据。** `experiments/codex-first/trial.py:93-106` 由新写的 deterministic worker 直接生成源码，`experiments/codex-first/trial.py:207-210` 的 `host-seam` 仅调用同一 `advance()`；Spec Kit 路线也只调用这个 owner callback。因此 13/13 与两路大部分观测一致，只能证明 fixture 不变量和 bridge 透传；不能比较 cc-sdd 主循环、修复/审查质量或维护成本。`verification/codex-first/README.md:27-33` 已对此正确降级结论。
3. **`forbidden-write` 只是事后检测，不是用户改动保全证据。** `experiments/codex-first/trial.py:104-106` 先覆盖 `unrelated.txt`，然后才在 `:164-168` 阻断；`experiments/codex-first/test_trial.py:68-78` 验证了“未接受候选/未解锁 C”，没有证明原字节被保全。独立诊断也观测到两条路线都留下 `unauthorized fixture write`。`experiments/codex-first/README.md:41-45` 已准确说明“detected after the effect and is not undone”；后续不得将此 case 计为 D 案用户文件/Git 保全通过。
4. **当前证据不能归因提示词/流程优势或可靠性。** 质量样本是一次 `gpt-5.6-terra` / `medium` Codex child-session，手工读取现有 installed `develop` skill，并非 fresh installed-client E2E。`verification/codex-first/quality-sample/metadata.json:2-18` 明确 `sampleCount: 1`、oracle 未提供给 implementer、成本/时延/重复性未测，且 `causalImprovementClaim: false`。这个案例是有效的单次功能样本，不是 A/B 显著性结论。

## 质量样本独立评估

- `latest_by_id` 在 `/private/tmp/leo-dev-codex-quality.Kc6t9i/app.py:4-8` 以字典替换同 key 的 value；这在保留 key 首次插入顺序的同时返回最后一条 record，不修改输入，也支持要求中的可哈希非字符串 ID。
- `points_for` 在 `:11-18` 先显式排除 `bool`，再检查 `int` 和 1–10 边界；没有字符串/浮点强制转换，错误类型仍为 `ValueError`。
- `test_app.py` 和 evaluator-only `quality_oracle.py:17-40` 覆盖空集、重复/顺序、对象身份/不修改、边界、布尔与非整数拒绝。oracle 对种子的 3 个失败与已知两个根因对应，不是缺依赖导致的伪 RED。
- 候选、测试、report 与 `verification/codex-first/quality-sample/` 归档逐字节一致。系统仅根据现有任务信息能确认“oracle 先写且未向 implementer 暴露”的流程 provenance；行为正确性由当前独立运行确认。

## 案例与 provenance 结果

| 案例 | 结果 | 可推导范围 |
|---|---|---|
| 当前产品 CLI 三个缺口 | 3/3 特征测试通过，期望产品行为仍失败 | 基线已冻结；产品未修复 |
| A→B→C scripted fixture | 两路均能展示 B 首轮 reject、修复、重审、B accept 后才启动 C | owner fixture 逻辑，不是 cc-sdd/Agent 自主行为 |
| 修复预算耗尽 | B 总共 4 attempts（首试 + 2 remediation + 第 4 次标记为 `debug-attempt`）后 blocked，C 未创建 | 符合固定 fixture 的次数预算；该第 4 次仍是脚本尝试，不证明 fresh-context 独立 debugger 被运行 |
| candidate/spec 变化 | fail closed | 只证明本地 hash 绑定；fixture ledger 可写，不是认证证据 |
| 写入后未记录候选的中断 | 两路都 blocked，不盲目重放 | 未实现自动 reconciliation |
| 已记录 verified 后的中断 | host fixture 能单次结算；Spec Kit bridge 因 running 状态拒绝 resume | 真实候选差异；不足以宣称 host 是生产引擎 |
| 单次 Codex 修复 | 自写 5/5 + 独立 oracle 4/4，范围保持 | 单个 Terra/medium 样本；无 A/B 显著性、无 fresh installed-client E2E |

## 必要后续

1. 不要根据本轮宣布 cc-sdd 获选或生产架构已定。本轮最强的选型结论是：当前 Spec Kit bridge 增加 Python/engine/registry 表面后，仍未买到所需的 running-crash 恢复，因此不应直接进入首版。
2. 若用户另行批准生产实现，下一步应只接通已确认的 input→candidate、review reject→bounded remediation 和 dependency unlock 缺口，并用真实 Codex 任务验证恢复。如要继续比较 cc-sdd，需运行受控改造的 `kiro-impl`/implementer/reviewer/debugger 路径，不能用 `host-seam` 代名。
3. 后续如要宣称案 D 的用户文件/Git 保全，需使用真实安全边界或可回收的所有权机制验证；当前事后 hash 检测只能阻止接受。
4. 在指定的用户权限内，未授权的生产控制器、已安装插件、Git/发布/网络操作继续保持冻结。

**一句话结论：** 当前产物是可接受的负责任本地实验和单次修复样本，它支持“不直接采用这个 Spec Kit bridge，继续做最小真实 Codex 接线”的下一步，不支持任何已定生产路线或可靠性声称。
