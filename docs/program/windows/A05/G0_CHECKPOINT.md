# G0 Checkpoint · A-05 Wave 1 启动基线

> 日期：2026-08-05  
> 分支：`codex/pilot-v0-control-plane`  
> 状态：`G0_ACCEPTED`

## 原子提交

- `a3f6783 feat(control-api): establish pilot auth foundation`
  - A01 Control API + PostgreSQL。
  - A02 白名单 Auth / Session / Tenant。
- `2c706b3 feat(storycanvas): expose pilot media readiness`
  - B01 Storage/Image/Video/TTS/FFmpeg Readiness。

## Gate 结果

- Control API：6 files / 20 tests PASS。
- Control API typecheck / build / 定向 ESLint：PASS。
- Control API 实库：001+002 migration、bootstrap、login/session/logout：PASS。
- StoryCanvas Readiness + BytePlus Assets/TOS/Video：10/10 PASS。
- 根前端串行回归：26 files / 181 tests PASS。
- 根 Build / Governance / `git diff --check`：PASS。

## 明确例外

- StoryCanvas 默认 `yarn test` 在进入测试前被本机 Electron 安装损坏阻塞；无 Electron 定向测试 10/10 通过。
- 该环境问题不得写成 StoryCanvas 全库 Test PASS，后续由 Q1/B 安装 Gate 处理。
- 根 `package-lock.json` 为用户在 G0 之前已存在的未提交更新，已从 G0 提交排除。

## Wave 1 规则

新窗口必须从包含上述两个提交和本 Gate 记录的基线启动，不得从旧 `main` 开工。
