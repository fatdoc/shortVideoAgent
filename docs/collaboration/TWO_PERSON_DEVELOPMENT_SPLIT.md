# 两人开发拆分方案

> 版本：D2
> 适用仓库：`fatdoc/shortVideoAgent`
> 当前产品形态：前端 + Mock 的内部 Demo，不是生产 SaaS

## 1. 拆分原则

项目按业务控制权拆成两个开发域，不按页面数量平均拆分：

```text
负责人 A：控制平面
谁能使用、卖什么、多少钱、品牌事实和规则是什么

负责人 B：生产平面
收到什么生产包、如何执行、生成什么任务/资产/回执
```

两个域只通过冻结合同协作。任何人不得在自己的模块里复制另一套租户、额度、品牌事实或生产任务真相。

## 2. 负责人 A：SaaS 控制平面

### 业务职责

- 登录、会话、组织、Membership、角色与工作台权限。
- 平台管理员、总代理、一级代理、二级代理和企业租户。
- 产品套餐、客户售价、额度、订单、分佣与结算的前端演示。
- 企业工作台、品牌大脑、Brief 和业务审批入口。
- 海底捞三里屯唯一 Demo 主数据和演示黄金路径。
- GitHub 主分支、公共合同与最终集成。

### 文件所有权

- `src/pages/auth/`
- `src/pages/dashboard/`
- `src/pages/brief/`
- `src/pages/brand-brain/`
- `src/pages/commercial/`
- `src/pages/workbench/`
- `src/components/brand/`
- `src/components/commercial/`
- `src/components/workbench/`
- `src/domain/controlPlane*`
- `src/domain/creditLedger.ts`
- `src/domain/demoIdentity.ts`
- `src/mocks/controlPlaneDemo.ts`
- `src/services/demoAuth.ts`
- `src/services/activeOrganization.ts`
- `src/services/controlPlane*`
- `src/stores/authStore.ts`
- `src/stores/controlPlaneStore.ts`
- `src/stores/demoExperienceStore.ts`

### 本轮任务

1. 收口 D2 纯白登录页和四身份登录闭环。
2. 完成角色到工作台、菜单、默认路由和越权拒绝。
3. 保持企业账号默认进入海底捞品牌大脑。
4. 明确总代理、一级代理、二级代理的数据范围和价格差异。
5. 继续使用 Mock/LocalStorage，不提前扩张真实认证与支付基础设施。

## 3. 负责人 B：媒体生产平面

### 业务职责

- 脚本编辑、分镜、生产工作台、任务、资产与导出体验。
- SaaS 到 StoryCanvas 的 package/grant/deep-link 交接。
- 成功、失败、取消、重试和 FALLBACK 的演示状态机。
- 任务回执、资产回执、来源链和额度结果的合同输出。
- StoryCanvas 画布精进，但不在生产平面实现租户、钱包或客户价格。

### 文件所有权

- `src/pages/script-editor/`
- `src/pages/storyboard/`
- `src/pages/rough-cut/`
- `src/pages/production/`
- `src/components/production/`
- `src/services/storyCanvasBridge.ts`
- 与上述页面一一对应的测试文件
- StoryCanvas 独立工作区中经授权允许修改的生产模块

### 禁止修改

- `src/pages/auth/`
- `src/pages/brand-brain/`
- `src/components/brand/`
- `src/domain/demoIdentity.ts`
- `src/domain/creditLedger.ts`
- 渠道、套餐、客户价格和分佣规则
- 海底捞 C1—C8 事实、禁用词和引用规则

负责人 B 的详细交接见 `DEVELOPER_B_HANDOFF_MANUAL.md`，首轮任务见 `DEVELOPER_B_FIRST_TASKS.md`。

## 4. 公共文件与修改规则

以下文件为共享集成面，默认由负责人 A 合并：

- `src/app/Router.tsx`
- `src/layouts/`
- `src/design/global.css`
- `src/design/tokens.ts`
- `src/domain/constants.ts`
- `src/stores/projectStore.ts`
- `docs/program/contracts/`
- `docs/program/INTEGRATION_CONTRACT.md`

负责人 B 如需修改公共文件：

1. 先在 PR 描述中写清请求原因。
2. 把公共变更单独放一个 commit。
3. 不同时夹带生产页面重构。
4. 由负责人 A 合并或提出替代接线方式。

## 5. Git 协作

建议分支：

```text
main
├── dev/control-plane
└── dev/production-plane
```

规则：

- 禁止直接向 `main` 提交。
- 每个 PR 只覆盖一个业务域。
- 每天开始前同步 `main`，使用普通 merge 或 rebase，不强推共享分支。
- 禁止 `git reset --hard`、强推和覆盖他人未合并成果。
- 合同修改必须附 fixture、兼容性说明和双方确认。
- 合并顺序默认是合同、控制平面、生产平面、集成测试。

## 6. 两人交互协议

交接请求至少包含：

```text
请求编号
发起人 / 接收人
业务目标
输入与输出合同
允许修改目录
禁止修改目录
验收标准
是否阻塞
目标日期
```

生产平面不得直接读取钱包或客户价格。控制平面不得伪造任务、资产和供应商执行结果。

## 7. 完成定义

单人任务只有同时满足以下条件才算完成：

- 页面或合同实现完成。
- 定向测试通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- 没有修改对方独占文件。
- 文档、STATUS、HANDOFF、CHANGELOG 同步。
- PR 描述包含演示步骤、风险和未完成项。
