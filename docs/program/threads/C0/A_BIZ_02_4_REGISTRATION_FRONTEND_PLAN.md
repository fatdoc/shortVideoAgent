# A-BIZ-02.4 · 注册、邀请与须知前端计划

> 日期：2026-08-08
> 状态：`FROZEN / READY_FOR_TEST_FIRST_RED`
> 前置提交：`fe76f0c feat(control-api): expose public registration api`
> 顺序：`Public API Client → Registration State/UI → Router/Login 接线 → 联合 Gate`

## 1. 目标

在不伪造正式用户须知、不伪造邮箱验证、也不自动登录的前提下，为唯一 Public Registration API 建立真实前端入口，并统一覆盖直接注册、平台邀请、代理分享邀请和 Tenant 成员邀请。

本节点交付的是可验证、可失败、可恢复的注册前端能力。正式 Terms 尚未发布或 Email Verification Provider 尚未接入时，页面必须明确 fail closed；不得回退 Demo、硬编码成功、把占位正文当正式须知，或把测试 Token 描述为真实邮箱验证。

## 2. 已冻结输入

- 唯一注册写入口：`POST /api/v1/public/registrations`。
- 当前须知读取：`GET /api/v1/public/terms/current?documentCode=registration-notice&locale=zh-CN`。
- 邀请预览：`POST /api/v1/public/invitations/preview`，Token 放 JSON body，不新增 path Token API。
- 四种服务端派生路径：`DIRECT`、`PLATFORM_INVITATION`、`CHANNEL_INVITATION`、`TENANT_MEMBER_INVITATION`。
- 新 Tenant 路径创建普通 Tenant 与本人 `tenant_admin`；成员邀请加入目标 Tenant 并创建 `content_operator`，前端不得提交 Role/Tenant/Channel 事实。
- 注册成功不签发 Session，用户仍需走现有登录入口。
- 当前 Control API 默认 `UnavailableEmailVerification`；正式 Provider 未接入时返回稳定 503，零数据写入。
- 正式用户须知正文尚未提供；没有当前 PUBLISHED Version 时注册入口必须阻断。

## 3. 范围

### 3.1 包含

- 严格解析 Public Terms、Invitation Preview、Registration Result 与 Error Envelope 的前端 API Client；
- `/register` 统一页面，以及带 Invitation Link 进入同一页面的流程；
- Terms loading / unavailable / stale、Invitation loading / unavailable / rate limited、未勾选、重复提交、幂等 replay、账号冲突、服务不可用等状态；
- 直接注册与邀请注册使用同一表单、同一提交函数；
- 邀请类型只用于解释来源/目标，不允许用户修改服务端 Scope；
- 成功页只展示安全 Registration 摘要和“前往登录”，不保存 Session、不自动登录；
- API、组件、Router、Login 入口、响应式布局与最小浏览器验收测试；
- C0 STATUS、HANDOFF、CHANGELOG、README 与桌面知识库同步。

### 3.2 不包含

- 邮件发送、验证码申请、验证码供应商或自建验证服务；
- 在 URL、LocalStorage、日志或普通错误文本中保存邮箱验证凭据；
- 正式用户须知正文、Terms seed 或法务发布动作；
- 自动登录、Session 签发、独立 consumer Role/Tenant/Workbench；
- 邀请管理后台、成员管理页面、支付、充值、佣金或归因纠错；
- B 的 StoryCanvas、脚本、分镜、画布和 `apps/storycanvas/data/vendor/byteplus.ts`。

## 4. 前端安全与数据合同

### 4.1 Public API Client

新增独立 Client，必须：

- 只在明确 `pilot` 模式且 Control API Base URL 合法时调用真实 API；
- 所有请求 `credentials: include`，但不依赖或读取 Session Cookie；
- 严格解析成功响应，任何缺字段、未知枚举、非法日期或不一致结构均返回 `INVALID_API_RESPONSE`；
- 保留服务端 `code/status/requestId/retry-after`，网络失败返回 `CONTROL_API_UNREACHABLE`；
- 不从失败文案推断账号、Invitation 或内部状态；
- 不记录请求 body，不把密码、Invitation Token、邮箱验证 Token 或幂等键写入日志/存储。

### 4.2 Terms

- 固定首版 document code 为 `registration-notice`、locale 为 `zh-CN`；这只是系统标识，不是正式正文。
- 页面只能展示 API 返回的当前 PUBLISHED Version；不得内置占位条款作为 fallback。
- Submit 使用首次加载的 `termsVersionId`；服务端返回 stale 时清除勾选、重新加载当前版本并要求用户再次确认。
- 未勾选 `accepted === true` 时前端不提交；服务端仍是最终权威。

### 4.3 Invitation

- 分享链接首版使用 `/register?invitation=<token>`。
- Router/Page 首次读取后立即用 `replace` 清除地址栏查询 Token，仅在当前组件内存保存；刷新后要求重新打开原邀请链接。
- Token 只发送到 Preview 和 Registration body；不写 LocalStorage、SessionStorage、错误信息、埋点或普通日志。
- Preview 只显示类型、目标角色、到期时间和剩余次数；不虚构代理名称、Tenant 名称或邮箱。
- unavailable/expired/revoked/exhausted 统一按服务端安全错误展示，不枚举具体内部原因。

### 4.4 Email Verification

- 02.4 不增加手工“验证 Token”输入框，也不从 URL 或存储读取验证 Token。
- Registration Form 只通过受控、内存态 `EmailVerificationEvidence` 适配点接收未来 Provider 的 Token。
- 当前真实 Bootstrap 没有 Provider 时，页面明确显示“邮箱验证暂未开放”，提交保持 fail closed。
- 组件测试可注入 Fake Evidence 验证正常提交，但 Fake 不进入生产 Router，也不在文档中冒充已开放能力。

### 4.5 幂等与重复提交

- 每次新的注册意图生成不可预测的内存态幂等键；同一次提交重试复用该键。
- 请求进行中禁用重复点击。
- 201 与 200 replay 均进入同一成功页；replay 可显示“请求已安全恢复”，但不暴露内部 digest。
- 用户修改影响注册事实的字段后生成新的幂等意图；不得让不同 payload 复用旧键。

## 5. 页面状态与错误映射

| 场景                         | 页面行为                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| Terms loading                | 表单骨架/加载状态，禁止提交                                |
| `TERMS_NOT_AVAILABLE`        | 明确“用户须知暂未发布”，禁止提交                           |
| 未勾选                       | 字段级提示，不调用 Registration API                        |
| Terms stale                  | 重新加载 Terms、取消勾选、提示重新阅读                     |
| Invitation Preview loading   | 禁止提交，避免未知来源注册                                 |
| Invitation unavailable / 404 | 显示统一不可用状态，可安全切换为直接注册但必须明确二次操作 |
| Invitation 429               | 显示 retry-after，不自动高频重试                           |
| Registration 429             | 保留表单，显示 retry-after                                 |
| `REGISTRATION_CONFLICT`      | 通用“无法使用当前身份完成注册”，不确认邮箱存在或停用       |
| 201                          | 安全成功摘要，进入登录入口                                 |
| 200 replay                   | 同一成功摘要，标识安全恢复                                 |
| 503 Verification             | 明确邮箱验证服务暂不可用，不写入成功状态                   |
| 网络/5xx                     | 保留非敏感字段，显示请求 ID；不打印原始 Error/body         |

## 6. Test-first 切片

### A-BIZ-02.4A · Public Registration API Client

新增：

```text
src/services/publicRegistrationApi.ts
src/services/publicRegistrationApi.test.ts
```

先写 RED，覆盖：

- Terms、Invitation Preview、Registration 三个真实 URL/method/body；
- 严格成功响应解析；
- 201 与 replay header；
- 稳定 Error Envelope、requestId、retry-after；
- malformed response、网络失败、Pilot 配置错误；
- 无 LocalStorage 写入和无敏感字段泄漏。

02.4A 不修改 Router、LoginPage 或 UI。

### A-BIZ-02.4B · Registration State / Page

新增：

```text
src/pages/auth/RegistrationPage.tsx
src/pages/auth/RegistrationPage.test.tsx
```

Test-first 覆盖 Terms、Invitation、勾选、字段校验、重复提交、stale reload、通用冲突、503、201/replay 成功和无自动登录。页面通过可注入 Client/Evidence Port 测试正常路径；生产默认 Evidence Port unavailable。

### A-BIZ-02.4C · Router / Login 入口

共享修改必须独立小提交：

```text
src/app/Router.tsx
src/app/Router.pilot.test.tsx
src/pages/auth/LoginPage.tsx
src/pages/auth/LoginPage.pilot.test.tsx
```

- 注册为 public route，不经过 RequireSession；
- 已登录访问 `/register` 回到合法默认项目入口；
- Login 页只在 Pilot 展示注册入口；Demo 四身份入口保持不变；
- Invitation 查询 Token 读取后立即清理 URL；
- 修改共享 Router 后通知 B 同步对应 commit。

### A-BIZ-02.4D · 视觉、文档与联合 Gate

- 桌面和移动视口检查；
- 键盘/label/Alert/加载与禁用状态检查；
- Root 定向及全量 Test、typecheck/build、lint、Prettier、Governance、diff-check；
- 在真实 Provider/Terms 缺失环境验证 fail-closed，不把阻断当代码失败。

## 7. 文件边界

A 可新增/修改：

```text
src/services/publicRegistrationApi*
src/pages/auth/RegistrationPage*
src/pages/auth/LoginPage*
src/design/d2-auth.css
docs/program/threads/C0/**
```

共享、需独立提交并通知 B：

```text
src/app/Router.tsx
src/app/Router.pilot.test.tsx
README.md
```

禁止修改/暂存：

```text
apps/storycanvas/**
src/features/storycanvas/**
src/pages/script-editor/**
src/pages/storyboard/**
src/components/script/**
src/components/storyboard/**
apps/storycanvas/data/vendor/byteplus.ts
```

禁止 `git add .`，每个切片只显式暂存 A 文件。

## 8. 完成标准

A-BIZ-02.4 只有同时满足以下条件才收口：

- 直接注册和三类 Invitation 都进入同一个 `/register` 页面和同一个 API；
- Terms/Invitation/Registration 均使用真实 Control API Client，不使用 LocalStorage/Mock 作为事实源；
- 正式 Terms 或 Email Verification 不可用时明确 fail closed；
- 未勾选、stale、Token 不可用、限流、重复提交、账号冲突、停用/不可判定、网络和 5xx 状态均有稳定测试；
- 邀请 Token、密码、邮箱验证 Token 和幂等键不进入 URL（读取邀请后清理）、Storage、日志或响应展示；
- 注册成功不自动登录、不创建前端伪 Session，只引导到现有登录；
- 不新增 consumer Role/Tenant/Workbench，不修改 B 独占页面；
- 定向、Root 全量、TypeScript、Build、Lint、Prettier、Governance 和 diff-check 通过；
- STATUS、HANDOFF、CHANGELOG、README 和桌面知识库同步；
- Router 共享提交已通知 B。

## 9. 当前可执行与真实开放条件

可以立即连续完成 02.4A、02.4B 的 fail-closed 页面和 02.4C 路由接线，不需要等待正式文案或 Provider 才开始开发。

但“公网注册已开放”必须同时满足：

1. 法务批准并发布 `registration-notice / zh-CN` 当前版本；
2. 正式 Email Verification Provider 接入并通过安全测试；
3. 生产级共享限流、人机验证和运维配置完成；
4. 真实环境安全/隐私验收完成。

在这些条件满足前，发布说明只能称为“注册前端与服务端合同已具备、正式开放保持 fail closed”。
