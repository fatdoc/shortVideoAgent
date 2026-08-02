# 视频画布当前用户流程

## 1. 实际运行环境

- 根前端：`http://127.0.0.1:5173/`，启动成功。
- StoryCanvas API：预期 `http://127.0.0.1:10588/`，本次未启动，避免其启动时自动执行数据库 migration。
- 真实模型请求：未发起。
- 本地 Package 请求：发起一次，因 API 离线返回 `Failed to fetch`。
- 页面视口：浏览器默认 `1280x720`。

## 2. 实际体验记录

| 步骤 | 实际操作 | 结果 | 断点或说明 | 截图 |
|---|---|---|---|---|
| 登录 | 打开根站点 | 成功显示四种 Demo 身份 | 固定密码、LocalStorage 会话 | `01-login-home.png` |
| 打开项目 | 以 tenant 登录 | 默认打开 `demo-local-001` 品牌页 | 不是多项目真实列表 | `02-tenant-dashboard.png` |
| 项目列表 | 访问 `/dashboard` | 显示唯一海底捞项目和 42% 进度 | 项目总数为 1 | `03-project-dashboard.png` |
| 创建项目 | 访问 `/projects/new` | Brief 已预填，可编辑 | 实际覆盖固定 Demo，不创建新 ID | `04-project-create-brief.png` |
| 业务资料 | 查看 Brief 和品牌页 | 可见商家、CTA、C1-C8、套餐、禁用词、老板 IP | 页面统计与底层 Demo 数量存在不一致 | `02`、`04` |
| 剧本 | 访问脚本页 | 三版脚本、分块编辑、事实引用和 Mock 风险可见 | 未点击 Mock 生成，避免改变本地数据 | `05-script-editor.png` |
| 角色 | 根 SaaS 无独立角色页 | 无法从当前导航完成 | StoryCanvas 角色资产组件存在但不可达 | 无独立截图 |
| 分镜 | 访问分镜页 | 8 镜、6 已匹配、1 待补拍、1 缺镜 | 分镜主要只读，无完整编辑/排序/版本操作 | `06-storyboard.png` |
| 交付 | 访问 rough-cut | Package、额度、Receipt 和来源链可见 | 初始回执为 0，Export `playable=false` | `07-rough-cut-output.png` |
| 制作身份 | 切换 production | 成功进入生产概览 | 与企业身份分离，必须退出重登 | `08-production-workbench.png` |
| 生产包 | 打开 inbox | Package/Grant 入口可见 | API 离线，入口初始禁用 | `09-production-inbox.png` |
| 任务 | 打开 tasks | 成功/失败五步演示可见 | 未执行任务，不产生模型费用 | `10-generation-tasks.png` |
| 素材 | 打开 assets | Task/Asset/Export Receipt 均为 0 | 不把静态素材当成成片 | `11-media-assets.png` |
| 导出 | 打开 export | 显示 FALLBACK、`playable=false` | 没有可验证下载地址 | `12-export-provenance.png` |
| 发包 | 点击 `POST package + grant` | 前端 Package/Grant ready；传输失败 | `TRANSPORT_REJECTED`、`Failed to fetch` | `13-package-grant-state.png` |
| 进入画布 | 直接访问 canonical 路由 | 页面和画布壳可见 | 只能加载占位镜头，服务连接失败 | `14-video-canvas-runtime.png` |
| 节点检查 | 查看右侧 Inspector | 可见提示词、类型、锁定、删除和禁用生成 | 未加载八镜 | `15-node-inspector.png` |
| 记忆 | 点击画布内“记忆” | 世界记忆区可见 | canonical 只读，实体为 0，因为 API 未加载 | `16-memory-workspace.png` |
| 画布素材 | 点击“素材” | 素材库和定位入口可见 | 只有加载占位项 | `17-canvas-assets.png` |
| 平台后台 | 切换 platform 身份 | 组织树、产品、额度、回执摘要可见 | 全部为 Mock | `18-platform-admin.png` |

## 3. 用户流程断点

| 断点 | 页面表现 | 技术原因 | 是否代码错误 |
|---|---|---|---|
| 企业进入生产 | tenant 点击生产路由会被 403 | 工作台守卫只允许 production | 是当前产品交接设计断点，不是异常崩溃 |
| Package 接收 | `Failed to fetch` | `10588` 未运行 | 环境依赖；本次按限制未启动 migration-capable API |
| 画布加载 | 只显示 1 个加载占位镜头 | canonical Package 未被 API 接受 | 上游断点导致 |
| 角色创建 | 无可达页面 | 角色组件未加入 `navItems` | 产品信息架构断点 |
| 最终导出 | `playable=false` | 无 ExportReceipt 和 approved Asset | 正确门禁，但完整交付未跑通 |

## 4. 截图目录

`docs/video-canvas-audit/screenshots/`

截图均来自本次无付费运行；没有用历史成功截图替代当前失败状态。

