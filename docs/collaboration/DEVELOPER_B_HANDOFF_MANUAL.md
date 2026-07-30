# 负责人 B 交接手册：媒体生产平面

## 1. 你的目标

你负责把已经批准的品牌事实、脚本和分镜可靠地送进媒体生产流程，并把任务、资产、导出和来源链结果交还控制平面。

你不负责租户、渠道、价格、钱包或分佣。

## 2. 当前项目状态

### 已完成

- 海底捞三里屯统一 Demo 项目：`demo-local-001`。
- 品牌事实、禁用词、套餐、老板 IP、引用和风险界面。
- 脚本、分镜、生产交接、成功/失败任务和资产展示。
- `ProjectProductionPackage v0.1`。
- project-scoped Mock grant。
- 成功任务消费额度、失败任务释放额度。
- Receipt outbox、ack 和错误项目拒绝。
- 可播放的 `DEMO_ONLY FALLBACK` MP4。
- 平台、渠道、企业、媒体生产四类工作台。

### 正在进行

- D2 登录与角色工作台。
- 登录仍是纯前端 Mock，会话位于 LocalStorage。
- 企业身份默认进入海底捞品牌大脑。

### 尚未完成

- 正式后端身份认证和服务端 RBAC。
- 真实供应商 Key 管理。
- 真实 AI 视频生成和正式计费。
- 生产级数据库、队列、重试和监控。
- 正式支付、发票、提现和分佣结算。

## 3. 启动项目

```bash
git clone --recurse-submodules https://github.com/fatdoc/shortVideoAgent.git
cd shortVideoAgent
npm install
npm run storycanvas:install
npm run dev
```

另开两个终端启动 StoryCanvas：

```bash
npm run storycanvas:api
npm run storycanvas:web
```

默认访问：

```text
SaaS：http://127.0.0.1:5173/
StoryCanvas Web：http://localhost:50188/
```

媒体生产演示账号：

```text
账号：production
密码：Demo@123456
```

## 4. 开工前必读

按顺序阅读：

1. `README.md`
2. `docs/00_README_FIRST.md`
3. `docs/program/COMMON_MEMORY.md`
4. `docs/program/INTEGRATION_CONTRACT.md`
5. `docs/program/contracts/v0.1/README.md`
6. `docs/program/specs/C0_D1_RUNTIME_CLOSEOUT.md`
7. `docs/program/specs/C5_PRODUCTION_PLANE_ASSESSMENT_V0_1.md`
8. `docs/program/specs/C6_D1_DEMO_EXPERIENCE_IMPLEMENTATION.md`
9. `docs/collaboration/TWO_PERSON_DEVELOPMENT_SPLIT.md`
10. `docs/collaboration/DEVELOPER_B_FIRST_TASKS.md`

## 5. 唯一业务事实

- Project：`demo-local-001`
- 商家：海底捞火锅（三里屯店）
- Package：`package-demo-local-001-v1`
- Contract version：`0.1`
- Package digest：`sha256:113bf8ae7b01c5b6328a59afd4d9d0b3c20b8f8978901b1ab2c74e3a2b75d645`
- Source suite digest：`sha256:ecb4856cbceb568b931360335822e3beb590b6a8feefa07e773f3813d2552823`

不得创建第二套“相似”的品牌、脚本、分镜或 package fixture。

## 6. 生产合同边界

控制平面提供：

- 已批准的 package。
- 当前项目 grant。
- 已预留额度证明。
- tenant、organization、project、package、capability 和 scope。

生产平面返回：

- `GenerationTaskReceipt`
- `AssetReceipt`
- 任务状态和标准错误
- 来源资产与引用
- Provider 用量事实
- 导出 Artifact 和来源链

生产平面禁止：

- 修改客户余额。
- 计算客户价格。
- 创建渠道或 Tenant。
- 把上游 API Key 放入 URL、LocalStorage、package、receipt 或日志。
- 在缺少有效 grant 时自动使用 fixture grant。

## 7. StoryCanvas 说明

StoryCanvas 完整源码已经并入当前仓库的 `apps/storycanvas/`。它承担画布和媒体生产执行，不承担商业控制平面。

接入时必须遵守：

- 只经 `src/services/storyCanvasBridge.ts` 和 v0.1 合同交接。
- StoryCanvas 内部修改限定在 `apps/storycanvas/`，不得把其 Store、SQLite 或依赖直接搬到根应用。
- grant 只保存在内存中，不进入 URL 或浏览器持久化。
- production API 依靠显式 project-scoped grant。
- 旧 StoryCanvas API 可能仍使用本地 JWT，两者不得混为生产安全结论。
- 未确认 Toonflow 商业授权和标识条款前，不得对外分发 StoryCanvas 基座或宣称商业上线。
- 必须保留 `apps/storycanvas/LICENSE`、`NOTICES.txt` 和上游标识。

## 8. UI 要求

- 延续当前纯白、轻边框、浅底、高密度视觉。
- 不创建深色大屏、渐变宣传页或通用 AI Dashboard。
- 海底捞品牌事实必须来自现有数据和资产。
- 不用手绘占位图，不复制仓库外素材。
- `1440×900` 不允许横向裁切。
- 错误、失败、降级和 Mock 必须明确标识。

## 9. 提交前检查

```bash
npm run test
npm run lint
npm run build
npm run validate:governance
```

PR 必须说明：

- 修改了哪些生产流程。
- 输入 package/grant 是什么。
- 输出 task/asset/receipt 是什么。
- 成功、失败和越权路径如何验收。
- 哪些能力仍是 Mock/Fallback。

## 10. 需要立即升级给负责人 A 的事项

- v0.1 合同字段需要改变。
- 需要修改 Router、AppShell、全局 token 或 projectStore。
- 发现品牌事实、套餐、价格或额度数据不一致。
- StoryCanvas 需要新的权限 scope。
- 需要真实 Provider Key、付费调用或外部发布。
- 许可证、素材权利、隐私或品牌授权不明确。
