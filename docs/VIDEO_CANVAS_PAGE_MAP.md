# 当前页面与路由地图

| 页面名称 | 路由 | 使用者 | 业务作用 | 主要输入 | 主要输出 | 与视频画布关系 |
|---|---|---|---|---|---|---|
| 登录 | `/login` | 全部 | 选择四种 Demo 身份 | 固定账号密码 | LocalStorage Session | 决定能否进入 production |
| 平台概览 | `/platform/overview` | platform | 组织、产品、额度、回执摘要 | Mock Control Plane | 汇总卡片 | 间接查看画布回执 |
| 渠道与企业 | `/platform/organizations` | platform | 三级渠道树与租户 | Mock Organizations | 组织范围 | 无直接关系 |
| 产品与能力 | `/platform/catalog` | platform | Product/SKU/Capability/RateCard | Mock Catalog | 可售状态 | 决定画布能力和额度语义 |
| 生产回执 | `/platform/production-receipts` | platform | 平台回执总览 | Receipt Store | 回执列表 | 画布下游 |
| 渠道概览 | `/channel/overview` | channel | 渠道子树摘要 | Mock Channel | 客户和能力摘要 | 间接关系 |
| 可售产品 | `/channel/products` | channel | 渠道可售能力 | Mock Catalog | 产品卡 | 影响租户可用能力 |
| 企业客户 | `/channel/customers` | channel | 客户列表 | Mock Tenant | 客户摘要 | 无直接关系 |
| 客户用量 | `/channel/customers/:tenantId/usage` | channel | 固定租户额度与用量 | Ledger Projection | 用量摘要 | 汇总画布消费 |
| 企业已购能力 | `/enterprise/products` | tenant | 已购、说明态、锁定能力 | Entitlement | 能力卡 | 决定生产能力是否展示可用 |
| 企业工作台 | `/dashboard` | tenant | 项目、待办、流程 | DemoWorkspace | 项目入口 | 画布上游总览 |
| 新建/Brief | `/projects/new` | tenant | 商家、渠道、时长、CTA、素材约束 | 表单 | Brief | 画布最上游输入 |
| 项目入口 | `/projects/:projectId` | tenant | canonical 跳转 | projectId | 品牌页 | 只支持固定项目 |
| 品牌大脑 | `/projects/:projectId/brand` | tenant | 品牌资料、Claims、套餐、禁用词、IP | BrandProfile | C1-C8 与规则 | Package 和 Prompt 上游 |
| 脚本编辑 | `/projects/:projectId/script` | tenant | A/B/C 脚本、Claim、风险 | Brief、Brand | ScriptVersion | 分镜和 Package 上游 |
| 分镜生产单 | `/projects/:projectId/storyboard` | tenant | 8 镜计划和素材状态 | activeScript | StoryboardShot[]、Package | 画布直接上游 |
| 任务/交付 | `/projects/:projectId/rough-cut` | tenant | 回执、额度、来源链 | Control Plane Store | 企业交付视图 | 画布下游 |
| 项目用量 | `/projects/:projectId/usage` | tenant | 复用 ProductionControlSurface | Ledger | 资产/用量视图 | 画布下游，页面重复 |
| 项目交付 | `/projects/:projectId/delivery` | tenant | 复用 ProductionControlSurface | Receipts | 导出视图 | 画布下游，页面重复 |
| 生产概览 | `/production/overview` | production | Package、Task、Asset、Export 总览 | Control Plane Store | 生产状态 | 画布宿主工作台 |
| 生产包 Inbox | `/production/inbox/:projectId` | production | 发包、检查、Grant | Package、Approval | 传输状态、Grant | 画布正式入口 |
| StoryCanvas | `/production/canvas/:projectId` | production | 镜头执行、记忆、素材 | projectId、内存 Grant | 合同任务和回执 | 视频画布本体 |
| 生成任务 | `/production/tasks/:projectId` | production | 成功/失败 Demo 流程 | Package、Credit | Task/Receipt | 画布任务下游 |
| 媒体资产 | `/production/assets/:projectId` | production | Task/Asset/Export 事实 | Receipts | Asset 状态 | 画布资产下游 |
| 导出/来源链 | `/production/export/:projectId` | production | Artifact 和 Provenance | Asset、Export Receipt | playable 判定 | 画布最终下游 |
| 404/403 | `*` 或守卫返回 | 已登录用户 | 路由和工作台拒绝 | URL、Session | 错误页 | 非法画布入口会触发 |

## 重复与不可达功能

- `/platform/overview`和`/platform/organizations`复用平台组件。
- 多个 channel 路由复用 `WorkbenchHomePage`。
- rough-cut、usage、delivery 复用 `ProductionControlSurface` 的不同 `view`。
- production 五个页面复用 `ProductionWorkbenchPage` 和 `view`。
- `CharacterAssetsWorkspace`和`SettingsWorkspace`存在，但当前 StoryCanvas `navItems`没有入口。
- legacy `50188` 子窗口桥接代码存在，但当前生产入口不调用。

权威路由：`src/app/Router.tsx:134-260`。侧边栏：`src/layouts/Sidebar.tsx:29`。

