# License Audit

本文件是工程风险记录，不构成法律意见。对外商业化前应由法律顾问复核固定 Commit 对应的完整许可证和第三方素材条款。

## Toonflow

- 仓库声明：Apache License 2.0，加自定义补充协议。
- 必须保留 `LICENSE`、`NOTICES.txt`、Toonflow 标识和版权信息。
- 补充协议要求：若把软件或衍生版本作为产品提供给两个及以上独立第三方，须预先取得 HBAI-Ltd 书面商业授权。
- 五个以内法人联合内部使用且不对外提供服务，被其条款视为内部使用。
- 其 README 给出按营收分档的授权价格，但商务执行必须以书面授权为准。
- v1.0.8 前 AGPL 使用者的不追溯条款不自动适用于本次从 v1.1.8/HEAD 开始的新项目。

风险等级：**高**。StoryCanvas 若作为 SaaS、桌面软件或客户交付产品向多个第三方提供，不能只依据 Apache-2.0 标识判断可商用。

## FireRed-OpenStoryline

- 固定 Commit 的 `LICENSE` 为 Apache License 2.0，版权行为 FireRed-OpenStoryline Authors。
- 修改/分发时保留许可证、版权与修改声明。
- 当前仓库无单独 NOTICE 文件，但仍需保留源仓库归属。

风险等级：**中**。代码许可证宽松，但模型、字体、音乐、素材库、Pexels、TTS/视频供应商的内容许可证和 API 条款独立生效。

## StoryCanvas 处理原则

- `upstream/FireRed-OpenStoryline` 保留为固定 submodule，不复制删除许可证。
- Toonflow 原始 `LICENSE` 与 `NOTICES.txt` 保留在根目录。
- `docs/FIRERED_PATCHES.md` 记录所有集成改动；当前无上游核心补丁。
- 产品 UI 必须展示“开源软件与第三方声明”。
- AI 生成或实拍素材必须记录来源、模型、Prompt、Hash 和版权备注。
- 不得用 AI 生成画面冒充真实探店体验；应在项目元数据中保留来源标记。

## 上线前法律门槛

1. 获得 Toonflow 书面商业授权或重新评估主应用技术基座。
2. 完成 Toonflow-web 的许可证审计后再修改前端源码。
3. 清点随包字体、音乐、模型权重、演示素材的再分发权限。
4. 审核所有云模型 API 的训练、内容存储和商用输出条款。
5. 设计用户上传素材的权利保证、删除和审计机制。

