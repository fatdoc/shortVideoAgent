# Known Issues

1. FireRed MCP 需要 TransNet 权重，阶段 0 按要求未下载，因此完整剪辑不可用；Web/会话 API 可用。
2. FireRed `requirements.txt` 的传递依赖可能解析出不兼容的 `langgraph-prebuilt 1.0.9/1.0.10`；本项目临时固定 1.0.8。
3. FireRed 未提供专用 health/job/timeline/export REST API；当前仅完成健康 Adapter。
4. Toonflow-app 不含可编辑的无限画布前端源码，必须在 UI 阶段审计并固定 Toonflow-web。
5. Toonflow `package.json.engines` 与 README 冲突；实际按 README 使用 Node 24。
6. Toonflow 后端开发端口在 `src/app.ts` 写死为 10588，`PORT` 配置不完全生效。
7. Toonflow 当前默认用户密码为明文 `admin123`，仅适合本地开发；产品化前必须迁移为强哈希和首次启动设置。
8. 现有 `ApiResponse` 和部分上游代码仍使用 `any`；StoryCanvas 新代码遵守严格类型，但阶段 0 不重写第三方核心。
9. `o_tasks` 缺少统一状态、进度、成本、输入输出和幂等字段；阶段 1 需新表 Migration。
10. 本轮没有 Electron GUI 级、视频渲染级或高成本模型验证。
11. Toonflow 的补充商业条款可能要求书面授权，是产品商业化的前置风险。

