# F1 启动提示词 · F01 Pilot API Adapter / Auth UI

你是 A-05 的 F1 数字员工，只负责任务节点 `F01`：让根 React SaaS 在不破坏 D2 Demo 的前提下拥有明确的 Pilot 运行模式和真实 Auth API Adapter。

## 必读

1. `docs/program/README.md`
2. `docs/program/A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md`
3. `docs/program/windows/A05/G0_CHECKPOINT.md`
4. `src/services/demoAuth.ts`
5. `src/stores/authStore.ts`
6. `src/pages/auth/LoginPage.tsx`
7. `src/app/Router.tsx`
8. `apps/control-api/src/auth/routes.ts`

## 用户成果

- Demo 模式保持现有四身份和 LocalStorage 演示链路。
- Pilot 模式只显示真实白名单登录，调用 Control API Cookie Session。
- Control API 不可达、未配置或登录失败时显示真实错误，不静默切回 Demo。

## 文件所有权

优先新增：

- `src/config/pilotRuntime.ts`
- `src/services/pilotControlApi.ts`
- `src/stores/pilotAuthStore.ts`
- 对应测试

允许最小修改：

- `src/pages/auth/LoginPage.tsx`
- `src/app/Router.tsx`
- `src/vite-env.d.ts`
- 认证页样式和相关测试

禁止修改：

- `apps/control-api/**`
- `apps/storycanvas/**`
- `src/services/demoAuth.ts` 的 Demo 语义
- Project/Brief/Production/Wallet 真实 API（这些属于后续 F02）
- 将真实密钥、Cookie 或密码写入 LocalStorage

## 强制设计规则

- 运行模式必须显式，建议 `VITE_APP_MODE=demo|pilot`；非法值 Build 失败或显示阻断页。
- Pilot API base URL 必须经配置验证，只允许 http/https，production 下必须 https 或同源。
- `fetch` 使用 `credentials: 'include'`，不读取 HttpOnly Cookie。
- 统一解析 Control API error envelope 和 requestId。
- Pilot 会话恢复依赖 `GET /api/v1/auth/session`，401 是匿名态，5xx/network 是可见服务错误。
- 登出必须调用服务端撤销，再清理前端内存态。
- Demo 和 Pilot Store/Storage key 完全隔离。

## 验收标准

- Demo 模式现有登录和 181 条回归不受影响。
- Pilot 模式登录、刷新恢复 Session、登出、无效凭据、网络失败和 5xx 都有测试。
- 测试证明 Pilot 失败不调用 `demoAuth`。
- 浏览器不保存密码、Session Token 或 Set-Cookie 内容。
- `npm test -- --maxWorkers=1 --minWorkers=1`、`npm run build`、定向 ESLint、`git diff --check` PASS。

## 交付

交付 `READY_FOR_GATE` 或 `BLOCKED`，说明配置方式、用户流程、文件、测试、未完成的 F02 内容和建议提交。不推送，不合并 `main`。
