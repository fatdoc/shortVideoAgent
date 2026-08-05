# A-05 · 开源优先实现策略

> 日期：2026-08-05  
> 状态：`ACTIVE / MANDATORY`  
> 目标：功能优先复用成熟开源实现、公开标准和官方 SDK，减少自研范围，同时守住许可证、安全与事实源边界。

## 1. 实现优先级

所有新功能按以下顺序决策：

1. 复用当前仓库已验证的实现。
2. 复用 StoryCanvas / FireRed-OpenStoryline 上游已有能力。
3. 使用供应商官方 SDK 或公开标准。
4. 参考成熟、活跃、有测试且采用宽松许可证的开源项目。
5. 只在上述方案无法满足合同、安全、国内部署或运营要求时自研。

“参考开源”不等于直接拷贝文件。优先使用依赖、Adapter、公开接口或可验证的模式；需要复制/改写代码时必须先通过许可证 Gate。

## 2. A-05 优先参考的成熟模式

| 领域           | 优先模式                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| Auth / Session | OWASP Session 管理建议、慢哈希、HttpOnly/SameSite/Secure Cookie、Token digest |
| API            | OpenAPI / JSON Schema、标准错误包络、Idempotency-Key                          |
| 数据库         | PostgreSQL 约束、追加事件、事务性 Outbox、可重复迁移                          |
| 对象存储       | S3/TOS 官方签名与重试模式、checksum、scope prefix、最小权限                   |
| 生成任务       | 持久化状态机、Attempt、poll/timeout/cancel/retry、Provider Adapter            |
| 媒体           | FFmpeg/ffprobe 官方行为、可重现命令、输入输出校验                             |
| 回执/计量      | Inbox/Outbox、payload digest、ACK、replay conflict、append-only ledger        |

## 3. 许可证 Gate

默认可进入技术评审的许可证：

- Apache-2.0
- MIT
- BSD-2-Clause / BSD-3-Clause
- ISC

以下类型在合并或商业试点前必须单独法务/商业授权批准：

- GPL / LGPL / AGPL
- SSPL、BSL 或其他 source-available 许可证
- 含 Non-Commercial、No-Derivatives 或用途限制的条款
- 无 LICENSE、许可证不明或只有个人声明的仓库

StoryCanvas 当前保留 Apache-2.0、NOTICE 和上游标识；这不自动解决 Toonflow 商标、白标或对外分发授权。

## 4. 来源登记

任何外部实现进入代码或设计前，必须在 `docs/program/SOURCE_REGISTER.md` 登记：

- 项目名与官方地址。
- 使用的 tag / version / commit。
- 许可证与 NOTICE 要求。
- 采用方式：依赖、官方 SDK、适配、算法参考或改写。
- 实际使用的功能与本地改动。
- 安全、运维和上游升级风险。

## 5. 数字员工验收增量

从本策略生效起，每个窗口的 `READY_FOR_GATE` 必须额外说明：

1. 查看了哪些现有/开源实现。
2. 为什么选择复用、适配或自研。
3. 是否新增了第三方依赖。
4. 许可证、NOTICE 和来源登记是否完整。
5. 是否执行了依赖安全检查与定向回归。

未完成来源/许可证登记的外部代码不得进入 `ACCEPTED`。
