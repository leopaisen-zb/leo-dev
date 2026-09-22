# 宿主子代理

实现者和审查者必须分开。插件不自建会话调度。

在 Grok Build 用 `spawn_subagent` 拉独立子代理。子代理的 session id 写入审查 receipt 的 `sessionId`。在 Codex 用该宿主的 agent/thread/成员工具拉独立会话；在 Claude Code 用 Task 类子代理。实现者的 session id 写入 `leo-dev claim --session`。审查 session 不得等于实现者 claim session。

同一窗口换角色不算独立审查。宿主没有子代理时停下来问人，或请人新开会话做 `human-confirmed` 审查。不要为了独立审查去安装其他工作流插件。
