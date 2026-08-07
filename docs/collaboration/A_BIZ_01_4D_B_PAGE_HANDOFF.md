# A-BIZ-01.4D · 给 B 的 Pilot 页面 Context 接线说明

> 日期：2026-08-07
>
> A 分支：`dev/business-plane`
>
> 前置共享 Shell 提交：`ade3e54 feat(workbench): connect unified tenant shell`
>
> 合同模块：`src/domain/tenantPageHandoff.ts`

## 1. B 开始前先同步什么

B 在继续脚本、分镜、StoryCanvas 或生产页面的 Pilot 接线前，需要先同步 A 的共享 Shell 提交：

```text
ade3e54 feat(workbench): connect unified tenant shell
```

该提交已把 Pilot 接入统一 Shell、真实 Project Scope、Route Manifest、角色菜单、安全 returnTo 与明确 403/404/服务错误状态。B 不应恢复旧 `/pilot` 成功卡片，也不应在 B 页面中自行复制一套 Router 授权。

## 2. 可使用的唯一页面 Context

```ts
export interface TenantPageHandoffContext {
  readonly projectId: string;
  readonly tenantId: string;
  readonly sessionMembershipId: string;
  readonly roleCodes: readonly ('tenant_admin' | 'content_operator')[];
  readonly runtimeMode: 'pilot';
  readonly controlApiBaseUrl: string;
}
```

六个字段用途：

| 字段                  | 来源                                       | B 可以做什么                        | B 不可以做什么                                  |
| --------------------- | ------------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| `projectId`           | 服务端可见 Project Scope + read 复核       | 作为页面 API 的 Project 路径参数    | 使用 URL 中不同的 ID、切换到未分配 Project      |
| `tenantId`            | 已验证 Session Active Context              | 仅用于请求 Context 和响应一致性检查 | 自行切 Tenant、从 Demo fixture 推导 Tenant      |
| `sessionMembershipId` | 已验证 Active Membership                   | 仅用于诊断 Context 是否陈旧         | 作为服务端授权替代品、伪造 Assignment           |
| `roleCodes`           | Session 与 Project Context 一致的冻结 Role | 控制页面展示和只读/管理提示         | 添加 Role、绕过服务端 Policy、推导 access level |
| `runtimeMode`         | 明确 Pilot Runtime                         | 禁止 Demo fallback                  | 在 Pilot 页面读取 Demo Store/LocalStorage       |
| `controlApiBaseUrl`   | 已校验 `VITE_CONTROL_API_BASE_URL`         | 作为 Control API Adapter base URL   | 拼接密钥、写入日志、转发给 Provider 或第三方    |

Context 不包含，也禁止 B 自行补入：Cookie、Authorization Header、密码、Token、Grant、内部服务凭据、Assignment、access level、额度、Task/Asset/Export 成功状态、用户邮箱或 Demo 数据。

## 3. Resolver API

```ts
import { resolveTenantPageHandoffContext } from '../../domain/tenantPageHandoff';

const resolution = resolveTenantPageHandoffContext({
  runtime: pilotRuntime,
  sessionContext: session
    ? {
        organizationType: session.activeContext.organizationType,
        tenantId: session.activeContext.tenantId,
        membershipId: session.activeContext.membershipId,
        roleCodes: session.roles,
      }
    : null,
  projectContext,
  requestedProjectId: routeProjectId ?? null,
});

if (resolution.status !== 'ready') {
  return <UnavailableState reason={resolution.reason} />;
}

const context = resolution.context;
```

重要：

1. `routeProjectId` 只是请求目标；resolver 会要求它与 A 的内存 Project Context 完全一致。
2. 只有 `status === 'ready'` 后，B 页面才允许发真实 API 请求。
3. `unavailable` 时不得读取 Demo Store、LocalStorage 或旧 fixture 继续渲染成功态。
4. resolver 是纯函数，不缓存权限结论；Membership、Role 或 Assignment 变化后的权威结果仍由 Control API 实时判定。
5. Ready Context 与 Role 数组已克隆并冻结；页面不得修改或扩张 Scope。

## 4. unavailable 原因与页面行为

| reason                        | 含义                                                   | B 页面行为                                          |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `runtime-not-pilot`           | 当前不是明确 Pilot Runtime                             | 不挂载 Pilot Adapter；Demo 行为留在既有 Demo Router |
| `control-api-unavailable`     | Base URL 缺失、配置错误或包含不安全信息                | 显示配置不可用，不发请求                            |
| `tenant-context-required`     | 非 Tenant、Tenant 缺失或 Session/Project Tenant 不一致 | 显示需要 Tenant Context，不回退 Demo                |
| `project-context-unavailable` | Project Scope 尚未 ready 或字段缺失                    | 显示项目上下文不可用，可等待 A Store 刷新           |
| `project-mismatch`            | URL Project 与当前授权 Project 不一致                  | 显示项目不存在/无权访问，不请求该 ID                |
| `membership-context-mismatch` | Membership 已变化或 Context 陈旧                       | 停止请求，等待 Session/Project Scope 重新 hydrate   |
| `role-context-mismatch`       | Role 已变化、未知或两侧不一致                          | 停止请求，不能靠隐藏菜单继续执行                    |

B 不要把 reason 文案当 API 错误码，也不要上报其中不存在的敏感输入。

## 5. B 页面请求规则

- 只使用 `resolution.context.projectId` 调用 Project 授权 API；不要直接使用 `useParams()` 的值发请求。
- 所有写操作仍需服务端幂等键；前端 Context 不代表 editor/写权限。
- `401`：停止页面请求，交给 A 的 Session 流程清理并返回登录。
- `403`：保留已认证 Session，显示当前 Membership 无权执行该动作。
- `404`：按不可见/不存在处理，不泄漏其他 Tenant 的对象事实。
- `409`：显示版本或幂等冲突，不能覆盖服务端事实。
- `5xx`/网络错误：显示真实失败和可重试状态，不生成虚构 Task、Asset、Export 或 Provider success。
- 日志不得记录 Session、Token、Grant、完整用户内容、内部 URL 凭据或 Provider 密钥。

## 6. Demo 与 Pilot 的硬边界

Pilot 页面禁止读取：

```text
useProjectStore / Demo Project Store
useControlPlaneStore 的 Demo snapshot
controlPlaneMockAdapter
localStorage 中的 Demo workspace
DEMO_PROJECT_ID / demo-local-001 fixture
```

如果真实 API 尚未实现，只显示明确的 unavailable/handoff。现阶段 Router 已按此规则处理 B-facing 路由；B 不需要为了“看起来可用”把 Demo 页面挂到 Pilot。

## 7. 文件所有权

B 可继续修改自己的独占文件：

```text
apps/storycanvas/src/agents/**
apps/storycanvas/src/domain/storycanvas/**
apps/storycanvas/src/services/storycanvas/**
apps/storycanvas/src/routes/production/**
apps/storycanvas/src/routes/mvp/**
apps/storycanvas/src/integrations/openstoryline/**
apps/storycanvas/data/skills/**
apps/storycanvas/migrations/**
src/features/storycanvas/**
src/pages/production/IntegratedStoryCanvasPage*
src/pages/script-editor/**
src/pages/storyboard/**
src/components/script/**
src/components/storyboard/**
```

以下共享文件不要夹带修改；需要变化时先把合同请求发给 A：

```text
src/app/Router.tsx
src/domain/constants.ts
src/domain/unifiedTenantWorkbench.ts
src/domain/tenantPageHandoff.ts
src/stores/pilotAuthStore.ts
src/stores/pilotProjectContextStore.ts
src/layouts/**
src/services/storyCanvasBridge.ts
docs/program/contracts/**
docs/program/INTEGRATION_CONTRACT.md
```

## 8. B 回传给 A 的内容

B 完成一个页面接线切片后，请提供：

1. B 分支名和 commit hash；
2. 修改文件清单；
3. 使用的 Route Manifest key/capability；
4. Context ready、unavailable、401、403、404、409、5xx 的测试结果；
5. 明确说明没有读取 Demo Store/LocalStorage、没有从 URL 扩权；
6. 未接真实 API 的部分及其 unavailable UI；
7. 定向测试、StoryCanvas typecheck/module check、Governance、diff check 结果；
8. 需要 A 修改的共享 Router/合同事项，单独列出，不直接夹带共享文件提交。

A 收到后负责：共享 Router 注册、跨平面合同复核、Root 回归与最终集成提交。

## 9. 当前机器验证

A 的合同测试文件：

```text
src/domain/tenantPageHandoff.test.ts
```

固定覆盖合法 Tenant Admin/Content Operator、运行模式、Control API 配置、Tenant、Project、Membership、Role 一致性、敏感字段排除及不可变 Scope。B 可以在自己的页面测试中直接构造 `ready` Context，但不得绕过 resolver 的负向测试。
