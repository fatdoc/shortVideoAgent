# C2 REQUESTS

> 跨模块请求写在这里。C0 决策后回填。

## RFC 模板

```
请求编号：REQ-C2-001
发起线程：C2
请求内容：
请求原因：
影响范围：
是否阻塞：是/否
临时方案：
C0 决策：待定
决策日期：
```

## 当前请求

### REQ-C2-001 · 升级 Gate1 公共 smoke

- 请求编号：REQ-C2-001
- 发起线程：C2
- 请求内容：将 `src/tests/app.smoke.test.tsx` 从 Dashboard 占位页标题/按钮断言升级为 C2 正式页主流程断言
- 请求原因：C2 已按职责替换占位页，Gate1 测试仍寻找“工作台 / 项目列表”与“切换脚本版本（验证 Store）”
- 影响范围：`src/tests/app.smoke.test.tsx`（C1/C7/C0 公共测试所有权）
- 是否阻塞：否（C2 定向测试、lint、build、视觉检查均通过；Gate2 全量前必须处理）
- 临时方案：C2 分支保留原公共测试不越权修改
- C0 决策：批准；C2 合入 integration 后由 C0 更新为正式 Dashboard / Brief / Brand / Script 导航与持久化断言
- 决策日期：2026-07-26
