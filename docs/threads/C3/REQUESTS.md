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

### REQ-C3-002 · 公共 shell / token 对齐图 3

- 请求编号：REQ-C3-002
- 发起线程：C3
- 请求内容：请 C0 / C1 评估公共侧栏、顶部工具栏与全局 token 对齐图 3，包括浅色导航、顶部搜索 / 团队操作区、内容区边距及轻边框 / 阴影 token
- 请求原因：1672×941 并排对照中，C3 页面主体已对齐，但当前深色全局侧栏与顶部 breadcrumb 是剩余最大的视觉差异；对应文件属于 `src/layouts` / `src/design` 公共所有权
- 影响范围：全局 shell、全部业务页
- 是否阻塞：否
- 临时方案：C3 保持现有 shell，不在业务页面覆盖公共布局或 token
- C0 决策：待定
- 决策日期：
- 完成状态：`OPEN`

### REQ-C3-003 · 提供批准的品牌 Logo / 人物头像资产

- 请求编号：REQ-C3-003
- 发起线程：C3
- 请求内容：请 C0 确认是否补充图 3 对应的海底捞品牌 Logo 与人物头像公共资产，或批准继续使用现有 Ant Design 图标
- 请求原因：仓库现有资产中没有对应 Logo / 头像；用户要求只能使用仓库已有资产 / 图标，C3 未手绘或生成占位素材
- 影响范围：公共静态资产与品牌页视觉保真度
- 是否阻塞：否
- 临时方案：使用仓库已安装的 `ShopOutlined` / `TeamOutlined`
- C0 决策：待定
- 决策日期：
- 完成状态：`OPEN`
