# C0 D2 A-02 身份、路由与菜单权限矩阵

> 冻结日期：2026-07-31
> 负责人：A（SaaS 控制平面 / 公共合同 / 主分支集成）
> 分支：`dev/control-plane`
> 前置提交：`327aae6 feat(auth): complete D2 mock session contract`
> 状态：`A02_PERMISSION_MATRIX_FROZEN`

## 1. 目的与边界

本文冻结 D2 内部 Demo 的四身份前端授权真相，供 `DemoIdentity`、Router、Sidebar、WorkbenchSwitcher、安全回跳和自动化测试共同使用。

该矩阵只用于前端 + Mock 演示：

- 不是生产认证或服务端 RBAC。
- 不提供真实租户隔离、防篡改会话或 API 授权。
- 菜单隐藏不能代替路由拒绝；Router 必须独立执行同一权限判断。
- 生产化时必须由服务端重新实现 Identity、Membership、Role、Permission、Tenant/Project Scope 和审计。

## 2. 授权模型冻结

A-02 不再只依赖 `allowedWorkbenches`。最终模型分为三层：

1. **工作台权限**：决定可否切换到平台、渠道、企业或生产工作台。
2. **路由权限**：决定具体页面是否可进入，并用于菜单过滤和安全回跳。
3. **资源范围**：决定 URL 中的 Tenant/Project 是否为 canonical Demo 资源。

统一判断入口：

```ts
canAccessDemoWorkbench(identity, workbench)
canAccessDemoRoute(identity, permission)
```

Router、Sidebar 和登录安全回跳不得分别维护另一套角色判断。页面内的高权限操作应复用动作权限，不得仅凭“已进入页面”推断可编辑。

## 3. 工作台矩阵与默认落点

| 身份 | 平台 | 渠道 | 企业 | 生产 | 登录默认落点 |
|---|---:|---:|---:|---:|---|
| 平台管理员 | 允许 | 拒绝 | 拒绝 | 拒绝 | `/platform/overview` |
| 渠道代理 | 拒绝 | 允许 | 拒绝 | 拒绝 | `/channel/overview` |
| 企业管理员 | 拒绝 | 拒绝 | 允许 | 允许 | `/projects/demo-local-001/brand` |
| 内容运营 | 拒绝 | 拒绝 | 限定入口 | 允许 | `/production/overview` |

工作台切换落点：

| 身份 | 目标工作台 | 落点 |
|---|---|---|
| 企业管理员 | 企业 | `/projects/demo-local-001/brand` |
| 企业管理员 | 生产 | `/production/overview` |
| 内容运营 | 企业 | `/projects/demo-local-001/brand` |
| 内容运营 | 生产 | `/production/overview` |

内容运营不得因为具有 `tenant` 工作台入口而获得企业全部菜单。WorkbenchSwitcher 只能展示至少拥有一条路由权限的工作台，并使用身份对应的允许落点。

## 4. 具体路由权限矩阵

图例：`允许` = 可进入；`只读` = 可进入但不得执行高权限品牌配置写入；`拒绝` = 统一 403。

| 权限键 | 路由 | 平台管理员 | 渠道代理 | 企业管理员 | 内容运营 |
|---|---|---:|---:|---:|---:|
| `platform.overview` | `/platform/overview` | 允许 | 拒绝 | 拒绝 | 拒绝 |
| `platform.organizations` | `/platform/organizations` | 允许 | 拒绝 | 拒绝 | 拒绝 |
| `platform.catalog` | `/platform/catalog` | 允许 | 拒绝 | 拒绝 | 拒绝 |
| `platform.receipts` | `/platform/production-receipts` | 允许 | 拒绝 | 拒绝 | 拒绝 |
| `channel.overview` | `/channel/overview` | 拒绝 | 允许 | 拒绝 | 拒绝 |
| `channel.products` | `/channel/products` | 拒绝 | 允许 | 拒绝 | 拒绝 |
| `channel.customers` | `/channel/customers` | 拒绝 | 允许 | 拒绝 | 拒绝 |
| `channel.customer-usage` | `/channel/customers/:tenantId/usage` | 拒绝 | 允许（限 canonical Tenant） | 拒绝 | 拒绝 |
| `enterprise.dashboard` | `/dashboard` | 拒绝 | 拒绝 | 允许 | 拒绝 |
| `enterprise.products` | `/enterprise/products` | 拒绝 | 拒绝 | 允许 | 拒绝 |
| `enterprise.project-create` | `/projects/new` | 拒绝 | 拒绝 | 允许 | 拒绝 |
| `enterprise.project-entry` | `/projects/:projectId` | 拒绝 | 拒绝 | 允许（限 canonical Project） | 允许（限 canonical Project） |
| `enterprise.brand-read` | `/projects/:projectId/brand` | 拒绝 | 拒绝 | 允许 | 只读 |
| `enterprise.brand-manage` | 品牌大脑编辑、保存等动作 | 拒绝 | 拒绝 | 允许 | 拒绝 |
| `enterprise.script` | `/projects/:projectId/script` | 拒绝 | 拒绝 | 允许 | 允许 |
| `enterprise.storyboard` | `/projects/:projectId/storyboard` | 拒绝 | 拒绝 | 允许 | 允许 |
| `enterprise.rough-cut` | `/projects/:projectId/rough-cut` | 拒绝 | 拒绝 | 允许 | 允许 |
| `enterprise.usage` | `/projects/:projectId/usage` | 拒绝 | 拒绝 | 允许 | 允许 |
| `enterprise.delivery` | `/projects/:projectId/delivery` | 拒绝 | 拒绝 | 允许 | 允许 |
| `production.overview` | `/production/overview` | 拒绝 | 拒绝 | 允许 | 允许 |
| `production.inbox` | `/production/inbox/:projectId` | 拒绝 | 拒绝 | 允许 | 允许 |
| `production.canvas` | `/production/canvas/:projectId` | 拒绝 | 拒绝 | 允许 | 允许 |
| `production.tasks` | `/production/tasks/:projectId` | 拒绝 | 拒绝 | 允许 | 允许 |
| `production.assets` | `/production/assets/:projectId` | 拒绝 | 拒绝 | 允许 | 允许 |
| `production.export` | `/production/export/:projectId` | 拒绝 | 拒绝 | 允许 | 允许 |

### 4.1 内容运营企业侧边界

允许内容运营进入企业侧的目的，是读取已批准品牌事实并衔接脚本、分镜、任务和交付，不是授予企业经营管理权限。

内容运营允许看到的企业菜单：

- 品牌大脑（只读）。
- 脚本编辑。
- 分镜生产单。
- 任务 / 交付。

内容运营必须看不到且直接 URL 访问必须拒绝：

- 企业工作台。
- 已购能力、额度或商业配置。
- 新建 Project / Brief。
- 品牌资料编辑、保存及其他高权限配置动作。

### 4.2 企业管理员生产侧边界

企业管理员可以进入 canonical Project 已批准的生产入口，以便讲解从品牌大脑到生产执行的完整链路。该允许不扩展到其他 Tenant 或 Project，也不改变生产 API 必须校验 Package/Grant 的合同要求。

## 5. Canonical 资源范围

D2 只允许以下资源：

```text
Tenant：tenant-demo-hdl
Project：demo-local-001
```

强制规则：

1. `/channel/customers/:tenantId/usage` 的 `tenantId` 必须为 `tenant-demo-hdl`。
2. 所有 `/projects/:projectId...` 的 `projectId` 必须为 `demo-local-001`。
3. 所有 `/production/.../:projectId` 的 `projectId` 必须为 `demo-local-001`。
4. 参数不匹配时不得自动映射到 canonical 资源，统一显示拒绝页。
5. 身份的 Active Organization 必须继续来自 canonical DemoSession，不接受 URL 覆盖。

## 6. 菜单与安全回跳规则

### 6.1 Sidebar

- 当前工作台菜单由“工作台菜单定义 + 当前身份具体路由权限”共同过滤。
- 不允许仅按 URL 所属工作台展示全部菜单。
- 菜单隐藏和 Router 拒绝必须复用同一权限键。
- 当前路由在权限过滤后无匹配菜单时，不得错误选中第一条无关菜单。

### 6.2 WorkbenchSwitcher

- 企业管理员显示企业、生产两个工作台。
- 内容运营显示企业、生产两个工作台，但切到企业时落到只读品牌大脑，不进入 `/dashboard`。
- 平台管理员和渠道代理只有一个工作台，切换器保持禁用。

### 6.3 安全回跳

登录安全回跳必须复用具体路由权限和 canonical scope 判断：

- 企业管理员可回跳到允许的企业或生产路由。
- 内容运营可回跳到允许的生产路由或限定企业业务路由。
- 内容运营回跳 `/dashboard`、`/enterprise/products`、`/projects/new` 时回到 `/production/overview`。
- 任一身份回跳到跨角色路由、未知 Tenant/Project 或未登记路由时回到该身份默认落点。

## 7. 统一拒绝页合同

角色拒绝和资源范围拒绝使用同一拒绝页壳，至少展示：

- `403` 和稳定错误码。
- 目标区域或目标资源。
- 当前身份、角色和 Active Organization。
- “返回我的工作台”按钮。
- “退出并切换身份”按钮。
- `前端 Demo 拒绝，不代表生产 RBAC 或服务端安全控制。`

建议错误码：

| 场景 | 错误码 |
|---|---|
| 身份无具体路由权限 | `ROUTE_PERMISSION_DENIED` |
| Tenant/Project 参数不是 canonical 资源 | `ROUTE_ID_REJECTED` |

退出并切换身份必须清理当前 Mock 会话后进入 `/login`。

## 8. A-02 实现切片

1. 在 `src/domain/demoIdentity.ts` 定义权限键、四身份权限表、动作权限和统一判断函数。
2. 将企业管理员和内容运营的 `allowedWorkbenches` 更新为 `tenant + production`。
3. Router 使用具体权限守卫，并给所有 Tenant/Project 参数路由增加 canonical scope guard。
4. 品牌大脑根据 `enterprise.brand-manage` 对内容运营收口为只读。
5. Sidebar 按具体权限过滤；WorkbenchSwitcher 使用身份允许落点。
6. `resolveDemoReturnPath` 复用相同权限与 scope 真相。
7. 补权限表单测、路由矩阵、菜单过滤、只读品牌和统一 403 测试。

## 9. 最小验收场景

- 平台管理员仅可进入平台四路由。
- 渠道代理访问平台或品牌路由得到 403。
- 渠道代理访问非 canonical Tenant 用量路由得到 403。
- 企业管理员可在企业与生产工作台之间切换。
- 企业管理员访问非 canonical Project 得到 403。
- 内容运营可进入品牌只读、脚本、分镜、交付和全部生产路由。
- 内容运营看不到企业工作台、已购能力、新建 Brief，直接 URL 访问得到 403。
- 内容运营在品牌大脑看不到或无法触发编辑、保存动作。
- 403 页面包含当前身份/组织、返回、退出切换和 Demo 声明。
- 菜单、Router 和安全回跳对同一路径给出一致结果。

## 10. 冻结结论

A-02 权限真相已冻结为“工作台 + 具体路由/动作 + canonical scope”三层模型。后续实现如需改变任一允许/拒绝关系，必须先更新本文，再同步 Router、菜单、安全回跳和测试，避免产生多套授权真相。

## 11. 2026-07-31 权限模型第一切片

已在 `src/domain/demoIdentity.ts` 实现：

- 24 个具体路由权限键。
- `enterprise.brand-manage` 品牌高权限动作键。
- 路由权限到四类工作台的完整映射。
- 四身份精确权限集合。
- `canAccessDemoPermission` 和 `canAccessDemoRoute` 统一判断函数。

新增 `src/domain/demoIdentity.test.ts`，冻结四身份完整权限集合并验证跨域拒绝、企业管理员生产权限、内容运营限定企业入口、匿名拒绝和路由工作台映射。

为避免 Router 仍使用旧工作台级守卫时产生临时越权，本切片没有提前扩大企业管理员和内容运营的 `allowedWorkbenches`。下一切片必须原子完成以下接线后再启用双工作台：

1. Router 具体权限守卫。
2. Sidebar 权限过滤。
3. WorkbenchSwitcher 身份落点。
4. 安全回跳具体路由权限。

定向验证：

- 权限、Demo Auth、Auth Store：40 项通过。
- 相关 ESLint：通过。
- Governance：通过。
- TypeScript：A 侧新增类型错误为 0；仍仅被 B 侧 `IntegratedStoryCanvasPage.tsx` Grant prop 既有错误阻塞。
