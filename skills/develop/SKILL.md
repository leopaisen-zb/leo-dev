---
name: develop
description: 个人跨项目软件开发入口。用于开发功能、实现方案、继续已批准任务或明确调用 $develop；覆盖规格/设计/任务收敛、宪法一致性、实现、验证、修复、独立审查与证据交付，适用于普通应用、网页、原生移动端及 AI/RAG。不要因问答、只读审查、纯诊断或微小明确编辑而启动完整流程；显式用于小任务时走轻量路径。
---

# Develop

`develop` is the only public development entry. 不另建 BMAD、SDD、GSD 或 OpenSpec 工作流/真源。

## 分流与开始

1. 先读适用的 AGENTS.md、任务上下文、工作区与已有规格，保留脏工作区归属。
2. Direct answers, read-only review/diagnosis, or truly tiny unambiguous edits bypass durable change state; 即使显式 `$develop`，也只走 lightweight 路径与窄检查，不创建规格、任务或生命周期状态。
3. 对其他工作先检查 controller/current state 和已批准规格；reuse it without a second interview or competing specification.
4. 实质或模糊工作若没有已批准规格，才运行 `grill-me → to-spec`；持久化未决事项，ask exactly one highest-leverage material question at a time。外部 issue 发布另需授权。
5. 读取 [lifecycle.md](references/lifecycle.md)，区分概念阶段和真实 controller commands。需要需求/设计/任务收敛或宪法一致性分析时，读取 [upstream-methods.md](references/upstream-methods.md)，按缺口选择包内 cc-sdd / Spec Kit 原始资源及必需引用；不重复已完成阶段。

## 实施、验收与审查

- 读取 [components.md](references/components.md)，明确且按需加载方法；包内原文只读，外部 Superpowers 不另复制，也不继承自动 worktree、commit、push、hooks、telemetry、model、permission 或 MCP 改动。
- 读取 [gates.md](references/gates.md)。有行为改动时用 TDD；故障用根因调试；不以删测试、改断言或降门槛换取通过。
- 读取 [acceptance.md](references/acceptance.md)，选择与项目和风险相称的验收。
- 读取 [review-protocol.md](references/review-protocol.md)，先审规格符合性再审代码质量；manager 保留最终回复。
- 只在上级指令允许且工作可独立时使用子代理；重叠修改串行进行。
- Codex 中用户要求 team，或已批准工作需要持续角色/交叉审查时，读取 [codex-team.md](references/codex-team.md)，使用真实宿主成员和 journal 交接；普通小任务不启动团队。其他宿主不能照搬 Codex 工具名。

## 自主边界与交付

- 读取 [autonomous-execution.md](references/autonomous-execution.md)。在本地、可逆、已授权范围内连续实现、测试、调试、审查与取证；新权限或实质决策时暂停。
- 读取 [delivery.md](references/delivery.md)。只基于本轮 current evidence 报告通过、失败、未执行、阻塞或不适用；`integration-review` 不等于 release-ready。
