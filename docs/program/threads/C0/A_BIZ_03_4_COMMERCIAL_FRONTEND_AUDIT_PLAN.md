# A-BIZ-03.4 · Commercial Frontend & Audit 计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`PLAN_FROZEN / READY_FOR_03_4A_RED`
- 上游计划：`A_BIZ_LATEST_MAIN_PLAN_2026-08-06.md`、`A_BIZ_03_3_COMMISSION_REVERSAL_SETTLEMENT_PLAN.md`
- 前置提交：`33b46ed docs(business-plane): close test settlement drafts`

## 1. 本节点目标

A-BIZ-03.4 只把 A-BIZ-03.1～03.3 已有的 TEST 商业事实接入真实 Pilot 会话，形成按 PLATFORM、CHANNEL、TENANT 严格分流的商业审计前端：

1. 补齐前端不能安全推导的 canonical Channel Reference 与 active Channel Directory 最小合同；
2. 建立只使用真实 Session Cookie 的严格商业 Control API Client；
3. 按 Organization Scope 冻结 Pilot 默认路由、菜单、Topbar 与直接 URL 授权策略；
4. 提供 Platform/Channel Commission Audit 真实只读页；
5. 提供 Platform TEST Settlement Draft 安全操作页；
6. 提供 Tenant TEST RechargeOrder 只读审计页。

本节点不是支付、结算或提现上线。所有金额与状态都只描述现有 TEST 审计事实；Settlement 必须始终明确为 `TEST + draft + NON_QUOTE`，不得表达已到账、可提现、`paid` 或真实资金动作。

## 2. 源码与合同审计结论

### 2.1 Pilot Router 当前错误地只支持 Tenant

`src/app/Router.tsx` 的 `PilotRouter` 当前把所有认证 Session 放入 `PilotTenantBoundary`。该 Boundary 要求：

- `organizationType === TENANT`；
- Session 有 canonical `tenantId`；
- 角色包含 `tenant_admin` 或 `content_operator`。

因此真实 PLATFORM/CHANNEL Session 会被错误阻断。`safePilotReturnPath()` 与 `pilotDefaultPath()` 也只基于 Tenant Project Manifest，不能作为多 Organization Pilot 策略继续扩展。

### 2.2 Pilot Sidebar/Topbar 默认依赖 Project Context

- `src/layouts/Sidebar.tsx` 的 Pilot 菜单仅按 Tenant Project Context 构建；
- `src/layouts/Topbar.tsx` 的 Pilot Topbar 总是显示 Project Selector；
- Pilot home 固定为 `/pilot`，工作台名称固定为“统一创作工作台”。

PLATFORM/CHANNEL 商业工作台不应依赖 Project，也不应出现 Project Selector。

### 2.3 现有商业页面仍是 Demo 数据

`src/pages/platform/PlatformManagementPages.tsx` 与 `src/pages/channel/ChannelCommercialPages.tsx` 仍读取 Demo `useControlPlaneStore`，包含演示客户、价格、商业数据与免责声明。

冻结决定：

- 不在 Demo 页面内增加 Pilot 条件分支；
- Demo Router、Demo 页面与 Demo Store 保持不变；
- Pilot 使用独立真实页面/组件和严格 Control API Client；
- Pilot API 失败时绝不回退 Demo/Mock。

### 2.4 现有 Pilot Client 只有 Auth/Project

`src/services/pilotControlApi.ts` 已正确具备：

- `credentials: 'include'`；
- HttpOnly Session Cookie；
- `PilotControlApiError` 的 status、code、requestId；
- 从错误信封或响应 Header 解析 Request ID；
- 网络失败、非 JSON 与无效响应的 fail-closed 处理。

03.4 在此基础上扩展严格商业 DTO/解析器，不复制另一套弱类型 fetch，也不读取 Demo Store。

### 2.5 canonical Channel ID 合同缺口

`PublicSession.activeContext` 只提供：

```ts
organizationId;
organizationType;
tenantId;
roles;
```

数据库中的 `organizations.organization_id` 与 `channels.channel_id` 是不同主键；Channel 仅通过唯一 `channels.organization_id` 关联 Organization。前端不得猜测 `channelId === organizationId`。

现有 Commission Service 能在服务端通过 Organization ID 解析 canonical Channel，但前端没有安全 Reference API。Channel Audit UI 在该合同补齐前不得开工。

### 2.6 Settlement 零候选所需 Channel Directory 缺口

`POST /api/v1/platform/commission-settlements` 必须显式提交 `beneficiaryChannelId`。零候选 Settlement Draft 是合法审计结果，因此 Platform UI 不能从已有 Commission Accrual 反推 Channel，也不能要求人工粘贴 UUID。

Channel 当前没有独立 status；可用性必须由关联 CHANNEL Organization 的 `status = active` 证明。03.4A 必须先提供最小 active Channel Directory。

### 2.7 Tenant RechargeOrder 纳入边界

Wave 3 / A-BIZ-03.4 要求覆盖充值记录、退款状态、佣金明细、冲正和结算状态，因此 Tenant RechargeOrder 不能完全排除。

但创建 RechargeOrder 必须选择 `conversionRuleVersionId`，当前没有安全的 active TEST Product/SKU/Conversion Rule Directory，且 Tenant Manifest 的 `/enterprise/products` 仍为 `not-implemented`。因此冻结为：

- 03.4E 只提供 Tenant TEST RechargeOrder 只读审计；
- 仅 `tenant_admin` 可见；
- 不提供创建 UI；
- 不允许用户手输或粘贴 Conversion Rule UUID；
- 创建能力等待独立的安全产品/规则目录合同。

## 3. 最小 Channel Reference/Directory 合同

03.4A 先增加两个只读 API；不新增 Migration，不扩大 Commission 或 Settlement 数据面。

### 3.1 DTO

```ts
type CommercialChannelReference = {
  channelId: string;
  organizationId: string;
  displayName: string;
  organizationStatus: 'active';
};
```

禁止返回：

- Parent/child 层级与客户关系；
- Commission Rule、比例、snapshot、digest；
- Tenant、User、Membership、Referral 明细；
- Settlement、余额、Provider 或 Secret；
- 任意跨 Scope 内部字段。

### 3.2 Current Channel Reference

```text
GET /api/v1/channels/current
```

合同：

- 只接受 active CHANNEL Organization Session；
- 服务端根据 Session `organizationId` 查询 canonical `channelId`；
- CHANNEL Organization 与 Channel 映射均必须存在且 active；
- 同 CHANNEL Scope 缺 `channel_admin` 返回 403；
- PLATFORM/TENANT、错误 Organization 或无映射返回 404；
- 未认证或 Session 失效返回 401；
- 响应 `cache-control: no-store`，只返回一个 `CommercialChannelReference`；
- Repository 查询必须在返回前再次验证 Organization 类型与 active 状态。

### 3.3 Platform Active Channel Directory

```text
GET /api/v1/platform/channels?status=active&limit=100
```

合同：

- 只允许 active PLATFORM Organization + `platform_admin`；
- 非 PLATFORM Scope 返回 404；同 PLATFORM Scope 缺角色返回 403；
- 当前只接受 `status=active`；未知筛选返回 422，不做宽松忽略；
- `limit` 为 1～100，Repository 再次 clamp；
- 只返回关联 active CHANNEL Organization 的 Channel；
- 按 `displayName ASC + channelId ASC` 稳定排序；
- 空目录返回 200 与空数组；
- 不支持任意搜索、跨层级查询或 disabled/inactive 展示。

### 3.4 错误与 Request ID

新增 API 复用现有统一错误信封与 Request ID：

- 401：`AUTHENTICATION_REQUIRED` / `SESSION_INVALID`；
- 403：同 Scope 缺管理员权限；
- 404：Organization Type 不匹配、跨 Scope、无 canonical mapping；
- 422：非法 query；
- 5xx：只返回安全服务错误，不泄漏 SQL、stack 或内部标识。

具体业务 error code 在 03.4A RED 中冻结，但必须保持稳定、可测试且遵守上述 status 语义。

## 4. Pilot Organization 路由与权限策略

03.4B 先建立可单测的纯 Route Manifest/Policy；03.4F 最后统一接入共享 Router/Sidebar/Topbar，避免多次修改共享导航骨架。

### 4.1 商业路由

```text
/platform/commission-audit
/platform/commission-settlements
/channel/commission-audit
/enterprise/recharge-orders
```

### 4.2 默认路由

| Session Scope | 必需角色                            | 默认路由                                                  | Project Context |
| ------------- | ----------------------------------- | --------------------------------------------------------- | --------------- |
| PLATFORM      | `platform_admin`                    | `/platform/commission-audit`                              | 不需要          |
| CHANNEL       | `channel_admin`                     | `/channel/commission-audit`                               | 不需要          |
| TENANT        | `tenant_admin` / `content_operator` | 保留现有首个可见 Project Brand；无 Project 时 `/projects` | 保留            |

`pilot_support` 不自动继承任意商业权限；未来如需支持角色，必须独立规划可审计的代理/授权合同。

### 4.3 路由拒绝语义

- 未认证：401 状态后安全回登录；
- Organization Type 与路由不匹配或跨 Scope 探测：404；
- 同 Organization Scope 但缺路由所需角色：403；
- Tenant `/enterprise/recharge-orders`：`tenant_admin` 可见，`content_operator` 菜单隐藏且直接 URL 为 403；
- 所有直接 URL、默认路由、登录 returnTo、Sidebar 可见性和 Workbench 切换必须复用同一 Policy；
- returnTo 只接受当前 Session Policy 允许的站内路径；外部 URL、未知路径和跨 Scope 路径回到该 Session 的安全默认路由。

## 5. 严格商业 Control API Client

在 `src/services/pilotControlApi.ts` 或其同域拆分文件中增加：

- Current Channel Reference；
- Platform active Channel Directory；
- Platform Payment Event bounded list；
- Platform Commission Calculation/Accrual/Reversal/manual-review bounded list；
- Channel Commission Calculation/Accrual/Reversal bounded list；
- Platform TEST Settlement Draft 创建；
- Tenant RechargeOrder bounded list。

冻结规则：

1. 每次请求使用 `credentials: 'include'`；
2. 商业读取使用 `cache: 'no-store'`，服务端保持 `cache-control: no-store`；
3. 每个 DTO 运行时严格解析 UUID、枚举、整数 minor unit、currency 与 timezone-aware timestamp；
4. 缺字段、错类型、未知关键枚举或非 JSON 成功响应视为 invalid API response；
5. 401/403/404、业务 409/422、网络错误和 5xx 均保留 status/code/requestId；
6. 不把原始响应、Provider payload、stack、SQL 或 Secret 写入 UI 错误；
7. 不回退 Demo Store、静态 fixture、localStorage 商业数据或 Mock；
8. bounded list 只描述当前返回窗口，不宣称完整历史，也不实现“导出全部”。

## 6. 页面合同

### 6.1 Platform Commission Audit

路由：`/platform/commission-audit`

真实加载：

- Platform Payment Events；
- Commission Calculations；
- Commission Accruals；
- Commission Reversals；
- Manual Reviews。

页面只展示 API 的最小安全投影。金额统一显示 `amountMinor + currency`，禁止从结果推导或展示：

- 真实佣金比例；
- 可提现、已到账或 `paid`；
- Rule snapshot/digest；
- Provider payload/secret；
- User/Tenant/Membership/Referral 明细。

Manual Review 只显示“需平台人工处理”的只读队列与现有安全原因，不提供 review/approve 按钮，也不调用未规划 HTTP。

### 6.2 Channel Commission Audit

路由：`/channel/commission-audit`

加载顺序必须是：

1. `GET /api/v1/channels/current`；
2. 读取服务端返回的 canonical `channelId`；
3. 以该 ID 请求 Channel Calculation/Accrual/Reversal；
4. 任一步失败按真实错误状态展示，不猜测 ID、不回退 Mock。

Channel 页面只显示自己的审计投影，不能接受 URL/query 中的任意 Channel ID，也不提供跨 Channel 搜索。

### 6.3 Platform TEST Settlement Draft

路由：`/platform/commission-settlements`

安全交互：

- 页面标题、说明、表单、确认区和成功区显著显示 `TEST`、`draft`、`NON_QUOTE`；
- 文案明确“非到账、非提现、非 paid、非自动打款”；
- beneficiary Channel 只能从 active Channel Directory 选择；
- 支持没有 Commission 候选的零额 Draft；
- 不把“没有候选”错误描述为创建失败；
- `periodStart` 只接受 UTC 自然月起点语义，`cutoffAt` 必须带时区且不早于 period end；
- 同一次可重试尝试保持稳定 idempotency key；用户明确修改业务事实后生成新 key；
- 409 显示安全冲突和 Request ID，不自动换 key 绕过冲突；
- 成功后只展示本次 API 返回的 Draft 汇总。

当前没有 Settlement GET 列表 API，因此不得伪造历史 Settlement 列表、把本地成功记录当服务端历史或宣称可恢复全部 Draft。

### 6.4 Tenant TEST RechargeOrder Audit

路由：`/enterprise/recharge-orders`

- 仅 `tenant_admin`；
- 使用 Session canonical `tenantId`，不允许 URL/query 覆盖；
- 只调用现有 Tenant GET RechargeOrder；
- 显示 TEST 标记、金额/币种、purchased/bonus credits、状态和安全时间字段；
- 如真实状态为 refunded/disputed，按订单审计事实显示，但不承诺退款到账；
- 不展示 Attribution snapshot、digest、Provider identity/payload 等内部证据；
- 不提供创建充值、模拟 Payment Event、退款、真实支付入口或 Conversion Rule UUID 输入。

## 7. 统一页面状态与敏感信息边界

每个真实页面必须具有可测试的状态模型：

- `loading`；
- `empty`；
- `ready`；
- `retrying`；
- 401 unauthorized/session expired；
- 403 permission denied；
- 404 scope not found；
- network/5xx service error；
- invalid API response。

### 7.1 401

- 清理 Pilot Session；
- 回到真实 Pilot Login；
- 仅保留经 Route Policy 校验的内部 returnTo；
- 不保留或展示旧商业数据。

### 7.2 403

- 保留有效 Session；
- 显示无权限，不跳入其他 Scope；
- 提供回安全默认路由；
- 不重试 Mock。

### 7.3 404

- 显示通用 Scope/资源不可用；
- 不披露“另一 Organization/Channel 中存在”；
- 不展示被探测的 canonical ID 或内部查询细节。

### 7.4 服务错误与重试

- 展示安全文案和可用 Request ID；
- Retry 只重新调用真实 Control API；
- 重新加载时清除当前商业投影，防止旧成功数据被误认成新结果；
- 不显示 SQL、stack、snapshot、digest、Secret、Token 或原始 Provider 内容；
- UI 日志也不得记录完整错误 body 或敏感 DTO。

## 8. 原子切片与提交边界

### 03.4A — Channel Reference/Directory 与严格商业 Client 基础

交付：

- Control API Current Channel Reference；
- Platform active Channel Directory；
- Service/Repository/Route/PostgreSQL 与授权 RED/GREEN；
- 前端严格商业 Client、DTO parser 与错误合同；
- 不新增页面、不修改 Router。

建议拆为独立提交：

```text
feat(control-api): expose commercial channel references
feat(control-api): wire commercial channel reference routes
feat(pilot): add strict commercial control api client
```

其中 `app.ts`、`app.test.ts`、`server.ts` 的共享 Bootstrap 接线必须单独提交，并明确通知 B 同步。

### 03.4B — Pilot Organization Commercial Route Policy

交付纯 Manifest/Policy、默认路由、安全 returnTo 和权限单测；不修改共享 Router/Sidebar/Topbar。

```text
feat(pilot): freeze organization commercial route policy
```

### 03.4C — Platform/Channel Commission Audit 真实只读页

交付真实页面、状态模型、canonical Channel 两段加载、安全投影与页面测试；Demo 页面不变。

```text
feat(pilot): show commission audit results
```

### 03.4D — Platform TEST Settlement Draft 安全操作页

交付 active Channel 下拉选择、TEST/draft/NON_QUOTE 文案、稳定幂等重试和当前 Draft 汇总；不做历史列表。

```text
feat(pilot): create test settlement drafts
```

### 03.4E — Tenant TEST RechargeOrder 只读审计页

交付 `tenant_admin` scoped 只读记录和退款/争议状态展示；不开放 POST。

```text
feat(pilot): show tenant recharge audit
```

### 03.4F — 共享 Pilot Router/Sidebar/Topbar 激活

最后一次性接入：

- `src/app/Router.tsx`；
- `src/layouts/Sidebar.tsx`；
- `src/layouts/Topbar.tsx`；
- 必要的共享 route/constants 文件。

要求：

- PLATFORM/CHANNEL 不再进入 `PilotTenantBoundary`；
- Tenant 现有 Project Boundary 和 Selector 行为保持；
- Platform/Channel 不显示 Project Selector；
- home、Workbench label、菜单和 direct URL 全部复用 03.4B Policy；
- Demo Router 保持不变。

```text
feat(pilot): activate organization commercial workbenches
```

此共享 Router/Layout 提交必须独立，并明确通知 B 后续修改共享导航前先同步。

最终文档收口另行提交：

```text
docs(business-plane): close commercial frontend audit
```

## 9. Test-first 顺序

### 9.1 第一个 RED

建议新增：

```text
apps/control-api/src/channels/routes.test.ts
```

首个关键合同：

> CHANNEL Session 的 `organizationId` 与数据库 canonical `channelId` 故意使用不同 UUID；请求 `GET /api/v1/channels/current` 必须返回 Repository 解析出的 canonical `channelId`，不得回显或猜测 Session `organizationId`。

当前预期 RED：Route 尚不存在，返回 `404 ROUTE_NOT_FOUND`。

同组后续 RED：

- PLATFORM/TENANT 探测 Current Channel 返回 404；
- CHANNEL 同 Scope 缺 `channel_admin` 返回 403；
- 无 canonical Channel mapping 返回 404；
- Platform Directory 仅返回 active CHANNEL Organization；
- 非 PLATFORM 探测 Directory 返回 404；
- PLATFORM 缺 `platform_admin` 返回 403；
- 空 Directory 返回 200 + `[]`。

### 9.2 前端 RED 顺序

1. 商业 Client 成功 DTO 与 malformed response fail-closed；
2. 401/403/404/5xx/Request ID 保留；
3. Organization Route Policy 默认路由和跨 Scope 拒绝；
4. Channel Audit 必须先解析 canonical Channel；
5. Platform Audit loading/empty/error/retry；
6. Settlement TEST/draft/NON_QUOTE、active Channel-only、稳定幂等 key；
7. Tenant Recharge tenant_admin-only；
8. 共享 Router/Sidebar/Topbar 分流和 Demo 回归。

## 10. Gate 与验收

每个原子切片必须独立通过适用 Gate：

- 定向 Vitest / PostgreSQL 合同测试；
- Control API 全量测试（涉及后端时）；
- 根前端定向测试与全量测试；
- TypeScript typecheck；
- Build；
- 定向 ESLint；
- Prettier；
- `npm run validate:governance`；
- `git diff --check`；
- StoryCanvas 路径 diff 必须为空。

03.4F 还必须人工/浏览器验证四类 Session：

- Platform Admin 默认进入 Platform Audit；
- Channel Admin 默认进入 Channel Audit，并使用 canonical Channel ID；
- Tenant Admin 保留 Tenant Project Workbench，并可进入 Recharge Audit；
- Content Operator 保留允许的 Tenant Project Workbench，但 Recharge 直接 URL 返回 403。

同时验证 Session Cookie、401 清 Session、安全 returnTo、403 保留 Session、404 不泄漏 Scope、Request ID 展示、loading/empty/service error/retry，以及 Demo 数据不进入 Pilot。

## 11. 明确排除

A-BIZ-03.4 不实现：

- LIVE Payment、Commission 或 Settlement；
- 真实 Product/SKU/Conversion Rule 目录与 RechargeOrder 创建 UI；
- 真实佣金比例的录入、展示或推导；
- Settlement `reviewed/approved` HTTP 命令；
- `paid`、到账、提现、负余额或钱包可用余额承诺；
- KYC、税务、发票、自动打款或真实 Provider；
- 部分退款、客户端退款动作或 Payment Event 模拟入口；
- 客户端“导出全部”、无限分页、任意搜索或跨 Channel 聚合；
- 跨 Tenant/Channel 的 User、Membership、Referral 或 Attribution 明细；
- StoryCanvas、B 的页面或 `apps/storycanvas/data/vendor/byteplus.ts`；
- Demo 页面、Demo Store 或 Demo Router 的业务改造。

完整审计导出、趋势看板、规则管理、审批工作流与生产运营能力等待 Wave 4 / A-BIZ-06 或独立获批计划。

## 12. 依赖、风险与协作通知

### 12.1 硬依赖

1. 03.4A Channel Reference/Directory 必须先于 Channel Audit 与 Settlement UI；
2. 03.4B Route Policy 必须先于 03.4F 共享 Router 激活；
3. 03.4C～03.4E 页面必须在 03.4F 前完成并通过独立测试；
4. Tenant Recharge POST UI 依赖未来安全 Product/SKU/Conversion Rule Directory，不属于本计划。

### 12.2 主要风险

- 把 Organization ID 猜成 Channel ID，导致错误 Scope 或数据越界；
- 从 Commission 记录反推 Channel，导致零候选 Draft 无法创建或目录不完整；
- 把 Demo Store 混入 Pilot，真实 API 故障时展示虚假成功；
- Router、Sidebar、Topbar 各自判断权限，造成菜单与直接 URL 不一致；
- 旧成功数据在 Retry 后继续显示，被误认为最新审计结果；
- 把 `draft`、净额或 refunded 状态写成到账、提现或真实退款承诺；
- 在没有服务端列表/导出合同的情况下用本地数据伪造完整历史；
- 共享 Bootstrap/Router 修改未独立提交，增加 A/B 冲突风险。

### 12.3 A/B 协作

- 03.4A 的 Control API `app.ts` / `app.test.ts` / `server.ts` 接线独立 commit 后，立即通知 B 同步；
- 03.4F 的 `Router.tsx` / `Sidebar.tsx` / `Topbar.tsx` / shared route constants 独立 commit 后，再次通知 B；
- 每个原子切片独立 commit；
- 禁止 `git add .`；
- 始终显式排除 `apps/storycanvas/data/vendor/byteplus.ts`；
- 未收到 push 指令前不 push。

## 13. 当前结论

A-BIZ-03.4 已冻结为六个切片：

```text
03.4A Channel Reference/Directory + Strict Client
03.4B Organization Commercial Route Policy
03.4C Platform/Channel Commission Audit
03.4D Platform TEST Settlement Draft UI
03.4E Tenant TEST RechargeOrder Audit
03.4F Shared Pilot Router/Sidebar/Topbar Activation
```

下一步只允许先执行 03.4A 的 canonical Channel Reference RED。未收到开始实现指令前，不修改业务代码。
