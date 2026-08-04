# D2 A-04 控制平面集成记录

- 日期：2026-08-04
- 集成负责人：A
- 基线：`origin/main@8594e21`
- A 来源：`dev/control-plane@2fe1ec5`
- 集成分支：`integration/d2-a04-control-plane`
- 功能合并提交：`03bc566 merge: integrate A-04 control plane`
- 状态：A-04 自动化 Gate、边界审查与既有 Lint 例外已接受；已快进并推送 `main`

## 1. 集成范围

本轮只集成 A-04 控制平面的 Tenant/Project 生产交付证据能力：

1. Tenant/Project scoped 的安全交付只读投影；
2. control-plane Adapter、Store 与 Reset 可靠性测试及最小修复；
3. 企业 Dashboard 的 Package、Grant、transport、receipt sync、唯一任务、Asset/Export 与运行额度状态；
4. A-04 测试、视觉证据与线程记忆文档。

明确不修改 B 独占的 Bridge、生产页面/组件、StoryCanvas 前端和 StoryCanvas API 实现。

## 2. Git 集成结果

从 `origin/main@8594e21` 创建短期集成分支：

```text
integration/d2-a04-control-plane
```

显式合入：

```text
dev/control-plane@2fe1ec5
```

Git 生成双父 merge commit：

```text
03bc566 merge: integrate A-04 control plane
parents: 8594e21 2fe1ec5
```

集成分支文件树与 `dev/control-plane@2fe1ec5` 一致。相对 `main` 的审查结果：

- B 独占目录无跟踪文件变化；
- Router、layouts、design、domain constants、project store 与跨域合同等共享集成文件无变化；
- 合并无冲突，未以整文件覆盖 B 成果。

## 3. 验证结果

### 3.1 A-04 定向回归

覆盖：

- `src/domain/controlPlaneDeliveryView.test.ts`
- `src/pages/dashboard/DashboardPage.test.tsx`
- `src/domain/demoRouteAccess.test.ts`
- `src/tests/app.smoke.test.tsx`

结果：

```text
4 files passed
51 tests passed
```

### 3.2 全量串行测试

```bash
npm test -- --maxWorkers=1 --minWorkers=1 --reporter=verbose
```

结果：

```text
26 files passed
181 tests passed
```

仅有既有 Ant Design `Spin tip` 警告，不影响断言。

### 3.3 ESLint

A-04 变更文件定向 ESLint：PASS。

全仓：

```bash
npm run lint
```

结果：

```text
702 problems
697 errors
5 warnings
```

问题数量与既有基线一致，集中于 B 独占的 `apps/storycanvas/src/`、`apps/storycanvas/data/vendor/` 和 `apps/storycanvas/data/serve/`。本轮已明确接受该 **既有 B/StoryCanvas Lint 例外**，不阻止 A-04 合入；相关技术债继续归 B 或后续专项治理，A 不越界修改 B 代码。

### 3.4 Build / Governance / Git

```text
npm run build                 PASS
npm run validate:governance   PASS
git diff --check              PASS
```

Build 仅有既有的大 chunk warning：主 JS 约 1,756.58 kB，gzip 约 542.28 kB。

## 4. 边界与运行时文件处理

StoryCanvas API 运行时生成了未跟踪空文件：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

该文件属于 B 范围，未暂存、未提交、未删除、未修改。A-04 文档提交和后续 `main` 推送必须继续排除该文件，并禁止使用 `git add .`。

## 5. 集成结论

A-04 功能、回归测试、构建、治理和边界审查均满足本轮验收要求。全仓 Lint 的唯一失败维持既有 StoryCanvas 基线，用户已于 2026-08-04 明确接受该例外。

最终结果：

1. 本集成记录与 C0 线程记忆已提交；
2. 推送前已刷新并确认 `origin/main@8594e21` 未前移；
3. 本地 `main` 已使用 `--ff-only` 快进到集成结果；
4. 已推送并确认 `main == origin/main@1df2bd1`。
