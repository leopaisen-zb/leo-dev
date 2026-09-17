---
date: 2026-09-08
status: source-audit-complete; architecture-candidate-not-implemented
scope: source-level technical selection; not implementation authorization
method: deep-market-research / technical selection, adapted to executable source audit
---

# 上游源码审计：统一开发工具的复用边界

本次回答：已有成熟仓库的实际机制是什么，leo-dev 应直接复用什么、保留什么、停止重造什么。旧报告保留为历史，不把这次新增证据追记成过去已完成的调研。

## 先读结论

建议优先试验 cc-sdd 的受控衍生流程、按需 BMAD 工程资源及项目证据/门禁内核，但**不把它宣布为已验证最优架构**。独立审查要求在定版前，与 Spec Kit custom-step 路线用同一 fixture 对照；特别检验任务状态单写者、未知副作用和三端差异。详见 [裁决与下一阶段计划](decision.md)。

本轮锁定并追踪了 8 个公开仓库的关键执行链，完成多组隔离测试/探针，未逐行读遍全部仓库，也没有运行三个真实客户端或真实训练/Agent 项目。

独立适配性审查还定位了现有产品的关键缺口：claim 后的真实实现修改没有独立 candidate 交接，失败审查未接入 remediation，依赖和完成仍是单任务 Lite 路径。它们解释了为什么“底层测试通过”不能说明大任务已可用。下一阶段必须围绕这些缺口完成同一三任务切片，而不是继续扩大抽象内核。

| 上游样本 | 源码中真正存在的机制 | 对本需求的主要复用边界 |
|---|---|---|
| Superpowers 6.3.0 | 技能流程、连续任务 ledger、workspace/brief/review 辅助脚本 | 精选纪律与审查资源；不原样接入另一总调度 |
| BMAD 6.13.0-next | spec/架构/审查等具体技能与 customization，项目脚本 | 按需工程深度；避免第二规范单写者 |
| BMAD Loop 0.11.1 | Python 状态机、验证、session/review/recovery | 有价值的运行时候选；clean-tree/commit/平台假设需处理 |
| cc-sdd 3.0.2 | 模板安装器；宿主驱动的规格→任务→实现/审查/debug循环 | 优先受控衍生候选；不是后台守护进程 |
| ECC 2.2.1 | 模块化安装、JS会话/看板、ECC2 Rust supervisor | 按需内容/安装/观测；会话状态不能当任务验收 |
| Spec Kit 1.0.5.dev0 | Python workflow engine、custom steps、overlay、持久状态 | 应参与固定对照；resume不天然解决未知副作用 |
| OpenSpec 1.12.0 | 工件 DAG、schema、status/validate/apply 指令 | 引用已有项目规范；工件完成不等于实现验收 |
| GSD 1.50.0-canary.0 | 查询层、宿主工作流、真实 SDK phase/milestone runner | SDK执行路径绑定Claude；不能直接宣称三端同语义 |

此表是锁定样本，不是稳定发行版推荐。版本/完整 SHA 见 [sources.json](sources.json)；官方同仓资料为 Single-source，不虚构独立交叉来源。

## 交付索引

- [架构裁决、输入输出、复用清单与下一步](decision.md)
- [BMAD / BMAD Loop 源码与配置接缝](bmad.md)
- [cc-sdd / GSD 源码与受控衍生反证](kiro-gsd.md)
- [ECC 的安装、会话与运行层](ecc.md)
- [Superpowers / Spec Kit / OpenSpec 源码与探针](superpowers-speckit-openspec.md)
- [实际测试、环境失败、S1–S6 覆盖与未运行项](validation.md)
- [独立事实/机制反方审查及处置](independent-source-review.md)
- [独立需求/选型审查](independent-fit-review.md)

研究使用 deep-market-research 的证据/矛盾/反方审查规则与 web-access 的公开静态渠道；因是源码技术选型，没有为凑模板添加市场规模、论文、社媒口碑或星数打分。系统调试用于区分探针配置和工具启动问题与上游机制缺陷。最终核验按 verification-before-completion 重新检查探针、引用与核心文件哈希。未运行任何浏览器预检配置生成/后台代理，也未改真实客户端。

## 已确认的需求，不重复访谈

- 一个 develop 入口、一个自己维护的 GitHub 源，跨 Claude Code / Cursor Agent / Codex。
- 完整工程生命周期，架构与代码稳健、控制技术债优先。
- 依赖感知的大任务持续执行、独立审查、有限修复、自我调整、可恢复；重大决策才询问用户。
- 全栈、算法训练、Agent 开发按领域验收。
- 复用上游，避免重复工作流、重复规格及维护负担；统一入口不等于内部全部自研。
- 不自动提交、推送、部署、修改权限、使用付费服务或破坏现有改动。

## 研究边界

锁定公开源码：Superpowers、BMAD-METHOD、BMAD Loop、cc-sdd、ECC（原 Everything Claude Code）、Spec Kit、OpenSpec、GSD。BMAD Loop 和 GSD 用于检验自主大任务替代路径，不因此扩张产品功能。

只修改本研究目录和研究验证附件；不改控制器、规格审批记录、已安装插件或客户端配置。源码保存在 `/private/tmp/leo-dev-source-audit.5I999C`，临时目录不是交付位置。

## 统一场景与证据尺度

| 场景 | 验证重点 |
|---|---|
| S1 已批准需求进入已有脏工作树 | 复用规格、保护改动、职责与契约约束 |
| S2 三项依赖任务 A→B→C | 下一任务选择、实现与审查隔离、失败不解锁 |
| S3 中断后恢复 | 持久化什么；仅可再读文档，还是可防止重复副作用 |
| S4 审查两次失败 / 测试持续失败 | 根因调试、修复预算、真实阻塞、不降低验收 |
| S5 契约/架构漂移与技术债 | 机器门禁 vs 评审判断；局部修复 vs 新授权 |
| S6 三端与三领域 | 原生可加载 vs 文本适配；软件测试 vs 训练/Agent eval |

证据轴分开：`documented` 文档承诺；`source-traced` 入口/实现/测试链；`locally-reproduced` 隔离测试或探针；`real-client-e2e` 真实客户端端到端。后者未执行时不可被前三者替代。

来源轴：官方仓库是 Tier 1，但同仓 README、源码、测试不是独立出版方，仓库事实标 Single-source；实验结果标本地观察。选型建议是基于这些证据的判断，不冒充跨源 Confirmed 结论。版本只描述锁定的观察样本，不承诺永久最新。

## 交付

- 固定提交清单与可定位的源码证据。
- 分组源码追踪报告、真实执行命令和限制。
- 统一比较、旧结论纠正、保留/复用/缩减/替换清单。
- 独立反方审查与解决记录。
- 后续可验收的迁移决策建议；未经确认不进行架构替换。
