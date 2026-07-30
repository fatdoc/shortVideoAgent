# C8 D1 Demo Pack v0.1 · 老板可直接讲

> 状态：`READY_FOR_C0_REVIEW`
>
> Owner：C8 · 产品材料与文档负责人
>
> 日期：2026-07-30
>
> 演示基线：C7 Round 3.1 `P0/P1/P2 = 0/0/0`，`D1 STATIC GATE = GO`
>
> 运行状态：`GO_FOR_INTERNAL_DEMO`
>
> 使用限制：已取得内部 Demo 运行证据；仍不构成正式报价、品牌批准、生产安全或发布完成

## 2026-07-30 Runtime Addendum

本附录取代本文后续所有“本轮未执行 test/build/browser”与 `BLOCKED_RUNTIME_EVIDENCE` 历史表述，原文保留用于说明验收前口径。

- Runtime Gate：`GO_FOR_INTERNAL_DEMO`
- package：HTTP `201`
- handoff：`storycanvas:d1-grant-request → grant → ready`
- success：`120 reserved → 100 consumed + 20 released`
- failure：`80 reserved → 0 consumed + 80 released`
- Outbox：4 条回执全部 `acknowledged`
- wrong project：`403 PROJECT_SCOPE_MISMATCH`
- FALLBACK：浏览器实际播放，6 秒、540×960、SHA-256 与登记一致
- reset：恢复 `DEMO_READY / available 1000 / reserved 0`
- 视觉：1672×941、1440×900、1280×720 无页面横向溢出

权威运行报告：`docs/program/specs/C7_D1_RUNTIME_GATE_REPORT.md`。

人工 10—13 分钟主持计时彩排仍建议在正式会议前执行；它不阻塞本次代码提交。

## 0. 材料文件索引

| 模块 | 用途 | 建议呈现 |
|---|---|---|
| 1. 主持人总则 | 开场前统一 Truth 口径 | 讲者备注 |
| 2. 16 步主持人脚本 | 10—13 分钟完整老板演示 | 主持手卡/逐页备注 |
| 3. 一页角色与工作台 | 解释四个视角和组织边界 | 1 张幻灯片 |
| 4. 一页商业逻辑 | 解释卖什么、如何冻结与结算 | 1 张幻灯片 |
| 5. 一页双仓架构与证据链 | 解释 SaaS 与 StoryCanvas 如何连接 | 1 张幻灯片 |
| 6. 一页可播放 FALLBACK 声明 | 诚实解释演示片性质 | 1 张幻灯片/播放前声明 |
| 7. 一页现场风险与应急 | 现场异常时不说假成功 | 1 张讲者应急卡 |
| 8. 一页 Gate 状态 | 区分 Static GO 与运行证据 | 1 张结尾/附录幻灯片 |
| 9. 来源与禁用说法 | 会后核验与材料复用 | 附录 |

建议标准时长为 **11 分 30 秒**；可压缩到 10 分钟，也可在第 13 步失败支线增加说明，将总时长扩展至 13 分钟。

---

## 1. 主持人总则

### 1.1 开场必须先说

> “今天展示的是 D1 静态收口后的演示路径。静态 Gate 已经清零，但本轮没有执行 test、build、browser、视觉检查或 16 步完整彩排，所以我会把静态事实、演示 Mock、FALLBACK 和未获得的运行证据分开讲。”

### 1.2 全程固定 Truth 标签

| 标签 | 现场含义 |
|---|---|
| `STATIC GO` | 约定的静态 Gate 已清零，不代表运行通过 |
| `DEMO_MOCK` | 确定性演示合同、额度、任务或授权，不是真实商业系统 |
| `CURRENT_EVIDENCE` | C5/C7 已有静态实现证据，仍需运行验证 |
| `FALLBACK / DEMO_ONLY` | 同一项目内的演示降级，不是真实 AI 或正式品牌成片 |
| `BLOCKED_RUNTIME_EVIDENCE` | 尚未取得 HTTP、browser、真实消息序列或完整彩排证据 |

### 1.3 禁用说法

- 禁止：“全链路已经跑通。”
- 禁止：“这是 FireRed 自动剪辑结果。”
- 禁止：“这是 AI 真实生成的海底捞成片。”
- 禁止：“120、100、80 是正式价格或套餐。”
- 禁止：“Static GO 就是上线通过。”
- 禁止：“超时了但后台其实已经成功。”

---

## 2. 10—13 分钟、16 步主持人脚本

### Step 01 / 0:00—0:25 · 定义今天展示什么

- **入口**：D1 Demo 封面或全局 Demo Shell。
- **操作**：指出页首的 `D1 STATIC GO` 与 `BLOCKED_RUNTIME_EVIDENCE` 两个并列标签。
- **讲解**：“静态 Gate 已清零；今天讲清业务闭环、合同和失败边界，不把尚未执行的运行证据说成已通过。”
- **预期状态**：页面显示 `P0/P1/P2 = 0/0/0`，同时显示运行证据未完成。
- **Truth 边界**：本轮没有 test/build/browser/视觉/16 步彩排。
- **失败时降级话术**：“如果现场页面未连接，我只展示已核验的静态材料，不宣称应用已经运行成功。”

### Step 02 / 0:25—1:00 · 平台卖什么

- **入口**：Platform `/platform/catalog`。
- **操作**：打开“AI 视频基础生成”和“本地生活 Agent”，再指向数字人/API 的锁定状态。
- **讲解**：“平台卖的是 AI 视频额度和可使用的生产能力。Agent 是业务流程与行业知识的增值包装；数字人和 API 今天不伪装成已购或已完成。”
- **预期状态**：基础生成、本地生活为 D1 可讲产品；数字人/API 为 `LOCKED` 或待授权。
- **Truth 边界**：目录、RateCard 和权益为演示数据；不构成正式产品政策或报价。
- **失败时降级话术**：“目录没有连上时，只打开版本化 Demo fixture，并明确它是合同样例，不用截图冒充在线目录。”

### Step 03 / 1:00—1:35 · Channel level-1 看什么

- **入口**：Channel level-1 `/channel/products` 或 `/channel/customers`。
- **操作**：切换到一级代理工作台，指向可售产品、企业客户和汇总用量。
- **讲解**：“总代理、一级代理、二级代理共用渠道工作台。这里用 level-1 说明：代理能看自己的商业范围，但不会因为渠道层级自动看到客户脚本、素材或品牌事实。”
- **预期状态**：平台全局数据消失；只显示当前渠道范围的产品、客户和商业汇总。
- **Truth 边界**：渠道层级是组织关系；客户生产内容访问仍需企业 Tenant 授权。
- **失败时降级话术**：“上下文无效时回到渠道选择页；我会明确说‘当前没有 Tenant 内容权限’，而不是从深链绕过。”

### Step 04 / 1:35—2:10 · Enterprise Tenant 买了什么

- **入口**：Enterprise `/enterprise/products`。
- **操作**：切换到海底捞演示企业，分别点击已购本地生活与未购数字人。
- **讲解**：“企业是否能使用能力，要同时满足组织身份、成员角色、Entitlement 和数据范围。菜单可见不等于可执行。”
- **预期状态**：本地生活显示可开始使用；数字人显示未购买/待授权，按钮不可执行。
- **Truth 边界**：企业是 Tenant；品牌、门店和项目是 Tenant 内业务对象。
- **失败时降级话术**：“权益数据异常时系统应默认拒绝，不做宽松放行；现场只解释拒绝原因。”

### Step 05 / 2:10—2:40 · 锁定唯一项目

- **入口**：Enterprise `/dashboard` 或 `/enterprise/projects/demo-local-001`。
- **操作**：打开 `demo-local-001`，核对海底捞北京三里屯、抖音、9:16、30 秒和 CTA。
- **讲解**：“后续所有页面和两个仓库都围绕同一个项目 ID，不复制第二套看起来相似的主数据。”
- **预期状态**：显示统一 Brand/Store、script-a、8 镜生产上下文。
- **Truth 边界**：禁止切换到“南城咖啡”或临时创建替代项目。
- **失败时降级话术**：“如果 canonical 项目缺失，演示在这里停止并报告恢复统一项目；不拿其他项目顶替。”

### Step 06 / 2:40—3:20 · 先受事实约束，再让 Agent 写

- **入口**：`/projects/demo-local-001/brand`。
- **操作**：打开 C1—C8 中的代表性 Claim、禁用词和来源。
- **讲解**：“AI 不是先写再补事实。价格、权益、营业信息和禁用词先形成有来源的项目快照，再进入脚本和生产包。”
- **预期状态**：Claim、Rule、来源和状态可见；后续引用同一事实集。
- **Truth 边界**：Claim 是统一 Demo 事实，不代表真实客户对外承诺；不得现场新造门店事实。
- **失败时降级话术**：“事实无法读取或保存时，保持草稿并阻止后续发包；只恢复 C1—C8 已知快照。”

### Step 07 / 3:20—4:00 · Agent 给方案，人来批准

- **入口**：`/projects/demo-local-001/script`。
- **操作**：浏览脚本版本，选择 script-a，查看 Claim 引用并执行批准动作。
- **讲解**：“Agent 负责提高策划效率，但最终脚本由人批准；批准版本、引用和风险不能被后续静默覆盖。”
- **预期状态**：script-a 从草稿进入批准态，或显示已批准的 D1 canonical 版本。
- **Truth 边界**：不把脚本生成描述为无人审核的自动发布。
- **失败时降级话术**：“保存或批准失败就不创建生产包；保留草稿和错误，不说‘后台已经批了’。”

### Step 08 / 4:00—4:40 · 把脚本变成 8 镜生产单

- **入口**：`/projects/demo-local-001/storyboard`。
- **操作**：展开 8 镜，重点看 05 和 07；确认缺镜处理与 8 镜结构。
- **讲解**：“真实素材优先；缺镜可以补拍、使用合规生成或移除，不能用虚假顾客或虚假门店画面补证据。”
- **预期状态**：8 镜、shot-05/shot-07 状态、引用和风险清楚。
- **Truth 边界**：Static GO 证明静态断点已关闭；本轮未执行现场交互验证。
- **失败时降级话术**：“页面动作失败时保持原状态，打开同一项目的生产单摘要；不把静态截图说成已创建成功。”

### Step 09 / 4:40—5:25 · 发 package、grant，并等待 ready

- **入口**：发包确认抽屉 → StoryCanvas handoff。
- **操作**：确认 `projectId=demo-local-001`、`packageId=package-demo-local-001-v1`、合同版本和 digest；点击进入生产。
- **讲解**：“SaaS 发不可变 package 和内存 Mock grant。request、grant、ready 三类消息都带 canonical project/package；只有 identity、origin 和 source 全部匹配后才进入 ready。”
- **预期状态**：静态设计为 `package dispatched → package accepted → handoff_ready`。
- **Truth 边界**：grant 是 deterministic Mock，不是正式签名 credential；不进入 URL、LocalStorage 或 sessionStorage。
- **失败时降级话术**：“出现 `HTTP_NOT_CONNECTED` 或 handoff timeout，就明确说‘生产平面尚未确认 ready’，停在 package 检查器并保留重试。”

### Step 10 / 5:25—6:10 · Production operator 进入 StoryCanvas

- **入口**：StoryCanvas `/storycanvas/demo-local-001`。
- **操作**：核对海底捞标题、script-a、8 镜、Claim/Rule、引用和连续性。
- **讲解**：“Production operator 是企业 Tenant 内的生产角色，不是第四类租户。StoryCanvas 只拿本项目的生产授权，不拿客户价格、钱包或渠道关系。”
- **预期状态**：canonical package 被只读消费，画布显示同一项目、8 镜和结构化连续性。
- **Truth 边界**：当前 grant、画布和 handoff 只有静态证据；运行消息序列尚待采集。
- **失败时降级话术**：“wrong project/package/origin/source 必须返回 `HANDOFF_IDENTITY_MISMATCH`；不回退到其他项目。”

### Step 11 / 6:10—6:55 · 成功任务先冻结 120

- **入口**：StoryCanvas task/企业额度并列视图。
- **操作**：选择 canonical Demo success task，指向“最多冻结 120、预计消费 100”的演示说明。
- **讲解**：“创建可计量任务前先预冻结。客户看到额度、条件和状态，不看到供应商 token、成本或密钥。”
- **预期状态**：演示口径为 `requested → reserved 120`，任务进入 queued/running。
- **Truth 边界**：120 和 100 都是演示数据，不是人民币、上游 token 或正式报价。
- **失败时降级话术**：“冻结失败就不创建任务；不部分透支，也不说任务已在后台执行。”

### Step 12 / 6:55—7:40 · 成功后 100 消费、20 释放

- **入口**：Task、Asset、Receipt 和 Credit 状态页。
- **操作**：展开 `task-demo-success`、资产回执、Outbox 和对应额度动作。
- **讲解**：“只有形成可交付资产并通过回执链后才消费。演示结果是冻结 120，消费 100，释放 20。”
- **预期状态**：Task succeeded；Asset registered；Receipt 经 preflight/ACK 安全边界后，额度展示 `100 consumed + 20 released`。
- **Truth 边界**：Outbox 是显式领取/重投/ack；没有后台主动推送 worker。ACK-first 运行证据尚未取得。
- **失败时降级话术**：“receipt timeout 或 retry 时保持 reserved/待同步；不提前显示 consumed。重复回执只讲幂等，不重复入账。”

### Step 13 / 7:40—8:15 · 失败任务 80 全释放

- **入口**：预置失败任务 `task-demo-failure`。
- **操作**：展开失败原因、无输出资产和额度处理。
- **讲解**：“没有可交付资产，客户消费是 0；冻结 80 全量释放。供应商失败成本不转嫁成客户额度。”
- **预期状态**：Task failed；无 output asset；演示额度显示 `0 consumed + 80 released`。
- **Truth 边界**：新重试必须有新的 task/reservation；不能复用已释放流水制造成功。
- **失败时降级话术**：“如果失败回执仍在 pending，就说‘等待对账’，不抢先说 80 已经释放。”

### Step 14 / 8:15—9:10 · 诚实进入 FALLBACK

- **入口**：StoryCanvas Artifact/基础合并视图。
- **操作**：打开 `export-demo-local-001-fallback-v1` 的技术、编辑、品牌和权利状态。
- **讲解**：“完整 FireRed 时间线和真实 Provider 成片不是今天的已完成能力。这里使用同一项目内的纯合成 FALLBACK，只验证播放载体、回执和来源链。”
- **预期状态**：`FALLBACK / DEMO_ONLY / SELF_GENERATED_SYNTHETIC`；technical QA passed；editorial not evaluated；brand not approved。
- **Truth 边界**：非 FireRed、非真实 AI、非品牌成片、非正式业务交付。
- **失败时降级话术**：“Artifact 或 HTTP 不可达时不说‘可播放已验证’，只展示静态元数据和来源链，并标记运行证据待补。”

### Step 15 / 9:10—10:20 · 播放声明与来源链

- **入口**：企业 Delivery 或 StoryCanvas Artifact 详情。
- **操作**：在播放前读出 FALLBACK 声明；若媒体可达再点击 controls；展开来源链。
- **讲解**：“我们交付的不只是一个文件，还要能追到 package、脚本、8 镜、任务、资产和 ExportReceipt。”
- **预期状态**：静态来源链为 `Package → script-a → 8 shots/basic-merge → shot-05 synthetic repair → Export`。
- **Truth 边界**：C5 有纯合成 MP4 和 technical QA 证据；本轮未执行 HTTP/browser controls 播放验证。
- **失败时降级话术**：“播放器未连接时我会说‘本轮未取得浏览器播放证据’，绝不播放截图或说刚才已经成功。”

### Step 16 / 10:20—11:30 · 回到 SaaS，收束角色、商业与 Gate

- **入口**：Enterprise usage → Platform production receipts → Gate 页。
- **操作**：指向企业明细、渠道汇总、平台审计范围，再落到 Static GO/Runtime Blocked。
- **讲解**：“同一事实按角色显示不同粒度：企业对账，渠道看商业汇总，平台做运营审计，Production operator 只做 Tenant 内项目生产。今天 Static GO，但运行证据仍待受控 Gate。”
- **预期状态**：四个视角数据边界清楚；Gate 页显示 `0/0/0` 与 `BLOCKED_RUNTIME_EVIDENCE`。
- **Truth 边界**：不从 StoryCanvas SQLite、前端余额或静态代码反推运行成功。
- **失败时降级话术**：“任何回执或明细缺失都显示‘待同步/待对账’，结论保持 Static GO，不升级为 Runtime PASS。”

---

## 3. 一页角色与工作台

### 一句话

> 四个演示视角，只有三个商业组织上下文；Production 是 Enterprise Tenant 内的角色工作台，不是第四类租户。

| 演示视角 | 组织/身份 | 看什么 | 不看什么 | D1 主讲价值 |
|---|---|---|---|---|
| Platform | 平台组织 / platform admin | 组织、产品、演示额度汇总、任务与回执异常 | 普通运营不默认展开客户生产内容；上游 Key 不展示 | 统一经营与审计 |
| Channel level-1 | 一级渠道组织 / channel member | 本组织可售产品、企业客户商业状态、汇总用量 | 平台上游成本、其他渠道价格、客户脚本/素材 | 可复制分销、数据最小化 |
| Enterprise Tenant | 企业租户 / owner/admin/业务成员 | 已购能力、额度、Brand/Store/Project、交付和对账 | 平台成本、渠道树、供应商 Key | 从购买到生产交付 |
| Production operator | **Enterprise Tenant Membership 内的生产角色** | 当前项目 package、脚本、8 镜、任务、资产、QA、Export | 客户价格、钱包、渠道关系、其他 Tenant | 专业生产与来源链 |

### 必须说清的边界

```text
Platform organization
ChannelOrganization(level-1)
Enterprise Tenant
  └─ Membership(role = production.operator)
       └─ Production workbench / StoryCanvas
```

- Production workbench 是第四个入口，不是第四种 Tenant。
- 渠道祖先关系不自动带来 Tenant 生产内容权限。
- Production operator 的权限来自 Enterprise Tenant Membership、角色、项目 scope 和 capability grant。
- StoryCanvas 不建设第二套 Tenant、Wallet、PriceBook 或渠道树。

---

## 4. 一页商业逻辑

### 卖什么

```text
核心商品：AI 视频额度
价值包装：基础生成能力 + 场景 Agent
生产交付：StoryCanvas 的任务、资产和 Export
```

- AI 视频额度不是人民币余额。
- AI 视频额度不是供应商 token。
- Agent 不是独立租户或第二套生产引擎；它把共享能力包装成本地生活、老板 IP、电商等业务流程。
- D1 主讲“基础生成 + 本地生活”；数字人/API 不作为已购完成能力。

### 成功任务演示

```text
冻结 120
→ 形成可交付资产
→ 消费 100
→ 释放余量 20
```

### 失败任务演示

```text
冻结 80
→ 任务失败且无可交付资产
→ 客户消费 0
→ 全量释放 80
```

### 页脚固定声明

> 以上 120、100、20、80 均为 D1 演示额度数据，仅用于解释 reserve / consume / release，不构成真实售价、套餐、折扣、结算、税务或客户承诺。

---

## 5. 一页双仓架构与证据链

### 双平面

```text
SaaS 控制平面
  active organization / entitlement
  package / Mock grant
  receipt preflight / ACK-first apply
  demo credit reserve-consume-release
             ⇅ canonical project/package identity
StoryCanvas 生产平面
  accepted immutable package
  canvas / 8 shots / continuity
  deterministic task / MediaAsset
  ExportArtifact / Receipt Outbox
```

### 当前静态证据

| 链路 | 当前证据 | Truth 边界 |
|---|---|---|
| Package | `demo-local-001`、`package-demo-local-001-v1`、合同 0.1、digest、不可变 accepted snapshot | 静态实现证据，不等于实际 HTTP 已跑 |
| Grant | canonical deterministic Mock；只在 JS 内存传递 | 非签名 credential，不用于生产安全声明 |
| Handoff | request/grant/ready 均携带 project/package；校验 origin/source/identity | 实际 opener 消息序列未采集 |
| Task/Asset | `task-demo-success`、`task-demo-failure`、受控 MediaAsset | Demo contract，不是当前真实 Provider 生产 |
| Outbox | `pending → delivered → acknowledged`；重投计数；幂等 ack | 无后台主动推送 worker；运行状态未验证 |
| ACK-first | C4 preflight envelope/payload/digest/identity；ACK success 后才 apply | ACK 失败零入账仍待运行证据 |
| Export | ExportReceipt 字段、payload digest、businessId/exportId 对齐 | Static GO，不等于 runtime delivery |

### 来源链

```text
Tenant / Brand / Store
→ Creative Brief / C1—C8
→ approved script-a
→ ProjectProductionPackage v0.1
→ 8 shots / basic-merge
→ task-demo-success / task-demo-failure
→ MediaAsset / synthetic shot-05 repair
→ export-demo-local-001-fallback-v1
→ ExportReceipt Outbox
→ SaaS preflight / ACK-first / credit view
```

---

## 6. 一页可播放 FALLBACK 声明

### 播放前必须逐字说明

> “接下来看到的是本地纯合成 D1 FALLBACK。它由项目自有的测试信号合成，不包含第三方素材，只用于验证媒体载体、ExportReceipt 和来源链。它不是 FireRed 剪辑结果，不是真实 AI 生成的海底捞成片，也没有通过编辑质量或品牌审批。”

### 权威标签

| 字段 | 声明 |
|---|---|
| Truth | `FALLBACK / DEMO_ONLY / 非 REAL` |
| 来源 | `SELF_GENERATED_SYNTHETIC / NO_THIRD_PARTY_ASSET` |
| 可播放属性 | C5 已登记真实 MP4 字节与技术元数据 |
| Technical QA | `passed` |
| Editorial QA | `not_evaluated` |
| Brand QA | `not_approved` |
| FireRed | 未使用，不得宣称 |
| 真实 AI 成片 | 不是，不得宣称 |
| 正式交付 | 不是，不得宣称 |

### 静态与运行证据分层

- 静态可讲：文件、checksum、尺寸/时长/codec、Asset/Artifact/ExportReceipt 和来源链已登记。
- 本轮不可讲：HTTP 已成功加载、browser controls 已播放、16 步现场已彩排。
- 播放失败时：保留 `BLOCKED_RUNTIME_EVIDENCE`，不使用封面、截图或口头描述冒充播放成功。

---

## 7. 一页现场风险与应急

| 现场事件 | 系统 Truth | 主持人话术 | 继续方式 | 绝对禁止 |
|---|---|---|---|---|
| `HTTP_NOT_CONNECTED` | 控制/生产 HTTP 未形成运行证据 | “静态合同已收口，但当前 HTTP 未连接，所以不会宣称发包或回执已完成。” | 打开静态 package/来源链材料；保留 Runtime Blocked | 说“后台已经通了” |
| handoff timeout | 未收到 canonical ready | “生产平面没有确认 ready，系统保持未就绪。” | 停在 package 检查器，允许重试 | 把 timeout 改成 ready |
| receipt retry | Outbox pending/delivered/retry，尚未安全 apply | “回执正在重投；对账前保持原额度状态。” | 展示 retryCount、deliveryId 和幂等规则 | 提前显示消费/释放 |
| ACK failure | preflight/ACK 未完成 | “ACK 失败按零入账处理，不改变客户额度。” | 保留异常，等待重试 | 先入账后补 ACK |
| reset rollback | reset/恢复未取得运行证据 | “重置未完成，当前状态不可作为 canonical Demo 起点。” | 使用明确标记的本地只读恢复快照，或停止演示 | 静默换项目/清数据 |
| wrong project/package | `HANDOFF_IDENTITY_MISMATCH`，必须拒绝 | “项目或包身份不一致，系统安全拒绝，不能进入 ready。” | 回到 `demo-local-001` canonical 入口 | 回退“南城咖啡”或自动代入正确 ID |
| FALLBACK 播放失败 | browser/HTTP runtime 未通过 | “本轮没有取得播放器运行证据，只保留技术元数据和来源链。” | 展示 Artifact 声明与静态证据 | 用截图、封面或口播称播放成功 |
| credit detail 缺失 | 待同步/待对账 | “没有完整回执就不从 StoryCanvas 或前端余额反推账本。” | 保持 pending，指向 Request | 编造 120/100/20 已落账 |

### 应急原则

1. 不换项目。
2. 不换第二套数据。
3. 不把 Mock 改称真实。
4. 不把 pending/timeout 改称成功。
5. 不从前端状态推断钱包事实。
6. 不用假播放、假回执或假 ACK 维持节奏。

---

## 8. 一页 Gate 状态

### 当前结论

```text
D1 STATIC GATE = GO
P0 = 0
P1 = 0
P2 = 0

Runtime = BLOCKED_RUNTIME_EVIDENCE
```

### Static GO 已覆盖

- handoff canonical identity 的静态校验闭环。
- ExportReceipt 最小字段、businessId、digest 和 C4 preflight 对齐。
- Round 3 其他已关闭项保持关闭。

### 本轮明确没有执行

- test
- build
- lint/governance
- browser
- 视觉检查
- 16 步完整彩排

### 仍缺的运行证据

1. accepted / duplicate / rejected 的实际 HTTP。
2. request → grant → ready 的真实 opener/origin/source 消息序列。
3. 缺失/错误 project/package 确实不能进入 ready。
4. Export Outbox `pending → delivered → acknowledged`。
5. ACK 失败零入账、ACK 成功后 ExportReceipt apply。
6. Synthetic FALLBACK 的 HTTP 加载、browser controls 播放和来源链。
7. current grant、active organization、reset、wrong route 的运行证据。
8. 10—13 分钟 16 步主持人彩排。

### 老板可直接讲的收口句

> “D1 的静态合同和关键边界已经清零，说明方案已经具备进入受控运行 Gate 的条件；但我们没有把静态 GO 外推成运行 PASS，更没有外推成正式品牌、生产安全或发布完成。”

---

## 9. 来源与禁用说法

### 9.1 权威来源

- `docs/program/specs/C7_D1_STATIC_GATE_REVIEW.md` Round 3.1。
- `/Users/docfat/.codex/worktrees/19f7/短视频agent/docs/program/threads/C5/HANDOFF.md`。
- `docs/program/specs/C6_DEMO_GOLDEN_PATH_V0_1.md` 的 16 步演示结构。
- `docs/program/specs/C8_MATERIAL_SYSTEM_V0_1.md` 的事实状态、数字红线和材料治理机制。

### 9.2 对外发布前置

本 Pack 可用于内部老板汇报和 D1 主持准备。用于渠道、客户、招商、白皮书或正式发布前，必须：

- 完成 `BLOCKED_RUNTIME_EVIDENCE` 对应运行 Gate。
- 由 C7 给出运行验收结论。
- 由 C0 批准外部能力声明。
- 对价格、授权、品牌、法务、隐私和 SLA 另行取得批准。
