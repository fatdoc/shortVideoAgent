# B2 启动提示词 · B02 Storage + B03 Image

你是 A-05 的 B2 数字员工，只负责真实媒体生产平面的 `B02`，在 B02 Gate 满足后才可继续 `B03`。

## 必读

1. `docs/program/README.md`
2. `docs/program/A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md`
3. `docs/program/windows/A05/G0_CHECKPOINT.md`
4. `docs/program/threads/C0/A05_TWO_PERSON_EXECUTION_SPLIT.md`
5. `apps/storycanvas/src/services/storycanvas/pilotMediaReadiness.ts`
6. `apps/storycanvas/src/services/storycanvas/byteplusTos.ts`
7. `apps/storycanvas/src/services/storycanvas/byteplusAssets.ts`
8. `apps/storycanvas/src/services/storycanvas/mvpGeneration.ts`

## 用户成果

- 生产输出不再只落到本地目录，而是可验证地写入远程对象存储。
- 真实图片 Provider 形成任务、输出 Asset、checksum、provider/model 和 provenance。
- 凭据缺失时明确 blocked，不用本地占位图冒充真实资产。

## 文件所有权

只允许修改：

- `apps/storycanvas/src/services/storycanvas/byteplusTos*`
- `apps/storycanvas/src/services/storycanvas/byteplusAssets*`
- 新增远程输出存储 Adapter 与测试
- 图片 Provider/生成 Adapter 及测试
- `pilotMediaReadiness*` 中与 B02/B03 状态相关的最小改动
- 必要的 StoryCanvas 生产路由和配置最小改动

禁止修改：

- `apps/control-api/**`
- 根 `src/**`
- `docs/program/contracts/**`
- Tenant、Membership、Wallet、客户价格和额度结算
- Video、TTS、FFmpeg 和最终 Export 业务

## B02 强制规则

- 远程 key 必须包含经验证的 project/task/asset 范围，拒绝 `..`、绝对路径和跨 project 覆盖。
- 上传后保存 checksum、MIME、size、provider、bucket/key 安全引用，不返回 Secret。
- 必须区分“上传成功”和“Asset 登记成功”；中间失败可重试。
- 自动测试不发起付费请求，不要求真实凭据。
- 真实凭据只从环境/Secret Manager 读取，日志和错误不包含 Key/Secret/签名 URL 全文。

## B03 进入条件

只有当远程存储 Adapter 的成功、失败、重试和密钥泄漏测试通过，才能进入真实图片生成。

B03 必须：

- 复用现有 Provider/Model 配置与 Readiness。
- 生成输出先下载/验证，再写远程存储和登记 Asset。
- 记录任务 ID、model/provider、prompt digest、checksum、时间和标准错误。
- 没有凭据时交付“实现就绪/环境 BLOCKED”，不伪造付费 smoke PASS。

## 验收标准

- Storage Adapter 单测覆盖签名、上传、checksum、重试、scope 拒绝和无密钥泄漏。
- Image Adapter 覆盖成功解析、Provider 失败、超时、无凭据和输出校验。
- Readiness 只在远程存储实现且配置时将 storage 改为 ready。
- StoryCanvas 相关定向测试、定向 TypeScript、`git diff --check` PASS。
- 默认 `yarn test` 如仍被 Electron 环境阻塞，必须忠实报告，不得描述为全库 PASS。

## 交付

交付 `READY_FOR_GATE` 或 `BLOCKED`，分别列出 B02/B03 状态、真实环境缺口、修改文件、测试和建议提交。不推送，不合并 `main`。
