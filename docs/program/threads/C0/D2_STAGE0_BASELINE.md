# C0 D2 Stage 0 基线报告

> 日期：2026-07-31  
> 负责人：A（SaaS 控制平面 / 公共合同 / 主分支集成）  
> 分支：`dev/control-plane`  
> 基线提交：`f48c210 fix: align StoryCanvas runtime with single frontend`

## 1. 范围与边界

本报告只建立 D2 单前端双平面的运行、测试和治理基线，不在 Stage 0 内修改 B 独占的生产页面、StoryCanvas UI 或媒体生产 API。当前产品仍是“前端 + Mock 的内部 Demo”，不是生产认证、正式 RBAC、真实租户隔离或正式结算系统。

## 2. 环境初始化

- 根应用依赖：已安装。
- StoryCanvas 依赖：已按其 `yarn.lock` 使用 Yarn 1.22.22 安装。
- FireRed 子模块：已初始化到 `04297707e7607dd398e906262235d0797068e7b4`。
- 根前端：`http://127.0.0.1:5173/`，HTTP 200。
- 集成画布：`/production/canvas/demo-local-001`，HTTP 200。
- StoryCanvas API：`http://127.0.0.1:10588/` 可达；根路径按设计返回内部 API 404 提示。

### 安装脚本偏差

根脚本 `npm run storycanvas:install` 调用 npm，但 `apps/storycanvas/` 只提交 `yarn.lock`，README 明确要求 Yarn 1.22.x。npm 10 因下列 peer dependency 冲突失败：

```text
sqlite3@6.0.1
@rmp135/sql-ts@2.2.0 -> peerOptional sqlite3@^5.1.7
```

本次没有修改依赖声明或锁文件，临时按 StoryCanvas 自身锁文件完成安装。后续需由 A/B 决定统一安装命令。

## 3. 自动化基线

| 检查 | 结果 | 说明 |
|---|---|---|
| `npm run validate:governance` | PASS | 治理结构、C0-C8、合同和 UI 引用通过 |
| `npx eslint src vite.config.ts` | PASS | 根 SaaS / A 与共享前端范围通过 |
| `npm run test` | FAIL | 45 项中 38 通过、7 失败；3 个测试文件失败 |
| `npm run lint` | FAIL | 697 errors、5 warnings；主要来自 `apps/storycanvas/**` 被根 ESLint 扫描 |
| `npm run build` | FAIL | 3 个 TypeScript 错误 |
| `git diff --check` | PASS | Stage 0 检查时无空白错误 |

## 4. 失败明细

### Build

1. `src/pages/production/IntegratedStoryCanvasPage.tsx`
   - `DemoProjectGrant` 无法赋给 `StoryCanvasApp` 从 JS 默认值推断出的 `null | undefined` prop。
   - 文件属于 B 生产平面范围，A 不在本分支越界修复。
2. `vite.config.ts`
   - 找不到 `node:path` 类型。
   - 找不到 `__dirname` 类型。
   - 根项目缺少 Node 类型依赖或等价配置，属于 A/共享集成修复范围。

### Test

默认命令单独重跑后仍有 7 项失败：

- A/共享：匿名访问登录页测试仍断言旧标题“欢迎登录”，当前页面标题是“登录工作台”。
- A：BrandBrain 两项交互测试超过 5 秒/10 秒超时，并伴随 React `act(...)` 警告。
- 共享：侧栏六路由 Smoke 超过 15 秒超时。
- B：ScriptEditor 两项交互测试超时，一项外部 reset 场景未找到“未保存”并错误导航到分镜占位页。

首次将 Test/Lint/Build 并行执行时失败数为 10；单独重跑后降为 7，说明部分超时受并行资源竞争影响，但以上 7 项仍需处理。

### Lint

- `npx eslint src vite.config.ts` 已通过。
- 默认 `npm run lint` 扫描 `apps/storycanvas/data/serve/app.js`、vendor 模板和大量 StoryCanvas TS 源码，产生 697 errors、5 warnings。
- 需要 A/B 决定：修复 B 全量存量问题，或把根 SaaS Gate 与 StoryCanvas 独立 Gate 明确拆分；不得通过静默忽略新增问题伪造通过。

## 5. P0 / P1 / P2

### P0：阻塞 D2 Gate

1. 根 `npm run build` 失败：Node 类型配置缺失。
2. 根 `npm run build` 失败：StoryCanvas Grant prop 类型边界未声明。
3. 默认 `npm run lint` 无法作为两人协作 Gate 使用，需冻结合理作用域或清理生产平面存量错误。

### P1：影响可靠性与回归

1. 默认单元测试仍有 7 项失败。
2. 登录 Smoke 使用旧文案断言，与 D2 当前登录页不一致。
3. BrandBrain 测试存在交互性能和 `act(...)` 警告。
4. ScriptEditor reset/脏稿测试存在超时或状态行为偏差，交给 B 处理。
5. StoryCanvas 启动会尝试把 3 个 tracked vendor 文件换为 CRLF；本次已恢复，后续需从生成逻辑或 Git 属性解决。
6. StoryCanvas 安装命令与其锁文件/README 不一致。

### P2：后续治理

1. 根 `npm install` 报告 7 个 high severity audit 项；本阶段不自动执行可能引入破坏性升级的 `npm audit fix --force`。
2. 当前实际 Node 为 22.22.3，StoryCanvas README 推荐 Node 24；需补充统一版本说明。
3. C0 旧状态文档中的权威路径和“D2 尚未实施”描述已过期，需要持续清理。

## 6. A/B 处理边界

### A 下一步

- 修复根 Node 类型配置。
- 在 A-01 中更新登录测试，并补齐会话合同、过期、损坏恢复与安全回跳测试。
- 更新 C0 STATUS/HANDOFF/CHANGELOG。
- 维护共享 Gate 和最终合并。

### B 请求

- 为 `StoryCanvasApp` 明确 Grant prop 类型，修复 `IntegratedStoryCanvasPage` Build 阻塞。
- 处理 ScriptEditor 的 3 项失败测试。
- 与 A 确认 StoryCanvas 独立 lint/test Gate 和安装脚本。
- 处理启动时 vendor 文件换行符重写问题。

## 7. Stage 0 结论

环境与双服务运行基线已建立，治理校验和根前端定向 ESLint 通过；全量 Test、默认 Lint 和 Build 尚未通过。允许 A 在独立分支进入 A-01，但在 D2 Gate 前必须关闭上述 P0，并对 P1 给出修复或双方确认的隔离方案。
