# C0 D2 A-01 Mock 会话与安全回跳验收

> 日期：2026-07-31  
> 负责人：A（SaaS 控制平面 / 公共合同 / 主分支集成）  
> 分支：`dev/control-plane`  
> 前置基线：`ae421ea docs(c0): record D2 stage 0 baseline and handoff`

## 1. 交付范围

A-01 将原有仅包含账号和创建时间的简化 LocalStorage 记录，补齐为可恢复、可退出、可过期、可严格校验的前端 Mock 会话。该实现只服务内部 Demo，不具备生产认证、服务端授权或防篡改能力。

本次未修改 B 独占的生产页面、StoryCanvas UI 或媒体生产 API。

## 2. 冻结的 DemoSession 合同

```ts
type DemoSession = {
  version: 1
  sessionId: string
  identityId: string
  role:
    | 'platform_admin'
    | 'channel_agent'
    | 'enterprise_admin'
    | 'content_operator'
  organizationId: string
  organizationType: 'platform' | 'channel' | 'enterprise'
  defaultWorkbench: 'platform' | 'channel' | 'enterprise' | 'production'
  issuedAt: string
  expiresAt: string
}
```

- 有效期：8 小时。
- 每次成功登录生成新的 `sessionId`。
- 会话中的身份、角色、组织和默认工作台必须与仓库内 canonical Demo Identity 完全匹配。
- 切换身份前先移除旧会话；新会话写入失败时不得恢复上一身份。

## 3. 恢复与清理规则

以下情况统一视为匿名状态，并尽力删除无效持久化数据：

- JSON 损坏。
- 字段缺失或字段类型错误。
- `version` 不匹配。
- `issuedAt` / `expiresAt` 无效，或失效时间不晚于签发时间。
- 当前时间达到或超过 `expiresAt`。
- `identityId` 不存在。
- 角色、组织、组织类型或默认工作台与 canonical identity 不匹配。
- LocalStorage 无法读取。

主动退出和失败的身份切换同时清理内存身份与持久化会话。

## 4. 安全回跳

未登录访问受保护路由时，Router 保存完整站内目标（pathname、query、hash）。登录恢复时只接受：

- 以单个 `/` 开头的站内路径。
- 不包含反斜杠或控制字符。
- 可解析到固定 Demo origin。
- 属于当前身份允许的工作台。
- Project-scoped 企业与生产路径必须使用 canonical Project `demo-local-001`。

外部协议、`//`、跨角色工作台、未知 Project 或其他非法目标统一回到当前身份默认路由。

## 5. 自动化证据

### PASS

```bash
npx vitest run src/services/demoAuth.test.ts src/stores/authStore.test.ts src/tests/app.smoke.test.tsx \
  --reporter=verbose \
  --testNamePattern='demoAuth|authStore|redirects anonymous users|returns to a safe protected path'
```

结果：3 个测试文件通过，33 项通过，5 项因定向过滤跳过。

覆盖：

- 四身份登录、完整合同和刷新恢复。
- 错误账号/密码。
- 主动退出。
- 过期、损坏、缺字段、错版本。
- 不存在的账号或组织、角色不匹配。
- 身份切换生成独立会话，失败切换不保留旧身份。
- LocalStorage 读写不可用时安全失败。
- 四工作台合法回跳、跨角色/外部/未知 Project 回跳拒绝。
- Router 保存 query/hash 并在登录后恢复安全目标。

```bash
npx eslint src
git diff --check
npm run validate:governance
```

结果：全部 PASS。

### 已知外部阻塞

```bash
npx tsc -p tsconfig.app.json
```

仍被 B 侧既有错误阻塞：

```text
src/pages/production/IntegratedStoryCanvasPage.tsx(76,23):
Type 'DemoProjectGrant' is not assignable to type 'null | undefined'.
```

A-01 修改文件未产生新的 TypeScript 错误。默认全量 Test/Lint/Build 的其余 Stage 0 缺口继续按 `D2_STAGE0_BASELINE.md` 处理。

## 6. 结论

A-01 会话合同、恢复清理和安全回跳已达到定向验收口径，状态为 `A01_TARGETED_PASS`。下一步进入 A-02 前，应先冻结企业管理员与内容运营的最终权限矩阵，再统一 Router、菜单和拒绝页行为。
