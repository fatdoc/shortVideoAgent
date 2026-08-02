# StoryCanvas Phase1 Changelog

> 日期：2026-08-03  
> 分支：`codex/storycanvas-phase1-production-loop`  
> 口径：记录当前共享分支已经实现和验证的 Phase1 增量，不宣称正式生产闭环全部完成。

## 1. Phase1 目标

围绕企业短视频营销业务建立第一条可追溯的 Mock 生产链：

```text
Approved Script
-> Storyboard Shot
-> Production Package
-> Stable Shot ID
-> Runtime Task
-> Shot Attempt
-> Valid Asset
-> Selected Attempt
-> RoughCut
-> Export
-> Credit
-> Provenance
```

StoryCanvas 仍是企业生产流程中的镜头生产台，不是通用无限画布或自由连线工作流。

## 2. 主要提交

| Commit | 内容 |
|---|---|
| `15d810e` | 增加 Phase1 Shot Production Workbench |
| `533b470` | 增加根控制面 Phase1 production projections 与严格额度门禁 |
| `2a04d94` | 对齐 Phase1 前端类型合同 |
| `f2c0022` | 增加任务事实源、额度、Prompt 和目标领域模型文档 |
| `d784339` | 增加 StoryCanvas Phase1 production runtime domain |
| `f626dd1` | 连接 Phase1 Runtime Workbench |
| `deb04af` | 增加 RoughCut、Export、Provenance、额度交付摘要与 14 张验收截图 |

以上为当前共享分支的近期 Phase1 提交记录。本文不推断尚未提交的并行工作内容。

## 3. Added

### 3.1 根控制面

- Stable Production Shot 投影；
- Package/Grant Handoff 投影；
- Runtime Task 投影；
- Shot Attempt 与多版本关系；
- Media Asset 投影；
- selected/alternative/rejected 版本决策；
- RoughCut 和 ExportArtifact 投影；
- Phase1 Credit Allocation、Entry 和幂等命令记录；
- LocalStorage 恢复键 `videoagent:control-plane:phase1:v1`；
- accepted/duplicate Package 的统一 ready 判定；
- Grant 具体失败原因展示。

### 3.2 StoryCanvas Runtime

- Phase1 Runtime Domain；
- Shot、Task、Attempt、Asset、Selection、RoughCut、Export 和 Provenance 的本地 HTTP 路径；
- Mock Provider 验证路径；
- Migration `004`；
- Phase1 镜头生产台与 Runtime 连接。

### 3.3 业务门禁

- 无 valid playable Asset 不得完成成功结算；
- 同一 Shot 只允许一个 selected Attempt；
- retry 使用独立 Attempt/Task 语义；
- failed/cancelled 释放全部冻结额度；
- production.operator 修改 locked price 被拒绝；
- duplicate Package 不重复创建 Shot 身份。

### 3.4 文档

- Task Source of Truth；
- Credit State Machine；
- Prompt Compilation；
- Target Domain Model；
- 本测试报告；
- 本 Changelog；
- Known Issues。

## 4. Changed

- canonical succeeded Receipt 不再被根控制面直接当作真实可播放成功，先进入 validating/pending/blocked 投影；
- Package duplicate 被视为幂等接收结果；
- Grant 握手错误保留具体错误码，而不是统一显示过期；
- 画布业务对象从视觉节点语义收敛到 Stable Shot、Attempt 和 Asset；
- 当前生产台可读取 Runtime 事实，而不是只依赖固定成功/失败卡片。

## 5. Preserved

以下兼容项保留：

- `demo-local-001`；
- C1-C8；
- `script-a` 审批兼容；
- Package、Grant、Receipt 公开语义；
- `120 -> 100 + 20` 成功 Demo 语义；
- `80 -> 0 + 80` 失败/取消语义；
- 企业、渠道、平台、生产四工作台边界；
- 旧 MVP 真实模型适配代码；
- Mock/FALLBACK 的明确 Truth 标记。

## 6. Migration

- 新增 Repo Demo DB Migration `004`；
- 临时数据库执行 `up -> idempotent up -> down -> up` 全部通过；
- Repo Demo DB 已应用 `004`；
- 没有证据表明线上数据库已经执行该迁移。

## 7. Validation

| 验证 | 结果 |
|---|---:|
| Root targeted | 24/24 PASS |
| Root full test | 72/72 PASS |
| Runtime targeted | 4/4 PASS |
| Root build | PASS |
| StoryCanvas build | PASS，需本地 `--no-save mariadb` |
| Migration sequence | PASS |
| HTTP positive loop | PASS，Mock 模式 |
| Failed credit release | PASS，80/0/80 |
| Cancelled credit release | PASS，80/0/80 |
| Locked price rejection | PASS |
| Real paid model call | 未执行 |
| Phase1 files lint | 0 error |
| Repository lint | 702 个既有问题 |

## 8. 当前 HTTP 事实

实测：

- 8 Shots；
- 8 Tasks；
- 8 Attempts；
- 8 valid Mock Assets；
- 8 selected Attempts；
- reserve/consume/release 各 8；
- RoughCut approved；
- Export 已创建；
- 14 类 Provenance。

限制：

- Package 镜头合同合计 30 秒；
- Mock 视频资产为 `8 * 6s = 48s`；
- RoughCut API 实测 48 秒；
- Export 复用 valid 镜头资产，不是独立合成成片资产。

## 9. Not Completed

- 正式八镜 FFmpeg 粗剪；
- 30 秒主成片；
- 独立 Export Asset；
- 图片 Mock/REAL 生成；
- 真实付费 Provider 验证；
- 真实钱包 ACK；
- 仓库全量 Lint 既有 702 个问题清零；
- 全量 App TypeScript Agent/Zod 风险清零；
- Playwright CLI Chrome 自动化验证。

详细风险见 `docs/STORYCANVAS_KNOWN_ISSUES.md`。
