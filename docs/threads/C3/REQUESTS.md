# C3 REQUESTS

> 跨模块请求写在这里。C0 决策后回填。

## RFC 模板

```
请求编号：REQ-C3-001
发起线程：C3
请求内容：
请求原因：
影响范围：
是否阻塞：是/否
临时方案：
C0 决策：待定
决策日期：
```

## 当前请求

### REQ-C3-001 · 适配 Antd Table 的 jsdom 样式查询

- 请求编号：REQ-C3-001
- 发起线程：C3
- 请求内容：在公共 `src/tests/setup.ts` 中兼容 jsdom 不支持 `window.getComputedStyle(element, pseudoElement)` 的限制
- 请求原因：Antd Table 测量滚动条时传入伪元素参数；真浏览器正常，jsdom 会向 stderr 输出 “Not implemented”
- 影响范围：`src/tests/setup.ts`（C1/C7/C0 公共测试所有权）
- 是否阻塞：否（10 files / 41 tests 全部通过，真浏览器 0 error / 0 warning）
- 临时方案：C3 自有页面测试内局部忽略第二参数
- C0 决策：批准；C3 合入 integration 后由 C0 在公共 setup 中统一适配并删除 Gate2 测试噪声
- 决策日期：2026-07-26
- 完成状态：`CLOSED`
- 完成证据：`4cfba82`
