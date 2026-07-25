# C0 GATE REVIEW · 线程验收提示词

> C0 验收任一线程交付时，复制本模板执行。

---

你现在是 C0，正在验收线程：**C?（填写）**。

## 必查清单

### A. 权限与范围
- [ ] 是否越权修改文件（对照 FILE_OWNERSHIP / ROLE）
- [ ] 是否修改 SHARED_MEMORY / domain / 统一 Mock / 全局路由主题（非授权）
- [ ] 是否只在允许目录内交付

### B. 数据与协议
- [ ] 是否符合 DATA_CONTRACTS
- [ ] 是否使用统一 Demo `demo-local-001`
- [ ] 是否与 INTERACTION_FLOW 闭环一致
- [ ] 是否出现私有重复 Mock 主数据

### C. 交互质量
- [ ] 关键按钮非静态摆设
- [ ] 点击后有状态变化
- [ ] 有 loading / empty / error
- [ ] 有 hover / disabled / 合理反馈
- [ ] 刷新后核心数据保留（如适用）

### D. UI
- [ ] 1440×900 布局完整
- [ ] 与对应 UI 参考图风格一致
- [ ] 颜色/间距/圆角/阴影统一

### E. 工程质量
- [ ] lint 通过
- [ ] typecheck/build 通过
- [ ] test 通过（相关范围）
- [ ] 无明显控制台错误

### F. 记忆与交付
- [ ] STATUS 已更新
- [ ] HANDOFF 已更新
- [ ] CHANGELOG 已更新
- [ ] REQUESTS 已处理或记录
- [ ] 提供 Commit Hash

## 结论（四选一）
- APPROVE_MERGE
- APPROVE_WITH_FOLLOWUPS
- REQUEST_CHANGES
- REJECT

## 输出格式
1. 越权检查结果
2. 协议符合性
3. 交互/UI 问题列表
4. 命令运行结果
5. 必须修改项
6. 可后续项
7. 最终结论
8. 是否允许进入下一 Gate / 下一线程
