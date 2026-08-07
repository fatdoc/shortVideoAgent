# A-BIZ-01.4D · B 页面 Context 接线合同与联合回归计划

> 日期：2026-08-07
> 分支：`dev/business-plane`
> 前置提交：`ade3e54 feat(workbench): connect unified tenant shell`
> 状态：`A_BIZ_01_4D_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`

## 1. 目标

在不修改 B 独占页面源码的前提下，由 A 提供机器可测、fail-closed 的 Pilot 页面 Context 合同与交接文档，使 B 的脚本、分镜、StoryCanvas 和后续生产页面能够：

- 只使用当前已授权 Project Context；
- 明确区分 `demo` 与 `pilot`；
- 只把 Control API 基础地址作为 Adapter 配置，不接收任何凭据；
- Context 不完整、不一致或页面尚未接线时显示 unavailable，不读取 Demo Store 伪造 Pilot success；
- 后续由 A 在共享 Router 中完成最终页面注册，B 不通过 URL 或本地状态自行扩大 Scope。

## 2. 冻结合同

### 2.1 B 页面最小 Context

```ts
interface TenantPageHandoffContext {
  projectId: string;
  tenantId: string;
  sessionMembershipId: string;
  roleCodes: readonly ('tenant_admin' | 'content_operator')[];
  runtimeMode: 'pilot';
  controlApiBaseUrl: string;
}
```

合同不得包含：

- Session、Cookie、Authorization Header、密码、Token、Grant 或内部服务凭据；
- User email、展示名、Tenant 名称或其他非页面授权必需信息；
- Assignment、access level、额度、Task、Asset、Export 或 Provider 成功状态；
- Demo Project、Demo Store snapshot 或 LocalStorage 数据。

### 2.2 真相来源

- `projectId`、`tenantId`、`sessionMembershipId`、`roleCodes` 来自 A 已验证的 Pilot Session 与内存 Project Context；
- `runtimeMode` 只允许显式 `pilot`；
- `controlApiBaseUrl` 来自已通过 `pilotRuntime` 校验的 `VITE_CONTROL_API_BASE_URL`；
- URL 中的 `projectId` 只能作为请求目标，必须与已授权 Project Context 完全一致，不能成为授权事实源；
- Assignment 与写权限继续由 Control API A-BIZ-01.3 Policy 实时判定，不进入前端 Context。

## 3. Fail-closed 结果

Context resolver 使用显式判别联合：

```ts
type TenantPageHandoffResolution =
  | { status: 'ready'; context: TenantPageHandoffContext }
  | {
      status: 'unavailable';
      reason:
        | 'runtime-not-pilot'
        | 'control-api-unavailable'
        | 'tenant-context-required'
        | 'project-context-unavailable'
        | 'project-mismatch'
        | 'membership-context-mismatch'
        | 'role-context-mismatch';
    };
```

规则：

1. 任何输入缺失、不一致或未知 Role 均返回 `unavailable`，不得猜测或回退 Demo。
2. Context 只接受当前两个冻结 Tenant Role：`tenant_admin`、`content_operator`。
3. Role 集合按冻结顺序去重输出；不得由页面自行添加 Role。
4. URL Project 与当前内存 Project Context 不同返回 `project-mismatch`。
5. Pilot Runtime 配置缺失或 Control API URL 不可用返回 `control-api-unavailable`。
6. Resolver 不发网络请求、不读 LocalStorage、不读取 Demo Store，也不缓存权限结论。

## 4. 文件边界

A 可修改：

```text
src/domain/tenantPageHandoff.ts                     # 新增纯合同/resolver
src/domain/tenantPageHandoff.test.ts                # 新增 test-first 合同
src/app/Router.pilot.test.tsx                       # 仅补联合回归，必要时
src/app/Router.tsx                                  # 仅当接入 resolver 必需；共享改动独立提交
src/components/workbench/**                         # 仅新增通用 Provider/Unavailable 边界，必要时
docs/collaboration/A_BIZ_01_4D_B_PAGE_HANDOFF.md   # 给 B 的正式 handoff
docs/program/threads/C0/**                          # 项目记忆
```

A 不修改：

```text
apps/storycanvas/**
src/features/storycanvas/**
src/pages/production/IntegratedStoryCanvasPage*
src/pages/script-editor/**
src/pages/storyboard/**
src/components/script/**
src/components/storyboard/**
```

B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 始终不修改、不删除、不暂存、不提交。

## 5. Test-first 顺序

### 5.1 RED

先新增纯函数测试，至少固定：

1. 合法 Tenant Admin Context；
2. 合法 Content Operator Context；
3. 非 Pilot Runtime 拒绝；
4. Pilot Control API 配置缺失拒绝；
5. 非 Tenant / tenant null 拒绝；
6. Project Context 缺失拒绝；
7. URL Project 与授权 Context 不一致拒绝；
8. Membership ID 不一致拒绝；
9. Session Role 与 Project Context Role 不一致拒绝；
10. 未知 Role 拒绝；
11. 输出不包含 Secret、Assignment、access level、User/Tenant 展示信息或 Demo 数据；
12. 输入数组/对象后续变化不能扩大已生成 Context。

确认模块缺失导致有效 RED 后再实现最小 resolver。

### 5.2 GREEN

- 新增纯合同与 resolver；
- 必要时在 Pilot handoff 边界调用 resolver；
- resolver unavailable 时继续显示明确 handoff/unavailable，不挂载 B 页面；
- 不实现真实 B 页面，不接 Provider，不生成 Task/Asset/Export success。

### 5.3 联合回归

- Pilot Route Manifest 与 Context resolver 一致；
- `tenant_admin` / `content_operator` 的 B-facing 路由均只得到当前 Project Context；
- 未分配 Project、错误 Membership/Role、非 Tenant、Control API 配置错误均无 Demo fallback；
- Demo 现有黄金路径与 Platform/Channel 导航保持兼容；
- B 独占源码 tracked diff 必须为空。

## 6. Handoff 文档必须写清

给 B 的正式文档至少包含：

- 可导入的 TypeScript 类型、resolver/Provider API 与示例；
- 六个字段的来源、用途和禁止用途；
- B 页面请求规则：只使用 Context Project ID，服务端 401/403/404/409/5xx 的展示边界；
- 禁止读取 Demo Store、LocalStorage 或 URL 扩权；
- 未接真实 API 时必须显示 unavailable；
- B 完成页面后由 A 负责共享 Router 注册与联合 Gate；
- B 需要回传的测试、文件清单和 commit hash。

## 7. Gate

```bash
npm test -- --run src/domain/tenantPageHandoff.test.ts
npm test -- --run src/app/Router.pilot.test.tsx src/domain/tenantPageHandoff.test.ts
npm test -- --run --maxWorkers=1 --no-file-parallelism
npm run build
npx eslint <A 修改文件>
npx prettier --check <A 修改文件与文档>
npm run validate:governance
git diff --check
git diff --name-only -- \
  apps/storycanvas \
  src/features/storycanvas \
  src/pages/production/IntegratedStoryCanvasPage.tsx \
  src/pages/script-editor \
  src/pages/storyboard \
  src/components/script \
  src/components/storyboard
```

## 8. 提交策略

1. 本计划、C0 状态与桌面知识库独立 `docs(business-plane)` 提交；
2. 纯合同/resolver 与测试独立功能提交；
3. 如必须修改共享 Router/Provider，单独提交并明确通知 B；
4. Handoff 文档、联合回归与视觉证据独立收口；
5. 始终显式 `git add <files>`，禁止 `git add .`。

## 9. 完成定义

01.4D 只有同时满足以下条件才完成：

- 六字段 Context 合同机器可测并 fail closed；
- B 无需读取 Demo Store、URL 授权事实或 LocalStorage 即可获得 Pilot 页面 Context；
- 合同不携带 Secret、Assignment 或虚构业务成功；
- 正式 handoff 文档足以让 B 独立开发并回传结果；
- Root 测试、Build、Lint/Prettier、Governance、diff check 通过；
- B 独占源码 tracked diff 为零；
- C0 与桌面知识库同步；
- 每个切片有独立 commit。
