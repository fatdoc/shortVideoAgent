# StoryCanvas Phase1 额度状态机

> 状态：根控制面 Phase1 additive 状态机说明  
> 计量单位：`AI_VIDEO_CREDIT`  
> 默认模式：Mock，不触发真实付费模型

## 1. 核心原则

```text
模型接口返回成功 != 任务成功
任务存在 outputAssetId != 资产可播放
Receipt succeeded != 可以消费额度
```

只有同时满足以下条件，Phase1 才允许 `settle_success`：

1. Task 和 Attempt 匹配；
2. 该 Task/Attempt 有 reserved Allocation；
3. Task 的 `outputAssetIds` 包含目标 Asset；
4. Asset 与同一 Task/Attempt 绑定；
5. Asset 类型为 `video` 或 `export`；
6. `validationStatus = valid`；
7. `playableUrl` 为非空字符串；
8. `mimeType` 以 `video/` 开头；
9. `durationSeconds > 0`。

缺少任一条件时抛出 `ASSET_NOT_PLAYABLE`，不得消费额度，也不得把 Runtime Task 标记为 succeeded。

## 2. 两套现状必须区分

### 2.1 现有 Demo Credit Ledger

实现位置：`src/domain/creditLedger.ts`。

现有兼容语义：

```text
成功：reserve 120 -> consume 100 + release 20
失败：reserve 80 -> consume 0 + release 80
```

该账本继续服务当前 Demo 展示，不在 Phase1 小提交中删除或迁移。

### 2.2 Phase1 严格状态机

实现位置：`src/domain/phase1Production.ts`。

Phase1 状态机以 `taskId + attemptId` 为结算边界，记录：

- `Phase1CreditAllocation`；
- `Phase1CreditEntry`；
- `processedCreditCommands`。

它是 additive 投影。目前没有替换原 Demo Wallet，也没有自动接管 canonical Receipt 的旧结算路径。

## 3. 状态转换

### 3.1 成功

```text
task draft/awaiting_confirmation
-> reserve
-> allocation reserved
-> queued
-> running
-> validating
-> valid playable Asset
-> settle_success
-> allocation consumed
-> consume actualCredit
-> release reservedCredit - actualCredit
-> task succeeded
```

成功结算后：

```text
consumedCredit = actualCredits
releasedCredit = reservedCredit - actualCredits
```

Demo 兼容例：

```text
reservedCredit = 120
actualCredits = 100
consumedCredit = 100
releasedCredit = 20
```

### 3.2 失败

```text
reserved
-> settle_failure
-> allocation released
-> consumedCredit = 0
-> releasedCredit = reservedCredit
-> task failed
```

Demo 兼容例：

```text
reservedCredit = 80
consumedCredit = 0
releasedCredit = 80
```

### 3.3 取消

```text
reserved
-> settle_cancel
-> allocation released
-> consumedCredit = 0
-> releasedCredit = reservedCredit
-> task cancelled
```

失败和取消都不能产生消费 Entry。

## 4. 幂等规则

每条额度命令必须提供 `idempotencyKey`。

幂等摘要计算时排除 `occurredAt`，因此同一业务命令因网络重试而使用不同发送时间，仍被视为同一命令。

规则：

| 情况 | 结果 |
|---|---|
| 同一 key、同一业务载荷 | 返回 duplicate，不追加 Allocation 或 Entry |
| 同一 key、不同业务载荷 | `IDEMPOTENCY_CONFLICT` |
| 同一 Task/Attempt 重复 reserve，使用新 key | `CREDIT_RESERVE_CONFLICT` |
| 已 consumed/released 后再次 settle，使用新 key | `CREDIT_SETTLEMENT_CONFLICT` |
| 同一成功结算命令重放 | duplicate，不重复消费或释放 |

## 5. Retry 规则

retry 必须创建：

- 新 `attemptId`；
- 新 `taskId`；
- 新 `reservationId`；
- 新额度幂等键。

旧 Attempt 的 Allocation 保持终态，不得重新打开。新 Attempt 可以按 RateCard 重新计算冻结额度，但不得复用旧 Task 的 consume/release Entry。

## 6. Entry 追溯

每条 Phase1 Credit Entry 至少保存：

- Entry ID；
- Task ID；
- Attempt ID；
- operation；
- amount；
- idempotencyKey；
- occurredAt。

因此 reserve、consume 和 release 均可追溯到具体生成尝试。

## 7. Export 额度边界

当前 Phase1 没有实现 Export 独立计费。

已确认规则：

- 镜头生成成功额度不能因 Export 失败而再次扣除；
- 若未来 Export 需要额度，必须创建独立 Export Task、Attempt/Execution 和 Reservation；
- Export 不得复用镜头生成 Task 的 Reservation；
- Export 只有形成 valid playable Export Asset 后才可消费。

## 8. Store 行为

`controlPlaneStore` 暴露 `applyPhase1Credit`，并把结果写入 Phase1 LocalStorage 投影。

当前返回布尔值表达该命令是否为已接受的 duplicate replay，不是余额、消费额或业务成功状态。调用方应读取 `phase1Projection.creditAllocations` 和 `creditEntries` 获取结果。

## 9. Known 未完成项

1. Phase1 Allocation 尚未与现有 Wallet available/reserved 余额统一投影。
2. Phase1 reserve 当前不检查 Wallet 可用余额；原 Demo Ledger 仍负责余额演示。
3. Phase1 尚未接入正式 RateCard、报价快照和真实成本。
4. canonical Receipt 同步尚未自动驱动 Phase1 reserve/settle。
5. Provider 实际成本、Token、视频时长与消费额度尚未核算。
6. 服务端事务、并发锁和数据库唯一约束尚未实现。
7. 进程崩溃后的服务端恢复和对账尚未实现。
8. 失败补偿、人工调账、退款和渠道分成不在当前实现范围。
9. Export 独立计费尚未实现。
10. 当前自动化测试证明纯状态机幂等和门禁，不证明生产账务系统已完成。
