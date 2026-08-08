# A-BIZ-03.3D · Scoped Commission Read APIs 计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 实现基线：`66301c5 feat(control-api): reverse refundable test payments atomically`
- 状态：`PLAN_FROZEN / READY_FOR_RED`
- 前置：A-BIZ-03.3A～03.3C 已完成

## 1. 目标

为现有 append-only Commission Shadow Ledger 增加最小只读审计 API，使平台管理员和渠道管理员能够在严格 Scope 下查看 Calculation Outcome、Accrual 与 Reversal，同时保持 Tenant/Content Operator 不可见、跨 Channel 不可探测、响应字段最小化。

本切片只读取既有事实，不创建 Rule、不修改佣金、不生成 Settlement、不承诺可提现或已到账。

## 2. HTTP 合同

### 2.1 Platform Admin

```text
GET /api/v1/platform/commission-audit/calculations?limit=50
GET /api/v1/platform/commission-audit/accruals?limit=50
GET /api/v1/platform/commission-audit/reversals?limit=50
GET /api/v1/platform/commission-audit/manual-reviews?limit=50
```

- active Organization 必须为 `PLATFORM`；否则统一 404，避免向 Tenant/Channel 暴露平台佣金路由；
- 同一 PLATFORM Scope 内缺少 `platform_admin` 返回 403；
- `manual-reviews` 仅返回 `outcome = manual_review` 的 Calculation Outcome；
- 平台列表可跨 Channel，但仍只返回冻结的安全审计投影。

### 2.2 Channel Admin

```text
GET /api/v1/channels/:channelId/commission-audit/calculations?limit=50
GET /api/v1/channels/:channelId/commission-audit/accruals?limit=50
GET /api/v1/channels/:channelId/commission-audit/reversals?limit=50
```

- active Organization 必须为 `CHANNEL`，且 `:channelId` 必须等于该 Organization 对应的 canonical Channel；
- 不属于当前 active Organization、Channel 不存在或非 Channel Organization 均返回 404；
- canonical Channel 相同但缺少 `channel_admin` 返回 403；
- Channel Calculation 列表只返回 `beneficiary_channel_id = :channelId` 的事实，因此 `not_attributed`、`attribution_expired` 或无受益 Channel 的 `manual_review` 不向 Channel 暴露；
- Channel 不提供 manual-review 专用接口，避免把平台待裁决异常误示为渠道可结算金额。

## 3. 列表与排序

- `limit` 默认 50，最小 1，最大 100；非法参数返回 400；
- 所有列表使用稳定排序：`occurred_at DESC, primary_id DESC`；
- 本切片不引入 cursor、导出或任意过滤器，避免无界查询与查询面扩张；
- 空列表返回 200 和空数组，不把“当前没有审计事实”误报为资源不存在。

## 4. 安全响应投影

允许返回：

- 审计记录 ID；
- 必要的 PaymentEvent、RechargeOrder、Calculation/Accrual/Reversal 关联 ID；
- beneficiary Channel ID；
- basis/commission/reversal 整数 minor-unit 金额与 currency；
- outcome、reasonCode、eligibleAt、occurredAt、createdAt。

禁止返回：

- `calculation_snapshot`、`reversal_snapshot` 及其 digest；
- Provider 原始 payload、签名、secret、内部 token；
- Rule 审批成员、Settlement 审批凭据；
- User、Tenant、Membership、Referral 来源明细；
- 其他 Channel 的记录或可推导其业务数据的聚合。

## 5. 模块与改动边界

新增独立模块：

```text
apps/control-api/src/commissions/types.ts
apps/control-api/src/commissions/errors.ts
apps/control-api/src/commissions/repository.ts
apps/control-api/src/commissions/service.ts
apps/control-api/src/commissions/routes.ts
```

测试：

```text
apps/control-api/src/commissions/service.test.ts
apps/control-api/src/commissions/routes.test.ts
apps/control-api/src/commissions/repository.postgres.test.ts
```

共享 Bootstrap 只做最小接线：

```text
apps/control-api/src/app.ts
apps/control-api/src/app.test.ts
apps/control-api/src/server.ts
```

共享接线必须与功能实现分开提交，便于 B 同步；不修改 `config.ts`，因为沿用现有 Session/Auth 配置且不新增 secret。

## 6. Test-first 合同

### 6.1 Service/Scope

1. Platform Admin 可读全局 Calculation/Accrual/Reversal/manual-review；
2. PLATFORM Scope 缺 `platform_admin` 为 403；
3. Tenant/Content Operator 探测平台或渠道佣金路由为 404；
4. Channel Admin 只能读 canonical 自身 Channel；
5. 跨 Channel 即使 ID 合法也为 404；
6. 同 Channel 缺 `channel_admin` 为 403；
7. 权限失败时不执行佣金列表查询。

### 6.2 Repository

1. Platform 列表跨 Channel 且稳定倒序；
2. Channel 列表只返回 beneficiary Channel 匹配事实；
3. Channel Calculation 不返回 beneficiary 为 null 的 Outcome；
4. manual-review 只返回 `manual_review`；
5. Reversal 通过 Accrual Scope 过滤，不能仅凭 Reversal ID 或 PaymentEvent 泄漏；
6. limit 在 Repository 层再次 clamp 到 1～100；
7. 所有 DTO 不携带 snapshot/digest、Provider payload 或审批字段。

### 6.3 Router/Bootstrap

1. 无 Session 401；Session 轮换继续写 Cookie；
2. UUID/limit 非法为 400；
3. 404/403 使用稳定安全错误码与消息；
4. 每个成功端点返回明确数组 key；
5. `createApp` 未注入 Router 时保持现有 404，注入后挂载 `/api/v1`；
6. 不影响现有 Auth/Terms/Invitation/Registration/Production/Payment 路由。

## 7. 提交切片

1. 计划与 C0 状态：

```text
docs(business-plane): freeze scoped commission read api plan
```

2. Commission types/repository/service/routes 与测试：

```text
feat(control-api): expose commission audit results
```

3. 共享 Bootstrap 接线：

```text
feat(control-api): wire commission audit routes
```

4. 最终 C0/Handoff/桌面知识库收口：

```text
docs(business-plane): close scoped commission read apis
```

## 8. Gate

```bash
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npx eslint apps/control-api/src/commissions apps/control-api/src/app.ts apps/control-api/src/app.test.ts apps/control-api/src/server.ts
npx prettier --check docs/program/threads/C0/A_BIZ_03_3D_SCOPED_COMMISSION_READ_APIS_PLAN.md apps/control-api/src/commissions apps/control-api/src/app.ts apps/control-api/src/app.test.ts apps/control-api/src/server.ts
npm run validate:governance
git diff --check
```

PostgreSQL/Supertest 如受本机端口沙箱限制，使用已批准的提升权限运行，不把环境限制误报为代码失败。

## 9. 明确不做

- Commission Rule 管理 API；
- Settlement Draft、review、approve；
- paid、提现、KYC、税务、发票或自动打款；
- LIVE Payment/Commission；
- 部分退款或已消费额度追偿；
- 任意搜索、导出、聚合报表或跨 Tenant 业务明细；
- 前端 UI；
- StoryCanvas 或 B 的生产平面代码。

## 10. 完成定义

- Platform/Channel/Tenant 的 404/403 Scope 合同通过；
- Calculation/Accrual/Reversal/manual-review 均为 bounded、稳定排序、安全投影；
- PostgreSQL、Service、Router、Bootstrap、全量测试与工程 Gate 全部通过；
- 共享 Bootstrap 形成独立 commit 并在 Handoff 明确要求 B 同步；
- C0 STATUS/HANDOFF/CHANGELOG 与桌面项目记忆完成同步。
