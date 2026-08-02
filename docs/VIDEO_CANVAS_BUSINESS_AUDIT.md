# 视频生成画布商业业务审计

> 审计日期：2026-08-02  
> 审计方式：代码只读、数据库只读证据、无付费请求的本地页面运行  
> 审计范围：根 SaaS、`apps/storycanvas`、当前 Demo 数据和相关文档  
> 重要口径：`真实接通`只表示代码链存在，不代表供应商账户、线上服务或商业结算已验证。

## 1. 商业场景结论

当前产品是面向平台运营方、渠道代理商、本地生活企业客户和媒体制作团队的短视频营销平台 Demo。商业核心是销售、分配和计量 `AI_VIDEO_CREDIT`，海底捞三里屯本地探店流程是当前唯一完整展示场景，用品牌事实、脚本、分镜、生产包、画布和回执把 AI 视频额度包装为垂直业务能力。

证据：

- `README.md:12-14`
- `docs/memory/SHARED_MEMORY.md:13`
- `src/mocks/controlPlaneDemo.ts:63`
- `src/domain/creditLedger.ts:113`

## 2. 服务对象与工作目标

| 用户 | 使用目的 | 当前状态 |
|---|---|---|
| 平台管理员 | 查看组织树、产品能力、租户额度和生产回执 | 固定前端 Demo 身份，Mock 数据 |
| 总代理、一级代理、二级代理 | 分销 AI 能力、服务企业客户、查看用量 | 三级组织树存在；只有一级代理登录；报价、分佣、结算未闭环 |
| 企业老板、市场、门店运营 | 提交 Brief，维护品牌事实，生成/编辑脚本，确认分镜，查看交付 | Store/LocalStorage Demo 闭环 |
| 视频制作人 | 接收生产包，进入 StoryCanvas，执行生成案例，登记资产和回执 | canonical Demo 闭环；当前本机 API 离线 |
| 普通 C 端用户 | 个人自助创作 | 没有对应身份和工作台 |
| 独立财务、审核、风控角色 | 审批、结算、风控 | 文档提及，当前没有独立身份或路由 |

## 3. 最终交付物

当前业务宣称的最终交付物是一条 `9:16`、约 `30s` 的海底捞三里屯营销短视频及其来源链。实际代码中的交付层次不同：

| 层次 | 实际交付 |
|---|---|
| 根 SaaS | `TaskReceipt + AssetReceipt + ExportReceipt + CreditLedger` 的 Demo 交付证明 |
| D1 canonical | 固定成功/失败回执和 `DEMO_ONLY` FALLBACK Artifact |
| StoryCanvas MVP legacy | 可执行图片/视频生成并由 FFmpeg 合并为 MP4，但与 canonical 商业回执未统一 |
| 当前运行 | API `10588` 离线，未获得真实视频文件，导出页为 `playable=false` |

无法从当前运行确认成片真实可播放、可下载、可商用、带水印或可导出剪辑工程。

## 4. 完整商业流程

```text
固定 Demo 身份登录
-> 企业查看已购能力和 AI_VIDEO_CREDIT
-> 打开 demo-local-001
-> 填写本地探店 Brief
-> 维护海底捞品牌事实、套餐、禁用词和老板 IP
-> 选择或 Mock 生成 A/B/C 脚本
-> 编辑 Hook/Body/Proof/CTA/Disclaimer 并绑定 C1-C8
-> 人工批准 script-a
-> 查看 8 镜分镜生产单与素材匹配状态
-> 创建不可变 ProjectProductionPackage
-> 切换 production.operator 身份
-> 接收 Package 和短期 Grant
-> 进入同一 SaaS 内嵌 StoryCanvas
-> 预冻结 AI_VIDEO_CREDIT
-> 执行成功或失败 Demo 案例
-> 同步 Task/Asset/Export Receipt 并 ACK
-> 成功消费 100、释放 20；失败消费 0、释放 80
-> 企业查看交付、额度流水和来源链
```

| 阶段 | 用户输入 | 系统输出 | 人工确认 | 付费模型 |
|---|---|---|---|---|
| 登录 | 固定账号与统一密码 | LocalStorage 会话、工作台 | 选择身份 | 否 |
| Brief | 商家、城市、地址、平台、比例、时长、受众、CTA、素材引用、限制 | `DemoWorkspace.brief` | 保存或继续 | AI 建议只是本地定时器 |
| 品牌 | C1-C8、套餐、禁用词、人物资料 | `BrandProfile` | 状态调整、保存 | 否 |
| 脚本 | 版本、文本块、时长、Claim 引用 | `ScriptVersion`、Mock 评分和风险 | 保存、选择 activeScript | 当前根 SaaS 为 Mock |
| 审批 | 批准、撤销、事实风险 | `ScriptApproval` | 必须显式批准 | 否 |
| 分镜 | 当前主要为查看八镜及素材匹配 | `StoryboardShot[]` | 创建 Package | 否 |
| 生产包 | Brief、Claims、规则、批准脚本、八镜快照 | 不可变 Package、Digest、Grant | 发包与检查 | 否 |
| 画布 | 镜头提示词、生成类型、确定性案例 | 镜头状态、合同回执 | 单镜生成入口 | canonical 不调用真实模型；legacy 可能付费 |
| 额度 | 成功/失败支线 | reserve/consume/release 分录 | 分步执行 | 当前为 Mock 计量 |
| 导出 | 已批准资产和 Export Receipt | Artifact、来源链、可播放判定 | 查看 | 当前 canonical 为 FALLBACK |

## 5. 视频画布在业务中的位置

- 进入阶段：脚本已批准、八镜分镜已形成、生产包已生成、制作身份已接收授权之后。
- 上游依赖：租户、项目、Brief、C1-C8、品牌规则、`script-a` 审批、八镜分镜、Package、Grant。
- 画布职责：把已批准生产意图转成镜头级执行界面，展示连续性记忆和参考素材，触发或登记生成任务。
- 下游输出：Task、Asset、Export Receipt、ACK、额度结算和来源链。
- 是否核心工作台：对制作人员是核心执行工作台；对完整商业系统只是中后段生产环节。
- 是否可绕过：根 SaaS 的 Demo 控制面可直接演示回执；legacy API 可独立生成，因此技术上存在绕过，但 canonical 业务要求经过 Package/Grant。
- 离开画布后：仍要同步回执、ACK、结算额度、审核资产、形成 Export Receipt、验证可播放引用并交付。

## 6. 业务角色与权限

| 身份 | 角色码 | 工作台 | 默认入口 | 权限实现 |
|---|---|---|---|---|
| 平台管理员 | `platform.admin` | platform | `/platform/overview` | 工作台级前端路由守卫 |
| 渠道负责人 | `channel.admin` | channel | `/channel/overview` | 工作台级前端路由守卫 |
| 企业老板 | `tenant.owner` | tenant | `/projects/demo-local-001/brand` | 工作台级前端路由守卫 |
| 视频制作人 | `production.operator` | production | `/production/overview` | 工作台级前端路由守卫 |

固定身份定义：`src/domain/demoIdentity.ts:85`。守卫：`src/app/Router.tsx:83`。登录：`src/services/demoAuth.ts:10`。

未实现服务端 RBAC、按钮级权限、真实多租户隔离、团队成员管理、总代理/二级代理独立账号。

## 7. 计费、合规和交付约束

### 计费

- 钱包类型：`AI_VIDEO_CREDIT`。
- 计量单元：`STANDARD_5S_720P_VIDEO`，当前文案按可交付资产计量。
- 成功 Demo：冻结 120，消费 100，释放 20。
- 失败 Demo：冻结 80，消费 0，释放 80。
- `sc_tasks`有 `estimatedCost/actualCost`，真实生成代码未形成成本核算。
- 当前没有人民币价格、订单、支付、发票、渠道进销价、佣金或提现闭环。

### 合规

- C1-C8 是脚本 Claim 的唯一事实来源。
- 禁用词、事实状态、免责声明会进入 Package 快照。
- 未批准脚本或未清事实风险不能发包。
- 缺镜不得伪造成 approved Asset。
- 当前没有真实内容安全、版权、肖像权、人脸、音乐授权或人工审核服务证据。

### 交付

- 当前 Demo 画幅 `9:16`，时长 `30s`。
- MVP FFmpeg 固定 `720x1280`、30fps、H.264，并去除音频。
- 未确认其他画幅、格式、水印、商用许可、项目打包、剪辑工程导出和多人协作。

## 8. 不可随意改变项

| 项目 | 原因 |
|---|---|
| `demo-local-001` | 根路由、Package、Grant、Fixture、ID Mapping 和回执共同依赖 |
| C1-C8 | 品牌事实、脚本引用、风险和 Package 快照依赖 |
| `script-a` 审批门控 | canonical Package 强制依赖 |
| `DemoWorkspace` | 企业页面和 LocalStorage 的聚合事实源 |
| `ScriptVersion.blocks[].claimIds` | 品牌事实到脚本的关联键 |
| `StoryboardShot.id/assetId/matchStatus` | 分镜、素材和生产结果关联 |
| Package `payloadDigest/idempotencyKey/version` | 不可变发包和重复检测 |
| Grant `tenantId/projectId/packageId/scopes/expiresAt` | 防止跨租户、跨项目、越权生产 |
| `sc_external_mappings` | 外部字符串 ID 与内部整数/UUID 桥梁 |
| `o_storyboard.id/trackId/index` | 旧分镜、视频段和顺序关系 |
| `o_videoTrack.videoId` | 当前采用视频版本 |
| `sc_receipt_outbox` 唯一性 | ACK、重投和控制面入账 |
| reserve/consume/release 语义 | 成功、失败和退款展示依赖 |
| 根工作台边界 | 当前唯一权限隔离措施 |

## 9. 关键问题的事实回答

1. 商业场景：销售 AI 视频额度的多角色本地生活短视频营销平台，海底捞三里屯是当前黄金 Demo。
2. 为什么进入画布：制作人员需要把已批准的八镜生产包转成镜头级任务、资产和回执。
3. 进入前已完成：Brief、品牌事实、脚本、审批、分镜、Package 和 Grant。
4. 离开后要完成：回执同步、ACK、额度结算、资产审核、Export Receipt、可播放验证和交付。
5. 三个价值：镜头执行可视化；Package/Grant 业务边界；任务/资产/来源链承接。
6. 三个严重问题：三套事实源并存；canonical 当前不是实时 AI 生成；画布编辑与保存大量停留在 React 内存。
7. 记忆性质：对话记忆是提示词上下文；Continuity 是结构化业务记忆，但 canonical 真实生成未闭环。
8. 分镜与最终视频：不是稳定一一对应，一个 Track 可有多个视频版本，当前 canonical 仅有 Demo 回执。
9. 画布定位：制作工作台中的核心执行环节，不是整个平台主流程，也不是通用工具。
10. 必须保留：事实引用、审批门控、八镜 ID、Package/Grant、连续性结构、任务/资产/导出回执、失败释放额度。
11. 不能轻改：上述 ID Mapping、Package Digest、Grant Scope、Storyboard/Track/Video 关系和 Receipt 唯一键。
12. 看似存在但未闭环：撤销重做、节点拖动排序、画布保存、角色资产导航、真实 canonical 生成、真实可下载成片、真实分佣。
13. 产品方向初判：现有事实更支持继续作为垂直业务画布；抽象成通用画布会先破坏当前 Package、Claim、八镜和计费语义。
14. LibTV 相关能力：镜头编排、角色/场景一致性、参考素材、预览、版本选择、时间线和导出来源链与本场景相关。
15. 不宜直接加入：无业务对象约束的任意节点图、通用无限工作流、与 Package/Grant/额度脱钩的自由生成。
16. 3D 白模接入位置：分镜批准后、视频生成前，作为镜头摄影要求和参考资产输入。
17. 3D 基础：已有镜头契约、Camera 字段、Reference Binding、资产模型和 Prompt 适配位置；没有 3D 资产类型、坐标、相机轨迹、渲染器或预演任务。
18. 下一阶段先研究：稳定镜头 ID 到可播放 Asset/Export 的单一事实链，并验证 Continuity 在真实生成请求中的实际使用。

第 13-18 项仅为基于现状的研究判断，不是重构建议。

