# A-05 · 单客户白名单真实试点 v0

> 日期：2026-08-05  
> 方案：模块化控制平面 + StoryCanvas 生产平面  
> 状态：`A05_STARTED / FOUNDATION_VERIFIED`  
> 分支：`codex/pilot-v0-control-plane`  
> 基线：`main@a683d33`

> 执行方式：从 A-05.2 起采用 A/B 双线并行，详见 `A05_TWO_PERSON_EXECUTION_SPLIT.md`。

## 1. 上线定义

本轮只交付单客户、白名单、受控真实试点，不宣称公开商业 SaaS 上线。黄金路径使用真实数据库、真实对象存储、真实 AI 调用和真实 MP4 导出；安全、监控和运营允许内部人工兜底。

## 2. 事实源与边界

- Control API 是 Tenant、Membership、Project、Brief、Script Approval、Package、Grant、Wallet 和 Credit Ledger 的事实源。
- StoryCanvas 是 Generation Task、Media Asset 和 Export Artifact 的事实源。
- 双方只通过版本化 Production Package、Project Grant、Task/Asset/Export/Usage Receipt、标准错误码和幂等键交互。
- 现有 `v0.1` 合同继续服务 D2 Mock Demo；其中硬编码的 `demo-local-001`、C1–C8 和 Mock Grant 不进入真实试点 API。
- 上游 API Key、客户价格和钱包余额不进入 StoryCanvas 前端或 Production Package。

## 3. 一周切片

### A-05.1 基座（已完成）

- 新建 `apps/control-api/` 独立 Node.js + TypeScript + Express 服务。
- 新建 PostgreSQL + Knex 迁移与本地 Compose。
- 建立 19 张试点核心表，包含 Auth Session、Project、Approval、Package、Grant、Wallet、Reservation、Ledger、Task、Receipt Inbox、Asset、Export、Outbox 和 Idempotency Record。
- PostgreSQL Trigger 禁止额度账本 update/delete。
- 增加 `/health/live` 与 `/health/ready`。

### A-05.2 真实登录与单 Tenant（已完成）

- 白名单用户初始化，密码使用 scrypt/Argon2id 等服务端慢哈希。
- 服务端 Session，Cookie 强制 HttpOnly / SameSite / Secure（HTTPS）。
- 单 Tenant Membership 和 `tenant_admin` / `content_operator` 最小角色。
- CSRF、登录限流、Session 轮换、登出撤销和安全回跳。

实施结果：20/20 测试、TypeScript、Build、定向 ESLint 通过；实库验证 `login → session → logout → 旧 Cookie 401` 通过，数据库仅保存 Session Token HMAC-SHA256 digest。

### A-05.3 真实项目、Brief、脚本审批

- Tenant-scoped Project CRUD。
- 版本化 Brief 与 ScriptVersion。
- 脚本审批/撤销状态机；未批准脚本禁止发包。
- 所有写入带幂等键和 Tenant 边界测试。

### A-05.4 OSS 与生产合同

- OSS 短时上传授权；回传后校验 tenant/project key prefix、MIME、大小和 checksum。
- 将真实 Production Package / Grant 与 D2 Demo `v0.1` 分版。
- Grant 使用服务端签名且数据库只存 token digest，限定 Tenant、Project、Capability 和过期时间。

### A-05.5 额度与 StoryCanvas 回执

- 任务创建前 reserve，成功且形成 deliverable Asset 后 consume，失败/取消 release。
- Receipt Inbox 先持久化后处理，使用 payload digest 防重放冲突。
- 同事务写业务状态和 Outbox，同进程 Worker 可重试投递。
- 管理员人工充值也必须生成 append-only Ledger 和审计记录。

### A-05.6 部署与 Gate

- 阿里云 RDS PostgreSQL、OSS、HTTPS 和最小日志/告警。
- 迁移前备份、恢复演练、试点数据清理策略。
- 用唯一白名单客户完成真实黄金路径。

## 4. A-05.1 验证证据

- Control API Test：2 files / 7 tests PASS。
- TypeScript typecheck：PASS。
- Build：PASS。
- PostgreSQL 14 临时实例：migration up / rollback / up PASS。
- 核心表数：19。
- Ledger mutation 验证：`update` 被 `credit ledger is append-only` Trigger 拒绝。
- 编译后 API + 真实 PostgreSQL：`/health/live` 200，`/health/ready` 200。
- Docker Compose 本机实跑未执行：Docker daemon 未启动；已使用独立临时 PostgreSQL 完成等价迁移验证。

## 5. 暂不进入本周

- 公开注册、在线支付、发票和自动结算。
- 多客户商业化运营、复杂 RBAC 和渠道分销。
- 多区域容灾、独立消息队列和多供应商自动调度。
- 将 StoryCanvas 改造为租户、钱包或客户价格的事实源。
