# StoryCanvas Phase1 测试报告

> 验证日期：2026-08-03  
> 分支：`codex/storycanvas-phase1-production-loop`  
> 验证口径：本报告记录本地 Mock/HTTP/构建和迁移事实，不代表真实付费模型、正式钱包或生产部署验收完成。

## 1. 总结

Phase1 已通过根控制面、Runtime、构建、迁移和本地 HTTP 闭环验证。验证证明当前 Mock 模式下可以形成 Shot、Task、Attempt、Asset、Selection、RoughCut、Export、Provenance 和额度记录。

以下内容不能由本次验证证明：

- 正式八镜 FFmpeg 粗剪；
- 30 秒独立主成片；
- 独立导出合成资产；
- 真实图片或视频模型调用；
- 真实钱包 ACK 与生产账务；
- 全量旧应用测试和 TypeScript 风险已经清零。

因此，本阶段结论是“Phase1 Mock 单一事实链可验证”，不是“正式视频生产闭环全部完成”。

## 2. 验证结果

| 验证项 | 结果 | 说明 |
|---|---:|---|
| 根控制面定向测试 | 24/24 PASS | 覆盖控制面投影、额度门禁、幂等和交接相关行为 |
| StoryCanvas Runtime 定向测试 | 4/4 PASS | 覆盖 Phase1 Runtime 核心链路 |
| Root Build | PASS | 根前端构建通过 |
| StoryCanvas Build | PASS | 本地以 `--no-save` 补充 `mariadb` 后构建通过；该依赖处理未作为本报告中的代码交付 |
| 临时数据库迁移 | PASS | `up -> idempotent up -> down -> up` 全部通过 |
| Repo Demo DB | PASS | Migration `004` 已应用 |
| HTTP 正向闭环 | PASS | 8 Shot、8 Task、8 Attempt、8 valid Asset、8 selected Attempt |
| HTTP 额度记录 | PASS | reserve、consume、release 各 8 条 |
| RoughCut | PASS，有限制 | 状态为 approved；实测 `totalDuration = 48s`，与 30s 目标不一致 |
| Export | PASS，有限制 | Export 记录存在，但当前复用 valid 镜头资产，不是独立合成成片资产 |
| Provenance | PASS | HTTP 返回 14 类来源链信息；本报告不推测未提供的分类名称 |
| 失败任务 | PASS | `reserved/consumed/released = 80/0/80` |
| 取消任务 | PASS | `reserved/consumed/released = 80/0/80` |
| 锁定商业字段 | PASS | 修改 locked price 被拒绝 |
| 真实付费模型 | 未调用 | 本轮仅使用 Mock/本地验证路径 |

## 3. 根控制面定向测试

结果：

```text
24 passed
0 failed
```

验证重点：

- Package accepted/duplicate 均可形成稳定 handoff；
- Grant 错误保留具体错误原因；
- Stable Shot ID 不因重复 Package 产生第二套身份；
- Task、Attempt、Asset、RoughCut 和 Export 投影可恢复；
- 同一 Shot 可以存在多个 Attempt；
- 每个 Shot 只有一个 selected Attempt；
- 无 valid playable Asset 时不得消费额度；
- reserve/consume/release 命令具备幂等保护；
- failed/cancelled 释放全部冻结额度；
- locked business field 修改被拒绝。

## 4. Runtime 定向测试

结果：

```text
4 passed
0 failed
```

验证重点：

- Runtime 可以形成 Shot 级任务和 Attempt；
- Mock Provider 结果可以登记为 Asset；
- valid Asset 才能进入后续选择和结算；
- Runtime 状态能够被 canonical/根控制面读取和投影。

本结果不表示 REAL Provider 已执行。真实模型接口未调用，也没有产生真实模型费用。

## 5. 构建验证

### 5.1 Root

Root Build：PASS。

### 5.2 StoryCanvas

StoryCanvas Build：PASS。

构建环境事实：

- 首次环境缺少 `mariadb`；
- 本地使用 `--no-save` 补充后构建通过；
- 本报告不把该本地依赖操作描述为仓库依赖已经正式治理完成。

## 6. 数据迁移验证

临时数据库验证序列：

```text
up
-> repeat up (idempotent)
-> down
-> up
```

结果：全部 PASS。

Repo Demo DB 状态：Migration `004` 已应用。

该结果证明本地 Demo 数据库迁移可以重复执行和回滚再升级，不证明线上数据库已经迁移，也不证明生产数据兼容性已经完成评估。

## 7. HTTP 正向闭环

实测对象数量：

| 对象 | 数量/状态 |
|---|---:|
| Production Shot | 8 |
| Generation Task | 8 |
| Shot Attempt | 8 |
| valid Media Asset | 8 |
| selected Attempt | 8 |
| reserve Entry | 8 |
| consume Entry | 8 |
| release Entry | 8 |
| RoughCut | approved |
| Export | 已创建 |
| Provenance | 14 类 |

链路：

```text
Package
-> 8 Shots
-> 8 Tasks
-> 8 Attempts
-> 8 valid Mock Assets
-> 8 selected Attempts
-> approved RoughCut
-> Export
-> Provenance
```

重要限制：

- Package 镜头合同总时长为 30 秒；
- 当前 Mock 视频资产为 `8 * 6s`；
- RoughCut API 实测 `totalDuration = 48s`；
- 这表示 Mock 资产时长与目标主成片时长不一致；
- 当前 Export 复用 valid 镜头资产，不是独立 FFmpeg 合成资产。

## 8. HTTP 负向验证

### 8.1 Failed

```text
reserved = 80
consumed = 0
released = 80
```

结果：PASS。失败任务未消费额度，冻结额度全部释放。

### 8.2 Cancelled

```text
reserved = 80
consumed = 0
released = 80
```

结果：PASS。取消任务未消费额度，冻结额度全部释放。

### 8.3 Locked Price

production.operator 修改锁定价格：被拒绝。

结果：PASS。该验证证明当前入口存在业务字段锁定门禁，不等同于所有服务端 RBAC 与字段权限已经完成。

## 9. UI 与浏览器验证

- Playwright CLI 环境缺少 Chrome，CLI 浏览器验证未完成；
- In-App Browser 截图成功；
- 截图成功证明本地页面可被 IAB 打开和记录，不替代 Playwright 自动化浏览器回归。

## 10. 已知非通过项

- 旧 `app.smoke` 仍有 1 个失败；
- 全量 App TypeScript 仍存在既有 Agent/Zod 风险；
- 首次旧 LocalStorage 状态触发幂等冲突；执行 Demo Reset 后恢复，并在重复 Package 时得到 duplicate；
- 上述问题未在本次文档提交中修改。

完整清单见 `docs/STORYCANVAS_KNOWN_ISSUES.md`。
