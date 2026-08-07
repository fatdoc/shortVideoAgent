# Control API · 受控真实试点 v0

该服务是 SaaS 控制平面的真实后端起点。它与根目录的 React Demo 和 `apps/storycanvas/` 并存，不把 LocalStorage/Mock 直接升格为生产事实源。

## 当前切片

- 独立 Express + TypeScript 服务；
- PostgreSQL + Knex 可重复迁移；
- 单 Tenant 试点所需的身份、项目、Brief、脚本审批、生产包、Grant、钱包、append-only 账本、任务、回执、素材、导出和 Outbox 表；
- liveness/readiness 接口；
- 单 Tenant 白名单登录、服务端 Session 与 `tenant_admin` / `content_operator` / `pilot_support` 角色读取；
- Node.js 内置 scrypt 密码慢哈希，数据库只保存 Session Token HMAC digest；
- HttpOnly、SameSite=Lax Cookie（production 强制 Secure）、定时 Session 轮换和登出撤销；
- 本地 IP + 邮箱维度的登录失败限流，以及仅允许站内路径的安全回跳；
- 三类 Invitation 生命周期、body Token Public Preview、组织范围管理与不可逆 Preview 限流键；
- 独立的 ProjectGrant 签名密钥与可轮换 `kid`；启动时缺失即拒绝运行，不复用 Session 根密钥；
- 生产环境秘钥与本地数据库凭据拒绝规则。

这一切片已实现生产包与短时 ProjectGrant HTTP 路由；尚未实现用户上传 OSS 签名和
StoryCanvas 回执入账，不应公开注册或直接对公网开放。

## 本地启动

```bash
docker compose -f compose.pilot.yaml up -d postgres
npm --prefix apps/control-api install
npm --prefix apps/control-api run db:migrate
npm --prefix apps/control-api run auth:bootstrap
npm --prefix apps/control-api run dev
```

首次执行 `auth:bootstrap` 前必须显式提供 `PILOT_TENANT_ID`、`PILOT_TENANT_NAME`、
`PILOT_ADMIN_EMAIL`、`PILOT_ADMIN_DISPLAY_NAME` 和至少 14 字符的
`PILOT_ADMIN_PASSWORD`。命令不提供任何默认账号或密码，也不会打印凭证。重复运行默认不改密码；
只有显式设置 `PILOT_REPLACE_PASSWORD=true` 才会换密并撤销该用户全部活跃 Session。

认证接口：

- `POST /api/v1/auth/login`：邮箱、密码及可选站内 `returnTo`；
- `GET /api/v1/auth/session`：返回当前用户、唯一 Tenant、角色和到期时间；
- `POST /api/v1/auth/logout`：撤销服务端 Session 并清除 Cookie。

邀请接口：

- `POST /api/v1/public/invitations/preview`：只从 body 接收 Token，并返回注册展示所需的最小白名单字段；
- `POST/GET /api/v1/platform/invitations`：PLATFORM 管理员创建和列出邀请；
- `POST/GET /api/v1/channels/:channelId/invitations`：CHANNEL 管理员在服务端校验后的 Channel Scope 内创建和列出邀请；
- `POST/GET /api/v1/tenants/:tenantId/invitations`：TENANT 管理员创建和列出固定 `content_operator` 成员邀请；
- `POST /api/v1/invitations/:invitationId/revoke`：按当前 issuer Organization 撤销邀请。

Public Preview 限流通过 `INVITATION_PREVIEW_MAX_ATTEMPTS`、
`INVITATION_PREVIEW_WINDOW_SECONDS` 和 `INVITATION_PREVIEW_BLOCK_SECONDS` 显式配置；
本地默认值不是正式公网安全参数，多实例部署前需替换为共享限流基础设施。

生产平面内部授权接口：

- `POST /api/v1/internal/project-grants/introspect`：仅供私网 StoryCanvas receiver 调用；
  同时要求 `X-Production-Plane-Internal-Token` 和 `Authorization: Bearer <ProjectGrant>`，
  返回签名 `jti` 与数据库绑定后的 `grantId` 以及最小 tenant/project/package/capability/scope/expiry，
  不接受或回显 body token/identity。

默认端口：

- Control API: `127.0.0.1:10600`
- PostgreSQL: `127.0.0.1:54329`

验证：

```bash
curl http://127.0.0.1:10600/health/live
curl http://127.0.0.1:10600/health/ready
npm --prefix apps/control-api test
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
```

## 部署边界

- `SESSION_SECRET` 在 production 必须显式配置且至少 32 字符。
- `PROJECT_GRANT_SIGNING_SECRET` 与 `PROJECT_GRANT_ACTIVE_KID` 在所有环境都必须显式配置；
  Grant 密钥不得与 `SESSION_SECRET` 共用。生产平面默认通过 introspection 验证，不取得签名密钥；
  若后续增加本地验签，只能使用独立 Grant keyring，并按 `kid` 先部署验证键再轮换。
- `PRODUCTION_PLANE_INTERNAL_TOKEN` 必须至少 32 bytes，且不得复用 Session 或 ProjectGrant 密钥；
  仅通过私网 Secret 注入给生产平面，不写入 URL、请求体、日志或回执。
- production 不存在默认白名单账号、Tenant 或初始化密码。
- `DATABASE_SSL=require` 时启用 PostgreSQL TLS 证书校验。
- 应用不记录 `DATABASE_URL`、Session Token、Grant Token 或上游 API Key。
- 额度账本表由数据库 Trigger 禁止 update/delete，只能追加。
- 正式上云前还需补充 RDS CA 管理、结构化日志、备份演练、限流和依赖漏洞 Gate。
