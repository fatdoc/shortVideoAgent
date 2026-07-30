# C7 集成验收体系 v0.1

> 状态：`PROPOSED / READY_FOR_C0_REVIEW`
>
> Owner：C7 · 集成、质量与交付负责人
>
> 日期：2026-07-30（Asia/Shanghai）
>
> 目标 Gate：D1 老板 Demo
>
> 业务冻结基线：`T1_C0_SYNTHESIS_V0_1.md · APPROVED_FOR_D1_DEMO_DESIGN`
>
> 公共合同基线：`INTEGRATION_CONTRACT.md · v0.1`
>
> 本轮方法：仅文档与合同静态审阅；未运行测试、未启动服务、未调用模型、未提交或合并

## 0. 结论

本体系把 D1 的“可以演示”定义为六类证据同时成立：

1. 商业语义没有把产品、能力、额度、价格和生产事实混为一体。
2. 权限在平台、渠道、企业、媒体生产四个上下文中默认拒绝越权。
3. 额度严格遵守 `requested -> reserved -> consumed | released`，且能由追加式流水解释。
4. SaaS 控制平面和 StoryCanvas 生产平面只通过版本化合同交换事实，没有第二套主数据。
5. 视觉和交互达到现场可读、可操作、状态真实可见的标准，不以“结构接近”放行。
6. C6 的 16 步海底捞黄金路径可在 10—15 分钟内完成，并能在同一项目内处理关键失败。

验收体系本身完成不等于 D1 已通过。当前没有可执行证据包，且 C6 已登记的 D1 P0 断点尚未关闭，因此本文发布时 D1 状态为：

```text
NOT_EVALUATED
└── known D1 blockers remain open
```

只有 C7 收到绑定双仓提交、合同版本、fixture digest 和运行环境的证据后，才能给出 `PASS / CONDITIONAL_PASS / BLOCKED` 建议；最终放行权属于 C0。

## 1. 权威基线与裁决顺序

### 1.1 本体系消费的输入

- 项目治理：`README.md`、`COMMON_MEMORY.md`、`EMPLOYEE_RULES.md`、`AUTONOMY_PROTOCOL.md`。
- 架构和合同：`ARCHITECTURE.md`、`INTEGRATION_CONTRACT.md`、`REPOSITORY_MAP.md`。
- C0 会签：`T1_C0_SYNTHESIS_V0_1.md`。
- 领域输入：C1—C5 v0.1 规格、各自 HANDOFF 和开放 Requests。
- 演示输入：`C6_DEMO_GOLDEN_PATH_V0_1.md`、C6 HANDOFF 和 Requests。
- C7 边界：C7 招聘说明、首轮任务书和 C7 项目级线程记忆。

### 1.2 冲突裁决

发生冲突时按以下顺序判定：

```text
C0 最新批准决策
> COMMON_MEMORY
> INTEGRATION_CONTRACT
> C0 已批准的 T1 会签
> 员工领域规格
> 历史 Gate 文档
> 运行时页面或聊天描述
```

当前必须特别防止两类旧提案污染 D1：

- C1 和 C0 已明确 `ChannelOrganization` 与 `Tenant` 分离；不得采用 C4 早期提案中“Organization 必须属于一个 Tenant”的过时表达。
- StoryCanvas 的“南城咖啡”只能作为历史产品证据；不得进入 `demo-local-001 / 海底捞三里屯` 黄金路径。

如果实现与上级权威语义不一致，验收失败；C7 不通过降低标准或代改业务实现解决冲突。

## 2. 范围、非目标与验收对象

### 2.1 本文负责

- 六类验收矩阵和用例 ID。
- P0/P1/P2、Gate 阻断条件、例外和证据格式。
- `ProjectProductionPackage`、项目令牌、`GenerationTaskReceipt`、`AssetReceipt` 合同测试设计。
- 额度 `requested/reserved/consumed/released` 合同和一致性测试设计。
- C6 16 步黄金路径 E2E、失败场景和真实性标识检查。
- 双仓版本对应、集成发布清单、D1 放行清单。
- 缺陷模板、结果口径和跨域 Request。

### 2.2 本文不负责

- 修改 Product、Capability、SKU、Entitlement、Wallet 或 Ledger 业务规则。
- 修改 Tenant、ChannelOrganization、Membership 或 scope 定义。
- 修改公共合同字段、任务枚举、令牌实现或 StoryCanvas 生产逻辑。
- 为通过验收而修改产品代码、Mock、fixture 或历史成果。
- 批准真实售价、支付、资金结算、授权、版权或生产部署。

### 2.3 验收对象

| 对象 | 验收粒度 | 权威来源 |
|---|---|---|
| SaaS 控制平面 | 工作台、组织上下文、产品授权、Demo 额度、发包和回执展示 | C1—C4、C6、C0 会签 |
| StoryCanvas 生产平面 | 包接收、ID 映射、画布、任务、资产、基础合并/时间线、导出 | C5、公共合同 |
| 跨平面合同 | 包、令牌、任务回执、资产回执、额度握手、幂等与错误 | 公共合同 v0.1；批准后的 C4/C5 可执行 Schema |
| 唯一 Demo fixture | `demo-local-001` 的商业状态、品牌事实、脚本、8 镜和额度预期 | C0 会签、C2/C3/C4/C5 联合交付 |
| D1 现场流程 | C6 16 步、失败兜底、真实性标识和 15 秒重置 | C6 v0.1 |

## 3. 严重级别、Gate 状态与阻断规则

### 3.1 缺陷严重级别

| 级别 | 定义 | 典型例子 | D1 处置 |
|---|---|---|---|
| P0 | 破坏核心商业语义、安全/租户边界、额度守恒、双仓事实一致性、可交付闭环或演示真实性；无可信现场绕行 | 跨 Tenant 泄露；失败仍扣额度；第二套海底捞/南城咖啡混入；Mock 冒充真实；无法导出或重置；令牌含上游 Key | 立即阻断；不得豁免为“演示问题” |
| P1 | 主流程可继续但关键解释、韧性、可用性或证据不完整；现场高概率出错或引发错误承诺 | 回执延迟无解释；失败兜底不可点击；重要状态缺少时间/原因；主视口遮挡；来源链缺一层但资产仍可验证 | 默认阻断；仅 C0 可签署有期限、有 Owner 的 D1 单次豁免 |
| P2 | 不影响核心正确性、权限、额度和完成路径的轻微问题 | 次要对齐、非关键文案、低频页面的小视觉瑕疵 | 可带入 D1，必须登记并排期 |

以下问题无论页面是否“看起来能走”都按 P0：

- 客户界面出现上游 token、供应商密钥或平台上游成本。
- 渠道祖先身份能读取 Tenant 脚本、素材、品牌事实或成片。
- 生成任务未成功形成可交付资产就进入 `consumed`。
- 同一回执重放导致重复消费、重复资产或重复流水。
- 使用 LocalStorage、前端余额或 StoryCanvas SQLite 反推真实额度事实。
- `REAL/MOCK/HYBRID/LOCKED/FALLBACK` 标识与实际执行路径不一致。
- 黄金路径切换到第二项目、第二 Claim 集或“南城咖啡”。
- 基础 FFmpeg 合并被宣称为完整 FireRed AI 剪辑。

### 3.2 Gate 状态

| 状态 | 含义 |
|---|---|
| `NOT_EVALUATED` | 尚未获得可复现证据；不得解释为通过 |
| `IN_PROGRESS` | 已开始执行，但证据包未闭合 |
| `PASS` | 所有必需项通过，证据可复现，无开放 P0/P1 |
| `CONDITIONAL_PASS` | 无 P0；仅存在 C0 书面接受的 P1，含 Owner、临时方案、失效时间和回滚条件 |
| `BLOCKED` | 存在 P0、未豁免 P1、证据不完整、版本不可复现或关键环境不可用 |

### 3.3 D1 总 Gate 放行条件

D1 只有同时满足以下条件才可建议 `PASS`：

- 六类矩阵中所有 `D1-MUST` 用例通过。
- 开放 P0 为 0，未豁免 P1 为 0。
- C6 16 步为 `16/16 PASS`，没有跳步、截图替代或第二套数据。
- 必选失败场景全部通过：权限不足、未购买、额度不足、供应商失败、回执延迟/重放、QA 阻断、FireRed 降级、导出失败、15 秒重置。
- 成功样例 `reserved 120 -> consumed 100 + released 20` 和失败样例 `reserved 80 -> released 80` 可从任务、资产和 ledger 证据相互核对。
- 双仓提交、合同版本、fixture digest、Adapter 版本和构建物形成唯一版本清单。
- 页面、按钮、回执和导出物的真实性标识一致。
- 在目标演示设备上连续两次完整彩排成功，每次 10—15 分钟；重置后状态与 fixture digest 不变。
- C7 提交证据化放行建议，C0 最终批准。

任何以下情形直接 `BLOCKED`：

- 仓库提交或 fixture 无法复现，或证据来自未登记的脏工作树。
- 关键证据只存在于口头描述、静态截图或聊天记录。
- 公共合同版本不一致或消费方静默忽略未知字段/错误状态。
- 现场依赖真实支付、真实密钥、不可控下载或无确定时限的模型生成。
- 为赶演示临时放宽权限、透支额度、跳过 QA 或硬编码伪成功。

## 4. 证据格式

### 4.1 Evidence Package 最小字段

每个用例必须生成或登记一个证据项：

```yaml
evidenceId: EVD-D1-0001
gate: D1
caseId: AUTH-004
title: 渠道祖先不能读取 Tenant 脚本
result: PASS | FAIL | BLOCKED | NOT_RUN
severityOnFailure: P0
requirementSource:
  - C1_TENANT_CHANNEL_V0_1.md#8
  - C6_DEMO_GOLDEN_PATH_V0_1.md#5-step-3
versions:
  controlPlane:
    repository: videoagent
    commit: "<full sha>"
    dirty: false
  productionPlane:
    repository: storycanvas
    commit: "<full sha>"
    dirty: false
  contractVersion: "0.1"
  fixtureId: "demo-local-001"
  fixtureDigest: "sha256:<digest>"
  adapterVersions:
    control: "<version>"
    production: "<version>"
environment:
  runId: "<id>"
  device: "<model>"
  os: "<version>"
  browserOrApp: "<name/version>"
  viewport: "1440x900"
  timezone: "Asia/Shanghai"
truthMode: REAL-UI | REAL-CAP | MOCK-CONTRACT | HYBRID | LOCKED | FALLBACK
preconditions: []
steps: []
assertions:
  expected: []
  actual: []
artifacts:
  video: "<immutable reference>"
  screenshots: []
  requestResponse: []
  receipts: []
  ledgerPostings: []
  logs: []
redaction:
  secretsPresent: false
  personalDataPresent: false
executedAt: "<RFC3339>"
executedBy: "<actor>"
reviewedBy: "C7"
defectIds: []
notes: ""
```

### 4.2 证据要求

- 版本：必须记录两个仓库完整 commit SHA；D1 正式证据要求 `dirty=false`。文档评审证据可记录脏状态，但不能用于运行放行。
- fixture：所有跨页面证据必须带同一个 `demo-local-001` 和同一个 canonical digest。
- 视频：完整 E2E 使用连续录屏，必须包含系统时钟、工作台/组织/项目顶栏和真实性状态条。
- 截图：用于细节补证，必须包含页面上下文；裁掉顶栏或只截成功 toast 不算完整证据。
- 合同：保存脱敏后的 canonical request/response、Schema 校验结果、幂等重放结果和标准错误。
- 额度：保存 reservation、任务、资产、posting group 和余额重建结果；只截余额数字不算证据。
- 视觉：保存目标视口全屏图、关键交互前后图和必要的对照标注。
- 敏感信息：证据中不得出现 access token、Provider Key、完整敏感提示词或不必要的个人信息。
- 不可变性：证据文件需有 SHA-256；更新证据必须创建新 `evidenceId`，不得覆盖失败证据。

### 4.3 缺陷记录模板

```yaml
defectId: BUG-D1-0001
title: ""
severity: P0 | P1 | P2
gate: D1
category: business | authorization | credit | cross-repo | visual | demo
caseIds: []
foundIn:
  controlCommit: ""
  productionCommit: ""
  contractVersion: "0.1"
  fixtureDigest: ""
truthMode: ""
preconditions: []
stepsToReproduce: []
expected: ""
actual: ""
impact: ""
evidenceIds: []
owner: ""
status: OPEN | FIXED_PENDING_VERIFY | VERIFIED | ACCEPTED_RISK
temporaryWorkaround: ""
regressionCases: []
c0Waiver:
  approved: false
  reason: ""
  expiresAt: ""
```

缺陷关闭必须由原失败用例和相关回归用例在同一或更高版本重新通过；“代码已改”“本地看着正常”不能关闭缺陷。

## 5. 六类验收矩阵

优先级：

- `D1-MUST`：D1 放行必需。
- `M1-MUST`：商业 MVP 前必需，D1 可只验证 Mock 语义。
- `LATER`：后续阶段。

### 5.1 商业语义矩阵

| ID | 阶段 | 验收点 | 通过标准 | 失败级别 |
|---|---|---|---|---|
| BIZ-001 | D1-MUST | 客户商品口径 | 客户只看到“AI 视频生产能力/AI 视频额度”，不出现上游 token | P0 |
| BIZ-002 | D1-MUST | Product/Capability/Agent | Product 是价值包装，Capability 是原子授权，Agent 是流程模板；三者页面和数据不混用 | P0 |
| BIZ-003 | D1-MUST | SKU/Entitlement/Wallet 分离 | 已购能力由 Entitlement 表达，额度由 Wallet/Ledger 表达；有能力无额度和有额度无能力均能分别阻断 | P0 |
| BIZ-004 | D1-MUST | 已购/锁定范围 | 基础生成和本地生活 active；数字人/API locked；老板 IP/电商不进入黄金路径 | P0 |
| BIZ-005 | D1-MUST | Demo 数字声明 | 预计 100、最多冻结 120 和所有金额区域显示“演示数据 · 非正式报价” | P0 |
| BIZ-006 | D1-MUST | 唯一案例 | 全程仅 `demo-local-001 / 海底捞三里屯 / 抖音 / 9:16 / 30 秒 / 领取团购券或到店核销` | P0 |
| BIZ-007 | D1-MUST | Claim 与产品价格分离 | 门店套餐/权益 Claim 有来源和 C8 免责声明，不与平台 RateCard 混淆 | P0 |
| BIZ-008 | D1-MUST | StoryCanvas 商业边界 | 生产平面不显示客户价格、钱包、渠道树或上游成本 | P0 |
| BIZ-009 | D1-MUST | 能力真实性 | 未购买或未完成能力不能进入可执行伪流程；必须给出锁定原因 | P0 |
| BIZ-010 | M1-MUST | 真实商业规则 | 真实售价、支付、税务、退款和授权必须有 C0/用户批准，不得从 Demo fixture 推导 | P0 |

### 5.2 权限矩阵

| ID | 阶段 | 验收点 | 通过标准 | 失败级别 |
|---|---|---|---|---|
| AUTH-001 | D1-MUST | active context 原子切换 | 工作台/组织切换后菜单、指标、额度、数据范围和按钮同时变化，旧抽屉/缓存关闭 | P0 |
| AUTH-002 | D1-MUST | Tenant 边界 | Brand、Store、Project 引用均属于同一 Tenant；跨 Tenant ID 返回安全错误且不泄露对象存在性 | P0 |
| AUTH-003 | D1-MUST | 渠道商业范围 | 渠道只见自身/授权下级的产品、客户商业状态和汇总用量 | P0 |
| AUTH-004 | D1-MUST | 渠道内容隔离 | 渠道祖先无 Tenant Membership 时不能读取脚本、素材、品牌事实或成片 | P0 |
| AUTH-005 | D1-MUST | 企业 scope | 门店/项目角色只能见被授权 Store/Project；财务查看不能生成或改价格 | P0 |
| AUTH-006 | D1-MUST | 平台最小权限 | 普通平台运营默认不能展开客户生产内容；break-glass 不作为 Demo 常规路径 | P0 |
| AUTH-007 | D1-MUST | 深链保护 | 无效上下文深链返回安全页，不自动打开其他 Tenant 的同 ID 对象 | P0 |
| AUTH-008 | D1-MUST | Entitlement 与 action scope | 未购买、过期、角色不足、额度不足分别返回对应错误，不宽松放行 | P0 |
| AUTH-009 | D1-MUST | 生产项目令牌 | 只允许指定 tenant/project/package/capability/scope/expiry；路径和 body 不能覆盖 claims | P0 |
| AUTH-010 | D1-MUST | 密钥隔离 | 浏览器、URL、LocalStorage、包、回执、日志和证据均无明文项目令牌/Provider Key | P0 |
| AUTH-011 | M1-MUST | 服务端强制 | 前端隐藏不是权限证据；服务端或合同 Adapter 的拒绝结果可复现 | P0 |
| AUTH-012 | M1-MUST | 撤销和过期 | expired/revoked token 不能读取包或写回执，刷新需重新授权 | P0 |

### 5.3 额度矩阵

| ID | 阶段 | 验收点 | 通过标准 | 失败级别 |
|---|---|---|---|---|
| CRD-001 | D1-MUST | 状态分离 | 任务状态和额度状态并列显示，不合并为一个“处理中” | P1 |
| CRD-002 | D1-MUST | 任务前冻结 | 可计费任务创建前先校验能力、报价和余额，再从 requested 进入 reserved | P0 |
| CRD-003 | D1-MUST | 成功结算 | 可交付资产登记成功后，120 冻结只消费 100，并单独释放 20 | P0 |
| CRD-004 | D1-MUST | 失败释放 | 无可交付资产的失败/允许取消：80 全量释放，客户消费 0 | P0 |
| CRD-005 | D1-MUST | 回执延迟 | 回执未被接受时保持 reserved，显示“待同步”，不得提前消费 | P0 |
| CRD-006 | D1-MUST | 幂等 | 同一任务/资产/用量回执重放不重复消费、释放或登记 | P0 |
| CRD-007 | D1-MUST | 余额不足 | 不部分冻结、不透支、不产生负 available；返回缺口 | P0 |
| CRD-008 | D1-MUST | 追溯 | 每条额度动作能追到 task、reservationReference、RateCard 版本、原因和时间 | P0 |
| CRD-009 | M1-MUST | append-only | Ledger 只追加；余额可重建；posting group 的 delta 合计为 0 | P0 |
| CRD-010 | M1-MUST | 终态冲突 | 第一条合法终态生效；后续冲突进入异常/manual review，不覆盖原流水 | P0 |
| CRD-011 | M1-MUST | 超额处理 | actual > reserved 时新建补充冻结或 manual review，不覆盖旧冻结、不造负余额 | P0 |
| CRD-012 | M1-MUST | 账本 Owner | 只有控制平面写客户额度；StoryCanvas 只回传生产/用量事实 | P0 |

### 5.4 双仓合同矩阵

| ID | 阶段 | 验收点 | 通过标准 | 失败级别 |
|---|---|---|---|---|
| XREP-001 | D1-MUST | 版本对应 | 证据绑定 control commit、production commit、contract v0.1、fixture digest 和 Adapter 版本 | P0 |
| XREP-002 | D1-MUST | 唯一生产包 | 包来自唯一海底捞 fixture；Project/Brief/Claim/script/8 镜一致 | P0 |
| XREP-003 | D1-MUST | 包不可变 | 同一 packageVersion/digest 内容不可变化；变更产生新版本 | P0 |
| XREP-004 | D1-MUST | ID 映射 | 外部字符串 ID 与 StoryCanvas 内部 ID 稳定一一映射；不改历史整数主键 | P0 |
| XREP-005 | D1-MUST | 合同版本 | 不支持的 contractVersion 明确拒绝；不得静默降级或忽略 | P0 |
| XREP-006 | D1-MUST | 发包/接收握手 | dispatched 只有在生产侧明确接受后进入 accepted；不可达时不生成任务或消费 | P0 |
| XREP-007 | D1-MUST | 任务/资产回执 | 成功任务有 GenerationTaskReceipt 和 AssetReceipt；失败有标准错误且无伪资产 | P0 |
| XREP-008 | D1-MUST | 来源链 | Package → ScriptVersion → Shot → Task → Asset → Timeline/基础合并 → Export 可下钻 | P0 |
| XREP-009 | D1-MUST | 禁止反向耦合 | SaaS 不读 StoryCanvas SQLite；StoryCanvas 不读/写 Wallet 或客户价格 | P0 |
| XREP-010 | D1-MUST | 存储引用 | AssetReceipt 使用受控引用，不把不可移植本机 SQLite 路径当 SaaS 合同 | P0 |
| XREP-011 | M1-MUST | Outbox/重放 | 回执至少一次投递，消费端按业务 ID + 幂等键去重，失败可重放 | P0 |
| XREP-012 | M1-MUST | Schema 兼容 | Producer/consumer fixtures 双向校验；新增字段向后兼容，破坏性变化提升合同版本 | P0 |

### 5.5 视觉矩阵

| ID | 阶段 | 验收点 | 通过标准 | 失败级别 |
|---|---|---|---|---|
| VIS-001 | D1-MUST | 上下文常驻 | 顶栏始终显示工作台、组织、角色、Tenant/Project 和 Demo Mode | P0 |
| VIS-002 | D1-MUST | 真实性状态条 | 每页固定显示 REAL/MOCK/HYBRID/LOCKED/FALLBACK；关键按钮和结果也可识别 | P0 |
| VIS-003 | D1-MUST | 主视口可读 | 目标演示视口 1440×900 和降级视口 1280×720 无遮挡、截断、横向溢出或不可点击控件 | P1 |
| VIS-004 | D1-MUST | 状态可辨 | active/locked/blocked/pending/succeeded/failed 不只依赖颜色，并有明确文案/图标 | P1 |
| VIS-005 | D1-MUST | 关键反馈 | 批准、发包、冻结、任务、资产、QA、导出均有 loading/success/failure，防止重复点击 | P1 |
| VIS-006 | D1-MUST | 数字与声明 | 额度、演示 RateCard 和 Claim 免责声明在现场距离可读，不被 tooltip 隐藏 | P0 |
| VIS-007 | D1-MUST | 画布一致性 | StoryCanvas 标题、8 镜、引用和海底捞上下文可见，无“南城咖啡”残留 | P0 |
| VIS-008 | D1-MUST | 错误可行动 | 错误页显示原因、当前上下文、请求/任务 ID 和下一步，不暴露秘密 | P1 |
| VIS-009 | D1-MUST | 成片证据 | 9:16 成片可播放，导出方式和来源链入口清晰；静态封面不能冒充视频 | P0 |
| VIS-010 | D1-MUST | 关键交互非截图 | 身份切换、批准、发包、生成、回执、额度和导出必须现场可点击并有状态变化 | P0 |

视觉放行不是“页面存在”或“结构接近”。每个关键页面必须提供全视口截图、关键交互前后状态和连续 E2E 录屏三类证据中的适用项。

### 5.6 演示矩阵

| ID | 阶段 | 验收点 | 通过标准 | 失败级别 |
|---|---|---|---|---|
| DEMO-001 | D1-MUST | 10—15 分钟 | 连续录屏从重置到最终回执总览不超过 15 分钟，不跳步 | P0 |
| DEMO-002 | D1-MUST | 四入口 | 平台、渠道、企业、媒体生产全部出现且数据范围不同 | P0 |
| DEMO-003 | D1-MUST | 业务主线 | 能回答卖什么、谁能卖、客户买到什么、如何生产、为何扣额度、交付什么 | P0 |
| DEMO-004 | D1-MUST | 16 步完整 | C6 步骤 1—16 全部 PASS，步骤/状态/证据可一一映射 | P0 |
| DEMO-005 | D1-MUST | 确定性 | 默认不依赖真实网络模型；真实能力失败可切到明确标识的同项目 Demo task | P0 |
| DEMO-006 | D1-MUST | 失败可信 | 失败不伪造成功、不换项目、不换截图；额度和资产保持正确 | P0 |
| DEMO-007 | D1-MUST | 15 秒重置 | 一键恢复 DEMO_READY，保留唯一主数据和 fixture digest | P0 |
| DEMO-008 | D1-MUST | 可追溯交付 | 播放成片并展开完整来源链，最后按角色查看不同粒度回执 | P0 |
| DEMO-009 | D1-MUST | 主持人口径 | 演示者不会把 Demo 额度说成真实价格、基础合并说成完整 AI 剪辑 | P0 |
| DEMO-010 | D1-MUST | 两次彩排 | 同一版本清单连续两次 16/16 通过，且一次至少执行一条失败支线 | P1 |

## 6. 测试分层与执行顺序

```text
L0 静态治理检查
  权威版本、字段词汇、fixture 唯一性、真实性 manifest
        ↓
L1 合同与 Schema 测试
  Package / token / TaskReceipt / AssetReceipt / credit transitions
        ↓
L2 模块集成测试
  权限上下文、发包接收、ID 映射、Inbox/Outbox、Ledger projection
        ↓
L3 双仓端到端
  16 步黄金路径 + 必选失败场景
        ↓
L4 视觉与现场彩排
  目标设备、目标视口、计时、重置、降级和证据归档
```

执行原则：

- L0/L1 失败时不进入 L3，避免用 UI 成功掩盖合同错误。
- 每层消费同一个 fixtureId/digest；测试不得各造一套海底捞数据。
- Mock 与真实执行使用相同合同断言，只允许 transport/provider 不同。
- 真实能力不可用不是自动失败；没有准确标识、没有确定性 fallback 或伪造成功才是失败。
- D1 可用 Mock 证明合同语义，M1/P1 必须补服务端、持久化、恢复和真实 Provider 证据。

## 7. 合同测试设计

### 7.1 ProjectProductionPackage

| ID | 场景 | 关键断言 | 失败级别 |
|---|---|---|---|
| PKG-001 | canonical fixture 通过 Schema | 含 tenant/org/project、Agent、Brief、Claim/Rule、批准脚本、8 镜、平台/比例/时长、capability、contractVersion、idempotencyKey | P0 |
| PKG-002 | 必填字段缺失 | 缺 tenant/project/script/contractVersion/idempotencyKey 任一项明确拒绝 | P0 |
| PKG-003 | 同 Tenant 引用 | Brand/Store/Campaign/Script/Shot 引用不得跨 Tenant | P0 |
| PKG-004 | 脚本批准状态 | draft/blocked 脚本不得发包；只有 approved script-a 可进入 canonical 包 | P0 |
| PKG-005 | 内容 digest | canonical JSON 计算 SHA-256；同内容稳定，同 version 内容变化拒绝 | P0 |
| PKG-006 | 幂等同请求 | 同 idempotencyKey + 同 canonical request 返回原 packageId/version，标 duplicate | P0 |
| PKG-007 | 幂等冲突 | 同 key + 不同 request 返回 `IDEMPOTENCY_CONFLICT` | P0 |
| PKG-008 | 不可变版本 | 事实/脚本/镜头变更创建 packageVersion+1，不覆盖 v1 | P0 |
| PKG-009 | 禁止字段 | 包不含 Wallet、客户价格、Provider Key、明文 access token | P0 |
| PKG-010 | 合同版本 | `0.1` 接受；未知 major/minor 按批准策略明确拒绝，不静默忽略 | P0 |
| PKG-011 | 能力最小化 | grants 只包含项目需要且 Entitlement 允许的 Capability | P0 |
| PKG-012 | 单一主数据 | 包中不得出现“南城咖啡”、第二 projectId 或第二 Claim 集 | P0 |

### 7.2 短期项目令牌

| ID | 场景 | 关键断言 | 失败级别 |
|---|---|---|---|
| TOK-001 | 有效令牌 | 验证签名/完整性、iss、aud、nbf、exp、jti、tenant、org、project、package/version、capability、scope、contractVersion | P0 |
| TOK-002 | audience 错误 | 非 StoryCanvas audience 被拒绝 | P0 |
| TOK-003 | project/package 错配 | token claims 与 URL/body/task binding 任一不一致即拒绝 | P0 |
| TOK-004 | capability 越权 | 请求未授权生成/导出能力返回 scope/entitlement 错误 | P0 |
| TOK-005 | expiry/nbf | 过期或未生效令牌被拒绝，时钟偏差策略有界 | P0 |
| TOK-006 | revoked | deny list 或撤销状态生效，不能继续读取包/写回执 | P0 |
| TOK-007 | claims 最小化 | 无客户价格、余额、Provider 路由、Provider Key 或个人敏感信息 | P0 |
| TOK-008 | 存储与展示 | access token 只返回一次，不进入 URL、LocalStorage、日志、截图和证据 | P0 |
| TOK-009 | body 欺骗 | body 中 tenant/project 不能覆盖认证上下文 | P0 |
| TOK-010 | 刷新 | 刷新重新校验 Membership、Project 和 Capability；不是无条件续期 | P0 |
| TOK-011 | 只读/回执 scope | 只读 token 不能写回执；receipt scope 不能访问其他 Project | P0 |
| TOK-012 | Mock token | Demo token 明确为内存 Mock，不伪装签名安全，不包含真实秘密 | P0 |

### 7.3 GenerationTaskReceipt

| ID | 场景 | 关键断言 | 失败级别 |
|---|---|---|---|
| GTR-001 | queued/running | progress 合法、时间单调、无输出资产要求；状态只前进 | P1 |
| GTR-002 | succeeded | task/project/shot/type/provider/model、input digest、reference assets、output asset、时间和 idempotencyKey 完整 | P0 |
| GTR-003 | failed | 有标准错误 code/retryable/details，错误脱敏，无伪 output asset | P0 |
| GTR-004 | cancelled | 终态明确，无可交付资产时触发 release 候选 | P0 |
| GTR-005 | 成功无资产 | 不得进入 billable success；拒绝或 manual review | P0 |
| GTR-006 | 资产未登记 | receipt 可先进入 pending，但额度保持 reserved，不 consume | P0 |
| GTR-007 | 重放 | 同业务 ID + 同 payload 返回 duplicate，不产生二次副作用 | P0 |
| GTR-008 | 冲突重放 | 同 key/ID + 不同终态进入 conflict/manual review，不覆盖首个合法终态 | P0 |
| GTR-009 | 乱序 | completed 后收到 running 不回退；时间矛盾被拒绝 | P0 |
| GTR-010 | 引用范围 | shot/reference/output asset 均属于 token project | P0 |
| GTR-011 | 成本字段 | 金额/单位按批准 Schema；客户视图不暴露上游成本 | P0 |
| GTR-012 | 错误安全 | 不含 Provider Key、原始敏感响应或完整敏感提示词 | P0 |

### 7.4 AssetReceipt

| ID | 场景 | 关键断言 | 失败级别 |
|---|---|---|---|
| AST-001 | 图片资产 | asset/project/shot/type/MIME/尺寸/checksum/source/task/storage/rights/review/version 完整 | P0 |
| AST-002 | 视频资产 | 在 AST-001 基础上时长、编码/规格可验证，9:16 结果符合目标 | P0 |
| AST-003 | 导出资产 | 能关联 TimelineVersion 或明确“基础合并版本”，有可播放引用和 checksum | P0 |
| AST-004 | checksum 不符 | 内容与 receipt checksum 不一致拒绝登记/进入 qa_blocked | P0 |
| AST-005 | task 关系 | generated 资产必须关联成功 task；上传/补拍资产有合法 source 和权利说明 | P0 |
| AST-006 | 跨项目引用 | token/project/shot 不一致拒绝，不泄露其他项目 | P0 |
| AST-007 | 权利与审核 | rightsNote、reviewStatus 缺失时不能 approved/export | P0 |
| AST-008 | 存储引用 | 引用可受控访问；不得把不可移植 SQLite 路径当跨仓 URI | P0 |
| AST-009 | 幂等重放 | 同 assetId + checksum 重放 duplicate；同 ID + 不同 checksum 冲突 | P0 |
| AST-010 | 版本链 | 派生/替换资产创建新版本或关系，不覆盖历史证据 | P0 |
| AST-011 | 提示词隐私 | 仅回传摘要/必要 provenance，不暴露敏感完整 Prompt | P1 |
| AST-012 | AI 标识 | AI 生成资产的来源和页面/导出说明一致 | P0 |

### 7.5 额度状态与账本

| ID | 初始/事件 | 预期 | 失败级别 |
|---|---|---|---|
| CSM-001 | requested + 有效授权/报价/余额 | 原子创建 reservation，available -N、reserved +N | P0 |
| CSM-002 | requested + 余额不足 | 不产生部分 reservation/任务，余额不变，返回缺口 | P0 |
| CSM-003 | reserved 120 + succeeded + registered asset + actual 100 | reserved -100 → consumed；余 20 单独 release | P0 |
| CSM-004 | reserved 80 + failed，无资产 | reserved -80、available +80、consumed 0 | P0 |
| CSM-005 | reserved + cancelled，无资产 | 全量 release；取消不伪装 success | P0 |
| CSM-006 | reserved + receipt delayed | 保持 reserved，状态 pending；不提前 consume/release | P0 |
| CSM-007 | 同成功回执重放 | posting group、余额和资产数量不变，duplicate=true | P0 |
| CSM-008 | success/failure 冲突 | 第一合法终态生效，后续进入异常；不反写原流水 | P0 |
| CSM-009 | actual < reserved | consume actual + release remainder，二者都可追溯 | P0 |
| CSM-010 | actual > reserved | 新 supplemental reservation 或 manual review；不覆盖旧 reservation | P0 |
| CSM-011 | posting group | 每组 delta 总和为 0，事务全成或全败 | P0 |
| CSM-012 | projection rebuild | 从 Ledger 重建 available/reserved 与页面投影一致 | P0 |
| CSM-013 | StoryCanvas 伪写账本 | 生产平面直接修改余额必须拒绝/不存在该能力 | P0 |
| CSM-014 | 失败有供应商成本 | 客户仍消费 0；成本只进入平台成本事实 | P0 |

## 8. C6 16 步黄金路径 E2E

以下用例必须共享一个 `runId`、一个版本清单和一个 fixture digest。

| Step / Case | 现场动作 | 必须断言 | 核心证据 |
|---|---|---|---|
| 1 / E2E-01 | 重置 Demo，Platform 开场 | 15 秒内回到 DEMO_READY；当前组织 Platform；无旧任务/导出状态 | 重置前后状态快照、计时、录屏 |
| 2 / E2E-02 | 平台产品目录 | 基础生成/本地生活 active；数字人/API locked；RateCard 有 Demo 水印 | 产品/能力 fixture、全屏图 |
| 3 / E2E-03 | 切一级代理并打开客户 | 平台指标消失；只见商业汇总；脚本/素材入口拒绝 | context diff、负向请求 |
| 4 / E2E-04 | 切企业，点击已购和未购 | 本地生活可开始；数字人不可执行并返回正确原因 | entitlement/action evidence |
| 5 / E2E-05 | 打开唯一项目 | ID/Brand/Store/平台/比例/时长/CTA/8 镜一致 | fixture digest、页面上下文 |
| 6 / E2E-06 | 查看 Claim C3/C6/C8 | 来源、状态、禁用词、C8 免责声明进入上下文；保存递增版本 | before/after、source versions |
| 7 / E2E-07 | A/B/C 切换并批准 A | script-a draft→approved；风险重算；批准版本不可静默覆盖 | ScriptVersion、审计/状态 |
| 8 / E2E-08 | 8 镜和 05/07 处理，创建包 | 07 missing→ai_placeholder/planned；05 保持 reshoot；总时长通过；创建 package v1 | PKG Schema/digest、UI 状态 |
| 9 / E2E-09 | 发包并进入生产平面 | package dispatched→accepted；grant 仅展示 scope/expiry；不展示 token/价格/Key | 双仓 request/response、token redaction |
| 10 / E2E-10 | StoryCanvas 调整画布 | 海底捞/8 镜/规则一致；保存 CanvasVersion；普通切镜不默认尾帧 | 画布录屏、ID mapping、版本 |
| 11 / E2E-11 | 生成镜头 07 | requested→reserved 120 后才 queued/running；真/Mock 标识准确 | reservation、task、状态条 |
| 12 / E2E-12 | 成功与资产登记 | succeeded + AssetReceipt accepted 后 consume 100/release 20；重放 duplicate | GTR/AST、ledger postings、replay |
| 13 / E2E-13 | 打开预置失败任务 | reserved 80→released 80，消费 0；重试需新 task/reservation | failed receipt、ledger、new IDs |
| 14 / E2E-14 | 接收补拍资产并 QA | 05 reshoot→matched；权利/Claim/字幕/缺镜检查通过后 qa_passed；FireRed 降级准确标识 | AST、QA report、capability marker |
| 15 / E2E-15 | 导出并播放 | requested→processing→ready；9:16 可播放；来源链完整；基础合并不冒充 AI 剪辑 | ExportArtifact、checksum、播放录屏 |
| 16 / E2E-16 | 返回企业/平台回执页 | 企业见自身明细、渠道见汇总、平台见运营元数据；内容不越权 | 三身份对照、负向证据 |

E2E-01 至 E2E-16 任一跳过、BLOCKED 或用静态截图代替关键操作时，总结果不得为 PASS。

## 9. 失败场景与恢复验收

| ID | 故障注入/前置 | 期望系统行为 | 继续路径 | 失败级别 |
|---|---|---|---|---|
| FAIL-001 | 渠道深链打开 Tenant 脚本 | 403/安全页，不泄露内容或对象存在性 | 切企业授权身份 | P0 |
| FAIL-002 | 本地生活 Entitlement 缺失/过期 | 不发包、不签 grant，明确错误和申请路径 | 恢复 active fixture | P0 |
| FAIL-003 | 可用额度小于最大冻结 | 不部分冻结、不创建可计费任务、不透支 | 使用 Demo 充足钱包快照 | P0 |
| FAIL-004 | Claim 缺失/过期或脚本 blocked | 批准/发包按钮阻断并定位 Claim | 恢复批准快照后重试 | P0 |
| FAIL-005 | StoryCanvas 不可达 | package 停留 dispatched；无任务、无消费；包检查器可用 | 恢复连接并幂等重发 | P0 |
| FAIL-006 | Provider 提交/执行失败 | 标准错误脱敏；无资产；冻结全量 release | 新 Demo task + 新 reservation | P0 |
| FAIL-007 | Task/Asset Receipt 延迟 | 资产 pending，额度保持 reserved，显示待同步 | 重放同一回执 | P0 |
| FAIL-008 | 同一回执重复/乱序 | duplicate 或 conflict；无二次资产/额度；状态不回退 | 查看异常详情 | P0 |
| FAIL-009 | QA 缺权利/缺镜/安全区失败 | 导出按钮禁用，定位镜头/规则 | 补齐批准资产后复验 | P0 |
| FAIL-010 | FireRed offline/degraded | 明确显示 FALLBACK，走基础合并；不显示完整 AI 剪辑成功 | 继续同项目导出 | P0 |
| FAIL-011 | 导出失败 | 保留历史可交付版本，当前版本 failed，有诊断和重试 | 重试或播放历史 Artifact | P1 |
| FAIL-012 | 中途状态污染/演示中断 | 一键重置在 15 秒内回 DEMO_READY，不改变主数据/digest | 从 Step 1 重开 | P0 |
| FAIL-013 | token 过期/项目错配 | 包读取或回执写入拒绝；不接受 body 伪造上下文 | 重新授权 | P0 |
| FAIL-014 | Asset checksum/rights 不合格 | 不 approved、不消费/导出，进入 qa_blocked/manual review | 重传合法资产 | P0 |

必选 D1 失败证据：FAIL-001、002、003、005、006、007、008、009、010、011、012。其余可通过合同层证据完成。

## 10. Mock / 真实能力标识检查

### 10.1 六类标识定义

| 标识 | 允许的含义 | 禁止表达 |
|---|---|---|
| `REAL-UI` | 页面和交互真实可操作，但数据可来自 DemoWorkspace/LocalStorage | 暗示真实权限、账本或后端已上线 |
| `REAL-CAP` | 能力在目标版本中真实执行并有任务/资产/导出证据 | 仅有代码、旧项目或健康检查就宣称已接黄金路径 |
| `MOCK-CONTRACT` | 字段、状态、错误和幂等按 v0.1 确定性模拟 | 伪装成真实交易、真实签名安全或真实 Provider |
| `HYBRID` | UI/画布/Provider/传输/计量中只有部分真实 | 只写“混合模式”而不列明真实与 Mock 的边界 |
| `LOCKED` | 未购买、未授权或后续能力，只能查看说明 | 按钮仍能进入生成或产生伪结果 |
| `FALLBACK` | 主能力失败后在同一项目、同一来源链内可操作降级 | 换预录截图、换项目、换第二套资产后声称主能力成功 |

### 10.2 Capability Truth Manifest

D1 发布物必须包含并在 UI 中消费同一份真实性清单：

```yaml
capabilityId: production.export
releaseId: D1-<id>
ui: REAL-UI
execution: REAL-CAP | MOCK
transport: MOCK-CONTRACT | HTTP
persistence: LOCAL_DEMO | SQLITE | SERVER
provider: FFmpeg | FireRed | DemoGenerator
billing: MOCK-CONTRACT | SERVER_LEDGER
projectIntegrated: true
fixtureDigest: "sha256:<digest>"
fallback:
  enabled: true
  label: "基础合并导出"
knownLimitations:
  - "不包含完整 FireRed AI 剪辑"
evidenceIds: []
owner: C5
reviewedBy: C7
```

### 10.3 标识一致性断言

| ID | 断言 | 失败级别 |
|---|---|---|
| TRUTH-001 | 全局状态条、按钮角标、任务详情、资产详情和导出说明读取同一 manifest | P0 |
| TRUTH-002 | REAL-UI 不自动提升为 REAL-CAP；旧“南城咖啡”真实能力不算海底捞集成证据 | P0 |
| TRUTH-003 | HYBRID 页面逐项列出 UI/transport/provider/persistence/billing 的真实状态 | P0 |
| TRUTH-004 | 用户切换真实 Provider → Demo Provider 时创建新 taskId，并保留原失败事实 | P0 |
| TRUTH-005 | MOCK task/receipt/ledger 全部带 Demo 标识，但仍遵守正式状态机和幂等语义 | P0 |
| TRUTH-006 | LOCKED Capability 的执行端点也拒绝，不只禁用按钮 | P0 |
| TRUTH-007 | FALLBACK 结果写入 ExportArtifact/来源链，并准确标明执行器 | P0 |
| TRUTH-008 | manifest 与实际运行探针/回执不一致时默认降级标识并阻断演示口径 | P0 |

## 11. 双仓版本对应

### 11.1 Integration Release Manifest

每次 D1 候选版本必须建立唯一清单：

| 字段 | 要求 |
|---|---|
| `releaseId` | 不透明且唯一，如 `D1-RC-001` |
| `controlRepository` | canonical path/remote、完整 commit SHA、分支/tag、dirty=false |
| `productionRepository` | canonical path/remote、完整 commit SHA、分支/tag、dirty=false |
| `contractVersion` | `0.1`；附 Schema/fixture digest |
| `controlAdapterVersion` | 发包、grant、receipt inbox、Demo ledger Adapter 版本 |
| `productionAdapterVersion` | package import、ID mapping、task/asset outbox 版本 |
| `fixture` | `demo-local-001`、canonical digest、生成来源 |
| `capabilityManifestDigest` | 页面真实性标识的唯一摘要 |
| `schemaVersions` | 两侧数据库/LocalStorage/SQLite/contract schema |
| `buildArtifacts` | 两侧可运行构建物 digest |
| `environment` | OS、Browser/Electron、FFmpeg/FireRed/Provider 状态 |
| `evidenceBundle` | 用例结果、录屏、截图、合同日志和 ledger 对账摘要 |
| `rollbackPair` | 上一个已知可用的双仓版本对 |
| `approvals` | C4/C5 技术确认、C6 演示确认、C7 Gate 建议、C0 决策 |

### 11.2 兼容矩阵

| Control Adapter | Production Adapter | Contract | Fixture | 结论 |
|---|---|---|---|---|
| `0.1.x` | `0.1.x` | `0.1` | canonical digest | 仅在合同套件和 E2E 通过后支持 |
| `0.1.x` | 未登记版本 | `0.1` | 任意 | `BLOCKED` |
| 任意 | 任意 | 非 `0.1` | 任意 | D1 `BLOCKED`，除非 C0 批准新合同 |
| 任意 | 任意 | `0.1` | 非 canonical/无 digest | `BLOCKED` |
| dirty worktree | 任意 | 任意 | 任意 | 可调查，不可作为正式放行证据 |

### 11.3 当前基线登记

本文静态审阅时已知：

- 权威资料库/控制平面治理基线：`d2357eb03723148e9612e38feed7459ebcef01ea`，权威工作树存在既有未提交治理改动。
- C5 评估的 StoryCanvas 代码基线：`b4295471825427fab248c10dd41884fdea31993d`。
- 公共合同：`v0.1`。

这组信息只是调查基线，不是可运行的 D1 版本对；未提供 Adapter、fixture digest、构建物和运行证据，因此不得标记 supported。

## 12. D1 发布清单

### 12.1 版本与治理

- [ ] C0 确认本文及 C7 Requests 的处理结果。
- [ ] 两仓 commit、分支/tag、工作树干净状态已登记。
- [ ] 合同 v0.1 可执行 Schema、示例和 canonical fixture digest 已冻结。
- [ ] Integration Release Manifest 和 Capability Truth Manifest 已生成并校验。
- [ ] 未修改共同 ID、额度状态机或 Owner 边界；如有变更，已有 C0 决策。

### 12.2 商业和权限

- [ ] 基础生成/本地生活 active，数字人/API locked，状态来源唯一。
- [ ] 所有演示数字带“演示数据 · 非正式报价”。
- [ ] Platform/Channel/Tenant/Production 四上下文切换和负向权限通过。
- [ ] 渠道无 Tenant Membership 时不能读取生产内容。
- [ ] Provider Key、明文 token、上游成本在客户/渠道/证据中均不可见。

### 12.3 合同和额度

- [ ] PKG/TOK/GTR/AST/CSM 的 D1-MUST 用例通过。
- [ ] package v0.1、digest、ID mapping、发包/接收和回执往返可重放。
- [ ] 成功 120/100/20 与失败 80/0/80 的任务、资产、reservation 和 posting evidence 一致。
- [ ] duplicate/conflict/receipt delayed 不产生二次消费或状态倒退。
- [ ] StoryCanvas 不读写客户钱包，SaaS 不读 StoryCanvas SQLite。

### 12.4 视觉和演示

- [ ] 1440×900 和 1280×720 关键页面视觉验收通过。
- [ ] REAL/MOCK/HYBRID/LOCKED/FALLBACK 在页面、动作、结果和导出中一致。
- [ ] C6 16 步 16/16 通过，连续录屏 10—15 分钟。
- [ ] 必选失败场景通过，15 秒重置通过。
- [ ] 成片可播放；基础合并/真实时间线说明准确；来源链可展开。
- [ ] 连续两次完整彩排通过，无未登记手工改数据。

### 12.5 发布包、回滚和签字

- [ ] 证据 bundle 有 checksum、索引和敏感信息检查。
- [ ] 演示设备使用与证据一致的构建物；无临时网络下载、真实支付或真实密钥依赖。
- [ ] rollbackPair 可恢复，回滚不会删除 package/receipt/ledger 历史。
- [ ] P0=0；P1=0 或均有 C0 单次书面豁免；P2 有 Owner 和目标 Gate。
- [ ] C4 确认控制平面版本，C5 确认生产平面版本，C6 确认演示脚本。
- [ ] C7 给出 `PASS / CONDITIONAL_PASS / BLOCKED` 建议。
- [ ] C0 记录最终 D1 决策、日期、适用版本对和失效条件。

## 13. Gate 报告模板

```markdown
# D1 Gate Report · <releaseId>

- 结论：PASS / CONDITIONAL_PASS / BLOCKED
- 版本对：control <sha> + production <sha>
- 合同 / fixture：0.1 / sha256:<digest>
- 环境：<target device and app>
- 执行时间：<start/end>
- 六类结果：
  - 商业语义：x/y
  - 权限：x/y
  - 额度：x/y
  - 双仓合同：x/y
  - 视觉：x/y
  - 演示：x/y
- 16 步：x/16
- 失败场景：x/y
- P0 / P1 / P2：0 / 0 / n
- 真实性 manifest：<digest>
- 证据 bundle：<reference + digest>
- 已知限制：
- 豁免：
- 回滚版本对：
- C7 建议：
- C0 决策：
```

## 14. 跨域 Requests

### REQ-C7-001 · 冻结可执行跨仓合同套件

- 目标 Owner：C4 / C5；C0 批准公共合同。
- 请求：联合交付 v0.1 可执行 Schema、canonical fixtures、项目令牌 claims/校验向量、Package/Task/Asset 正反例、ID 映射规则、幂等/冲突/错误枚举和回执传输方式。
- 原因：当前公共合同只有语义字段，无法形成稳定的 producer/consumer 合同测试。
- 影响：XREP、PKG、TOK、GTR、AST、Demo Adapter 和双仓版本清单。
- 阻塞性：阻塞 D1 双仓 Gate。
- 临时方案：本文先给测试意图，不编写依赖未冻结字段的脆弱测试。
- 期望 Gate：D1 集成实现开始前。

### REQ-C7-002 · 交付唯一 D1 商业与额度 fixture

- 目标 Owner：C2 / C3 / C4。
- 请求：交付唯一 `demo-local-001` Product/Capability/Entitlement/RateCard/Wallet/CreditLedger fixture，给出成功 120/100/20、失败 80/0/80 的 reservation、posting group 和余额重建期望。
- 原因：没有单一预期值时，平台、企业和生产回执页面可能各造一套状态，C7 无法对账。
- 影响：BIZ、CRD、CSM、E2E-02/04/11/12/13/16。
- 阻塞性：阻塞 D1 商业闭环。
- 临时方案：只引用 C0 已批准演示样例，所有数字标记 Demo，不推导真实价格。
- 期望 Gate：D1。

### REQ-C7-003 · 交付确定性生产、资产与导出证据接口

- 目标 Owner：C5。
- 请求：提供同一海底捞项目的确定性成功/失败任务、统一 MediaAsset 登记、GenerationTaskReceipt/AssetReceipt Outbox、基础合并 ExportArtifact、checksum、权利/审核状态和 Capability Truth Manifest。
- 原因：没有媒体事实，额度变化和可播放交付都不能形成证据闭环。
- 影响：XREP、GTR、AST、E2E-10 至 E2E-15、FAIL-006 至 FAIL-011。
- 阻塞性：阻塞 D1。
- 临时方案：允许明确标识的 Demo Provider + FFmpeg 基础合并，不允许冒充完整 FireRed。
- 期望 Gate：D1。

### REQ-C7-004 · 冻结 D1 真实性标识与视觉基线

- 目标 Owner：C6；C4/C5 提供能力事实。
- 请求：冻结全局状态条、按钮级标识、结果/导出说明、1440×900 与 1280×720 关键页面基线，以及 HYBRID 的真实/Mock 分解字段。
- 原因：仅使用页面文案无法保证同一能力在四工作台和生产平面表达一致。
- 影响：VIS、TRUTH、E2E 全流程和老板主持人口径。
- 阻塞性：阻塞 D1 真实性与视觉 Gate。
- 临时方案：采用本文 Capability Truth Manifest，不自行创造能力事实。
- 期望 Gate：D1。

### REQ-C7-005 · 裁决 C4 早期组织表述与已批准语义冲突

- 目标 Owner：C0 / C4；C1 会签。
- 请求：在 C4 下一版或批准记录中明确 `Platform / ChannelOrganization / Tenant` 的独立关系，移除或废止“Organization 必须属于一个 Tenant”的早期表述，并给出项目令牌中 organizationId 的 D1 含义。
- 原因：该表述与 C1 规格及 C0 会签冲突，若进入实现会造成渠道与 Tenant 边界错误。
- 影响：AUTH-001 至 AUTH-009、Package 上下文、token claims、四工作台。
- 阻塞性：不阻塞本文评审；阻塞相关控制平面 Schema/权限实现和 D1 正式合同证据。
- 临时方案：验收按 C1 + C0 会签执行，旧 C4 表述不得作为通过依据。
- 期望 Gate：D1 集成实现开始前。

## 15. 风险与限制

| 风险 | 当前事实 | C7 口径 |
|---|---|---|
| 可执行合同未冻结 | C4/C5 仍有开放 Request | 保持 NOT_EVALUATED，不写脆弱字段级实现测试 |
| 两个仓库无正式版本对 | 只有调查基线，且权威资料工作树有既有改动 | 不作为发布证据 |
| StoryCanvas 主数据冲突 | 当前真实基础仍偏“南城咖啡” | 未接 canonical package 前 D1 P0 |
| 分镜/初剪/回执/额度 UI 未闭环 | C6 已列 P0-03 至 P0-08 | 不因 Demo 模式降级标准 |
| FireRed 未完整闭环 | 只有基础与健康检查，资源/凭证未批准 | 允许准确标识的基础合并，不宣称完整 AI 剪辑 |
| Toonflow 商业授权 | 阻塞商业 MVP/对外上线 | 不阻塞内部 D1，但必须保持非对外、非商业承诺 |
| 本轮未运行测试 | 用户明确禁止 | 本文只交付验收设计，不给出运行通过结论 |

## 16. C7 自查

- [x] 六类验收矩阵已建立。
- [x] P0/P1/P2、Gate 状态、阻断和有限豁免已定义。
- [x] 证据、缺陷和 Gate 报告格式已定义。
- [x] Package、项目令牌、TaskReceipt、AssetReceipt、额度状态合同测试已设计。
- [x] C6 16 步黄金路径、失败场景和真实性标识已覆盖。
- [x] 双仓版本对应与 D1 发布清单已建立。
- [x] 跨域问题已按 `REQ-C7-NNN` 登记。
- [x] 未降低标准迁就实现，未越权修改业务。
- [x] 未运行测试、未修改产品代码、公共合同、共同记忆或其他员工目录。
