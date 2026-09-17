# 本地交付验证 · 2026-08-26

结论：个人开发工具箱 v1 已完成本地安装与抽样验证。Leo Dev 基线 v0.1.0（安装缓存版本带官方 helper 生成的 cachebuster），Superpowers 固定 v6.3.0。安装不等于当前任务热加载；请开新 Codex 任务使用入口。

## 结果

| 验证项 | 结果 | 证据/边界 |
| --- | --- | --- |
| Leo Dev manifest | 通过 | 官方 `validate_plugin.py`，退出码 0 |
| develop Skill 元数据 | 通过 | 官方 `quick_validate.py`，退出码 0 |
| 安装/路径/来源检查 | 通过 | doctor 15/15；两个插件 installed=true、enabled=true |
| doctor 状态判断 | 通过 | 6 个单元测试，覆盖缺失、禁用、错误 marketplace、非安装状态等 |
| Superpowers 原始内容 | 通过 | git 工作区干净，固定 b36e0829…，缓存 manifest 与上游一致 |
| UI/UX Pro Max | 通过（局部） | 原有源码干净；实际本地查询 `form accessibility` 返回 1 条结果。不是界面设计验收 |
| Playwright 浏览器链路 | 通过 | CLI 0.1.18，Chrome，本地表单输入→提交→快照→结果断言→截图→trace；最终 Errors=0、Warnings=0 |
| 小修复独立任务 | 通过（抽样） | 空列表返回值修复；代理先复现失败，主线程复跑 2/2 通过；用户 NOTES 原文保留 |
| 健身原生 App 方案独立任务 | 通过（流程抽样） | 复用确认规格；明确原生 SDK/模拟器/设备门槛，不把浏览器替代原生，不强加 AI/RAGAS |
| 集团小星方案独立任务 | 通过（流程抽样） | 复用确认规格；涵盖漏调用、失败降级、证据与隔离；历史基线不冒充本轮结果；收费评测等待预算 |
| 新任务自然触发率 | 未执行统计评测 | 独立任务通过显式指定已安装 Skill 路径验证，不代表自然语言触发率已量化 |
| 集团小星业务/原生移动端 | 未执行 | 本轮不修改业务、不部署，不把流程抽样宣称为产品验收 |

安装状态与源目录原文均已检查。全局 AGENTS 的旧内容保留，仅追加标记段；原始备份位于 `~/.codex/backups/leo-dev/AGENTS.before-leo-dev.md`。未改模型/沙箱/原有 MCP，未添加 Context7、GSD、OpenSpec，未自动提交、推送或创建 Goal。

## 可复查证据

- 校验与测试原始输出：`../leo-dev-validation/checks.json`
- 浏览器命令与结果：`../leo-dev-validation/browser-results.json`
- 浏览器截图：`../leo-dev-validation/browser-smoke.png`
- 浏览器 trace：`../leo-dev-validation/.playwright-cli/traces/trace-1787716469939.trace`
- 独立任务输入与观察摘要：`../leo-dev-validation/forward-results.md`
- 小修复夹具：`../leo-dev-validation/forward-fixtures/tiny/training.py`
- 最终安装状态：`../leo-dev-validation/install-results.json`

证据保存在本机独立目录，不作为开源上游内容或业务代码打包。插件可复用，路径检查和这些证据是本机安装记录，不是可移植依赖锁文件。

## 过程中发现并处理的问题

- 最初浏览器命令将表单容器误当作输入框，CLI 明确报错；按快照改为正确输入框后重新执行，未把失败当成功。
- 初版本地测试夹具缺 favicon，造成无关 404；补充空 data favicon 后，用全新隔离会话复跑，最终控制台无错误。
- Python 在项目目录和个人插件目录解析到不同环境。官方 YAML 校验固定使用已具备 PyYAML 的 miniforge Python；自定义 doctor 仅依赖标准库。没有为此修改全局 Python 配置。
- 备份和测试临时产物移出插件源码目录，最终安装使用官方 cachebuster helper 刷新，避免把本地备份混入新包。

## 限制

Skill 是模型遵循的流程指导，不是硬性权限控制或确定性路由器。三类样例不证明所有项目都正确。Playwright 现有 npx wrapper 未固定 npm 包版本；未来升级需重跑浏览器验证。原生设备、真实业务和收费模型质量门槛留待对应开发任务执行。

本轮自建的两个浏览器会话已关闭；仅监听 127.0.0.1:18764 的测试 HTTP 服务已停止。未关闭用户浏览器标签。
