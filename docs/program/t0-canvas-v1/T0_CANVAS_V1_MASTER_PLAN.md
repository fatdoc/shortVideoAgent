# T0-CV1 · Canvas V1 紧急融合开发总控计划

> 版本：`v0.15`
> 日期：`2026-08-14`
> 状态：`ACTIVE / EXECUTION_SOURCE_OF_TRUTH`
> 优先级：`T0 · 紧急特殊开发`
> 总控负责人：`CV0 · Codex（与用户唯一主交互窗口）`
> 适用范围：合同合并、Canvas V1、Canvas UI、业务融合

## 0. 本文的权威性

本文是本轮 T0-CV1 开发的唯一持久总控事实源。聊天、旧任务书、员工自行总结与本文冲突时，以本文最新已批准版本为准。

历史 `docs/program/ROADMAP_AND_GATES.md` 中已经存在并完成一个项目级 `T0` Gate。本轮不得改写历史 T0，也不得把历史 `T0: COMPLETE` 当作 Canvas V1 已完成。本轮所有任务、状态和 Gate 统一使用 `T0-CV1` 命名空间。

文档权限：

- 只有 CV0 可以修改本文的状态、决策、Gate 和集成记录。
- CV1—CV6 只读本文；需要变更时提交 `REQ-T0CV1-*`。
- 员工不得把聊天内容直接写成已批准事实。
- 方案使用 `PROPOSED`，只有 CV0 验收后才能改成 `ACCEPTED`。

员工开工前必须完整阅读：

1. 本文；
2. `docs/program/EMPLOYEE_RULES.md`；
3. `docs/program/AUTONOMY_PROTOCOL.md`；
4. 自己在 `docs/program/t0-canvas-v1/tasks/` 下的任务书；
5. 与任务直接相关的现有合同和验收文档。

## 1. 当前基线与保护规则

### 1.1 Git 事实

G0 放行时状态：

```text
integration worktree:
/Users/docfat/.codex/worktrees/t0-cv1-integration

integration branch:
codex/t0-cv1-integration

governance baseline:
413322708b35da7a158f45bdb329416b39238e52

G1 integrated head:
bbb475d0326b48b84941ca2a5daae4c15ec0ab5c

Wave 2 remediation product head:
1e6d0848e0142ff5aeac508057ad383d098ecad2

Wave 2 independent QA integrated head:
9d86c7cf1c2fab97ba2e2e0753bc1ec7fe8e02b4

G5 activation transport contract head:
ee1c24e9c55369c2d38eabc89e76a4cbfea17197

G4 Canvas Agent product integrated head:
93f26d8af1ed4d37f43540c0b7cbe139e217923c

G4 independent QA evidence integrated head:
c09be04a961dfb5a45286e375e81e4fa1f9c8895

G5 additive Workspace/Materialization contract integrated head:
0cc3b3613c86e8b5a17e62727d2f7d3ca3c32392

G5 additive contract independent QA integrated head:
37181987b6178e3ac39aaf3f7750e10ea2f48d87

G5 Control Materialization independent QA integrated head:
4fea9b76412d92eaec91106b83634455c2e8ea9b

G5 Control Workspace Authority independent QA integrated head:
f9a894d3ea582b8a733120dd7ba84b73af90a01a

G5 Story Workspace/Materialization independent QA integrated head:
1865e7da703d4147ab16e22b481daaf5fa11d0a7

G5 Shared Bridge/Router/Proxy independent QA integrated head:
6032b2e56423ad586d7d38638a4cf81abf8be83b

G6 safe no-provider browser independent QA integrated head:
603caf90759020a2b02541f25e2c74d07e063589

G6 platform local-output product head:
1dca807e0ff82576f83ac9165ef05d8b656afa72

origin/main:
19582cbf16e1414f884f9864f7c0d372640cb26a
```

原始用户工作区继续作为受保护混合工作区，不是 T0-CV1 员工代码基线。T0-CV1 产品代码冻结基线是：

```text
origin/main@19582cbf16e1414f884f9864f7c0d372640cb26a
```

CV0 已重新 fetch 并确认 `origin/main`，在独立 worktree 建立治理基线。若远端发生变化，不自动重置本轮冻结基线；由 CV0 先审计差异，再决定是否重新执行 G0。

### 1.2 当前必须保护的用户文件

以下文件或目录不得被本轮文档提交、员工暂存、删除、移动或覆盖：

```text
apps/storycanvas/data/vendor/byteplus.ts
docs/ui/VIDEOAGENT_STORE_SIMPLE_UI_V3.md
docs/ui/VIDEOAGENT_UI_SUITE_V2.md
docs/ui/assets/
output/
tmp/
```

特别规则：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

继续视为用户/B-owned 受保护未跟踪文件。任何员工都不得执行 `git add .`、`git add -A` 或其他可能带入该文件的操作。

### 1.3 Git 操作纪律

- 一员工一短分支、一独立 worktree、一个明确进行中的任务。
- 禁止直接在 `main` 开发或推送。
- 禁止 `reset --hard`、`git clean`、rebase、force push。
- 禁止通过手工复制其他员工文件绕过 Git 合并。
- 员工只提交自己任务书允许的 exact paths。
- 共享文件由指定唯一写入人修改。
- CV0 决定合并顺序、冲突处理和最终集成。

建议分支：

```text
codex/t0-cv1-integration
codex/t0-cv1-contract
codex/t0-cv1-assets-production
codex/t0-cv1-agent
codex/t0-cv1-ui
codex/t0-cv1-business-integration
codex/t0-cv1-qa
```

## 2. 本轮交付目标

### 2.1 一天完成定义

本轮基础完成定义是打通以下真实纵向链路：

```text
真实用户登录
→ 打开真实门店项目
→ 读取批准脚本与批准分镜
→ 创建/读取唯一 Canvas Entry
→ Browser-safe Canvas Bootstrap
→ 加载 Canvas V1
→ 显示项目资产、人物授权与 Provider 可用状态
→ 未就绪人物资产阻止视频生成
→ 绑定已认证真人或已注册虚拟人物资产
→ UI 或 Agent 通过同一个 CanvasCommand 创建镜头任务
→ StoryCanvas 服务端解析可信资产并调用 Seedance
→ 任务结果登记为真实项目资产
→ 刷新页面后恢复 Canvas Document、绑定和任务结果
```

如果现有 FFmpeg 接口可以在不扩大风险的条件下直接复用，则追加：

```text
镜头排序 → 服务端合并 → 可播放 MP4
```

MP4 导出是本轮 Stretch Goal，不得因其未完成而伪造导出结果。

### 2.2 产品方向

Canvas V1 是门店探店视频生产工作台，不是通用创意请求页面，也不是首日复制完整 LibTV/剪映。

主流程：

```text
门店资料
→ 商品/套餐
→ 可信资产
→ 爆款参考
→ AI 探店脚本
→ 分镜
→ 镜头素材匹配/生成
→ 简单编排
→ 导出投流视频
```

首日画布形态：

```text
镜头列表
+ 当前镜头生产链
+ 资产库/Asset Dock
+ 镜头参数检查器
+ 简单成片顺序
```

首日节点：

```text
ScriptNode
AssetNode
ImageNode
VideoNode
PlaylistNode
```

### 2.3 明确非目标

首日不实现：

- 完整自由无限画布；
- 任意节点类型和任意连线；
- 多轨非线性剪辑器；
- 关键帧、复杂转场和专业调色；
- 自动化真人认证二维码全流程；
- 多人实时协作；
- 自动发布、投流和渠道回传；
- Agent 无确认批量发起高成本视频任务；
- 真实支付、提现或正式佣金结算；
- 用 Mock、Demo 或旧 `demo-local-001` 冒充真实链路。

## 3. 冻结的顶层裁决

### D-001 · 新前端、复用生产后端

```text
ACCEPTED
```

重做 Canvas V1 前端与交互层；保留并适配原 StoryCanvas 的人物资产、可信资产、连续性、模型供应商、任务、媒体存储和导出能力。

### D-002 · 受控画布

```text
ACCEPTED
```

首日不实现完全自由的 LibTV 工作流。画布使用固定生产阶段和有限节点类型，先保证真实门店项目纵向链路。

### D-003 · Creator + Agent 同一命令层

```text
ACCEPTED
```

用户操作和 Agent 操作必须调用同一个 Canvas Command Service。Agent 不直接访问数据库、Provider 或内部资产 URI。

### D-004 · 资产是生成门禁

```text
ACCEPTED
```

资产库不是附件列表，而是人物/门店/商品/品牌/声音在生成前的授权、批准、Provider 注册和项目绑定事实源。

### D-005 · 真人与虚拟人物

```text
ACCEPTED
```

- 真人：首日采用外部认证、系统同步状态；不得伪造真人已授权。
- 虚拟人物：复用现有 Image 2/Seedream 设定板与 BytePlus 资产注册链。
- Provider 未 Active、权利未授权、项目未绑定时，视频生成必须 fail-closed。

### D-006 · 版本策略

```text
ACCEPTED
```

不进行所有历史合同的大爆炸式升级。保留现有权威版本，新增 Canvas V1 聚合合同并通过 fixture/negative vectors 保证跨平面一致。

### D-007 · 正式环境失败策略

```text
ACCEPTED
```

真实环境不可用时显示真实阻塞或失败，不回退 Demo、Mock Grant、LocalStorage 或固定项目。

## 4. 四个开发工作流

### W1 · 合同合并

保留并组合：

```text
ProjectProductionPackage/0.3
ProjectGrant/0.2
CanvasEntryRedemption/0.1
Pilot Production Contract/0.2
```

新增：

```text
CanvasBootstrap/0.1
CanvasDocument/0.1
AssetRecord/0.1
ProviderAssetBinding/0.1
EntityBinding/0.1
ShotAssetRequirement/0.1
ShotReadiness/0.1
CanvasCommand/0.1
CanvasEvent/0.1
```

合同必须区分：

- Control Plane authority；
- StoryCanvas production authority；
- browser-safe projection；
- server-only authority；
- provenance/rights facts；
- status/error/idempotency；
- secret/forbidden marker。

### W2 · 画布与生产能力

复用：

- `characterAssets.ts`；
- `characterAssetBinding.ts`；
- `continuityMemory.ts`；
- `byteplusAssets.ts`；
- `byteplusTos.ts`；
- `byteplusVideo.ts`；
- Generation Task、Media Asset、FFmpeg/Receipt 基础能力。

新增：

- 生产级 Asset Adapter；
- 显式 tenant/project/package/session Scope；
- Asset Readiness；
- Canvas Document 持久化与乐观版本；
- Canvas Command Service；
- Canvas Agent Tools；
- 正式 Canvas API。

### W3 · Canvas UI

UI 必须展示：

- 当前镜头；
- 脚本/分镜事实；
- 需要的人物、门店、商品、品牌和声音资产；
- 真人/虚拟人物；
- 权利、批准、Provider、项目绑定状态；
- 候选图片/视频；
- 生成队列和失败原因；
- 保存/刷新恢复；
- 简单镜头顺序。

视觉约束：

- 暖白/浅灰底；
- 深灰文字；
- 单一橙色主操作；
- 少卡片、少装饰；
- 素材缩略图承担主要视觉；
- 不使用霓虹、玻璃拟态、复杂渐变；
- 生成视觉稿只能作为布局参考，禁止整图作为背景。

### W4 · 业务融合

正式链路：

```text
Session
→ Tenant/Project
→ approved Script/Storyboard
→ Production Package
→ Canvas Entry
→ Bridge/Proxy/Router
→ Canvas V1
→ Task/Asset/Usage Receipt
```

必须完成：

- Control Plane 管理业务资产权利和项目归属；
- StoryCanvas 管理 Provider 注册、生成任务和技术资产；
- Package/Canvas Entry/Canvas Session 精确绑定；
- 浏览器不持有 Grant、Token、Digest、raw Idempotency-Key、`asset://` 或 Provider secret；
- 生成资产回到真实项目；
- Shared Router 不再进入旧 Demo Canvas。

## 5. 资产权威与生成门禁

### 5.1 四层模型

```text
AssetRecord              Control Plane 业务资产与权利
ProviderAssetBinding     StoryCanvas Provider 注册与状态
EntityBinding            项目人物/门店/商品/品牌绑定
ShotAssetRequirement     当前镜头生成要求
```

### 5.2 生成可用条件

```text
rightsStatus == authorized
AND approvalStatus == approved
AND providerStatus == active
AND entityBinding.approved == true
AND tenant/project/package/session exact match
```

任一条件不满足：

- UI 必须显示明确原因；
- Agent 必须返回同一原因；
- 服务端拒绝创建真实视频任务；
- 不创建伪 AssetReceipt；
- 不消费成功额度。

### 5.3 Provider secret 规则

以下内容只允许存在于服务端：

```text
asset:// provider URI
provider asset/group internal id
ARK/BytePlus credentials
Canvas Entry raw access token
Project Grant
Package snapshot
internal token
digest
raw Idempotency-Key
```

浏览器只接收非秘密业务 ID、安全状态和可访问的受控预览 URL。

## 6. 数字员工组织

| 员工 | 角色 | 任务书 | 初始状态 | 阻塞条件 |
|---|---|---|---|---|
| CV0 | 总控与集成负责人 | `tasks/CV0_MASTER_INTEGRATION_TASK.md` | `IN_PROGRESS` | 无 |
| CV1 | 合同架构师 | `tasks/CV1_CONTRACT_ARCHITECT_TASK.md` | `ACCEPTED` | G5 Workspace/Materialization/Authority additive 合同已独立验收 |
| CV2 | 资产与生产后端工程师 | `tasks/CV2_ASSET_PRODUCTION_BACKEND_TASK.md` | `ACCEPTED` | G2 与 G5 Story Workspace/物化/受控媒体已独立验收；付费 smoke 留给 G6 |
| CV3 | Canvas Agent 工程师 | `tasks/CV3_CANVAS_AGENT_TASK.md` | `ACCEPTED` | G4 已独立验收；只读分析和单镜头受控命令面就绪 |
| CV4 | Canvas UI 工程师 | `tasks/CV4_CANVAS_UI_TASK.md` | `ACCEPTED` | G3 已独立复验通过 |
| CV5 | 业务融合工程师 | `tasks/CV5_BUSINESS_INTEGRATION_TASK.md` | `ACCEPTED` | Control、Story 与 Shared Bridge/Router/Proxy 已独立验收 |
| CV6 | QA/Gate 工程师 | `tasks/CV6_QA_GATE_TASK.md` | `BLOCKED` | 非付费真实浏览器与一次本地落盘付费 smoke 已通过；TOS 签名访问及完整产品输出链仍阻塞 |

运行配置遵循 `docs/program/EMPLOYEE_RULES.md`：

```text
model: gpt-5.6-sol
reasoning: high
speed: 1.5x（客户端支持时）
```

若客户端不提供速度设置，员工报告实际配置，不得伪造已设置。

### 6.1 最大并发

任何时候最多 4 个活跃窗口，包含 CV0。推荐组合：

```text
CV0 + 最多 3 名执行员工
```

### 6.2 独占写集摘要

| 员工 | 独占写集 |
|---|---|
| CV0 | 本文、集成记录、集成分支、最终状态 |
| CV1 | `docs/program/contracts/canvas-v1/**`、约定的合同 runtime parser/fixture |
| CV2 | `apps/storycanvas/src/services/storycanvas/assets-v1/**`、`canvas-v1/**`、正式 Canvas 生产路由、对应新迁移 |
| CV3 | `apps/storycanvas/src/agents/canvas-v1/**`、`apps/storycanvas/data/skills/canvas-v1/**` |
| CV4 | `src/features/canvas-v1/components/**`、`pages/**`、`canvas-v1.css`、UI view state |
| CV5 | `apps/control-api/src/assets/**`、Canvas 业务 API、`pilotStoryCanvasBridge.ts`、`Router.tsx`、Pilot proxy、`vite.config.ts` |
| CV6 | `tests/e2e/canvas-v1/**`、Canvas V1 Gate runner/报告；产品代码只读 |

共享文件唯一写入人：

```text
src/app/Router.tsx                              CV5
src/services/pilotStoryCanvasBridge.ts          CV5
src/config/pilotE2eProxy.ts                     CV5
vite.config.ts                                  CV5
T0_CANVAS_V1_MASTER_PLAN.md                     CV0
```

## 7. Task DAG 与工作顺序

```mermaid
flowchart TD
    T000["T0-CV1-00 基线与总控文档"] --> T001["T0-CV1-01 合同冻结"]
    T001 --> G1["G1 Contract Gate"]

    G1 --> T002["T0-CV1-02 资产与生产后端"]
    G1 --> T004["T0-CV1-04 Canvas UI"]
    G1 --> T005A["T0-CV1-05A Control Plane Asset Authority"]

    T002 --> G2["G2 Asset/Command Gate"]
    T005A --> G2

    G2 --> T003["T0-CV1-03 Canvas Agent"]
    T004 --> G3["G3 UI Gate"]
    T003 --> G4["G4 Agent Gate"]

    G2 --> T005B["T0-CV1-05B Bridge/Proxy/Router"]
    G3 --> T005B
    G4 --> T005B

    T005B --> G5["G5 Business Integration Gate"]
    G5 --> T006["T0-CV1-06 Real Browser Golden Path"]
    T006 --> G6["G6 Delivery Gate"]
```

### Wave 0 · Checkpoint

活跃：CV0、CV1、CV6。

- CV0：建立事实源、fetch、基线和保护清单。
- CV1：只读审计现有合同和版本差异。
- CV6：只读运行基线测试/构建，记录已有失败。

### Wave 1 · Contract Freeze

活跃：CV0、CV1、CV6。

- CV1：Schema、fixtures、negative vectors、错误码、字段安全分类。
- CV6：合同 conformance 测试。
- CV0：裁决未决字段并验收 G1。

### Wave 2 · Parallel Build

活跃：CV0、CV2、CV4、CV5。

- CV2：资产/生产后端和 Canvas Command Service。
- CV4：使用冻结 fixture 开发 Canvas UI。
- CV5：Control Plane Asset Authority 和业务 API。
- CV0：处理 Request 和检查写集。

### Wave 3 · Agent and Shared Integration

活跃：CV0、CV3、CV5、CV6。

- CV3：Agent tools 只调用 Canvas Command Service。
- CV5：Bridge、Proxy、Router 和正式项目接入。
- CV6：安全、组件和集成 RED/GREEN。
- CV0：按固定顺序集成。

### Wave 4 · Golden Path

活跃：CV0、CV6，以及最多一名返工 Owner。

- dedicated PostgreSQL `_test`；
- Control API、StoryCanvas、Vite 三服务；
- 真实 Chrome；
- 真实项目/资产门禁/任务；
- 刷新恢复；
- 全量回归和证据。

## 8. Gate

| Gate | Owner | 放行条件 | 未通过禁止 |
|---|---|---|---|
| G0 Baseline | CV0/CV6 | fetch 后 SHA、保护文件、基线测试、分支/worktree 计划明确 | 禁止多窗口写产品代码 |
| G1 Contract | CV1/CV6/CV0 | Schema、fixture、negative vector、状态、ID、错误、安全投影一致 | 禁止 CV2/CV4/CV5 正式实现 |
| G2 Asset/Command | CV2/CV5/CV6 | 未认证阻断、Active 资产绑定、Scope、命令幂等、持久化通过 | 禁止 Agent 和真实视频生成 |
| G3 UI | CV4/CV6 | 真实状态、明确失败、刷新恢复、无旧 MVP API、可访问性 smoke | 禁止切正式路由 |
| G4 Agent | CV3/CV6 | Agent/UI 共用命令，不能绕过资产/审批/成本门禁 | 禁止 Agent 批量生产 |
| G5 Business Integration | CV5/CV0/CV6 | Tenant/Project/Package/Session 精确绑定，Bridge/Proxy/Router fail-closed | 禁止进入最终 Golden Path |
| G6 Delivery | CV6/CV0 | 真实浏览器、真实项目、真实任务、无秘密泄漏、全量回归 | 禁止宣称 Canvas V1 完成 |

Gate 状态：

| Gate | 当前状态 | 证据/说明 |
|---|---|---|
| G0 | `ACCEPTED` | `handoffs/CV6_G0_BASELINE_HANDOFF.md`；带已知基线失败放行 |
| G1 | `ACCEPTED` | 含 EntityBinding missing amendment；66/66 PASS、10 fixtures、38/38 双 parser parity |
| G2 | `ACCEPTED` | 审批消费、资产同步/绑定、连续性、任务幂等与 Provider 任务事实链独立 Gate 通过；G6 已另行完成一次本地落盘真实 Provider smoke |
| G3 | `ACCEPTED` | CV4 owner 31/31、CV6 独立三项回归 3/3；审批、状态恢复和五个媒体 sink 均 fail-closed |
| G4 | `ACCEPTED` | CV6 独立静态 4/4、动态 7/7，CV3 owner 11/11；Agent 不直连 DB/Provider 且不能绕过 scope/readiness/approval |
| G5 | `ACCEPTED` | Control、Story、Shared 同源 API/Bridge/Router/Proxy 均通过独立 Gate；历史 4 个 Shared RED 以真实产品实现转绿 |
| G6 | `BLOCKED` | 真实三服务、Chromium 双视口、刷新恢复与安全扫描已通过；一次直连受控 Seedance task 已成功。平台现已支持显式本地受控输出、`output_registered` 事实推进和 UI 轮询，但尚未从真实平台页面再次执行付费命令闭环 |

状态词只使用：

```text
NOT_STARTED
READY
IN_PROGRESS
BLOCKED
READY_FOR_GATE
ACCEPTED
```

## 9. 联合状态口径

新状态只能按真实证据推进：

```text
CANVAS_V1_CONTRACT_FROZEN
CANVAS_V1_ASSET_GATE_READY
CANVAS_V1_COMMAND_READY
CANVAS_V1_UI_READY
CANVAS_V1_AGENT_READY
CANVAS_V1_BUSINESS_INTEGRATED
CANVAS_V1_GOLDEN_PATH_PASS
```

当前继续保持：

```text
CANVAS_V1_CONTRACT_FROZEN
CANVAS_V1_ASSET_GATE_READY
CANVAS_V1_COMMAND_READY
CANVAS_V1_UI_READY
CANVAS_V1_AGENT_READY
CANVAS_V1_BUSINESS_INTEGRATED
B_REMEDIATION_ACCEPTED
SHARED_ACTIVATION_GREEN_READY_FOR_PLANNING
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

在 G6 通过前不得宣称：

```text
REAL_EDITOR_LOADED
CANVAS_V1_COMPLETE
AB_GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

## 10. 员工交互协议

### 10.1 开工报告

每名员工首次报告必须包含：

```text
employee/task id
model/reasoning/actual speed configuration
repository/worktree
branch
baseline full SHA
master plan version read
exact intended write set
explicit no-write set
planned RED/tests
known blockers
```

配置或基线不符时先暂停，不得开始写代码。

### 10.2 Request

编号：

```text
REQ-T0CV1-{发起员工}-{三位序号}
```

必须包含：

- 请求内容；
- 请求原因；
- 合同/文件影响；
- 是否阻塞；
- 临时方案；
- 期望 Owner；
- 目标 Gate。

只有 CV0 可以批准跨域修改。

### 10.3 Handoff

每次交付必须包含：

```text
task id
baseline and final full SHA
atomic commits
exact changed paths
implemented contracts
test commands and exact results
security/secret evidence
known failures
unfinished items
rollback method
downstream first step
```

### 10.4 更新频率

- 员工状态发生变化时向 CV0 报告，不直接更新本文。
- 进行中的员工每个原子切片结束必须报告。
- 遇到真实合同冲突、跨写集需求或秘密/授权风险时立即报告。
- 普通实现选择由员工在边界内自主处理。
- CV0 只在 Gate、真实阻塞或需要用户决策时向用户汇报。

## 11. 固定集成顺序

```text
1. Contract
2. Control Plane Asset Authority
3. StoryCanvas Asset/Command
4. Canvas UI
5. Canvas Agent
6. Shared Bridge/Proxy/Router
7. E2E/Gate
```

每次集成前 CV0 必须验证：

- commit object；
- baseline ancestor；
- exact write set；
- `git diff --check`；
- 任务 targeted tests；
- 不包含受保护文件；
- 没有旧 Demo/Mock fallback；
- 回滚方法存在。

## 12. 通用员工启动提示词

以下前缀必须出现在 CV1—CV6 的正式启动提示词中：

```text
你是 T0-CV1 紧急开发数字员工。开工前完整阅读：
1. docs/program/t0-canvas-v1/T0_CANVAS_V1_MASTER_PLAN.md
2. docs/program/EMPLOYEE_RULES.md
3. docs/program/AUTONOMY_PROTOCOL.md
4. 你的 T0-CV1 任务书

先只读核对仓库、分支、baseline SHA、Master Plan 版本和工作区状态，
然后报告 exact intended write set 与 explicit no-write set。配置或基线不符时暂停。

只修改任务书声明的独占写集。不得触碰、暂存或提交：
apps/storycanvas/data/vendor/byteplus.ts

不得使用 Demo Grant、Mock 成功、LocalStorage、SessionStorage、固定
demo-local-001 或旧 /api/mvp/* 替代正式能力。不得 reset --hard、git clean、
rebase、force push，不得 git add .。

UI 和 Agent 必须通过同一个 Canvas Command Service。任何合同冲突通过
REQ-T0CV1 提交，不自行改写共享合同或他人文件。按 RED → GREEN → 回归推进，
每个任务形成原子 commit。完成后提供 full SHA、exact paths、真实测试结果、
安全证据、风险、未完成项、回滚方法和下游第一步。
```

## 13. 横向强制约束

四个工作流必须共同满足：

1. 资产授权与权利生命周期；
2. Canvas Document 版本与乐观锁；
3. 命令幂等、response-loss replay 和 changed-payload rejection；
4. Provider secret、Package/Grant 和浏览器隔离；
5. Feature Flag 与旧画布可控回退入口；
6. 数据库迁移、回滚和临时数据根；
7. 开源来源、许可证和 NOTICE；
8. Request ID、错误包络、任务诊断和日志脱敏；
9. 真实能力不可用时 fail-closed；
10. 高成本模型调用前的明确用户确认和使用量记录。

## 14. CV0 决策升级边界

CV0 可以自行决定：

- 任务拆分和员工启动顺序；
- 普通技术实现；
- 测试和返工安排；
- 不改变合同语义的字段命名修正；
- 已批准范围内的分支和集成方式。

CV0 必须向用户升级：

- 改变首日完成定义；
- 从受控画布改为完整自由无限画布；
- 引入需要付费或限制商业使用的核心编辑器；
- 真人授权、肖像权、版权或隐私规则变化；
- 真实模型密钥、采购、付款、正式部署或对外发布；
- 删除/替换现有生产后端；
- 无法 fast-forward/安全集成且需要重写历史；
- 需要触碰受保护 `byteplus.ts`。

## 15. 验收证据清单

G6 最少需要：

1. fetch 后 baseline full SHA；
2. 所有员工原子 commit 与 exact paths；
3. 合同 schema/fixture/negative vector PASS；
4. 未认证人物 UI、Agent、服务端三层阻断；
5. Active 可信资产绑定与连续性 revision 更新；
6. UI/Agent 同一 CanvasCommand 证明；
7. 真实项目 Canvas Bootstrap；
8. 真实 Seedance task id 和安全状态证据；
9. 生成结果归属 tenant/project/package/session；
10. 刷新恢复；
11. 浏览器/DOM/URL/Storage/console/日志无秘密字段；
12. Root build、StoryCanvas build、targeted tests、Governance、diff-check；
13. `apps/storycanvas/data/vendor/byteplus.ts` 未触碰证明；
14. 旧 Shared RED 不被删除、skip 或弱化；
15. 尚未完成的 MP4/Golden Path/Joint Gate 明确说明。

## 16. 当前执行入口

用户已正式启动 T0-CV1。G0 已由 CV6 完成并由 CV0 以
`ACCEPT_WITH_KNOWN_BASELINE_FAILURES` 放行；G1（含 additive amendment）、
G2、G3、G4 和 G5 已由 CV0 验收。当前进入 Wave 4 / G6 Delivery：

```text
1. CV2 已完成资产门禁、Document、Canvas Command Service、受信审批消费与 Seedance runtime adapter
2. CV2 已完成 SYNC/BIND/GENERATE/SELECT/SAVE 最小命令面，真实付费 Seedance smoke 仅在 G6 执行
3. CV4 UI 和动态 exact-action approval 已通过独立 Gate
4. CV3 已完成 12 个白名单 Agent tools，只读分析、资产计划和单镜头命令全部经同一 CanvasCommand Service
5. CV1 冻结 browser-safe `CanvasWorkspace/0.1` 与 server-only `CanvasAssetMaterialization/0.1`
6. CV2 已完成 formal bootstrap/workspace/materialization；CV5 已完成 Activation/Bridge/Proxy/Router
7. CV6 已使用 dedicated PostgreSQL `_test`、Control、StoryCanvas、Vite 和真实 Chromium 完成双视口安全浏览器切片
8. G6 期间修复并独立复验了 Session 重投影、同源 GET provenance、StrictMode 并发 Legacy Open 与 Formal Bootstrap
9. 用户已明确授权并完成一次受控 Seedance 付费 smoke：单次 POST、4 秒、480p、无音频，Provider `succeeded` 且 MP4 本地校验通过；TOS 签名读取仍为 403，因此未执行 TOS 写入或产品输出登记
10. 用户随后明确要求回到平台开发；本地环境已开启 Seedance 音频并显式选择 `local` 输出模式。平台生成结果可原子写入受控 StoryCanvas 项目目录、登记 `sc_media_assets`、经 authenticated controlled-media route 回显，并在完成后推进 `CanvasEvent` 到 `output_registered`
11. Canvas 路由容器会对 `accepted/provider_submitted/task_created` 事实执行 bounded authoritative workspace polling，终态后停止；本切片未发起第二次付费 Provider 调用
```

G1 证据：

```text
CV1-A inventory:        9690885765b2ffeb308e06e3a17b416439996578
CV1-B fixtures/RED:     1f2b2abd47e9b0a92730f61cf8d1ca63e7a60e96
CV1-C parsers/GREEN:    898b3067f4d82e302e67fa735baf80e61c7fabe7
CV1-D handoff:          2f7939433dee7632b9e188ba4fbabc9365a79b7c
CV6 RED:                a5b3ac79ac35ce8bff463f8b5525d4e8588df3f0
CV6 GREEN:              a03432891d440c51d0906948adb84db6593fa50b
CV6 handoff:            7dd0caed9b817b106d33e1be14f5777f8a52e074
Contract Gate:          60 PASS / 0 FAIL / 0 SKIP/TODO
Negative-vector parity: 37/37 frontend/backend stable-code PASS

Wave 2 independent revalidation:
CV6 test:                  8e8d5037cbc8b040deb82340e17e2ad09dab3648
CV6 handoff:               9d86c7cf1c2fab97ba2e2e0753bc1ec7fe8e02b4
G1 amendment gate:         66/66 PASS; 10 fixtures; 38/38 parity
G2 production-wired scope: 3/3 PASS; Story 005 + PostgreSQL 025/026 PASS
G3 independent regressions: 3/3 PASS; owner suite 31/31 PASS
G2 runtime independent:    approval/wiring 23/23; provider recovery 18/18 PASS
G2 owner targeted:         Control 60/60; StoryCanvas 54/54 PASS
Dynamic approval Gate:     71/71 PASS
G2 status:                 ACCEPTED; paid Seedance smoke deferred to G6
G4 independent static:     4/4 PASS
G4 independent dynamic:    7/7 PASS
G4 owner targeted:         11/11 PASS
G4 status:                 ACCEPTED; no paid Seedance and no bulk production
G5 additive validators:   domain 38 + activation 25 + workspace 69 + authority 30 PASS
G5 additive parser Gate:  facts 7; Story 7; parity/boundary 11; browser/UI 6 PASS
G5 Shared Gate:           activation 6/6; static 7/7; runtime 7/7; historical 37/37 PASS
G5 owner/root:            Shared owner 67/67; root 521/521 PASS
G5 product status:        ACCEPTED; external browser and paid Provider remain G6
G6 safe browser:          real 3-service Chromium 1440x900 + 1672x941 2/2 PASS
G6 session recovery:      3/3 PASS; reload authority and document facts stable
G6 no-provider result:    formal workspace hydrated; generation blocked; approval/command/provider 0
G6 paid local smoke:      one Provider POST; succeeded; H.264 4.041667s; local SHA-256 verified
G6 TOS status:            signed object GET 403 AccessDenied; no TOS write attempted
G6 platform local output: atomic 0600 file + sc_media_assets + controlled Range + output_registered GREEN
G6 platform polling:      bounded authoritative workspace refresh GREEN
G6 audio config:          enabled in ignored local env; no second paid task executed
G6 status:                BLOCKED; real browser approval→CanvasCommand→paid Seedance→local output evidence not yet run
```

G0 已知基线事实：

```text
StoryCanvas:                         69/69 PASS
StoryCanvas v0.2:                   13/13 PASS
Media/TTS/Storage:                  17/17 PASS
Root/Control/StoryCanvas builds:    PASS
Governance/diff-check:              PASS
Root suite:                         431 PASS / 4 historical Shared RED
Historical contract gate:           outer 9/10; stale A3 child 4/10
Control API without _test database: 447 PASS / 236 SKIP
Full Joint Gate:                    BLOCKED as designed
```

这些失败不归因于 T0-CV1，也不得在后续被删除、skip、弱化或伪报为 PASS。

## 17. 变更记录

### v0.15 · 2026-08-14

- 用户纠正目标为继续开发平台而非继续直连接口测试；CV0 将主项目与集成工作树的忽略本地配置切换为 `SEEDANCE_GENERATE_AUDIO=true`、`CANVAS_V1_OUTPUT_STORAGE=local`，TOS 配置原样保留；
- 新增显式本地输出后端：生成结果原子写入 StoryCanvas 受控项目目录、文件权限 0600、same/same 幂等、changed-content conflict、task/project exact binding，并登记 `sc_media_assets`；
- controlled-media route 在完整 command→event→task→media authority join 后支持本地 MP4 与单 Range 流式读取；本地绝对路径不进入 browser DTO、DOM、URL 或响应；
- `CanvasCommandService` 现在仅在持久输出通过 `assertOutputAsset` 后推进 `task_created → output_registered`，异步失败写固定安全事件；UI 对运行中事件执行 bounded authoritative workspace polling并在终态停止；
- 原子切片：RED `0ff2bdc21b99f2d2e95556e4fac633ef1887d3db`、GREEN `db5a52a740b3b4ca31b9833bdcb4426f4c709914`；RED `c6c454e5d2177ce6d36121ef763eee74c641f089`、GREEN `31ad3d1e8ecb55700fedebe50e51082a3cfb55c6`；RED `482625d93e531fa49ee816753abb18c9f842217a`、GREEN `1dca807e0ff82576f83ac9165ef05d8b656afa72`；
- 验证：Canvas/Story targeted 58/58、Root 522/522、Canvas UI 59/59、Root build、StoryCanvas build、Governance、diff-check 全部通过；`byteplus.ts` 未触碰；
- 本切片零 Provider POST、零付费调用。G6 继续 `BLOCKED`，下一门为真实平台浏览器的动态审批→CanvasCommand→带音频 Seedance→本地登记→controlled media 回显；该真实付费任务需要新的明确授权。

### v0.14 · 2026-08-14

- 用户明确授权一次 Seedance 受控付费 smoke；CV0 以单次 POST、无自动付费重试提交 4 秒、480p、9:16、无音频任务，Provider 达到 `succeeded`；
- Asset Group 与两个 Active Image 资产预检通过；现有资产 URL 可读取，但当前 AK/SK 对匹配 bucket/prefix 的签名 TOS GET 返回 HTTP 403 `AccessDenied`；
- 经用户裁决，本轮保留 TOS 配置并改为本地落盘；MP4 为 H.264、496×864、24fps、4.041667 秒、493718 字节，SHA-256 已校验；
- 原始 Provider task ID 只保存在仓库外 0600 本地状态，持久报告仅记录安全指纹；未写 TOS、未触碰 `byteplus.ts`、未发起第二次付费任务；
- G6 继续为 `BLOCKED`：本地 Provider smoke 成功不等于浏览器动态审批、CanvasCommand、TOS 输出登记、controlled media、Golden Path 或 Joint Gate 完成。

### v0.13 · 2026-08-14

- 真实 Chromium 复现并修复 formal GET 缺少 `Origin`、StrictMode 并发 Legacy Open 200/409、并发 Formal Bootstrap 502，以及新 `pcs_*` 会话下 Provider/Entity authority 无法恢复；
- 冻结浏览器 provenance 与并发 replay additive 合同；同源 formal GET 通过 Session、exact `pcs_*`、Fetch Metadata 与 Referer 组合验证，mutation 继续 exact Origin + CSRF；
- 使用 dedicated `videoagent_control_test`、Control API、StoryCanvas、Vite 和真实 Chromium 完成 1440×900、1672×941 双视口验证，formal Workspace 加载、刷新恢复、无秘密泄漏均通过；
- Provider 未配置时 UI 明确显示 Seedance unavailable，生成按钮禁用；approval、command、paid Provider 调用均为 0；
- CV0 接受 `G6 SAFE NO-PROVIDER BROWSER` 切片，但 G6 整体标记 `BLOCKED`：当前环境缺少六项 BytePlus/TOS 配置，且尚未获得付费 smoke 授权，因此没有真实 task/output，Golden Path 仍未完成。

### v0.12 · 2026-08-14

- 集成正式 Canvas V1 same-origin API、Activation/Legacy Open/Formal Bootstrap/Workspace Bridge、动态审批与权威刷新；
- Pilot Router 仅在 canonical `projectId + packageId` 入口加载 Canvas V1，缺失、重复、畸形或越权 Package 均 fail-closed，不回退 Demo/generic handoff；
- test-only 双开关代理保持浏览器原始 Origin，非法端口和非测试环境固定拒绝；历史 4 个 Shared RED 未删除或弱化，现以真实产品能力全部转绿；
- CV6 独立验证 Activation 6/6、Shared static 7/7、runtime 7/7、browser harness policy 3/3、历史 Shared 37/37，Owner 67/67、Root 521/521 以及合同、Control/Story、构建和治理全部通过；
- CV0 接受 G5 并登记 `CANVAS_V1_BUSINESS_INTEGRATED`；G6 进入 READY，但三服务、外部真实浏览器、截图和付费 Seedance 均尚未执行。

### v0.11 · 2026-08-14

- 集成 Story formal Bootstrap/Workspace、trusted prepare、Control authority/materialization clients、原子本地媒体映射与 controlled media proxy；
- trusted prepare 按公共 UUIDv5 创建稳定 document/requirement/readiness，casting 0/>1 全表零写，Workspace GET 保持只读；
- output 只在 command→shot→event→task→media 完整事实链精确绑定后进入安全投影；
- CV6 先后发现并关闭 persisted event/command authority poison 与 runtime media port 装配错误；
- 独立动态 10/10、Story targeted 48/48（Owner 60/60）、G2/G4/合同/构建/治理全通过；G5-owned strict TypeScript 新错误为 0；
- CV0 接受 Story G5 切片；G5 剩余为 Shared same-origin API/Bridge/Router/Proxy 和真实浏览器 Gate。

### v0.10 · 2026-08-14

- 集成 Control server-only Workspace Authority，通过 active Canvas session 精确绑定 actor/tenant/project/package；
- 按 Package 中精确 Script/Storyboard ID 查询数字版本，禁止 latest 推断，返回真实 project name 和完整安全 AssetRecord 集合；
- 一个 pending 虚拟人物保留真实状态，零个或多个固定 409，不返回 partial authority/workspace；
- CV6 独立静态 5/5、HTTP/service/PostgreSQL 6/6、Owner 16/16，Control 全量 790 PASS / 4 existing skips；
- CV0 接受 Control Workspace Authority 切片；Story trusted prepare 与 formal Workspace 已进入实现和分段独立复验。

### v0.9 · 2026-08-14

- 集成 Control server-only Canvas Asset Materialization、027 immutable attempt authority 与受控本地存储 reader；
- 修复 Control exact 8 MiB base64 parser 栈溢出与 reset/seed 001–027 迁移数量回归；
- CV6 独立静态 5/5、动态/PostgreSQL 5/5、Owner 35/35，Control 全量 776 PASS / 3 existing skips；
- 真实 PostgreSQL 只使用 `videoagent_control_test`，迁移 001–027、持久 replay/conflict、边界素材与构建全通过；
- CV0 接受 Control Materialization 切片；G5 仍等待 Story formal Workspace/本地映射和 Shared 浏览器接入。

### v0.8 · 2026-08-14

- 冻结并独立验收 `CanvasWorkspace/0.1`、`CanvasAssetMaterialization/0.1` 与 server-only Workspace Authority additive 合同；
- 冻结 exact Package 数字版本投影、唯一虚拟人物 casting、公共 UUIDv5 派生、每镜头唯一 requirement 与分镜 description 初始 prompt；
- casting 缺失或歧义时固定 409，不返回 partial Workspace，不写入伪 requirement/document/readiness；
- 修复 materialization exact 8 MiB base64 parser 栈溢出，并冻结 JPEG/PNG/WebP magic、字节大小、SHA-256 和稳定边界错误；
- CV6 验证 38+25+69+30 vectors、Story/browser parity、真实 UI hydration、构建和治理全通过；
- CV0 只放行 G5 additive 合同进入产品实现；G5 产品 Gate 仍为 `IN_PROGRESS`，未完成 Golden Path。

### v0.7 · 2026-08-14

- 集成 Canvas Agent 12 个严格白名单工具、受信 host scope、单镜头命令工作流与安全 Skill；
- 五类高成本命令仍需 host approval，Agent 不能 mint approval，SYNC 保持 low-cost 但仍走共同命令服务；
- CV6 独立 G4 静态 4/4、动态 7/7，CV3 owner 11/11，合同、G2 回归、构建和治理通过；
- CV0 将 G4 标记为 `ACCEPTED`，新增联合状态 `CANVAS_V1_AGENT_READY`；
- 进入 G5：先冻结 browser-safe Workspace 与 server-only Materialization 合同，再实现真实 Activation/Bootstrap/Bridge/Proxy/Router；
- 未执行付费 Seedance，未完成正式画布浏览器闭环、Golden Path 或 Joint Gate。

### v0.6 · 2026-08-14

- 集成 StoryCanvas 受信 Control approval consumer 与 Seedance runtime adapter，收紧 action 为 exact `{commandId,payload}` 和固定 60 秒 TTL；
- 集成五类高成本动作的动态 UI 确认，独立 Gate 71/71 PASS；
- 接通 SYNC/BIND/GENERATE/SELECT/SAVE 最小命令面，校验唯一业务资产→本地人物→Provider 映射，BIND 推进 continuity revision；
- 完成 Provider 任务建立事实、响应丢失重放、changed task hook poison 与输出项目归属校验；
- CV6 G2 独立 Gate 23/23 + 18/18 PASS，Control 60/60、StoryCanvas 54/54，合同、数据库、构建和治理通过；
- CV0 将 G2 标记为 `ACCEPTED`，但未调用真实付费 Seedance，G6 和 Golden Path 继续未完成；
- 启动 Wave 3 / G4 Canvas Agent RED/GREEN，CV5 05B 继续等待 G4。

### v0.5 · 2026-08-14

- CV0 接受 G5 additive Activation Transport 合同 `ee1c24e9c55369c2d38eabc89e76a4cbfea17197`；
- canonical route 冻结为 `/production/canvas/:projectId?packageId=<uuid>`，缺失或猜测 Package 一律 fail-closed；
- 冻结 Control activation facade、server-derived Canvas Entry 幂等、legacy open 与 formal CanvasBootstrap/0.1 分层；
- 冻结高成本命令动态确认：`action={commandId,payload}`，禁止静态通用 approval；
- Transport validator 6/6 PASS，25 个 negative vectors；当前仅合同放行，不表示 G5 已实现。

### v0.4 · 2026-08-14

- 集成 CV2/CV4/CV5 Wave 2 产品切片与 CV6 独立复验；
- 接受 EntityBinding missing amendment，合同 Gate 更新为 10 fixtures、38 vectors、66/66 PASS；
- 新建并验证本机隔离数据库 `videoagent_control_test`，PostgreSQL 025/026 与迁移链真实通过；StoryCanvas 005 同步通过；
- 修复 Control Canvas Session exact scope、response-loss replay、registration fail-closed 与内部 token 比较；
- 修复 UI 高成本绑定 approval、同镜头新文档版本 prompt 恢复与全部 browser media sink；
- CV0 将 G3 标记为 `ACCEPTED`；
- G2 保持 `BLOCKED`：正式 StoryCanvas runtime 尚未注入 Control approval consumption 和 Seedance production adapter；
- CV3 与 CV5 05B 仅完成只读准备，不越过 G2/G4 Gate。

### v0.3 · 2026-08-14

- CV0 集成 CV1 四个合同提交与 CV6 G1 RED/GREEN/证据提交；
- 九个 Canvas V1 additive contracts、canonical fixtures、37 个 negative vectors、前后端 strict parser 已冻结；
- CV6 独立 Gate 60/60 PASS，CV0 将 G1 标记为 `ACCEPTED`；
- 新增联合状态 `CANVAS_V1_CONTRACT_FROZEN`；
- 启动 Wave 2：CV2、CV4、CV5；CV5 当前只获准执行 05A。

### v0.2 · 2026-08-14

- 用户正式启动 Wave 0；CV1、CV6 均以 `gpt-5.6-sol/high` 执行；
- 冻结 `origin/main@19582cbf16e1414f884f9864f7c0d372640cb26a` 与治理基线 `413322708b35da7a158f45bdb329416b39238e52`；
- CV6 完成 G0 baseline matrix，CV0 接受带已知基线失败放行；
- CV1 完成零写入合同审计，识别并由 CV0 裁决八项 G1 必修边界；
- G1 进入 `IN_PROGRESS`，G2—G6 保持未启动。

### v0.1 · 2026-08-14

- 建立 T0-CV1 唯一总控事实源；
- 冻结四个工作流、七名数字员工、写集、DAG 与 G0—G6；
- 冻结受控画布、资产门禁、Creator + Agent 同一命令层；
- 记录本地与远端基线及受保护文件；
- 尚未招聘员工，尚未修改产品代码。
