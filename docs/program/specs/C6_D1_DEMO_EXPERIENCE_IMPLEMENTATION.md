# C6 D1 SaaS Demo Experience · 实现证据

> 状态：`ROUND_3_UI_IMPLEMENTED / C7_STATIC_REVIEW_REQUIRED`
>
> Owner：C6 · UX 与老板演示闭环负责人
>
> 日期：2026-07-30
>
> 工作树：`/Users/docfat/.codex/worktrees/17ce/videoagent`
>
> 基线：detached `HEAD` `8d847adaa4f25b3531f882c7c3a9453e58dff8ba`
>
> 限制：按 C0 指令未运行 test、build、lint 或 governance；本文不是运行时 Gate PASS 证据。

## 1. 实现结论

D1 P0 Fix Wave 已在现有 C6 UI 上完成增量接线：

- 四工作台入口：平台管理员、渠道代理、企业客户、媒体生产。
- 工作台与当前组织分别可切换；Organization、Tenant、Project、Role 分字段常驻，不用 `organizationId` 冒充 tenant/project。
- 平台/渠道/企业产品区只读取 C4 commercial fixture。
- storyboard 复用唯一海底捞 `DemoWorkspace`，可查看 8 镜、05/07 状态并创建 canonical package。
- 企业项目生产控制面显式提供 `approveCanonicalScript()`、`revokeCanonicalScript()`、`blockCanonicalScript()`；非 approved 状态禁止发包。
- StoryCanvas 入口只调用 `dispatchCanonicalPackage()`；POST 返回 accepted/duplicate 后才开放 Store 返回的 deepLink，offline/rejected/error 使用 `retryCanonicalPackage()`。
- 回执只通过 `syncStoryCanvasReceipts()` 同步，显示 pending/delivered/acknowledged/retry 和 Task/Asset/ExportReceipt。
- 成功/失败额度分支只调用 `reserveCanonicalSuccess()` / `reserveCanonicalFailure()`；钱包、Reservation、Ledger 只读 `useControlPlaneStore`。
- `qa_blocked` 与 `playable=false` 显式展示；静态素材、FALLBACK 或无已批准输出资产的 ExportReceipt 不包装成成片。
- 生产页复位只调用 Store 的单一 `resetDemoReady()` 包装入口，并按 Store 的 `lastAction/error/stateName` 显示 ready/error。

## 2. C4 Foundation 同步证据

从权威集成工作树逐字节同步：

- `src/domain/controlPlane.ts`
- `src/domain/controlPlaneSchemas.ts`
- `src/domain/controlPlaneUtils.ts`
- `src/domain/creditLedger.ts`
- `src/mocks/controlPlaneDemo.ts`
- `src/services/controlPlaneMockAdapter.ts`
- `src/stores/controlPlaneStore.ts`
- `docs/program/contracts/v0.1/*`
- `src/stores/projectStore.ts` 的 `resetDemoReady()` 集成

`controlPlaneUtils.ts` SHA-256：

```text
6080d8986f33a6031bd6d58282f87865b5d43c4bdb741990bacbaf5c5e5a9324
```

UI 没有创建第二个 Store、商业 fixture、品牌事实或 Truth Manifest。

## 3. 可运行路由

### 平台管理

- `/platform/overview`
- `/platform/organizations`
- `/platform/catalog`
- `/platform/production-receipts`

### 渠道代理

- `/channel/overview`
- `/channel/products`
- `/channel/customers`
- `/channel/customers/:tenantId/usage`

### 企业客户

- `/dashboard`
- `/enterprise/products`
- `/projects/new`
- `/projects/demo-local-001/brand`
- `/projects/demo-local-001/script`
- `/projects/demo-local-001/storyboard`
- `/projects/demo-local-001/rough-cut`
- `/projects/demo-local-001/usage`
- `/projects/demo-local-001/delivery`

### 媒体生产

- `/production/overview`
- `/production/inbox/demo-local-001`
- `/production/canvas/demo-local-001`
- `/production/tasks/demo-local-001`
- `/production/assets/demo-local-001`
- `/production/export/demo-local-001`

## 4. C6 16 步覆盖

| 步骤 | 证据入口 | 状态 |
|---|---|---|
| 1. 重置与四工作台切换 | 全局 Topbar / Truth Bar | 已实现 |
| 2. 平台产品与 RateCard | `/platform/catalog` | 已实现 |
| 3. 代理共用层级 UI | `/channel/overview`、`/channel/products` | 已实现 |
| 4. 企业已购/未购买 | `/enterprise/products` | 已实现 |
| 5. 唯一海底捞项目 | `/dashboard` | 复用既有成果 |
| 6. 品牌事实与 C1—C8 | `/projects/demo-local-001/brand` | 复用既有成果 |
| 7. A/B/C 脚本与风险 | `/projects/demo-local-001/script` + `/production/overview` 审批区 | 复用脚本事实；approve/revoke/block 已接 C4 Store |
| 8. 8 镜与创建生产包 | `/projects/demo-local-001/storyboard` | 已实现 |
| 9. Package / Grant | `/production/inbox/demo-local-001` | `dispatchCanonicalPackage()` 原子创建/复用并 POST |
| 10. StoryCanvas 发包入口 | `/production/canvas/demo-local-001` | accepted/duplicate 后开放 deepLink；离线检查器与 retry 已实现 |
| 11. 成功支线冻结 120 | `/production/tasks/demo-local-001` 或 rough-cut | 已实现 |
| 12. TaskReceipt + AssetReceipt + 100/20 | 同上 | `syncStoryCanvasReceipts()` + Outbox delivery/ack 状态 |
| 13. 失败支线 80 → 0 + 80 | 同上 | 已实现 |
| 14. 时间线 / QA | `/projects/demo-local-001/rough-cut` | Truth-gated；真实 QA/05 补拍 AssetReceipt 开放 |
| 15. 导出与 ExportArtifact | `/projects/demo-local-001/delivery`、`/production/export/demo-local-001` | ExportReceipt 独立展示；无完整证据时 `playable=false` |
| 16. 企业/平台回执回看 | `/projects/demo-local-001/usage`、`/platform/production-receipts` | 已实现 |

## 5. Truth 与失败状态

Truth 标识只读取 `snapshot.truthManifest`：

- `REAL-UI`
- `REAL-CAP`
- `MOCK-CONTRACT`
- `HYBRID`
- `LOCKED`
- `FALLBACK`

状态覆盖：

- 空：任务、资产、额度流水和来源链均有空态。
- 错：ControlPlaneStore error 展示 code、message 和 retryable。
- 权限不足：渠道首页固定说明商业 scope 不等于 Tenant 生产内容权限。
- 未购买：数字人/API 锁定，按钮不可执行；老板 IP/电商仅说明态。
- 余额不足：按 Wallet available 与 RateCard maxReservedCredits 动态显示门禁，不部分冻结或透支。
- StoryCanvas 离线：显示 `HTTP_NOT_CONNECTED`，使用 canonical package 检查器降级。
- 导出未接：读取 `production.basic-ffmpeg-merge` Truth，禁用真实导出动作。

## 6. P0 状态

| P0 | 状态 | 证据 / 剩余项 |
|---|---|---|
| P0-01 四工作台与 active context | C6 UI 已关闭，待 C7 复核 | 工作台/当前组织双选择；Organization/Tenant/Project/Role 显式拆分 |
| P0-02 产品、已购/未购买、RateCard | D1 Mock 已关闭 | 全部来自 C4 commercial fixture |
| P0-03 storyboard / rough-cut 占位 | C6 UI 已关闭，媒体事实待 C5 | 脚本审批门禁、8 镜、Task/Asset/Export、qa_blocked/playable=false 已展示 |
| P0-04 canonical package | D1 Mock 已关闭 | `createCanonicalPackage()`；唯一 `demo-local-001` |
| P0-05 SaaS → StoryCanvas | C6 UI 已关闭，跨仓待 C7 | 仅 Store dispatch/retry；accepted/duplicate 前不开放 deepLink |
| P0-06 任务、资产与回执 | C6 UI 已关闭，跨仓待 C7 | 仅 Store sync；Outbox 与三类 receipt 分离展示 |
| P0-07 额度 120/100/20、80/0/80 | D1 Mock 已关闭 | Wallet、Reservation、Ledger 均来自 Store |
| P0-08 ExportArtifact 与完整来源链 | C6 Truth UI 已关闭，真实交付开放 | 无完整证据固定 `playable=false`；C5 可播放导出仍开放 |
| P0-09 reset 与依赖降级 | 生产页已关闭；全局提示待授权修复 | 单一 reset 包装入口及 ready/error；Topbar 旧成功 toast 不在本轮授权范围 |
| P0-10 Truth 标识 | C6 UI 已关闭，待 C7 复核 | TruthBadge 只读 manifest；HTTP 未握手固定 `HTTP_NOT_CONNECTED` |

## 7. C7 证据入口

建议 C7 按顺序检查：

1. `/platform/overview`：全局 Truth、组织树、工作台切换。
2. `/platform/catalog`：产品状态和非正式报价标识。
3. `/channel/overview`：代理层级共用 UI、生产内容权限说明。
4. `/enterprise/products`：active / explanation_only / locked。
5. `/projects/demo-local-001/storyboard`：8 镜、05/07 与 canonical package。
6. `/production/overview`：撤销/阻断脚本后发包按钮禁用；重新批准后调用 POST。
7. `/production/inbox/demo-local-001`：offline → dispatch/retry → accepted/duplicate → deepLink。
8. `/production/tasks/demo-local-001`：按 01—05 顺序执行发包、两条 reserve 与两次 receipt sync。
9. 成功支线：Wallet `1000/0 → 880/120 → 900/0`。
10. 失败支线：成功支线之后 `900/0 → 820/80 → 900/0`。
11. `/production/assets/demo-local-001`：Outbox ACK、Task/Asset/Export、QA 与 playable Truth。
12. `/production/export/demo-local-001`：来源链与不可播放交付说明。
13. 非 canonical project 或 `?tenantId=`：`ROUTE_ID_REJECTED`，不映射 canonical 数据。
14. 生产页“重置 DEMO_READY”：单一入口并显示 reset ready/error。

## 8. 本轮限制

- 未运行测试、build、lint、governance、开发服务器或真实模型。
- 未修改品牌大脑和脚本业务事实。
- 未修改 StoryCanvas 仓库。
- 未生成占位素材，未修改 UI 原图。
- 未提交、未合并、未推送。

## 9. 残余风险 / 跨域 Request

- C4 Round 3 已改为 Receipt ACK 成功后再 apply；C6 UI 明示 delivered/acknowledged，ACK 失败为零入账。
- Topbar 已按 `reset()` 返回的 `result.ok` 区分 success 与 error/rollback，不再无条件成功。
- StoryCanvas 子窗、受信 origin 与 grant postMessage 只由 C4 `openStoryCanvas()` 管理；C6 不直接 `window.open`，不把 grant 写入 URL 或持久存储。
- 当前 C4 fixture 只有 platform、channel level-1、tenant 的有效 Membership；MASTER/LEVEL_2 organization ID 在 Select 中诚实展示为不可切换，等待 C4 补 actor Membership。
- 按 C0 指令未运行测试、构建、lint、governance、浏览器或双仓联调，因此不声明 Gate PASS。

## 10. Round 3 UI 收口

- `WorkbenchChrome`：组织 Select value 为真实 organization ID；调用 `switchActiveOrganization(id)`，展示 C4 返回的 workbench kind、role、tenant/project scope。工作台 Select 仍只导航。
- `ProductionControlSurface`：accepted/duplicate 后调用 Store `openStoryCanvas()`；展示 handoff waiting/ready/timeout/error，只有 ready 使用“画布已授权”，失败可清理或重试。
- Receipt UI：展示 delivered → acknowledged；`ack_error` 明示零入账，Task/Asset/Export 展示保持。
- `Topbar`：await reset result；成功与失败/rollback 分支分离。
- `Router`：`/projects/:projectId` 仅 canonical ID 跳转品牌页；其他 ID 返回 `ROUTE_ID_REJECTED`，不映射 canonical 项目。
