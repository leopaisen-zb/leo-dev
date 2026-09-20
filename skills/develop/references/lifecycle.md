# 生命周期与控制器边界

Conceptual phases are not literal CLI commands. 对非 bypass 的实质工作，概念顺序是 inspect → route → spec approval → (non-Lite design review) → serial task loop → integration review → release evidence；controller 已支持的阶段以其 committed state、事件和 current-tree evidence 为准，会话清单不能替代它。Artifacts are controller-created and controller-validated outputs, not a command.

Existing change: run `leo-dev inspect --change <id>` or `leo-dev status --change <id>`, then use `leo-dev resume --change <id>` or the next supported command returned by state.

以下示例在目标仓库根目录执行；从其他目录调用时，回执使用已核对的绝对路径，不能假定 `--repo` 会改变所有输入路径的解析基准。

New change: run `leo-dev init --change <id> --spec <path>`, then `leo-dev inspect --change <id>`, then the reviewed `leo-dev route` path. `route` accepts the legacy `--task/--gate` Lite form and a repository task plan. Its committed route retains the maximum actual task risk (`lite`, `standard`, or `full`); a caller must not silently downgrade a Standard/Full plan to use a Lite path.
用户说「开工」后写入规格与计划并继续（开工授权），再走已审查的 `leo-dev route` 路径。不必等用户再批规格文件。

Lite may continue from `spec-approved` to `task-ready`. Standard/Full must enter `design-review`, obtain a current design receipt, then enter `design-approved` before `task-ready`. A current independent `reject` receipt may return only `design-review → spec-approved` in one transition batch; it retains the original specification approval and task revisions. Edit the rejected design only after that return, request a new design review with the repaired bytes, and obtain a fresh independent `pass` before `task-ready`. The same receipt must exactly bind the current change/spec/plan/design/producer context, be current and unused, and provenance/session labels remain unauthenticated audit metadata. 缺 Node、controller 或所需 transition 时如实报告 prerequisite/unsupported，不模拟状态。

`integration-review` 后仍须独立的 release evidence；没有该证据不得称 release-ready。只有一个已完成的最终 `role: integration` task、其 verification-only candidate、成功 Gate/evidence 和独立 Standard+ review 都当前有效时，才可运行：

```sh
leo-dev transition --change <id> --scope change --to release-evidence
leo-dev status --change <id>
```

`RELEASE_EVIDENCE_RECORDED` writes controller release evidence and exposes `state.archiveContext`; it does not deploy. Archive needs the current proof plus repository-contained independent CI receipt and archive manifest:

```sh
leo-dev transition --change <id> --scope change --to archived \
  --receipt <repository-contained-ci-receipt> --archive <repository-contained-manifest>
```

The CI receipt and verifier evidence bind the change, authority, candidate, proof and evidence hashes; the archive manifest binds that proof plus artifact and retrospective hashes. `ARCHIVED` records the archive only. Provenance and actor labels remain audit metadata rather than cryptographic identity.

## 可验证的串行执行

先确认当前 CLI 的 `route --help` 有 `--plan`、`run-gates --help` 有 `--run`、`claim --help` 有 `--session`，再检查实际返回的状态。旧控制器缺这些能力时报告 unsupported，不自行维护一套替代状态。`leo-dev` 指项目已确认的本地控制器入口；未安装全局命令时使用其确认过的 Node 可执行路径，不临时从网络安装同名包。

单任务保留上面的 `--task/--gate` Lite 兼容形式。多任务使用仓库内独立输入文件运行 `leo-dev route --change <id> --plan <path>`，不手改控制器生成的 tasks.yaml，也不重复 route 追加任务。输入是 `schemaVersion: 1` 和 `tasks`：每项有 `id`、`revision: 1`、`state`、`dependsOn`、`allowedPaths`、非空 `acceptance`、一个 `gateIds` 项，以及 `risk: lite|standard|full`。根任务 state 为 ready，其余为 pending；依赖引用唯一任务 ID，每项只使用一个已有的聚合 gate。可选 `role: integration` 最多一个；它必须传递依赖所有其他任务，且不能有后继。没有 integration task 的旧计划仍可执行，但不能生成 release evidence。allowedPaths 优先使用具体仓库相对文件，例如 `src/cart.ts`；需要目录内文件时用 `src/**`，不能把单独的 `src` 当作递归目录授权。当前仅支持路径片段中的 `*` 和独立 `**` 片段，不是完整 glob 引擎。`.` 是兼容的广泛授权，新计划避免使用。

若仍在 triage，沿用真实的 `transition --scope change --to discovery`、`spec-review`、匹配既有授权的 `approve --receipt <path>` 和 `spec-approved`。每步先核对当前状态；approve 回执按当前 `state.approvalContext` 绑定真实已有决定，不能凭本地标签制造人类批准。已进入 executing 的变更不重跑上述步骤。

Lite 接着进入 `task-ready` 和 `executing`。Standard/Full 先使用仓库相对的设计源和实际 producer session：

```sh
leo-dev transition --change <id> --scope change --to design-review \
  --design <repository-relative-design-path> --session <producer-session>
leo-dev status --change <id>
# Read state.designReviewContext; do not reconstruct its hashes by hand.
leo-dev transition --change <id> --scope change --to design-approved --receipt <design-review-receipt>
leo-dev transition --change <id> --scope change --to task-ready
leo-dev transition --change <id> --scope change --to executing
```

The design context binds `changeId`, current `specHash`, normalized plan hash, repository design bytes hash, and producer session. A design receipt has its own ID, provenance, actor/session when applicable, pass verdict, findings hash, timestamp, and expiry, and repeats the bound change/spec/plan/design/producer identities. `platform-attested` must name a session different from the producer; `human-confirmed` is supported; `agent-asserted` is not accepted for non-Lite design approval. Provenance labels are audit metadata, not cryptographic identity. Changed design bytes, stale/expired/reused receipts, or changed spec/plan authority refuse without advancing state. Task-ready and non-Lite claim admission recheck that evidence.

对当前依赖已完成的任务执行：

```sh
leo-dev claim --change <id> --task <task-id> --session <actual-session-id>
# 保存 CLAIMED 响应 state.run.runId，并核对 lease.taskId。
# 按已批准验收修改该任务 allowedPaths 内的代码。
leo-dev run-gates --change <id> --task <task-id> --run <saved-run-id>
# 只有 Gate 通过，才继续：
leo-dev submit --change <id> --task <task-id>
leo-dev status --change <id>
# 按当前 reviewContext 绑定实际审查结果，不复用旧候选回执。
leo-dev review --change <id> --task <task-id> --receipt <review-receipt-path>
```

If the reviewed Gate has `network: approval-required`, first obtain the exact current `state.gateApprovalContext` by dry-run/status and pass its matching existing approval receipt:

```sh
leo-dev run-gates --change <id> --task <task-id> --run <saved-run-id> \
  --approval-receipt <approval-path>
```

Missing, expired, or mismatched approval refuses before candidate registration or Gate argv release. An approval receipt is a scoped decision record; its local provenance fields do not authenticate a person or platform.

Gate 绑定写完后的候选，不能把 claim 输入哈希改成输出哈希；候选注册后再改代码会使证据过期。`REVIEW_REJECTED` 的成功退出仅表示拒绝回执已记录，任务应在 remediation，绝不是审查通过。按控制器剩余预算重新 claim，取得新的 Run/代次再修复、验证和审查；不要编辑任务验收或 ledger 重置次数。debug 尝试必须来自新的实际上下文，并提供不同 session；会话标签不是身份认证。

任务 done 后只继续状态中已 ready 的后继；pending、blocked、approval-required 或 unknown 不能强行执行。换会话后先 inspect/status/resume。若上次代码已写、尚无候选注册，先核对现有文件、原 Run 和实际 lease.expiresAt；租约仍有效才可继续原 Run。过期时先按下文取得新代次，再写代码或运行 Gate。存在未知副作用时走既有 reconciliation，不能靠换一个 session/Run 绕过。

多任务治理准入见下文。先检查实际控制器是否返回 `planAssessmentContext`：旧 C2 版本不支持时报告 unsupported，不能省略已有评估绕过拒绝。未评估计划仍是 `not-assessed`；它不取代 Standard/Full 必需的 design-review/design-approved 证据。

## Gate 前租约到期：保留代码并重新领取

当当前任务仍为 `implementing`、Run 为 `running`，但其租约已到期，且从未注册候选或准备 Gate 时，核对已有改动均属于原任务 allowedPaths。确认 `claim --help` 支持 `--supersede`，用实际新的 producer session 和状态中的原 Run ID：

```sh
leo-dev claim --change <id> --task <task-id> --session <fresh-session-id> \
  --supersede <expired-run-id> --dry-run
leo-dev claim --change <id> --task <task-id> --session <fresh-session-id> \
  --supersede <expired-run-id>
```

成功后读取新 Run/leaseGeneration，再继续实现、Gate 和审查。控制器保留源码、失败预算和当前尝试类型，将原 Run 记为 abandoned 并隔离旧代次；fresh-debug 的新 session 必须不同于该任务所有先前 claim 的 session。旧输出只作诊断，不能充当新尝试的成功证据。普通 claim 不会自动接管过期任务。已有候选、Gate 记录、提交或 unknown 结果时不适用此入口；按实际状态选择已支持的审查恢复或 reconciliation，拒绝后不改日志、租约或时钟。

长任务的非 Lite 设计审查到期时，需要对 `state.designReviewContext` 中同一份设计、规格和计划做一次新的独立审查。`claim --design-review-receipt <new-receipt-path>` 可随合法的普通领取或上述 supersession 原子记录新凭据；使用仓库内的 runtime/evidence 路径保存它。设计源与绑定必须保持一致，并已有获批设计历史。新审查应有真实报告、新 ID 和实际时间；不能修改旧凭据的时间。设计或规格变更仍走原设计/修订流程；无效领取不会消耗新凭据。

若领取在事务准备后中断，`resume` 按记录的准备时间核对当时准入，且要求源码与引用凭据的字节仍完全一致；漂移会阻止恢复。恢复提交后仍须检查实际新租约是否有效，不把事务恢复当作租约续期。

## 待审租约到期：接续审查

当实际状态为 `review-required`、原 Run 已成功、提交候选未变，但实现租约已到期时，先确认当前 `resume --help` 支持 `--recover-review`，再使用同一已确认 Node/CLI 入口：

```sh
leo-dev resume --change <id> --task <task-id> --recover-review --dry-run
leo-dev resume --change <id> --task <task-id> --recover-review
leo-dev status --change <id>
```

恢复只建立审查接续上下文，不重写代码、不重跑 Gate、不延长原租约或消耗一次修复机会。`REVIEW_RECOVERED` / `REVIEW_RECOVERY_REPLAYED` 后仍须审查；读取新的 `reviewContext`（包含 recoveryId），交给实际 reviewer 核对当前候选和证据，生成新审查回执。原 Run、leaseGeneration 和候选哈希保持原值；诊断时间在旁路 `reviewRecovery`，不整块复制进回执。旧 findings 可作为历史材料，但不能仅改旧回执时间/ID来声称发生了新审查。

重复恢复应返回同一标识。普通 `resume` 不自动重新接纳待审候选；执行新命令被拒绝时按实际漂移、未知结果或前置条件处理，不编辑日志/租约绕过。当前接口仅支持可验证的成功 Gate 提交链；历史 reconciliation-derived 等不支持的情况如实报告。已 `done` / `remediation` 的任务按其正常流程推进，不反复恢复。

## 架构 / 技术债准入

需要落实架构/技术债优先政策的变更，在 `init` 后先 `inspect` 或 `status`，读取 `state.assessmentContext` 的 `changeId`、`specHash`、`subjectTreeHash`。已有评估时也读取 `latestAssessmentFingerprint`。旧版 CLI 没有这些字段或 `--assessment` 时，报告该能力不支持，不把旧路由当作治理已完成。

把有证据支持的评估写入 `.leo-dev/runtime/<id>/assessment-input.yaml`，再运行：

```sh
leo-dev route --change <id> --task <task-id> --gate <reviewed-gate-id> --assessment .leo-dev/runtime/<id>/assessment-input.yaml
```

输入字段：`schemaVersion: 1`、`assessmentId`、`changeId`、`taskId`、`specHash`、`subjectTreeHash`、`coverage`（`complete` / `partial`）和 `findings`。每项 finding 包含唯一 `id`、`severity`（`low` / `medium` / `high`）、`relation`（`worsened-by-change` / `required-by-change` / `unrelated`）、`boundary`、`rationale`、`evidence`（仓库相对 `path` 与当前文件的 `sha256`）、`repairScope`（`local` / `material` / `unknown`）。缺证据时保留不确定性；空 findings 或 complete 只是提交者声明，不是无技术债证明。

- `ready`：只表示所提交评估允许该任务或计划准入；继续原有规格审批、设计（适用时）、执行、门禁和审查，不等于验证通过。
- `local-remediation-required`：任务尚未创建。先在已授权局部范围完成必要修复和相关验证，再刷新树哈希并提交后继评估；此版本不调度 repair → feature 的任务 DAG。
- `approval-required`：停止该项实质性架构变更，提交影响和所需决定；普通 `approve` 回执或改成 ready 都不能清除此准入决定。本版本没有重大架构变更的自动恢复路径。
- `assessment-required`：补充不完整评估或查清相关修复范围，不猜测后放行。

后继评估带 `previousAssessmentFingerprint`。此前相关高风险 finding 被移除、降级或改为无关时，必须在 `resolutions` 中给出 `findingId`、`rationale` 和新的有效 `evidence`：至少一个当前内容哈希未出现在前一份评估的任何 finding 或 resolution 证据中。不能借用前一份记录里的无关旧证据冒充新证据；这也不等于跨全部历史的去重或修复语义证明。无关旧债留在记录中另排，不顺手清理。已经记录评估的 change 不能省略参数退回旧路径。

首份评估不带解决记录；后继解决记录只能引用上一份的相关高风险 finding。同一 finding 不能既保留为相关高风险、又声称已解决；局部修复未完成时保留阻塞项即可。

### 整份依赖计划的评估

在 `route` 前准备好经过审查的 task-plan 输入；不要修改已经路由的计划。先只读取得整个计划的身份：

```sh
leo-dev route --change <id> --plan <repo-relative-plan-path> --dry-run
```

读取 `state.planAssessmentContext` 的 `taskId`、`changeId`、`specHash`、`subjectTreeHash` 和当前历史信息。`taskId` 是 `plan:<hash>`，绑定验证后的完整有序 tasks 数组，而不是其中一项任务。不要自行计算、复制其他计划的身份或把单任务 assessment 当作全计划覆盖。修改任务、依赖、顺序、验收、路径或 gate 后，须重新 dry-run 取身份；新身份不会消除已有评估的拒绝和历史义务。

按同一 assessment schema 填入这些当前值，覆盖整份计划的相关边界与 findings，再提交：

```sh
leo-dev route --change <id> --plan <repo-relative-plan-path> --assessment .leo-dev/runtime/<id>/assessment-input.yaml
```

`ready` 才原子记录 assessment 并路由全部任务；其他 disposition 只记录评估，不创建任务。后继评估仍必须链接/处理旧 finding；material 拒绝不能被换计划或普通批准回执清除。省略 assessment 的 dry-run 可返回拒绝和取证上下文，供补充输入，不代表准入成功；所有 dry-run 都不写状态。

此 route 接口不自动发现/修复技术债，也不把高风险局部修复安排成 repair → feature DAG，不能重复路由来替换任务。已路由变更的 Spec/宪法修改使用下方专用修订入口；不靠新 scope 或手改日志使旧证据生效。

控制器将记录保存在 `.leo-dev/changes/<id>/assessments/`。准入树哈希是历史输入标识；后续代码变化仍需新的 Gate/审查证据。未提供评估的兼容路径明确为 `not-assessed`。以上是提交者判断的结构化准入检查，不是自动架构扫描、可信身份认证或完整技术债治理，也不替代 Standard/Full 的设计或审查要求。

## Spec / 宪法修订：保留代码，全任务重验

先确认当前入口的 `leo-dev revise --help` 真正列出 `--spec`、`--plan`、`--constitution`、`--assessment`、`--receipt`；旧包不支持时报告 prerequisite，不能编辑初始化哈希或创建替代 ledger。上游方法负责影响分析和草案，只有当前 controller 的专用修订操作激活新版本。

保留所有旧 task ID，每项 revision 在当前值上加 1；新增 ID 从 1 开始。完整计划中根任务 ready、依赖任务 pending，不携带 done；仍须满足路径、依赖、验收、Gate 和 integration-role 约束。本切片不支持删除旧任务、选择性继承成功或借修订清空修复预算。无需强制重写已正确的代码，也不要求所有任务先做完；但活动租约、未知结果、未完成门禁/批次、未决批准和重大治理阻断必须先按既有边界解决。

准备仓库内 Spec 草案和完整任务输入；宪法是明确指定的仓库内文档，不是自动修改全局 AGENTS。省略 `--constitution` 保留当前绑定，没有移除宪法开关。需要不同 registry 才显式提供 `--registry`。先只读提案：

```sh
leo-dev revise --change <id> --spec <spec-path> --plan <plan-path> --constitution <constitution-path> --dry-run
```

从 `state.revisionContext` 读取 proposal 的 `authorityHash`、`taskId`、`subjectTreeHash` 及 Spec/宪法/任务身份；此时普通 `state.assessmentContext` 仍可能指旧版本，不能混用。按上方 assessment schema 在 runtime 内保存覆盖完整新计划的评估：`specHash` 取该 `authorityHash`，其余身份取同一次 proposal，历史链接/解决义务仍有效。然后带 `--assessment <runtime-path>` 再次 dry-run，取得控制器生成的 `state.revisionApprovalContext`。

按这个上下文记录真实、明确的修订决定：approval schema 的 `scope: change`、`operationKind: spec-revision`、`decision: grant`，以及匹配 changeId、有效期和全部返回指纹，无 task scope。普通 spec-approval 回执不适用；不能自行声称人类已经批准。已有明确且精确匹配的决定不重复访谈，缺少批准才请求一次。准备好后由 revise 一次性消费：

```sh
leo-dev revise --change <id> --spec <spec-path> --plan <plan-path> --constitution <constitution-path> --assessment <runtime-path> --receipt <approval-path>
```

输入或 journal 改变会使旧上下文失效，应重新提案/评估/核对决定，不能只刷新旧回执字段。非 ready 评估不会激活修订；实际调用可能仅记录评估拒绝。批准标签不提供密码学身份认证。

激活后核对 `spec-approved` 和所有新 task revision。Lite 可重新进入 `task-ready → executing`；Standard/Full 必须重新走当前的 design-review/design-approved，使用新的 design context and receipt before task-ready. 然后逐项重新 claim、Gate、submit 和实际审查。当前 `specHash` 是版本化 authority，不再等同 Spec 文件原始哈希；`sourceHash` 才是原文哈希。旧代码、运行和审查留在历史，旧成功不算本版本完成。新快照记录实际捕获的原文，不虚构初始化时未保存的旧文本。

中断的修订使用现有 `resume --change <id> --dry-run` 检查，再按原批次恢复；不反复提交已消费的回执，不手改第三值工件。团队也进入新版本：先读 team status，再明确 open/bind 实际成员；旧意见归档，旧 request ID、消息、成员绑定不能直接迁移成当前证据。详见 [codex-team](codex-team.md)。
