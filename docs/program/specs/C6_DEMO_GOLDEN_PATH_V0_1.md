# C6 老板演示黄金路径 v0.1

> 状态：`PROPOSED / READY_FOR_C0_REVIEW`
>
> Owner：C6 · UX 与老板演示闭环负责人
>
> 日期：2026-07-30
>
> 目标：在 10—15 分钟内，用唯一项目 `demo-local-001` 讲清“平台卖什么、渠道如何卖、企业买到什么、媒体如何生产、额度为何变化、最终交付什么”。
>
> 适用范围：D1 老板 Demo 的信息架构、演示节奏、页面/交互状态和失败兜底。本文不批准真实价格、资金结算、商业授权、生产部署或公共接口变更。

## 1. 一句话主线

```text
平台配置可售能力
→ 代理看到可售范围与客户状态
→ 企业切换到海底捞三里屯并使用已购能力
→ 品牌事实约束脚本和分镜
→ 唯一生产包进入 StoryCanvas
→ 生成任务形成任务/资产回执
→ 控制平面解释额度冻结、消费和释放
→ 导出成片并下钻到完整来源链路
```

老板离场前应能复述：

1. 平台销售的是“AI 视频生产能力与额度”，不是上游 token。
2. 场景 Agent 把通用生产能力包装成可理解的本地生活业务流程。
3. StoryCanvas 负责媒体生产，不掌握客户价格，不直接改钱包。
4. 每次生成先冻结，成功形成可交付资产才消费，失败或余量会释放。
5. 成片能追溯到品牌事实、脚本、镜头、任务、模型、资产和导出版本。

## 2. 演示纪律与真实性图例

### 2.1 强制纪律

- 全程只使用 `demo-local-001 / 海底捞火锅·北京三里屯门店`，不得复制第二套“相似”主数据。
- 关键按钮必须现场可点击并产生可见状态变化；身份切换、脚本批准、发包、生成、回执、额度变化和导出不得用静态截图替代。
- 所有额度和商业数字区域固定显示水印：`演示数据 · 非正式报价`。
- “预计 100、最多冻结 120”只作为经 C0 批准的演示 RateCard 样例，不是正式定价，也不承诺额度与人民币、时长或模型调用的固定换算。
- 品牌事实中的门店套餐/价格属于演示 Claim，必须显示来源与 `C8：具体套餐、价格和权益以门店实际规则为准`，不得与平台产品价格混淆。
- 真实生成、Mock 生成、基础合并导出和尚未购买能力必须显式标识。
- 不展示上游 API Key、供应商秘密、平台上游成本或其他租户内容。

### 2.2 图例

| 标识 | 含义 | 演示口径 |
|---|---|---|
| `REAL-UI` | 当前 `videoagent` 已有可操作页面/状态 | 可现场操作，但数据仍来自 DemoWorkspace / LocalStorage |
| `REAL-CAP` | StoryCanvas 已有真实画布、连续性或生成基础 | 能力真实存在；是否已接海底捞生产包需另标 |
| `MOCK-CONTRACT` | 按 v0.1 字段和状态机模拟的跨平面合同 | 语义真实，传输/存储为 Demo Mock |
| `HYBRID` | 真实交互或能力外包一层 Mock Adapter | 必须在页面角标说明哪部分真实、哪部分 Mock |
| `LOCKED` | 未购买、未授权或后续能力 | 只展示价值、依赖与解锁原因，不允许进入伪流程 |
| `FALLBACK` | 主路径失败后的可操作降级 | 仍使用同一项目和同一来源链，不换预录截图 |

### 2.3 当前能力基线

| 能力 | 当前基线 | D1 展示方式 |
|---|---|---|
| 企业工作台、Brief、品牌大脑、脚本 | 已有可操作前端页面 | `REAL-UI`；顶部标记 DemoWorkspace / LocalStorage 非生产事实源 |
| 分镜清单、素材/初剪 | 当前仓库仍是占位页 | D1 必须补成可操作 Demo；补齐前是 P0 断点 |
| 四工作台身份/组织切换 | 尚未形成统一外壳 | `MOCK-CONTRACT`，但菜单、余额、数据范围必须真的随切换变化 |
| Product / Entitlement / Wallet / Ledger | 领域语义已会签，真实后端未实现 | `MOCK-CONTRACT`；严禁冒充真实交易或账本 |
| StoryCanvas 画布、连续性、部分真实生成 | 已有真实基础，但当前主数据仍偏“南城咖啡” | `HYBRID`；必须消费唯一海底捞生产包后才可进入黄金路径 |
| FireRed 完整时间线/AI 剪辑 | 尚未闭环 | 默认不演示为真实；使用基础合并并明确标识 |
| 导出 | StoryCanvas 有 FFmpeg 基础顺序合并 | `HYBRID`；D1 需登记导出物及来源链 |

## 3. 统一演示数据与开场快照

### 3.1 唯一业务快照

| 字段 | 演示值 |
|---|---|
| 项目 | `demo-local-001` |
| 企业 Tenant | 海底捞演示企业 |
| Brand / Store | 海底捞火锅 / 北京三里屯门店 |
| 场景 Agent | 本地生活 Agent |
| 平台 / 规格 | 抖音 / 9:16 / 30 秒 |
| 受众 | 18—30 岁，北京本地及旅游美食人群 |
| 主 CTA | 领取团购券 / 到店核销 |
| 已购 | AI 视频基础生成 + 本地生活 Agent |
| 未购买/待授权 | 数字人 Add-on、API Add-on |
| 脚本 | A 服务体验向、B 会员权益向、C 夜景种草向；默认批准 A |
| 分镜 | 8 镜；05 为 `reshoot`，07 为 `missing` |
| 品牌事实 | Claim `C1—C8`，含来源、状态与免责声明 |

### 3.2 演示状态种子

开场必须从可重置的 `DEMO_READY` 快照开始：

```text
activeOrganization = Platform
selectedTenant = null
selectedProject = demo-local-001
entitlements = [基础生成: active, 本地生活: active, 数字人: locked, API: locked]
project = scripting
script-a = draft_approved_for_demo=false
productionPackage = not_created
productionPlane = not_entered
task-demo-success = not_requested
task-demo-failure = not_requested
wallet = demo fixture
exportArtifact = not_created
```

“重置 Demo”应恢复业务状态，不清空或切换主数据；任何演示中断后都能在 15 秒内回到 `DEMO_READY`。

## 4. 页面地图

以下路由是 D1 UX 建议，不构成公共 API 合同。`现有` 表示当前 `videoagent` 已有路由，`D1` 表示 Demo 需补，`SC` 表示 StoryCanvas 生产平面。

```text
全局 Demo Shell（D1）
├── 当前工作台 / 当前组织 / 当前角色
├── Demo Mode 与 REAL/MOCK 状态条
├── 通知 / 任务回执
└── 重置 Demo

平台管理（D1）
├── /platform/overview                  平台概览
├── /platform/organizations             渠道与企业组织
├── /platform/catalog                   Product / Capability / 演示 RateCard
└── /platform/production-receipts       任务、资产与额度处理状态

渠道代理（D1）
├── /channel/overview                   本组织概览
├── /channel/products                   可采购 / 可售产品
├── /channel/customers                  下级与企业客户
└── /channel/customers/:tenantId/usage  客户商业用量汇总

企业客户
├── /dashboard                          经营与项目概览（现有）
├── /enterprise/products                已购 / 未购买能力（D1）
├── /projects/new                       Brief（现有）
├── /projects/demo-local-001/brand      品牌大脑（现有）
├── /projects/demo-local-001/script     脚本编辑（现有）
├── /projects/demo-local-001/storyboard 分镜生产单（现为占位，D1 P0）
├── /projects/demo-local-001/usage      额度与使用明细（D1）
└── /projects/demo-local-001/delivery   成片与来源链路（D1）

媒体生产（SC / D1 Adapter）
├── /production/inbox/demo-local-001    生产包接收与合同摘要
├── /storycanvas/demo-local-001         分镜画布、引用与连续性
├── /storycanvas/demo-local-001/tasks   生成任务
├── /storycanvas/demo-local-001/assets  媒体资产
├── /storycanvas/demo-local-001/timeline 时间线 / 基础合并
└── /storycanvas/demo-local-001/export  导出与回执
```

### 4.1 导航规则

1. 左侧导航只显示当前工作台可见模块；工作台切换器固定在左上。
2. 顶栏始终显示：`当前组织 > 当前角色 > 当前 Tenant/Project`，避免多组织上下文混淆。
3. 切换组织后必须原子更新菜单、指标、余额、数据范围和可执行按钮；旧组织抽屉/弹窗立即关闭。
4. 从企业侧进入 StoryCanvas 使用同页新路由或新标签页均可，但必须保留：
   - 顶部同一项目条：`海底捞三里屯 · demo-local-001`；
   - 返回企业项目的可见入口；
   - `ProjectProductionPackage v0.1`、包版本和 Demo/真实标识；
   - 不在 URL、LocalStorage 或页面展示短期令牌明文。
5. 进入 StoryCanvas 后，不显示客户价格、钱包、渠道树或平台上游成本；仅显示“生产授权有效 / 额度已由控制平面预冻结”。
6. 所有深链若上下文无效，回到安全页并给出原因，不自动打开其他 Tenant 的同 ID 对象。

## 5. 10—15 分钟老板演示 Storyboard

建议标准时长 13 分钟，预留 2 分钟回答问题或演示一条失败支线。

| # / 时间 | 入口与页面 | 现场操作 | 可见状态变化 | 讲解词 | 业务价值 | 标识 | 失败兜底 |
|---|---|---|---|---|---|---|---|
| 1 / 0:00—0:40 | 全局 Demo Shell → 平台概览 | 点击“重置 Demo”，确认当前组织为“平台” | 全局恢复 `DEMO_READY`；平台菜单、全局指标出现 | “我用一套账号进入不同组织，系统会同时切换菜单、数据范围和可执行动作。” | 先证明不是四套割裂系统 | `MOCK-CONTRACT` | 重置失败时加载内置只读快照，但仍允许后续身份/页面点击；显示“本地 Demo 恢复” |
| 2 / 0:40—1:30 | 平台 `/platform/catalog` | 打开“AI 视频基础生成”和“本地生活 Agent”；切换“已发布 / 待授权”筛选 | Product → Capability 关系展开；演示 RateCard 显示水印；数字人/API 为 `LOCKED` | “平台卖的是生产能力与额度。Agent 是业务流程包装，数字人和 API 今天只讲价值，不伪装为已完成。” | 解释商品层次与首发范围 | `MOCK-CONTRACT` | 目录加载失败时从本地合同 fixture 渲染并显示版本，不使用截图 |
| 3 / 1:30—2:20 | 切换到代理商 `/channel/products`、`/channel/customers` | 用工作台切换器选择“一级代理演示组织”；点击海底捞客户 | 平台全局指标消失；仅显示本组织可售产品、客户商业状态和汇总用量；内容入口不可见 | “总代理、一级、二级共用一个渠道工作台。代理能看自己的可售范围和客户商业状态，但不能因为渠道祖先关系看到脚本与素材。” | 证明渠道可扩展且数据最小化 | `MOCK-CONTRACT` | 组织上下文失效时返回渠道选择页；保留解释卡“无 Tenant 内容权限” |
| 4 / 2:20—3:10 | 切换到企业 `/enterprise/products` | 选择“海底捞演示企业”；点击已购“本地生活”再点击未购“数字人” | 企业菜单、企业额度出现；本地生活按钮为“开始使用”；数字人显示“未购买/待授权”，主按钮不可执行 | “菜单可见不等于可使用。已购、额度、角色和数据范围要同时满足；未购能力给出原因和路径，而不是假按钮。” | 清楚表达已购/未购买和增购空间 | `MOCK-CONTRACT` | Entitlement fixture 异常时默认拒绝使用并显示 `CAPABILITY_NOT_ENTITLED`，不宽松放行 |
| 5 / 3:10—3:50 | 企业 `/dashboard` | 打开唯一项目 `demo-local-001`；核对门店、抖音、9:16、30 秒和 CTA | 项目从列表进入；面包屑固定为海底捞三里屯；显示 8 镜、05 待补拍、07 缺镜 | “品牌、门店和项目都在企业 Tenant 内，不是独立租户。后续四个工作台都围绕同一个项目 ID。” | 建立唯一主数据与业务上下文 | `REAL-UI` | 找不到项目时提供“恢复统一 Demo 项目”动作；禁止生成新相似项目 |
| 6 / 3:50—4:45 | `/projects/demo-local-001/brand` | 打开 Claim C3、C6、C8；查看来源、状态、禁用词；不修改或仅做一次可撤销编辑 | 被选 Claim 高亮；引用关系、来源和免责声明出现；保存后统一工作区版本递增 | “AI 先受事实约束再写稿。价格、权益和营业信息都有来源，禁用词和免责声明会进入后续生产包。” | 降低幻觉、品牌偏差和合规风险 | `REAL-UI` | 保存失败时保持草稿并阻止进入下一步；演示可点击“放弃草稿，恢复 C1—C8” |
| 7 / 4:45—6:00 | `/projects/demo-local-001/script` | 切换 A/B/C；选 A，局部编辑一句；查看 Claim 引用与风险；点击“批准并进入分镜” | `script-a: draft → approved`；风险重新计算；按钮状态改为“已批准”；批准版本不可被后续静默覆盖 | “Agent 一次给出不同业务角度，但最终由人批准。我们保留版本和事实引用，不让 AI 文案直接进入生产。” | 提升策划效率并保留人工控制 | `REAL-UI` + D1 批准态 | 风险阻断或保存失败时不发包；可恢复已知合规的 A 版本并重新批准 |
| 8 / 6:00—6:50 | `/projects/demo-local-001/storyboard` | 展开 8 镜；点击 05 与 07；将 07 选择为“合规权益图卡”，保留 05 为补拍；点击“创建生产包” | 07 `missing → ai_placeholder/planned`；8 镜总时长校验；`productionPackage: not_created → created(v1)` | “脚本现在变成生产单。真实素材优先；缺镜可以补拍、合规生成或移除，不能用虚假顾客画面替代证据。” | 把文案变成可执行且可审的生产计划 | `MOCK-CONTRACT`；当前页为 P0 待补 | 页面未完成时不得用截图顶替；应使用可点击合同表格降级页，仍能改变 07 状态和创建包 |
| 9 / 6:50—7:30 | 发包确认抽屉 → 媒体生产入口 | 检查包内 Tenant/Project、Brief、Claim/Rule、批准脚本、8 镜、能力和合同版本；点击“进入 StoryCanvas” | 包 digest 生成；短期 Demo grant 仅在内存签发；企业页记录 `package_dispatched`；生产页记录 `package_accepted` | “两个平面不复制业务主数据。控制平面发不可变快照和短期项目授权，StoryCanvas 不拿客户价格和上游 Key。” | 建立可演进的双平面边界 | `MOCK-CONTRACT` | StoryCanvas 不可达时进入同数据的“生产包检查器”，允许验证包但不伪造画布；保留重试 |
| 10 / 7:30—8:50 | StoryCanvas `/storycanvas/demo-local-001` | 确认标题、8 镜、Claim/规则一致；拖动一镜；打开 07 引用；查看连续性；保存画布版本 | `package_accepted → canvas_ready`；生成 `CanvasVersion`；引用与结构化世界状态更新；普通切镜默认不使用上一镜尾帧 | “生产平面保留专业画布、角色/场景引用和结构化连续性。只有连续动作镜头才允许选择上一镜尾帧。” | 展示核心生产差异化和可控性 | `REAL-CAP + MOCK-CONTRACT = HYBRID` | 若海底捞接线失败，停在包检查器并明确“适配未完成”；严禁切回“南城咖啡”冒充同一项目 |
| 11 / 8:50—10:00 | StoryCanvas 任务抽屉 | 选择镜头 07，点击“生成合规权益图卡”；确认演示报价“预计 100、最多冻结 120（演示数据）”；提交 | 控制平面 `requested → reserved(120)`；任务 `queued → running`；企业钱包可用额度减少、冻结额度增加；任务进度可见 | “创建可计费任务前先预冻结。这里只展示额度与成功条件，不向客户暴露供应商 token 或成本。” | 让成本边界和客户预期透明 | `HYBRID`：可选真实生成，默认确定性 Mock | 真实供应商不可用时，用户点击“切换 Demo 生成”；沿用同一 task 业务意图但创建新的 Demo task ID，并明确标识 |
| 12 / 10:00—10:50 | 任务中心 + 资产抽屉 | 等待成功；打开 `GenerationTaskReceipt` 和 `AssetReceipt` | 任务 `running → succeeded`；资产 `registering → registered`；额度先 `reserved 120 → consumed 100 + released 20`；镜头 07 `ai_placeholder → matched` | “只有形成可交付资产才消费；本次演示消费 100、释放余量 20。任务、资产和账本动作可以互相下钻。” | 证明商业计量与媒体事实闭环 | `MOCK-CONTRACT`；资产可为真实或 Demo 生成 | 成功回执超时则显示“回执待同步”，不提前扣减；可重放同一回执并展示幂等 `duplicate=true` |
| 13 / 10:50—11:30 | 任务中心失败支线（建议预置） | 打开预置失败任务，点击“重试解释”而非再次真实生成 | 失败任务 `reserved 80 → released 80`，客户消费 0；错误标为可重试/不可重试；新重试将生成新 task/reservation | “无可交付资产的失败全量释放。供应商失败成本不转成客户额度，重试也不复用已释放流水。” | 建立信任并展示异常处理 | `MOCK-CONTRACT` | 若时间不足，只展开状态详情，不执行第二次任务；仍需现场点击而非截图 |
| 14 / 11:30—12:20 | StoryCanvas 时间线 / QA | 打开 05，点击“接收预置补拍资产回执”，再点击“基础合并预览”；查看字幕安全区、Claim、权利和缺镜检查；确认 QA 通过 | 05 `reshoot → matched` 并登记补拍 AssetReceipt；`canvas_ready → reviewing → qa_passed`；不得静默忽略缺镜 | “完整 FireRed 时间线尚未闭环，今天明确展示基础合并。补拍素材也经过资产回执进入同一来源链，QA 再检查事实、缺镜、字幕、权利和 AI 标识。” | 不夸大能力，同时保留可交付路径 | `HYBRID / FALLBACK` | 补拍回执缺失时保持 QA 阻断；FireRed 不可用时走 FFmpeg 基础合并，不能强制导出 |
| 15 / 12:20—13:20 | 导出页 → 企业 `/delivery` | 点击“导出抖音 9:16”；播放成片；点击“查看来源链路” | `export: requested → processing → ready`；生成 ExportArtifact；来源链显示 Package → ScriptVersion → Shot → Task → Asset → Timeline/基础合并 → Export | “交付的不只是一条视频，还有可复核的生产链。老板能知道买了什么、为什么扣额度、素材从哪里来、用什么任务生成。” | 完成从商品到交付的闭环 | `HYBRID` | 导出失败时保留上一个可播放版本并标“历史导出”；提供重试与下载诊断，不用静态封面冒充成片 |
| 16 / 13:20—14:00 | 企业 `/usage` 或平台回执页 | 返回企业侧，展开同一任务的冻结、消费、释放和资产/导出链接；最后切回平台回执总览 | 企业只见自身明细；平台见全局任务元数据；渠道只见汇总；三个范围互不串数据 | “同一事实按角色展示不同粒度：企业能对账，渠道看经营汇总，平台做运营审计，但生产内容不会因渠道层级自动泄露。” | 收束四入口与权限价值 | `MOCK-CONTRACT` | 任一明细缺失时显示“回执待对账”，不从 StoryCanvas SQLite 或前端余额反推事实 |

## 6. 四入口首屏与角色差异

| 入口 | 首屏必须回答 | 首屏关键卡片 | 明确不可见 |
|---|---|---|---|
| 平台管理员 | 平台有哪些组织、产品、额度与生产风险？ | 组织数、Product/Capability、额度发行/冻结汇总、失败任务、回执异常 | 普通运营默认不展开客户脚本/素材；上游 Key 永不展示 |
| 代理商 | 我能卖什么、服务哪些客户、经营结果如何？ | 本组织可售产品、自己的可用/冻结额度、下级/客户、销售边汇总、客户用量汇总 | 平台上游成本、其他渠道价格、客户脚本/素材 |
| 企业客户 | 我买了什么、还能用多少、当前项目下一步是什么？ | 已购/未购买、企业额度、Brand/Store、项目进度、风险待办、最近成片 | 渠道树、平台成本、供应商 Key |
| 媒体生产 | 当前项目授权我生产什么、镜头/任务/资产处于什么状态？ | 包版本、批准脚本、8 镜、引用/连续性、生成任务、资产、QA、导出 | 客户价格、钱包余额、渠道关系、其他 Tenant |

## 7. 关键交互规格

### 7.1 组织与工作台切换器

- 展示格式：`工作台名称 / 组织名称 / 当前角色`。
- 切换前若有未保存编辑，弹出“保存草稿 / 放弃 / 取消切换”。
- 切换成功后清空上一组织的查询缓存、筛选和打开对象；重新计算菜单和按钮。
- 顶栏显示不可伪造的 Demo 上下文标签；平台、渠道、企业使用不同色条，但不复制应用。
- 渠道身份若无 Tenant Membership，企业内容入口显示“需企业授权”，不得通过深链打开。

### 7.2 已购 / 未购买

| 状态 | 产品卡 | 主动作 | 错误语义 |
|---|---|---|---|
| 已购且有效 | `已开通` + 有效期/范围 | 开始使用 | — |
| 未购买 | `未购买` | 查看方案/联系渠道 | `CAPABILITY_NOT_ENTITLED` |
| 待授权 | `待授权` + 缺失授权 | 查看授权要求 | `AUTHORIZATION_REQUIRED` |
| 已过期 | `已过期` | 续费/联系管理员 | `ENTITLEMENT_EXPIRED` |
| 角色不足 | 产品可见但按钮禁用 | 申请权限 | `ACTION_SCOPE_DENIED` |
| 额度不足 | 能力有效，任务不可提交 | 查看额度/联系管理员 | `INSUFFICIENT_CREDITS` |

数字人和 API 在 D1 固定使用 `未购买/待授权`；老板 IP、电商只展示产品说明卡，不进入黄金路径。

### 7.3 发包与跨平面跳转

发包确认抽屉必须让演示者快速确认：

- `contractVersion = 0.1`、`projectId = demo-local-001`、包版本和 digest。
- Tenant / organization / Brand / Store / Campaign 上下文。
- Creative Brief、Claim `C1—C8`、禁用词、引用和风险规则快照。
- 已批准 `script-a` 与 8 镜初稿。
- 平台、9:16、30 秒、可用 Capability。
- 短期授权只展示范围和过期时间，不展示令牌明文。
- 明确“不包含：客户价格、钱包、上游 API Key”。

### 7.4 生成与额度双状态

任务状态与额度状态必须并列显示，不能把二者合成一个“处理中”：

```text
任务 requested
  └─ 控制平面冻结成功 → reserved
       └─ 生产任务 queued → running
            ├─ succeeded + 可交付资产 → consumed + release余量
            ├─ failed / cancelled，无可交付资产 → released
            └─ receipt delayed → 保持 reserved，显示“待同步”，不得预扣
```

每条额度明细显示：动作、演示额度、任务 ID、reservationReference、RateCard 版本、时间和原因。金额、供应商成本和真实价格不进入客户视图。

### 7.5 来源链路

成片详情按从业务到媒体的顺序展示：

```text
Tenant / Brand / Store
→ CreativeBriefVersion
→ Claim / Rule Snapshot
→ Approved ScriptVersion
→ ProjectProductionPackage v0.1
→ Scene / Shot
→ ReferenceBinding
→ GenerationTaskReceipt
→ MediaAsset / AssetReceipt
→ TimelineVersion 或“基础合并版本”
→ ExportArtifact
```

每一节点至少显示 ID、版本、状态、来源/Owner、时间和可见性；资产节点增加类型、尺寸/时长、checksum、模型/任务、权利说明、审核状态。客户不应看到完整敏感提示词或上游密钥。

## 8. 关键状态清单

| 对象 | D1 最小状态 | 黄金路径状态 |
|---|---|---|
| Active context | `platform / channel / tenant / production` | platform → channel → tenant → production → tenant/platform |
| Entitlement | `active / locked / expired / authorization_required` | 本地生活 active；数字人/API locked |
| Project | `scripting / storyboarding / production / reviewing / exported` | scripting → storyboarding → production → reviewing → exported |
| ScriptVersion | `draft / blocked / approved / superseded` | script-a draft → approved |
| Shot match | `matched / reshoot / missing / ai_placeholder` | shot-07 missing → ai_placeholder → matched |
| ProductionPackage | `not_created / created / dispatched / accepted / rejected` | not_created → created(v1) → dispatched → accepted |
| Grant | `not_issued / active / expired / revoked` | not_issued → active；仅展示范围 |
| GenerationTask | `requested / queued / running / succeeded / failed / cancelled` | requested → queued → running → succeeded |
| MediaAsset | `registering / registered / qa_blocked / approved` | registering → registered → approved |
| Credit reservation | `requested / reserved / consumed / released` | requested → reserved 120 → consumed 100 + released 20（均为演示数据） |
| QA | `pending / blocked / passed` | pending → passed |
| Export | `not_created / requested / processing / ready / failed` | requested → processing → ready |
| Receipt sync | `pending / accepted / duplicate / rejected / manual_review` | accepted；失败支线可展示 duplicate |

## 9. P0 断点与放行标准

| P0 | 当前断点 | D1 最小放行标准 | Owner 建议 | 未关闭时的演示影响 |
|---|---|---|---|---|
| P0-01 | 四工作台与 active organization 切换尚未形成 | 一次点击切换工作台/组织；菜单、指标、额度和数据范围同步变化；当前上下文常驻 | C4 + C6 | 无法证明多组织和权限边界 |
| P0-02 | 产品、已购/未购买和演示 RateCard 页未接 | 基础生成/本地生活 active，数字人/API locked；所有数字有“演示数据 · 非报价” | C2 + C3 + C4 | 无法解释平台卖什么与客户买了什么 |
| P0-03 | 分镜与初剪在当前前端仍为占位 | 8 镜可展开；05/07 状态可操作；能创建唯一生产包；QA/导出有真实按钮状态 | C5 + C6 | 关键流程会退化为静态讲解，违反验收 |
| P0-04 | 海底捞唯一 `ProjectProductionPackage` fixture 未冻结/接线 | C1—C8、script-a、8 镜、Brief、能力、合同版本来自同一 fixture；无“南城咖啡”旁路 | C2 + C4 + C5 | 双仓形成第二套主数据，黄金路径失真 |
| P0-05 | SaaS → StoryCanvas 发包、ID 映射与返回链路未接 | 包可点击发出、被接受；外部字符串 ID 可映射；可返回企业项目；失败有重试 | C4 + C5 | 无法形成双平面闭环 |
| P0-06 | 生成任务、资产登记和回执 Outbox 未形成统一演示 | 至少一条成功和一条失败任务；现场状态推进；成功有 Task/Asset Receipt，失败有标准错误 | C4 + C5 | 额度变化没有媒体事实依据 |
| P0-07 | 额度冻结/消费/释放目前无统一 UI 状态 | 成功演示 120 冻结、100 消费、20 释放；失败 80 全释放；均标演示数据；支持幂等解释 | C3 + C4 | 无法解释商业核心且易被误解为随意扣费 |
| P0-08 | 导出未统一登记 ExportArtifact/来源链 | 产生可播放 9:16 文件；标注基础合并或真实时间线；能下钻到包/脚本/镜头/任务/资产 | C5 + C6 | 只能“看过程”不能证明交付 |
| P0-09 | Demo 失败预案和一键重置未统一 | 15 秒恢复 `DEMO_READY`；供应商/FireRed/回执失败均有可操作降级，不换截图或第二项目 | C4 + C5 + C6 | 现场稳定性不可控 |
| P0-10 | REAL / MOCK / LOCKED 标识可能不一致 | 每页固定状态条；按钮级标识；最终导出说明写清能力来源 | C6 + C7 | 容易把未实现能力误报为真实 |

## 10. 失败剧本与主持人口径

| 故障 | 页面反应 | 主持人口径 | 可继续动作 |
|---|---|---|---|
| 组织/权限不足 | 安全页显示当前组织、所需 scope 和请求 ID | “系统默认拒绝跨组织访问，渠道关系不等于客户内容权限。” | 切回获授权企业身份 |
| 未购买能力 | 产品卡锁定，给出依赖和申请路径 | “能看到产品价值，但没有 Entitlement 就不能执行。” | 返回本地生活已购能力 |
| 额度不足 | 提交前阻断，显示缺口，不部分冻结 | “额度与能力授权是两道门，余额不足不会透支。” | 使用预置充足的 Demo 钱包快照 |
| 品牌事实过期/缺失 | 脚本批准按钮阻断，定位 Claim | “事实不完整时先补资料，不让模型编造。” | 恢复 C1—C8 已批准快照 |
| StoryCanvas 不可达 | 包停在 `dispatched`，显示重试和包检查器 | “合同包已形成，但生产平面未确认接收，所以不会产生任务或扣费。” | 打开包检查器或恢复连接 |
| 生成供应商失败 | 任务 failed；冻结全量 released；错误脱敏 | “无可交付资产不消费客户额度。” | 新建 Demo 生成任务，不复用原 reservation |
| 回执延迟 | 资产待登记、额度保持 reserved | “生产事实先进入 Inbox，对账未完成前不提前结算。” | 重放同一回执并展示幂等 |
| QA 阻断 | 导出按钮禁用，定位具体镜头/规则 | “导出前必须关掉事实、权利或缺镜风险。” | 修复 07 或使用已批准素材 |
| FireRed 不可用 | 标记“基础合并导出”，不显示 AI 剪辑成功 | “完整智能剪辑不是今天的已完成能力；我们用已存在的基础合并保证交付。” | 走 FFmpeg 基础合并 |
| 导出失败 | 保留上一个版本，展示失败阶段与重试 | “版本链不会因失败被覆盖，历史可交付物仍可播放。” | 重试导出或打开历史 ExportArtifact |

## 11. 演示前 5 分钟检查

- [ ] 页面顶部确认 `Demo Mode`、日期和 `演示数据 · 非正式报价`。
- [ ] 当前组织为 Platform，`DEMO_READY` 重置成功。
- [ ] 唯一项目、Brand、Store、Claim C1—C8、script-a 和 8 镜 ID 一致。
- [ ] 已购基础生成/本地生活；数字人/API 锁定。
- [ ] 组织切换后无旧组织数据残留。
- [ ] 生产包 version/digest 可生成并被同一海底捞项目接受。
- [ ] StoryCanvas 不出现“南城咖啡”，不显示钱包/客户价格/渠道树。
- [ ] 成功任务、失败任务、任务/资产回执和额度动作可现场推进。
- [ ] 成片可播放；导出方式标识正确；来源链可展开。
- [ ] 供应商、FireRed、回执和导出失败的 fallback 均可点击。
- [ ] 不依赖网络临时下载、真实密钥、真实支付或不可控的长时生成。
- [ ] 不使用静态截图代替关键操作。

## 12. D1 验收口径

### 12.1 业务闭环

- 四个入口都在 13 分钟标准脚本中出现，且角色可见范围不同。
- 老板能看到平台商品、代理可售范围、企业已购能力和媒体交付之间的一条连续链。
- 海底捞三里屯是唯一主数据；无第二项目、第二 Claim 集或“南城咖啡”混入。
- 已购/未购买、额度不足、权限不足和待授权能被分别解释。

### 12.2 媒体与商业闭环

- 已批准脚本形成 8 镜生产单和不可变生产包。
- StoryCanvas 消费同一包，至少完成一次可解释的镜头操作。
- 任务成功产生任务/资产回执并消费/释放演示额度；失败任务全量释放。
- 导出物可播放并能追到来源链；基础合并不得标为完整 AI 剪辑。

### 12.3 真实性与韧性

- 每个关键动作有现场交互与状态变化，不靠静态截图。
- REAL、MOCK、HYBRID、LOCKED 和 FALLBACK 标识一致。
- 任何页面不把演示额度、门店 Claim 或产品说明写成正式报价。
- 任一外部依赖失败后仍可在同一项目内继续或清楚停住，不伪造成功。

## 13. 跨域 Request 摘要

详细请求登记在 `docs/program/threads/C6/REQUESTS.md`：

- `REQ-C6-001`：C2/C3/C4 联合提供 D1 产品、Entitlement、演示 RateCard 与 Wallet/Ledger 单一 fixture。
- `REQ-C6-002`：C4/C5 冻结并实现 D1 唯一海底捞生产包、发包/接收、ID 映射和任务/资产回执 Mock Adapter。
- `REQ-C6-003`：C5 提供可确定性演示的生成、基础合并导出、ExportArtifact 与来源链；真实供应商/FireRed 不可用时必须有同项目降级。

## 14. 本轮边界

- 本文只定义演示体验，不修改产品代码、公共合同、共同记忆或 C1—C5 规格。
- 本文中的路由、状态和 UI 文案属于 D1 UX 提案；跨域字段以 `INTEGRATION_CONTRACT.md` v0.1 和 C0 会签为准。
- 本轮未运行测试、未调用真实模型、未使用真实支付或密钥、未提交、未合并、未推送。
