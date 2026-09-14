# 能力衔接

优先从当前会话的技能目录读取实际路径。安装插件不等于当前任务已重新加载技能；缺失时先查 `codex plugin list --json`，必要时让用户开新任务，不重复安装已有副本。本插件携带选定的 cc-sdd / Spec Kit 原始方法资源与许可，不打包其工作流引擎，不自动安装外部依赖。

| 阶段 | 来源 | 衔接规则 |
| --- | --- | --- |
| 澄清和规格 | 已有 grill-me、to-spec | 仅实质/模糊且缺已批准规格时按 `grill-me → to-spec`；一次只问一个实质问题，已确认即复用，不再跑第二轮 brainstorming |
| 需求/设计/任务收敛 | 包内固定 cc-sdd 原始资源 | 按 [upstream-methods](upstream-methods.md) 绑定已有工件；不自动批准或启动 kiro-impl |
| 宪法/跨工件分析 | 包内固定 Spec Kit analyze | 同一绑定文件中的只读路径；分析不是批准，不运行 hooks |
| 实施计划 | Superpowers writing-plans | 仅补仍缺的小步和验证命令；已有 cc-sdd/项目计划充分时省略重复方法，不重复产品决策，不自动 commit |
| 实施 | Superpowers TDD、systematic-debugging | 优先既有测试接缝；配置/文档改动用相应校验，不伪造“红灯” |
| 审查 | Superpowers requesting-code-review、receiving-code-review | 允许时对 diff 独立审查；脏工作区不要仅比较两个 commit 而忽略未提交改动 |
| 交付 | Superpowers verification-before-completion | 当轮真实验证结果；finishing-a-development-branch 的 push/merge/删除不是默认授权 |
| 界面 | 已有 ui-ux-pro-max:ui-styling 或 frontend-design 等匹配技能 | 每阶段选最适合的能力，不因已安装而全量加载；保留产品已有设计系统 |
| 网页交互 | 已有 playwright Skill | 独立命名会话，快照后操作，断言结果，截图/trace 取证；不关闭用户会话 |

包内原始来源以 [upstream/provenance.json](upstream/provenance.json) 为准，不依赖开发者 checkout。Superpowers 是外部依赖，按当前技能目录解析；开发者源码 checkout 曾固定 v6.3.0，不代表接收方已安装该版本。缺失则如实报告，不虚构已加载。开发者仓库中的 doctor 是只读路径检查，不属于这里承诺的包内业务验证命令。

若插件技能在本会话不可用但本地上游源码已存在，可以明确报告使用本地 Skill 文件的兼容路径，并完整读取所需 SKILL.md 及必需引用。不要虚构 `$superpowers:...` 已被工具执行；Codex 通过读取技能指令后使用实际工具完成工作。

Load Superpowers methods explicitly and selectively. 读取上游时要明确说明并完整读取当前阶段需要的 Superpowers Skill；不复制其内容，也不假装未加载的方法已经运行。Do not inherit automatic worktree, commit, push, merge, hooks, telemetry, model, permission, or MCP changes. 优先应用用户已选择的边界：小任务不走完整流水线；设计已确认不重问；不要照抄上游关于模型和工具可用性的配置建议。使用当前平台实际工具定义。

不默认接入 Context7。它的外部服务与数据出站要单独确认；公开官方文档查询已能满足多数场景。不要同时引入 GSD/OpenSpec 作为第二套主流程。
