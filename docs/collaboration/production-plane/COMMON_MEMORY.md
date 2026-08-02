# D2 生产平面共同记忆

## 当前目标

负责人 B 在 `dev/production-plane` 完成可供负责人 A 审查的媒体生产平面交付。基线为远端 `main` 提交 `f48c210`，禁止整体合并旧纯白 UI 归档分支。

## 唯一业务事实

- Tenant：`tenant-demo-hdl`
- Project：`demo-local-001`
- 商家：海底捞火锅（三里屯店）
- Package：`package-demo-local-001-v1`
- Contract：`0.1`
- 用户唯一前端：`http://127.0.0.1:5173/`
- 画布路由：`/production/canvas/demo-local-001`
- StoryCanvas API：`http://localhost:10588/api/`

## B 允许范围

- `src/pages/script-editor/`
- `src/pages/storyboard/`
- `src/pages/rough-cut/`
- `src/pages/production/`
- `src/components/production/`
- `src/features/storycanvas/`
- `src/services/storyCanvasBridge.ts`
- 对应测试
- `apps/storycanvas/src/` 的媒体生产 API 与引擎

## 禁止范围

- Auth、品牌大脑和品牌组件
- `demoIdentity.ts`、`creditLedger.ts`
- 渠道、套餐、价格、钱包和分佣
- 海底捞 C1-C8 事实、禁用词和引用规则
- 旧纯白归档分支

## 并发规则

- B0 是唯一 Git 提交与推送人。
- B1、B2、B3 不执行 `git add`、`git commit`、`git merge`、`git push`。
- 每人只修改任务书列出的独占文件。
- 发现共享文件需求时写入交接，不直接越界修改。
- 不回滚、覆盖或格式化他人的文件。
- 意外发现其他窗口修改同一文件时立即停止并通知 B0。

## 完成标准

- Typed Grant 边界和拒绝路径完成。
- Package、任务、资产、Receipt、ACK、消费与释放可讲解。
- TypeScript 和 Build 通过。
- B 定向测试通过；全量 Gate 结果诚实记录。
- Governance 与 `git diff --check` 通过。
- 形成 B-01～B-05 状态、演示步骤、风险和 A 回传。

必读：`A_TO_B_UNBLOCK_2026-08-02.md`。
