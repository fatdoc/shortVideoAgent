# D2 生产平面交接

> 状态：`READY_FOR_A_INTEGRATION`  
> Owner：B0  
> 更新日期：2026-08-02  
> 对应请求：`D2-AB-UNBLOCK-001`

## 1. 分支信息

```text
分支：dev/production-plane
基线 main：f48c210
代码交付头：ea6a430
最终分支头：以 origin/dev/production-plane 为准（交接文档提交位于代码交付头之后）
旧归档整体合入：否
A 独占文件修改：否
数据库 / migration 修改：否
```

## 2. 本轮交付

1. 将 StoryCanvas 收回唯一 SaaS 前端：生产工作台不再打开 popup 或依赖 `50188`，统一进入 `/production/canvas/demo-local-001`。
2. 建立内存型 `DemoProjectGrant` 合同，拒绝无 Grant、错 Project、错 Package、缺 Scope、过期和明文 Token。
3. 修复 StrictMode 重复派发，canonical Package 每次挂载只 dispatch 一次。
4. 交付闭环升级为 Task + Asset + Export Receipt 三重门槛；成功和失败均有可讲解的额度结算结果。
5. 补充 12 条定向测试，覆盖 Grant 边界、内嵌页和生产交付状态。

## 3. 演示脚本

1. 使用 `production / Demo@123456` 登录根前端。
2. 打开生产工作台 Inbox，接受 canonical 项目 `demo-local-001` 的 Package。
3. 点击“进入 StoryCanvas 画布”，确认在同一前端进入 `/production/canvas/demo-local-001`，不打开第二窗口。
4. 说明 Grant 仅存于当前 React 内存，并展示项目、Package、Scope 和过期校验边界。
5. 在画布触发成功演示，先产生 Task、再产生 Asset、最后产生 Export Receipt；缺任一步都不能宣称完成。
6. 返回工作台查看成功结算：`consume 100 + release 20`。
7. 成功 Export 后开启失败支线，展示失败不生成假资产：`consume 0 + release 80`。
8. 明确说明本链路为前端 Mock/Fallback 演示，不等同真实 AI、媒体服务或生产后端已上线。

## 4. 验证结果

| 验证 | 结果 |
|---|---|
| `npx vitest run ...StoryCanvasApp.types.test.ts ...IntegratedStoryCanvasPage.test.tsx ...ProductionControlSurface.test.tsx` | PASS，12/12 |
| B 修改文件 ESLint | PASS，0 errors；1 个 ignored-file warning |
| `npx tsc -b --pretty false` | PASS |
| `npm run build` | PASS，仅大 chunk warning |
| `npm run test` | 56/57；登录烟测 1 条旧标题断言失败，页面实际已在 `/login` |
| `npm run lint` | 702 problems，与 A 基线一致 |
| `npm --prefix apps/storycanvas test` | ENV_BLOCKED，Electron 指向旧 worktree 且安装损坏 |
| `npm run validate:governance` | PASS |
| `git diff --check` | PASS |
| 视觉两档 | 本轮未重跑；按 C0 指令不因浏览器工具失败阻塞 |

完整证据见 `B_STATUS.md`。

## 5. A 的集成步骤

```bash
git fetch origin
git switch <A 的短期集成分支>
git merge --no-ff origin/dev/production-plane
```

推荐 A 先集成 `dev/control-plane`，再合并本分支。若发生冲突：

- B 文件由本分支版本优先。
- A 独占认证、控制平面、价格/钱包/分佣文件由 A 版本优先。
- 共享文件必须人工审查，不以整文件覆盖处理。

## 6. 风险与后续

- 登录烟测需要 A 按当前登录页可访问名称更新断言，B 未越界修改。
- StoryCanvas API 测试需修复 Electron 依赖安装与旧 worktree 路径后复跑。
- 全量 Lint 仍有 702 个存量问题，建议另建技术债任务，不应阻断本次 Demo 集成。
- 合并后由 A 在统一集成分支执行最终端到端演示和两档视口截图。

## 7. B0 签发

- B-01～B-04 已完成，B-05 已完成并保留基线例外记录。
- 本轮没有修改 A 独占业务、后端、数据库或 migration。
- 远端交付目标仅为 `dev/production-plane`，不直接推送 `main`。
- 交付可供 A 审查、合并与统一验收。
