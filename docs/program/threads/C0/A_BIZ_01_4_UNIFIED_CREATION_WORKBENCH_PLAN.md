# A-BIZ-01.4 · 统一企业创作工作台实施计划

> 日期：2026-08-07
> 负责人：工程师 A（业务平台）
> 分支：`dev/business-plane`
> 前置完成：A-BIZ-01.1～01.3（Organization / Membership / Session / Project Scope）
> 状态：`PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`

## 1. 背景与目标

2026-08-06 已批准的 A/B 共创决策明确：企业老板、单人创作者和内容工作人员使用同一套 `Tenant + Membership + 统一创作工作台`，不能再要求用户在“企业客户工作台”和“媒体生产工作台”之间切换产品端。

当前代码仍有两套不同状态：

- D2 Demo 已实现角色路由、菜单过滤和 403，但 Tenant 用户仍通过 WorkbenchSwitcher 在 `tenant` / `production` 之间切换；
- Pilot 模式只在 `/pilot` 展示真实 Session 成功卡片，没有 Project 列表、默认项目落点、统一菜单或直接 URL 授权；
- D2 页面依赖 Mock / LocalStorage，不能直接挂到 Pilot 路由后冒充真实客户数据；
- B 独占的脚本、分镜和 StoryCanvas 页面尚未声明可消费真实 Pilot Project Context，A 不得直接修改或把 Demo fixture 注入真实模式。

本切片的目标是建立一套由可信 Session + 服务端 Project Scope 驱动的统一工作台导航内核，并在不修改 B 独占页面的前提下提供稳定的 Route Manifest、Project Context 和安全接线边界。

## 2. 冻结产品语义

### 2.1 Tenant 只有一个创作工作台

Tenant Context 不再暴露“企业 / 媒体生产”切换器。统一菜单同时承载：

- 项目与品牌资料；
- Brief；
- 脚本；
- 分镜；
- StoryCanvas；
- 生产任务、资产和导出；
- 仅管理员可见的企业管理入口。

`production` 可以继续作为路由命名空间和内部页面分类，但不能继续表现为需要用户手动切换的第二个产品工作台。

### 2.2 角色与菜单

| 能力                              | `tenant_admin` | `content_operator`                                        |
| --------------------------------- | -------------- | --------------------------------------------------------- |
| 查看当前 Tenant 项目列表          | 允许全部       | 只允许服务端返回的 Assignment 项目                        |
| 默认进入项目品牌大脑              | 允许           | 允许只读进入已分配项目                                    |
| 创建项目 / 修改 Project 元数据    | 允许           | 拒绝且不展示入口                                          |
| 查看品牌、Brief、脚本和生产状态   | 允许           | 允许已分配项目                                            |
| 写 Brief / Script / Approval      | 允许           | 由服务端 Assignment access 决定；viewer 只读、editor 可写 |
| 进入分镜 / StoryCanvas / 生产页面 | 允许           | 允许已分配项目；最终写权限仍由服务端拒绝                  |
| 成员、充值、佣金、渠道和平台入口  | 后续能力才显示 | 始终不显示且直接 URL 拒绝                                 |

前端菜单只做体验收口，不是安全边界。所有实际读写继续以 A-BIZ-01.3 服务端 Policy 为准。

### 2.3 默认路由

- Demo 企业管理员继续默认进入 canonical 海底捞品牌大脑：`/projects/demo-local-001/brand`；
- Demo 内容运营同样进入 canonical 品牌大脑，但保持只读/受限菜单；
- Pilot Tenant Session 登录或刷新后先请求 `/api/v1/projects`；
- 有可见项目时默认进入第一个稳定排序项目的品牌入口 `/projects/:projectId/brand`；
- 无可见项目时进入统一项目空状态 `/projects`；
- 禁止在 Pilot 中写死海底捞 Project ID、客户 UUID、邮箱或 Demo fixture；
- 非 TENANT Context 不伪造默认项目，进入稳定的 403 / 不支持上下文页面。

### 2.4 Project Context

新增前端 Pilot Project Context，最少包含：

```ts
type PilotProjectContext = {
  tenantId: string;
  projectId: string;
  projectName: string;
  sessionMembershipId: string;
  roleCodes: RoleCode[];
};
```

约束：

- `tenantId`、Membership 和 Role 来自已解析的 `PublicSession.activeContext`；
- `projectId` 只能来自服务端 `/projects` 可见列表或当前请求再次确认；
- 不从 URL、LocalStorage 或 Demo Store 推断 Tenant/Project Scope；
- Project 切换只在服务端可见列表内发生；刷新、Assignment 撤销或 Membership 变更后立即重新收口；
- 任何解析失败、空响应、未知 Role 或上下文不一致均 fail closed。

## 3. Demo 与 Pilot 数据边界

### 3.1 Demo

- 保留 D2 Mock / LocalStorage 黄金路径；
- Tenant 用户移除必须手动切换 `tenant` / `production` 工作台的体验；
- 现有 Demo canonical Tenant/Project 守卫继续生效；
- 不改变平台管理员和渠道代理现有 Demo 页面。

### 3.2 Pilot

- 只消费 Control API 的 Session 和 Project 数据；
- 不读取 `controlPlaneDemo`、`demoWorkspace`、`projectStore` 或海底捞 fixture 作为真实数据；
- API 不可达、Session 失效、Project 不可见时展示真实失败或空状态，不自动回退 Demo；
- B 页面在具备真实 Project Context 接口前不得直接渲染 Demo 数据。A 只交付路由入口、Context 合同和明确的“生产页面尚未接入真实数据”安全占位，不伪造成功状态。

## 4. Route Manifest 与拒绝语义

新增共享但运行模式无关的 Tenant Route Manifest，描述：

- route pattern；
- 菜单标签和顺序；
- 是否需要 Project；
- 所需前端 capability；
- `tenant_admin` / `content_operator` 可见性；
- Pilot 页面当前是 `ready`、`handoff-required` 或 `not-implemented`。

稳定前端结果：

| 场景                        | 结果                                                |
| --------------------------- | --------------------------------------------------- |
| 未登录                      | 跳转 `/login`，只保存安全内部回跳                   |
| Session 无效 / 401          | 清空内存 Session，返回登录                          |
| Control API 不可达 / 5xx    | 服务不可用页，禁止 Demo fallback                    |
| 非 TENANT Context           | 403 `TENANT_CONTEXT_REQUIRED`                       |
| Project 不在服务端可见列表  | 404 `PROJECT_NOT_FOUND`，不泄漏存在性               |
| 当前角色无菜单 capability   | 403 `PERMISSION_DENIED`                             |
| viewer 打开写操作           | UI 隐藏/禁用；服务端仍是最终 403                    |
| B 页面未完成真实 Pilot 接线 | 明确 handoff 状态，不显示 Demo 任务、资产或成功结果 |

## 5. 实施切片

### 5.1 01.4A · 纯函数 Route Manifest / Policy RED → Green

允许修改：

- `src/domain/*workbench*` 新文件；
- 对应纯函数测试。

覆盖：

1. Tenant 路由在一个统一菜单内排序；
2. Tenant Admin 和 Content Operator 菜单差异；
3. 不再生成 Tenant `production` WorkbenchSwitcher 选项；
4. Project route 必须携带可见 Project ID；
5. 未分配、错误 Tenant、未知 Role fail closed；
6. Demo canonical 海底捞默认路由保持不变；
7. Pilot 默认路由不硬编码客户 Project。

### 5.2 01.4B · Pilot Session / Project Context

允许修改：

- `src/services/pilotControlApi.ts`；
- `src/stores/pilotAuthStore.ts`；
- A 新增的 Pilot Project Context store/service；
- 对应测试。

工作：

- 解析完整 `activeContext`，支持 `tenant: null` 的非 TENANT Session；
- 新增 Project list/read API；
- 登录、hydrate 或 Project Scope 变化后刷新可见项目；
- 401 清 Session，403/404/5xx 保留稳定错误；
- 内存保存上下文，不写 LocalStorage；
- 不把 Assignment 或 access level伪造进 Session。

### 5.3 01.4C · 统一 Router / Sidebar / Shell

共享文件必须形成独立 commit 并通知 B：

- `src/app/Router.tsx`；
- `src/layouts/**`；
- 必要时 `src/domain/constants.ts`。

工作：

- Demo Tenant 导航合并为单一创作菜单；
- Pilot 从 `/pilot` 成功卡片切到统一 Shell、项目空状态和 Project Context 路由；
- 默认路由、刷新恢复、安全回跳、403/404 和服务错误使用同一 manifest；
- 非 Tenant 的 Demo 平台/渠道路径保持兼容；Pilot 非 Tenant 明确 fail closed；
- 不修改 B 独占页面源码。

### 5.4 01.4D · B 接线合同与联合回归

A 向 B 提供：

```text
projectId
tenantId
sessionMembershipId
roleCodes
runtimeMode
controlApiBaseUrl（只作为 Adapter 配置，不下发密钥）
```

B 后续页面必须：

- 只用 Context 中的 Project ID 调用授权 API；
- 不读取 Demo Store 作为 Pilot 数据；
- 不信任 URL 自行扩大 Scope；
- 未接真实数据时显示 unavailable，而不是 Demo success。

A 的 01.4 完成不以修改 B 页面为前提，但必须提供机器可测的 Context 合同和 handoff 文档。

## 6. 测试与 Gate

### 6.1 单元 / 组件

- Route Manifest 完整性和无重复 pattern；
- 两角色菜单、默认落点和直接 URL 拒绝；
- Pilot Session `activeContext` 严格解析；
- Project list 空、成功、401、403、404、5xx；
- Login returnTo 只接受 manifest 内部路径；
- Demo Tenant 不再需要切工作台即可进入品牌、脚本、分镜和生产入口；
- Pilot 不读取 Demo Store，不出现海底捞 fixture 或虚构生产成功。

### 6.2 集成 / 浏览器

- `tenant_admin` 登录 → 默认项目品牌入口 → 同一侧栏进入业务与生产路由；
- `content_operator` 登录 → 只出现服务端可见项目 → 管理入口不显示；
- 直接输入未授权 Project → 404；
- Session / Membership / Assignment 失效后刷新立即收口；
- 无项目显示安全空状态；
- Control API 不可达显示真实失败；
- 1440×900 和 1280×800 检查 Sidebar、Topbar、空状态和 403。

### 6.3 工程 Gate

- 定向 Vitest；
- Root 全量测试；
- `npm run build`；
- A 修改文件定向 ESLint / Prettier；
- `npm run validate:governance`；
- `git diff --check`；
- `git diff --name-only -- apps/storycanvas src/features/storycanvas src/pages/storyboard src/pages/script-editor src/components/script src/components/storyboard` 必须为空；
- 每个切片独立 commit，禁止 `git add .`。

## 7. 明确不做

- 不在本切片实现注册、邀请、Terms、成员管理、充值、佣金或 Support Grant；
- 不新增 `consumer` 组织、角色、工作台或注册 API；
- 不把 Demo/LocalStorage 数据展示为 Pilot 真相；
- 不修改 B 的脚本、分镜、StoryCanvas 页面；
- 不伪造 Task、Asset、Export、Provider 或额度成功；
- 不硬编码真实客户 ID、邮箱、价格、代理层级或佣金；
- 不以隐藏菜单替代服务端授权；
- 不让前端 access level 覆盖 A-BIZ-01.3 Policy。

## 8. 提交策略

1. 本计划、C0 状态和桌面知识库形成独立 `docs(business-plane)` 提交；
2. 01.4A 纯函数 Route Manifest / Policy 形成独立提交；
3. 01.4B Pilot Session / Project Context 形成独立提交；
4. 01.4C 共享 Router / Sidebar / Shell 单独提交并通知 B；
5. 01.4D handoff、联合回归和视觉证据独立收口。
