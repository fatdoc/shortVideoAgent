# A-05 真实试点 · A/B 双线并行职责

> 日期：2026-08-05  
> 状态：`ACTIVE / TWO_LANES_RUNNING`  
> 目标：用最少串行依赖在一周内打通单客户白名单真实黄金路径。

## 当前执行结果

- A-05.2 已完成：白名单登录、单 Tenant、scrypt、服务端 Session、Cookie、轮换/撤销、限流、安全回跳和 bootstrap CLI；20/20 测试及实库登录链路通过。
- B-05.1 已完成：内部媒体 Readiness 接口与 storage/image/video/tts/ffmpeg 真实状态检查；10/10 定向测试通过。
- 当前媒体真实状态：FFmpeg ready；storage 仅 local-only；image/video 因未配 `ARK_API_KEY` 不可用；TTS 未实现；总体正确标记为 `PILOT_MEDIA_BLOCKED`。
- 两线交付尚未提交、未推送；集成前必须先形成独立 Checkpoint。

## 1. 新一轮组织方式

```text
C0 / 集成负责人
├── 负责人 A：真实 SaaS 控制平面
└── 负责人 B：真实媒体生产平面
```

C0 只负责版本化合同、边界裁决、集成、回归与上线 Gate，不在 A/B 之间新建第三套业务真相。

## 2. 负责人 A：真实控制平面

### 独占职责

- `apps/control-api/` 服务、PostgreSQL 模型与迁移。
- 白名单登录、密码慢哈希、服务端 Session、Cookie、CSRF 和限流。
- Tenant、Membership、Project、Brief、ScriptVersion 和 Approval。
- Production Package 组装、Project Grant 签发与撤销。
- 用户上传的 OSS 短时授权、上传完成校验和素材元数据。
- Wallet、Reservation、append-only Credit Ledger、Receipt Inbox 和控制平面 Outbox。
- 管理员人工充值、审计与 Tenant/Project 数据隔离。

### A 不得实现

- 图片/视频/TTS 供应商调度。
- FFmpeg 剪辑、字幕、音频混合和 MP4 导出。
- 伪造 Task/Asset/Export 成功结果。
- 把客户价格、Wallet 余额或上游 API Key 放入 Production Package。

### A 当前任务：A-05.2

- 单 Tenant 白名单账号初始化。
- 登录、登出、当前会话和 Session 撤销。
- HttpOnly / SameSite Cookie，production 下 Secure。
- Session Token 数据库只保存 digest。
- 登录限流、Session 轮换和安全回跳。

## 3. 负责人 B：真实媒体生产平面

### 独占职责

- `apps/storycanvas/` 的生产 Runtime、Provider Adapter、Task、Attempt 和媒体来源链。
- StoryCanvas 生产包读取、Grant 校验和 Tenant/Project/Capability 范围执行。
- 实拍素材进入 StoryCanvas 后的生产使用和镜头绑定。
- 一个真实图片供应商、一个真实视频供应商和一个 TTS 供应商。
- Polling、Timeout、Cancel、Retry 和标准化 Provider Error。
- 生产输出的对象存储、Checksum、Provenance 与 Rights Metadata。
- FFmpeg 镜头拼接、字幕、TTS/BGM 混合和独立 MP4 导出。
- TaskReceipt、AssetReceipt、ExportReceipt 和 UsageReceipt 的真实输出。

### B 不得实现

- Tenant 成员、登录、客户价格、Wallet、套餐、渠道或最终用量结算。
- 信任前端传入的 Tenant、Capability、Grant 或 API Key。
- 直接修改 Control API 的额度账本。
- 将不可用 Provider 、本地占位资产或复用镜头素材标记为真实成功。

### B 当前任务：B-05.1

- 盘点 Storage、Image、Video、TTS 和 FFmpeg 的实际可用性。
- 新增不泄漏密钥的内部 Pilot Media Readiness 接口。
- 已正确配置的能力才返回 ready，缺失项必须返回 unavailable。
- 冻结 Provider/Storage/FFmpeg 标准错误码，为随后真实生成链提供运营入口。

## 4. C0 / 集成负责人

- 维护公共合同和 fixture，禁止 A/B 分别定义同名异义字段。
- 冻结真实试点合同新版，不原地改写 D2 Demo `v0.1`。
- 依次执行合同 Gate、A Gate、B Gate、跨平面集成 Gate。
- 维护白名单试点范围，拒绝公开注册、在线支付、渠道分销和复杂 RBAC 插队。
- 上线前统一验证备份、HTTPS、日志、告警、额度一致性和真实 MP4。

## 5. 最少协作合同

A 发给 B：

```text
ProjectProductionPackage
ProjectGrant
GenerationTask command
Idempotency-Key
```

B 发给 A：

```text
TaskReceipt
AssetReceipt
ExportReceipt
UsageReceipt
StandardError
Receipt-Idempotency-Key
```

在合同新版冻结前，A/B 可用各自的内部测试 fixture 并行开发，但不得增加未经 C0 确认的跨平面字段。

## 6. 加速排期

| 时间  | A 控制平面                        | B 生产平面                | C0 / 集成               |
| ----- | --------------------------------- | ------------------------- | ----------------------- |
| Day 1 | 白名单登录、Session、Tenant       | 媒体能力 Readiness        | 职责和错误码冻结        |
| Day 2 | Project / Brief / Script Approval | 实拍素材、真实图片生成    | 真实试点合同 fixture    |
| Day 3 | OSS 签名、Package / Grant         | 真实视频、TTS、任务轮询   | Package → Task 集成     |
| Day 4 | Receipt Inbox、额度入账           | FFmpeg 字幕/音频/MP4 导出 | Receipt / Ledger 一致性 |
| Day 5 | 管理员充值、审计                  | 失败重试、导出回执        | 本地真实黄金路径        |
| Day 6 | RDS / OSS 环境                    | 云端 Provider 验证        | HTTPS、日志、备份       |
| Day 7 | 白名单客户支持                    | 生产运营兜底              | 受控真实验收            |

## 7. 每日 Gate

每个负责人的交付必须同时包含：

- 功能代码和迁移/配置。
- 至少一条成功路径和一条失败路径测试。
- 无密钥、Session Token、Grant Token 或客户数据进入日志。
- 定向 Test、Typecheck/Build 和 Lint 结果。
- 修改文件、已知风险、下一个依赖与可回滚说明。

任何一边的 Provider 未配置、外部服务不可用或数据库不可达，都必须返回明确失败，不得自动切换为 Mock 并宣称真实成功。
