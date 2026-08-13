# A-BIZ-06C · Pilot Operations UI 计划

- 日期：2026-08-10
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`A_BIZ_06C_PLAN_FROZEN / READY_FOR_06C_1_RED`
- 上游：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`
- 实现基线：`158f792 docs(business-plane): close member operations api`
- 共享基线：Control API Bootstrap `0b177cf`；Pilot Router/Layout `b80e9ef`

## 1. 本切片目标

A-BIZ-06C 只把已经存在的 Terms、Invitation、Member 运营能力接入真实 Pilot 前端，并先补齐页面恢复所必需的最小 bounded 读合同。它不是完整 IAM、法务内容系统或生产运营后台，也不改变现有 TEST 商业事实。

交付目标：

1. 为 Platform Terms 管理补齐 bounded Document Directory 与 Version Directory；
2. 为 Platform/Channel/Tenant Invitation 管理补齐 bounded list query，保留确定性排序；
3. 扩展严格 Pilot Control API Client，接入 Terms、Invitation、Member 的真实 Cookie HTTP；
4. 新增 Platform Terms、分 Scope Invitation、current Organization Member 的真实运营页面；
5. 最后一次性扩展 Pilot Route Manifest、Router、Sidebar 与 Topbar，验证默认路由、direct URL、越权与 Project Context；
6. 为 06D 真实浏览器 E2E 提供稳定 UI 状态，但 06C 不冒充完成 Full Joint Gate。

## 2. 源码与合同审计结论

### 2.1 Pilot Client 尚无运营 API

`src/services/pilotControlApi.ts` 已有 Auth、Project、canonical Channel、active Channel Directory、Payment、Commission、Settlement 与 Recharge API，并统一使用：

- `credentials: 'include'`；
- 商业 GET 的 `cache: 'no-store'`；
- `PilotControlApiError` 保存 code、HTTP status 与 Request ID；
- 运行时 DTO 校验；
- Pilot 失败不回退 Demo Store、Mock 或 localStorage。

06C 必须延续该模式，不另建弱校验 fetch 封装。

### 2.2 Member HTTP 已就绪

06B 已交付：

```http
GET  /api/v1/organizations/current/members?status=all&limit=100
POST /api/v1/organizations/current/members/:membershipId/suspend
Content-Type: application/json

{ "expectedVersion": 2 }
```

Member 页面可以直接使用 canonical current Organization Scope，不接受 URL/query 中的任意 Organization ID。页面必须隐藏当前登录成员的停用动作，成功或 replay 后重新读取真实目录，并稳定处理 self、last-admin、stale version、inactive status 与 Session invalidation。

### 2.3 Invitation 列表当前是无界查询

现有 Invitation 管理路由已支持 Platform、Channel、Tenant create/list 与 revoke，但 GET 不接受 query；`InvitationService.listInvitations()` 直接调用 `listByIssuerOrganization()`，PostgreSQL 仅按 `created_at DESC, invitation_id DESC` 排序，没有 `LIMIT`。

因此 06C 页面不能把现有响应描述为 bounded。必须先给 list 增加 strict status/limit 合同，并在 Repository 再次 clamp；不能只在前端截断无界结果。

Invitation token 只存在于首次创建响应，replay 为 `null`，列表从不返回 token/digest。前端只能在创建成功后的当前内存状态中最小一次性展示，禁止写入 localStorage、sessionStorage、URL、日志、trace、错误详情或测试快照。

### 2.4 Terms 管理端缺少恢复所需的读合同

现有 Terms 管理 HTTP 只有 create document、create/update draft、publish、retire；Public current 只能读取某 locale 当前生效版本。`TermsStore` 没有 management list/read 方法。

Platform Terms 页面因此无法从服务端恢复：

- Document Directory；
- DRAFT / PUBLISHED / RETIRED Version History；
- 刷新后的 draft 编辑目标；
- publish/retire 后的真实状态。

冻结决定：先增加最小 management directories，禁止用组件本地 state、创建响应或 Public Current 反推管理历史。

### 2.5 Router/Layout 仍只注册商业页面

`pilotOrganizationRoutePolicy.ts`、`Router.tsx`、`Sidebar.tsx` 与 `Topbar.tsx` 当前只接入 Commission、Settlement、Recharge 商业页面。06C 运营页面必须先完成独立 Client/Page 测试，再以单独共享提交一次性激活；不得在多个页面切片中反复改共享导航骨架。

## 3. 06C.1 · Backend Bounded Read Contracts

### 3.1 Platform Terms Document Directory

```http
GET /api/v1/platform/terms/documents?status=all&limit=100
```

Query：

- `status=all|active|retired`，默认 `all`；
- `limit=1..100`，默认 `100`；
- unknown query、非整数、越界值返回 422；
- Route strict parse，Repository 再次 clamp 到 1..100。

响应：

```json
{
  "documents": [
    {
      "termsDocumentId": "uuid",
      "documentCode": "registration-notice",
      "title": "...",
      "status": "active",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

排序冻结为 `updated_at DESC, terms_document_id DESC`。空目录返回 200 与空数组。该接口不返回 User、Consent、Invitation 或内部数据库字段。

### 3.2 Platform Terms Version Directory

```http
GET /api/v1/platform/terms/documents/:documentId/versions?status=all&limit=100
```

Query：

- `status=all|DRAFT|PUBLISHED|RETIRED`，大小写严格，默认 `all`；
- `limit=1..100`，默认 `100`；
- path 必须为 UUID；unknown query、非法 status/limit 返回 422。

响应：

```json
{
  "versions": [
    {
      "termsVersionId": "uuid",
      "termsDocumentId": "uuid",
      "versionLabel": "v1",
      "status": "DRAFT",
      "content": "authorized operator input",
      "contentDigest": "sha256",
      "locale": "zh-CN",
      "publishedAt": null,
      "effectiveAt": null,
      "publishedBy": null,
      "supersedesTermsVersionId": null,
      "mustReaccept": false,
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

排序冻结为 `updated_at DESC, terms_version_id DESC`。Document 不存在或跨资源探测返回安全 404；空 Version Directory 返回 200 与空数组。返回 content 是 Platform 管理编辑所需事实，前端不得写日志、URL 或浏览器持久化。

### 3.3 Invitation bounded list

现有三类 GET 保持路径不变：

```http
GET /api/v1/platform/invitations?status=all&limit=100
GET /api/v1/channels/:channelId/invitations?status=all&limit=100
GET /api/v1/tenants/:tenantId/invitations?status=all&limit=100
```

Query：

- `status=all|active|revoked|exhausted|expired`，默认 `all`；
- `limit=1..100`，默认 `100`；
- Route strict parse，Repository 再次 clamp；
- expired 继续按服务端 `asOf` 计算，不能由浏览器本地时钟重写；
- 排序保持 `created_at DESC, invitation_id DESC`；
- 列表永不返回 token、token digest、creation idempotency key 或 request digest。

### 3.4 Auth、缓存与错误

所有 management GET 延续：

- 真实 `videoagent_session` HttpOnly Cookie 与 rotation Cookie；
- `cache-control: no-store`；
- Platform Terms 只允许 `platform_admin`；
- Invitation 分别只允许当前 PLATFORM/CHANNEL/TENANT 的对应管理员；
- Channel path 必须匹配 canonical channelId，Tenant path 必须匹配 Session tenantId；
- 401 未登录/失效，403 同 Scope 缺角色，404 path Scope/资源不存在，409 生命周期冲突，422 query/path/body 无效；
- 错误信封保留 Request ID；unexpected 5xx 不泄漏 SQL、password、token、digest 或 stack。

本切片不新增 migration；若 PostgreSQL query 证据显示 bounded 排序无法稳定或性能不可接受，再独立冻结索引 migration，不在实现中顺手扩表。

## 4. 06C.2 · Strict Pilot Operations Client

在 `src/services/pilotControlApi.ts` 增加并测试：

- Terms：list documents、list versions、create document、create/update draft、publish、retire；
- Invitation：按 PLATFORM/CHANNEL/TENANT list/create/revoke；
- Member：list current Organization、suspend；
- 对 create/revoke/publish/suspend 解析 `idempotency-replayed`；
- 对 canonical Channel/Tenant Scope 做本地格式校验，但最终权限只以服务端结果为准。

严格规则：

1. 请求始终 `credentials: 'include'`；management GET 使用 `cache: 'no-store'`；
2. DTO 严格验证 UUID、enum、正整数 version/count、email、digest、timestamp 与 nullable 字段；
3. API 成功响应出现未知敏感字段时 fail closed，至少拒绝 `tokenDigest`、`creationIdempotencyKey`、`creationRequestDigest`、password、session/token/provider secret 类字段；
4. 401/403/404/409/422/5xx 与 Request ID 原样保留为安全错误对象；
5. 401 由页面触发现有 Pilot Session/Project Context 清理流程；
6. 不回退 Demo、Mock、fixture 或 localStorage；
7. Invitation token 只作为 create 调用返回值保留在调用方当前内存中，replay 的 `null` 不恢复旧 token。

首个 RED：导入尚不存在的 `listPilotCurrentOrganizationMembers()`，验证真实 Cookie、`no-store`、bounded query、严格 Member DTO 与敏感字段拒绝；随后实现最小 Green，再继续 Terms/Invitation Client。

## 5. 06C.3 · Platform Terms Operations Page

UI 路由：`/platform/terms`

页面状态必须覆盖：

- Document Directory loading / empty / ready / error / retry；
- Version Directory loading / empty / ready / error / retry；
- create document；
- create/update DRAFT；
- publish 与 retire 的确认、replay、409 conflict 和刷新；
- 401、403、404、422、5xx、invalid response 与 Request ID；
- 刷新后完全从真实服务端目录恢复，不依赖组件历史。

边界：

- 工程师不 seed、不代写、不自动发布正式 Terms 正文；
- UI 只允许授权 Platform 管理员录入业务/法务提供的正文；
- 不实现富文本附件、电子签章、法务审批流、跨 locale 自动翻译或批量发布；
- 不展示 User Consent 明细或导出。

## 6. 06C.4 · Organization Invitation Operations Pages

UI 路由：

```text
/platform/invitations
/channel/invitations
/enterprise/invitations
```

Scope：

- PLATFORM 使用 Session Platform Scope；可选 attribution Channel 必须来自真实 active Channel Directory；
- CHANNEL 先读取 `/api/v1/channels/current` 的 canonical channelId，再调用 Channel Invitation API，不猜测 `organizationId === channelId`；
- TENANT 使用 Session `tenantId`，仅 `tenant_admin` 可访问；
- `pilot_support` 与 `content_operator` 不扩权。

页面覆盖 bounded list、empty、loading、retry、create、revoke、expired、revoked、exhausted、duplicate/replay 和安全错误。首次 token 使用显式“仅本次可见”区域，离开/刷新/再次创建即清除；不提供历史 token 恢复。

## 7. 06C.5 · Current Organization Member Operations Pages

UI 路由：

```text
/platform/members
/channel/members
/enterprise/members
```

三条路由复用一个 current Organization Member 页面组件，但由 Manifest 固定 Organization Type 与角色：

- PLATFORM：`platform_admin`；
- CHANNEL：`channel_admin`；
- TENANT：`tenant_admin`；
- `pilot_support`、`content_operator` 直接 URL 403，菜单隐藏。

页面覆盖：

- bounded list 与 status filter；
- loading、empty、service error、retry；
- suspend 二次确认与 expectedVersion；
- self 不显示操作；last-admin、stale、inactive、replay 使用固定安全状态；
- 成功或 replay 后重新读取目录；
- 被停用成员的旧 Session 在下一请求 401 时清理现有 Pilot Session/Project Context。

明确不实现：角色编辑、新增成员、恢复、删除、批量操作、密码重置、MFA、全局 User suspend、Support Grant 或伪造 Audit Export。

## 8. 06C.6 · Shared Pilot Router / Sidebar / Topbar Activation

06C.3～06C.5 页面与 Client 测试通过后，单独修改共享文件：

- `src/domain/pilotOrganizationRoutePolicy.ts`；
- `src/app/Router.tsx`；
- `src/layouts/Sidebar.tsx`；
- `src/layouts/Topbar.tsx`；
- 对应 policy/router/layout tests。

冻结决定：

1. Platform 默认路由继续 `/platform/commission-audit`；
2. Channel 默认路由继续 `/channel/commission-audit`；
3. Tenant 默认路由继续现有首个可见 Project Workbench；无可见 Project 时保留现有安全行为，不因 06C 暗改默认落点；
4. 06C 运营页均不需要 Project Context；Tenant 进入 Invitation/Member 页时 Topbar 不伪造 Project；
5. direct URL、登录 returnTo、Sidebar visibility 与 Router authorization 必须复用同一 Manifest/Policy；
6. Organization Type 路由不匹配返回 404；同 Scope 缺角色返回 403；未认证回登录；未知路径 404；
7. Pilot 页面失败不渲染 Demo 页面，不读取 Demo Store；
8. 共享提交完成后必须明确通知 B 同步，再修改这些文件。

## 9. 原子提交顺序

| 切片      | 内容                                                   | 共享文件            | 建议提交                                                 |
| --------- | ------------------------------------------------------ | ------------------- | -------------------------------------------------------- |
| 06C Plan  | 本计划、父计划、STATUS、HANDOFF、CHANGELOG、桌面知识库 | 否                  | `docs(business-plane): freeze pilot operations ui plan`  |
| 06C.1a    | Terms Repository/Service bounded management read       | 否                  | `feat(control-api): add bounded terms management reads`  |
| 06C.1b    | Terms HTTP GET routes                                  | 否；复用现有 Router | `feat(control-api): expose terms management directories` |
| 06C.1c    | Invitation bounded Repository/Service/Route query      | 否；复用现有 Router | `feat(control-api): bound invitation management lists`   |
| 06C.2     | Strict Pilot Terms/Invitation/Member Client            | 否                  | `feat(pilot): add operations control api client`         |
| 06C.3     | Platform Terms 页面                                    | 否                  | `feat(pilot): add terms operations page`                 |
| 06C.4     | Invitation 页面                                        | 否                  | `feat(pilot): add invitation operations pages`           |
| 06C.5     | Member 页面                                            | 否                  | `feat(pilot): add member operations pages`               |
| 06C.6     | Route Policy + Router + Sidebar + Topbar 激活          | 是                  | `feat(pilot): activate operations workbenches`           |
| 06C Close | C0 与桌面知识库收口                                    | 否                  | `docs(business-plane): close pilot operations ui`        |

禁止 `git add .`；每次只显式暂存当前切片文件。StoryCanvas 与 B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 始终排除。

## 10. Test-first 与 Gate

### 10.1 RED 顺序

1. Client Member list import/strict DTO RED；
2. Terms Repository document/version bounded ordering 与 404 RED；
3. Terms Service/Route auth、query、Cookie、Request ID 与 no-store RED；
4. Invitation limit/status/asOf/filter 与 token non-disclosure RED；
5. Terms、Invitation、Member 页面状态机 RED；
6. Route Policy/default/direct URL/Sidebar/Topbar RED。

虽然首个可见 RED 是 Client Member 合同，06C.1 后端缺口仍必须在 Terms/Invitation 页面实现前完成；不以测试顺序规避依赖顺序。

### 10.2 必跑验证

每个原子切片至少执行：

- 对应 Vitest 定向；
- Control API 变更执行 typecheck/build；
- 前端变更执行 Root typecheck/build 或等价 build；
- PostgreSQL Repository 变更使用合法 dedicated `_test` database，缺环境不得记为 PASS；
- ESLint 定向；
- Prettier check/write；
- `npm run validate:governance`；
- `git diff --check`；
- `git diff -- apps/storycanvas` 必须为空。

06C 收口不等于 06D Pilot Playwright、06E A/B 黄金路径、06F migration/docs/full Joint Gate 已完成。

## 11. 风险与 fail-closed 边界

1. **Terms 正文风险**：正式正文必须来自业务/法务授权输入；工程实现不得编造或自动发布。
2. **Invitation Token 风险**：只在首次创建内存态展示，replay/刷新后不可恢复；不持久化、不记录。
3. **无界列表风险**：Invitation 与 Terms 目录必须服务端 bounded；前端切片不能替代服务端上限。
4. **Scope 风险**：Channel 只能使用 canonical current Channel；Tenant 只能使用 Session tenantId；不得猜 ID。
5. **共享导航风险**：Router/Layout 只在 06C.6 单独提交，完成后通知 B。
6. **Session 风险**：401 必须清理现有 Pilot Session/Project Context，不能继续展示缓存运营数据。
7. **敏感信息风险**：UI、错误、日志与测试不得泄漏 token、digest、password、Session、SQL、stack、Provider Secret 或内部 payload。
8. **范围扩张风险**：不实现角色编辑、恢复/删除/批量成员、法务审批、Consent 导出、Support Grant 或未规划 HTTP。
9. **商业边界**：Settlement 继续是 `TEST + draft`、非到账、非提现；不实现 LIVE、真实比例、paid、提现、KYC、税务、发票、自动打款或 Commission/Settlement review/approve。
10. **StoryCanvas 边界**：06C 不修改 StoryCanvas；B 的未跟踪 vendor 文件不得暂存或提交。

## 12. 完成定义

只有以下全部满足，才能标记 `A_BIZ_06C_COMPLETE / PILOT_OPERATIONS_UI_READY`：

- Terms/Invitation bounded management read 合同完成并有真实 PostgreSQL/HTTP 证据；
- Strict Pilot Client 完成且无 Demo/Mock/localStorage fallback；
- Terms、Invitation、Member 页面状态与安全边界完成；
- Shared Router/Layout 独立激活并通知 B；
- 定向测试、build、lint、Prettier、Governance、diff-check 通过；
- StoryCanvas tracked diff 为零；
- C0 与桌面知识库收口。

仍不得宣称：完整 IAM、法务系统、正式 Terms 内容上线、A-BIZ-06 总体完成、Full Joint Gate PASS 或 LIVE Operations Ready。
