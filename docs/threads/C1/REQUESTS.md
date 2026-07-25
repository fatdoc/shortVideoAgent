# C1 REQUESTS

> 跨模块请求写在这里。C0 决策后回填。

## RFC 模板

```
请求编号：REQ-C1-001
发起线程：C1
请求内容：
请求原因：
影响范围：
是否阻塞：是/否
临时方案：
C0 决策：待定
决策日期：
```

## 当前请求

无。

## 已关闭 / 说明

- 未发现需要 C0 裁决的协议冲突。
- mockApi 扩展了 `updateBrand` / `updateStoryboard` / `updateTimeline`，仍兼容既有 `DemoWorkspace` 协议，未改 domain 字段结构。
- `NotFoundPage` 属于全局路由兜底，由 C1 维护。
