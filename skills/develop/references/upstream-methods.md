# 上游方法：单入口、单真源

这是对原始资源的显式宿主绑定，不是安装上游插件或调用其工作流引擎。按本阶段缺口选择方法，先记录选择/省略的简短原因，再完整读取选中的原文及其必需引用。已批准规格直接复用；没有缺口就不重跑生成步骤。阶段产物和必要门禁不能因方法可选而省略。

## 可用资源

路径均相对本文件；固定来源、原文哈希、打包哈希、唯一换行规范化和 MIT 许可见 [provenance.json](upstream/provenance.json)。原文不可就地修改；以下绑定是单独披露的语义适配。

| 需要解决的缺口 | 原始入口 | 必需资源 |
| --- | --- | --- |
| 需求可测试性、包含/排除边界 | [cc-sdd requirements](upstream/cc-sdd/tools/cc-sdd/templates/agents/codex-skills/skills/kiro-spec-requirements/RESOURCE.md) | rules/ears-format、requirements-review-gate；templates/specs/requirements |
| 既有系统扩展的边界、依赖、复用决策 | [cc-sdd design](upstream/cc-sdd/tools/cc-sdd/templates/agents/codex-skills/skills/kiro-spec-design/RESOURCE.md) | rules/design-principles、design-synthesis、design-review-gate；templates/specs/design、research；扩展另读 design-discovery-light |
| 有序任务、覆盖、交付边界 | [cc-sdd tasks](upstream/cc-sdd/tools/cc-sdd/templates/agents/codex-skills/skills/kiro-spec-tasks/RESOURCE.md) | rules/tasks-generation；templates/specs/tasks；本切片采用 sequential |
| 规格/设计/任务/宪法的一致性 | [Spec Kit analyze](upstream/spec-kit/templates/commands/analyze.md) | 实际 canonical 规格、设计、完整任务草案和适用宪法/项目规则；只读分析 |

表中 rules 和 templates 均为 `.md` 文件，分别从 `upstream/cc-sdd/tools/cc-sdd/templates/shared/settings/rules/` 和 `.../settings/templates/specs/` 读取。三个原始 SKILL.md 仅在包内改名为 RESOURCE.md，字节不变、原名保留在 provenance，避免作为额外技能入口被发现。资源按需加载，不把整套框架常驻上下文。

当前仅带 cc-sdd light/minimal discovery 与 sequential tasks 的引用闭包，未带 full discovery、parallel analysis、kiro-impl/validate-gap 或 Spec Kit 其他命令。需要未包含的方法时明确报告缺项，选实际可用且满足阶段要求的方法，或经授权补齐固定版本资源；不能把 light 称为 full、虚构命令已运行或临时下载 latest。

## Canonical 绑定与差异

开始前在项目已有计划/交接中写一行绑定：`requirements=<真实路径或章节>; design=<路径或章节>; tasks=<路径或章节>; constitution=<适用规则路径>; facts=<项目事实来源>; approval=<真实决定及范围>; language=<项目语言>`。同一文档可绑定多个章节；缺少必要输入时先定位或补草案，不造一个已批准副本。

- `{{KIRO_DIR}}/specs/$1/{requirements,design,tasks,research}.md`、Spec Kit 的 SPEC/PLAN/TASKS，分别绑定现有规格、设计、计划/任务及研究记录；`brief.md` 绑定用户需求与已记录决定。有现成位置就原位引用，不建另一套 `.kiro`、`.specify`、`_bmad` 或可编辑真源。控制器生成的 `tasks.yaml` 不属于可编辑草案；审查后的任务输入经 [lifecycle](lifecycle.md) 公共 route 提交。
- steering `product/tech/structure` 绑定已核对的项目事实、架构及 AGENTS；Spec Kit constitution 绑定现有宪法/适用项目规则，不另写一份替换它们。规则冲突要指出实际条款，遵从宿主指令优先级。宪法修订单独提出影响与决定，不在 analyze 中改规则来消除冲突。
- `spec.json` 的语言/阶段/批准字段绑定已有项目语言、草案记录和真实审批状态；不创建或修改上游 metadata。禁用原文 `-y`、自动批准、生成即批准及重复确认已批准决定的建议。依赖草案可继续探索但必须标明未批准，不执行未批准的实现。文本审查 PASS 不是 controller approval、任务 done 或新的人类授权。
- 保留既有 requirement/task IDs 和可追溯引用，不为上游 numeric/FR 格式改写已批准 ID；已有格式优先，必要时在现有计划附只读一一对照。模板用于补足实质信息，不为章节形式新造需求；EARS 表述不得改变已有语义。数值化不确定指标须有依据，不能猜测阈值。
- 用真实宿主工具替代命令占位符。Spec Kit `{SCRIPT}`/task-command 前置检查替换为实际文件/章节存在、可读、任务草案完整性检查；不声称运行了上游 tasks 命令。不执行原文 before/after hooks、安装器或自动 Git/设置操作，包括仓库已存在的 hooks。记录这项适配。
- cc-sdd 在此用 sequential 任务模式；草案中的隐含顺序在送入现有 task-plan 时转为显式 `dependsOn`，从设计边界得到具体 `allowedPaths`，并引用已有聚合 gate。Markdown 勾选不负责完成状态。不把标准/复杂任务降为 Lite 来绕过尚不支持的控制器路径。
- 原文的独立 sanity review 由协调者交给真实独立会话/人；子代理不自行派生。reviewer 直接读取所需原文和完整项目输入；可合并同一候选的重叠审查职责，但必须记录实际覆盖，不能自审冒充独立。实施、调试仍按已有 Superpowers 选择规则，不重复启动另一套计划流程。
- 上游可选测试、文档排除、固定任务时长/数量和只给建议的 severity 规则，不得覆盖项目已批准验收、必要交付或已授权的局部修复。具体是否阻塞以实际契约、风险与 [review-protocol](review-protocol.md) 为准；不能根据模板加严或放松验收。分析者只读返回 findings，协调者仅在现有权限内安排修复。

## 收敛与交接

每次返回可定位的缺口：`missing / partial / contradicts / unrequested`、对应需求/规则、候选位置、影响及建议。区分实际冲突、证据缺失和可选改进。实现错误回实现/任务；草案错误回草案；意图或实质架构变化回用户决定。保留旧版本、失败和决定，绝不修订 Spec 来使错误代码变正确。

Spec/宪法改变时先列影响到的设计、契约、任务、测试及下游依赖。确认实际 controller 支持 [lifecycle 的 revise](lifecycle.md) 后，以完整新计划、当前评估和专用修订批准激活新版本；所有旧任务重新验证，保留代码与历史，不选择性继承旧成功。旧包缺接口时报告 prerequisite；不能重绑旧审批、编辑初始化哈希或重用旧 Gate。文字影响分析不是已激活修订，上游分析 PASS 也不代替修订批准。

交接复用已有证据/报告，列实际读取的资源路径与固定 revision、宿主绑定、产物位置、可选步骤省略理由、审查结果/未决项和实际验证；同时把 producer/consumption report 交给 reviewer。仅打包存在不是已消费；仅消费方法不是装载上游引擎，更不是可靠性/模型性能提升证明。
