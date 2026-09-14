# 门槛与修复

按项目配置和当前树运行相关 gate；记录命令、退出码、环境与证据。Gate failure never authorizes test deletion, assertion weakening, threshold lowering, or hidden failures. 也不授权扩大范围。

At most two normal remediation attempts are allowed. Exactly one fresh-context root-cause pass follows those attempts. 仍失败、证据过期或副作用未知时，标为 blocked 或 approval-required，先协调再继续；不要重放可能非幂等的未知运行。

C2 enforcement applies to the supported routed controller path. 该路径以持久化事件共享计算 Gate/审查失败：首试、两次 remediation、一次 fresh-context debug，仍失败则 blocked；重复回执不增加预算，接受失败回执不等于完成任务。按实际状态/预算字段行动，不手工改 ledger。debug 的 session 标签只是审计信息，不能冒充平台验证了独立上下文。

没有 C2 能力的旧控制器仍只有上述 Skill 约定，不能声称已强制执行修复次数。Standard/Full 的可执行路径仍须满足其设计和独立审查条件。副作用未知时必须先协调/reconcile，不能当作普通失败重试。
