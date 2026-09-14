# 自主执行与授权边界

在本地、可逆、已授权范围内，连续完成实现、测试、调试、审查和证据；保留预先存在的脏文件，重叠工作串行，不重置、清理或覆盖他人改动。

遇到未决实质产品/架构决定时暂停。A historic “continue” is not operation-specific approval.

- deploy requires exact operation-specific authority.
- push requires exact operation-specific authority.
- PR requires exact operation-specific authority.
- merge requires exact operation-specific authority.
- publication requires exact operation-specific authority.
- paid service requires exact operation-specific authority.
- credential expansion requires exact operation-specific authority.
- permission expansion requires exact operation-specific authority.
- destructive data action requires exact operation-specific authority.
- irreversible data action requires exact operation-specific authority.

不自动 commit、push、开 PR、合并、发布、部署、安装服务、扩权或删除工作树/分支。上述是流程边界，不是安全沙箱或同权限进程的强制防护。
