# 门槛与修复

按项目配置和当前树运行相关 gate；记录命令、退出码、环境与证据。Gate failure never authorizes test deletion, assertion weakening, threshold lowering, or hidden failures. 也不授权扩大范围。

Repair continues until the independent review passes or stalls with no new evidence. 同一条审查意见（相同 findingsHash）在一次修补后仍出现，记为卡住并 blocked，问人。不要按尝试次数封顶。不要重放可能非幂等的未知运行。

C2 enforcement applies to the supported routed controller path. 该路径以持久化事件判断「有无新进展」；接受失败回执不等于完成任务。按实际状态字段行动，不手工改 ledger。

没有 C2 能力的旧控制器仍只有上述 Skill 约定，不能声称已强制执行修复次数。Standard/Full 的可执行路径仍须满足其设计和独立审查条件。副作用未知时必须先协调/reconcile，不能当作普通失败重试。
