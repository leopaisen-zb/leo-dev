---
name: develop
description: 个人跨项目软件开发入口。用于开发功能、实现方案、继续已批准任务或明确调用 $develop；覆盖规格、计划、实现、验证、独立审查与证据交付。不要因纯问答或只读查看而启动完整流程。
---

# Develop

`develop` is the only public development entry. 不另建第二套工作流或真源。

## 分流与开始

1. 先读适用的 AGENTS.md、任务上下文、工作区与已有规格，保留脏工作区归属。
2. Direct answers and read-only review/diagnosis bypass durable change state. 即使显式 `$develop`，也不创建规格、任务或生命周期状态。
3. Any product-code or behavior change enters the full cycle. 不再对微小明确编辑走轻量旁路。
4. 对其他工作先检查 controller/current state 和已有合格规格；reuse it without a second interview or competing specification.
5. 目标和范围在本会话对齐且用户说「开工」后，运行 `leo-dev start --change <id> --goal <text>`，写入规格与计划并继续（开工授权）。不必等用户再批规格文件。目标变了才停下来问。ask exactly one highest-leverage material question at a time。
6. Do not read every reference before starting. 只在当前缺口需要时再读下面链接。

## 完整循环

规格 → 计划 → 实现 → 独立审查 → 完成证据。

- 用宿主现成子代理拉起实现者和审查者；见 [host-subagents.md](references/host-subagents.md)。
- 需要命令对照时读 [lifecycle.md](references/lifecycle.md)。
- 需要门槛时读 [gates.md](references/gates.md)。阶段内自己选实现和调试做法；不强制 TDD、worktree 或品牌 skill 名。
- 需要审查规则时读 [review-protocol.md](references/review-protocol.md)。
- 需要授权边界时读 [autonomous-execution.md](references/autonomous-execution.md)。
- 需要交付用语时读 [delivery.md](references/delivery.md)。
- 只在上级指令允许且工作可独立时使用子代理；重叠修改串行进行。

## 自主边界与交付

- 独立审查通过且证据绑当前树之后允许本地 git commit；不准 push。push 仍要用户点名。
- 只基于本轮 current evidence 报告通过、失败、未执行、阻塞或不适用。`integration-review` is not release-ready.
