# Production adoption — 2026-09-11

本轮范围是现有计划的 P1（上游原文资源与审查绑定）和 P2（整份任务计划的治理准入），不是完整 v1。源码实现、独立代码审查与最终完整回归已完成：`npm test` 358 项通过，另有 6 项 Python 测试通过。新代理方法消费样本仍只计为部分通过；P3 的 Spec/宪法版本收敛尚未实现。

## 实际交付

源码：`/Users/leo/plugins/leo-dev`。隔离构建：`/private/tmp/leo-dev-production-delivery.IAbsP6`。本机安装缓存没有更新，也没有提交、推送或发布。

- **P1：从概念借鉴进入原文复用。** 单一 `develop` 入口按需读取包内 cc-sdd 需求、设计、任务方法及 Spec Kit analyze；17 个原文/引用/许可文件有固定来源、版本与哈希。没有安装几个完整插件、启用其 hooks 或添加第二个编排引擎。
- **P1：明确宿主绑定。** 方法使用现有 Spec、设计、任务、宪法和批准记录；上游模板不能另建事实来源、自动批准、宣布完成或擅自增减验收要求。审查须区分已证明违约、证据不可取得、可选建议。
- **P2：治理判断覆盖完整依赖计划。** `route --plan <path> --dry-run` 返回当前变更/Spec/代码树与 `plan:<规范化任务数组的指纹>`。调用方提交匹配的 assessment 后，沿用原有准入、历史、原子提交与恢复逻辑。单任务判断不能冒充整份计划覆盖；更换计划也不能清除历史阻断义务。

当前组合关系是：上游资源提供方法，Codex 主协调者选择并组织工作，已有 journal/Gate/controller 保留唯一执行和证据权威。原有 BMAD 团队协议适配与 Codex team 支持没有被替换；Superpowers 仍按需外部调用。本轮不声称接入了这些项目的完整工作流引擎，也不声称 controller 不含自研代码。

入口/绑定：[SKILL.md](../../skills/develop/SKILL.md)、[upstream-methods.md](../../skills/develop/references/upstream-methods.md)、[review-protocol.md](../../skills/develop/references/review-protocol.md)。来源：[provenance.json](../../skills/develop/references/upstream/provenance.json)。运行接口：[lifecycle.md](../../skills/develop/references/lifecycle.md)。本轮源码范围内共 32 项新增/修改、没有删除文件，逐文件前后哈希见 [source-inventory](source-inventory-final.json)；该清单明确不含文档、验证报告和生成的构建目录。

## 验证与失败记录

本机检查环境为 macOS/arm64、Node v25.8.2；不是 Linux 实机或最低支持 Node 版本的验收。[独立交付表述审查](handoff-review.md)没有发现阻断性夸大，但审查发生在完整回归完成前，最终测试结论由主线程核对原始结果。

| 检查 | 当前结果与范围 |
| --- | --- |
| P2 聚焦公开 CLI 测试 | 19/19 通过；整份计划绑定、拒绝、历史与原子恢复等案例，见 [governance-report](governance-report.md) |
| P2 独立审查 | 无 Critical/Important；要求的主线程完整回归现已通过，两项非阻断覆盖/错误优先级提醒保留，见 [review](governance-review.md) |
| P1 独立审查及修复 | 初审发现真实的 JSON 排序过约束，修复后限定复审通过；不是把初审写成通过，见 [initial](package-review-initial.md)、[final](package-review-final.md) |
| 首次 `npm test` | 失败：161 核心与 17 adapter 通过，CLI/skill 173/179 通过，6 项超时；[原始结果](full-test-initial.json) |
| 六项超时定位 | 相同测试/断言/超时预算，文件级串行执行 6 通过、56 项筛选跳过；[原始结果](timeout-diagnostic.json) |
| 最终 `npm test` | **358/358 通过、退出码 0**：161 核心 + 18 adapter + 179 CLI/skill；[完整原始结果](full-test-final.json)。仅调整 CLI 测试文件调度为串行，不提高超时、不降低断言、不移除测试内部并发 |
| TypeScript 类型检查 | `npm run typecheck` 通过 |
| Python 当前测试发现 | `python3 -m unittest discover -s tests -v`，6 项通过；不是复用历史 19 项数字 |
| 隔离构建与包校验 | 四个目标包 verify 通过，完整回归后[最终核对](delivery-verify-final.json)退出码 0；Codex 包含可迁移 runtime，其余保持薄包；本机安装未验收 |
| Skill 与 Codex 插件清单校验 | 通过；原环境缺 PyYAML，命令级复用已有缓存，没有安装依赖或改全局环境 |
| 新代理资源消费 | **部分通过**，见下一节；不等于模型行为、性能或安装端全面通过 |

P1 初审发现来源清单按 JSON 文本比较，错误拒绝只改变属性/资源列表顺序的等价清单。实际 RED 后改为按唯一 `packagedPath` 比较固定字段集合与固定值；仍拒绝重复、缺失、未知路径、哈希改变、路径越界与符号链接。修复记录及 5 项聚焦 GREEN 在 [package-report](package-report.md)。

三份上游入口文件仅在包内改名为 `RESOURCE.md`，保留原始 `sourcePath` 和内容哈希；每个包递归检查恰好一个 `SKILL.md` 入口。不依赖未经证实的客户端嵌套发现行为。其余内容保持原文，唯一已有的末尾换行转换如实记在来源清单。

六项初次超时与同断言串行通过支持文件级资源争用的判断，但不证明所有超时都一定由负载造成。完整配置重跑才是本轮回归结论；初次失败永久保留。测试调度变更也经过不同于实现者的独立审查。

## 代理消费：保留不理想结果

冻结协议见 [consumer-protocol](consumer-protocol.md)，初始回答见 [consumer-initial](consumer-initial.md)，纠正与裁决见 [consumer-addendum](consumer-addendum.md)。

新代理能从中间构建包找到原版方法，保留规范身份，识别擅自加严 JSON 成功格式的问题，并区分必要验证与可选重复测试。但它还增加了冻结协议不要求的就绪条件，一度误称包内没有可执行 controller；后者经同一代理核查后撤回。报告也缺少完整逐文件消费路径/版本。因此整体只计为部分通过，不改测试样本来制造通过。

该代理读的是包内入口改名和最终生命周期文档更新前的中间版本；最终包的路径、哈希与链接检查由机械测试和独立审查完成，不能反向声称新代理已验收最终包。前测已经正确识别同一个 JSON 契约问题，故没有推理提升证据。本轮没有统计意义上的 GPT-5.6 性能结论。

## 保留与剩余边界

旧现场、历史批准和安装缓存的 63 项冻结文件哈希，以及旧试验 24 项仓库输入哈希，已核对未变，见 [逐文件核验](preservation-final.json)。旧 N/S/C 试片与失败记录不重跑、不覆盖。源码原本全未跟踪且无 HEAD，变更审查使用明确的本轮前快照和文件差异，不伪称 Git 提交差异。

P3 源码调查见 [spec-revision-seams](spec-revision-seams.md)：初始化 Spec 身份、批准、候选、任务终态与恢复证据目前没有统一的活动版本切换机制；也没有足以证明“哪些任务未受影响”的需求到任务绑定图。不能通过刷新旧哈希、清空状态或换一份批准来冒充收敛。

建议首版采用保守边界：修订获得批准后，保留历史，但旧任务的通过证据不得自动带到新版本，全部重新验证；这不等于删除或强制重写已有代码。是否接受该边界，或本版必须新增权威作用域以选择性重验，尚待用户决定。决定后仍须在唯一计划中冻结版本/任务/证据接口及 RED 案例，再进入实现和完整纵切。

尚未完成：P3、完整治理→实现→复盘纵切、训练/Agent 专项案例、安装后新客户端加载、Claude Code/Cursor 实机使用和 GitHub 发布。Standard/Full 支持边界没有因 P2 而放宽。

唯一规范：[spec](../../.scratch/unified-development-plugin/spec.md)。唯一实施计划：[C3.4](../../docs/superpowers/plans/2026-09-04-unified-development-plugin.md)。本页是验证交付记录，不另建规格或调度状态。
