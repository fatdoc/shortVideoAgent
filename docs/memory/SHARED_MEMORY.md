# SHARED MEMORY · 权威共同记忆

> 仅 C0 可修改。C1—C7 只读。  
> 更新时间：2026-07-26（Gate1 验收后）  
> 当前 Gate：Gate 1（已通过，可启动 C2/C3/C4）

## 项目目标

打造「短视频营销 Agent」前端可交互 MVP，演示企业级 AI 短视频生产工作台完整业务流程。

## MVP 定位

- B 端 SaaS 前端交互 Demo
- 产品业务流程演示系统
- 后续真实产品的前端基础
- 前端 + Mock，无生产级后台

## 首期业务范围

工作台 → 新建项目 → Brief → 品牌/商家大脑 → 脚本生成与编辑 → 分镜与拍摄清单 → 素材中心 → 初剪预览 → QA → 导出预览

## 首期 6 个页面

1. 工作台 / 项目列表 — C2 — `/dashboard`
2. 新建项目 / Brief — C2 — `/projects/new`
3. 品牌 / 商家大脑 — C3 — `/projects/:projectId/brand`
4. 脚本生成与编辑 — C4 — `/projects/:projectId/script`
5. 分镜 / 拍摄清单 — C5 — `/projects/:projectId/storyboard`
6. 素材中心 / 初剪预览 — C6 — `/projects/:projectId/rough-cut`

审核与导出：抽屉 / 弹窗 / 初剪右侧面板，不单独做复杂页。

## 明确不做

真实登录、多租户、后端数据库、大模型调用、ASR/OCR、FFmpeg、真实转码渲染、专业 NLE、关键帧、数字人、声音克隆、自动发布、真实计费、复杂权限、原生移动端、投放归因与经营数据回流。

## 技术栈（冻结）

React · TypeScript · Vite · Ant Design · React Router · Zustand · Recharts · dnd-kit · react-dropzone · LocalStorage · Vitest · RTL · Playwright · ESLint · Prettier

禁止子线程更换核心技术栈。

## UI 风格（冻结）

- 白底、蓝色主色 `#1677FF`
- 状态色：青/绿/橙
- 卡片化、轻阴影、中高信息密度
- 左侧导航 + 顶部工具栏
- 现代 B 端 SaaS
- 禁止：海报风、数据大屏、赛博朋克、过度玻璃拟态

## 统一 Demo 项目（冻结）

| 字段 | 值 |
|---|---|
| ID | `demo-local-001` |
| 名称 | 海底捞火锅·北京三里屯店探店视频 |
| 业务类型 | 本地探店 |
| 负责人 | 张晓明 |
| 平台 | 抖音 |
| 比例 | 9:16 |
| 时长 | 30 秒 |
| CTA | 领取团购券 / 到店核销 |

事实编号 C1—C8、分镜 01—08、素材状态见 `DEMO_STORY.md`。

## 路由（冻结）

见 `ROUTES.md`。

## 数据闭环（冻结）

Brief → Script → Storyboard → Assets → Rough Cut → QA  
详见 `INTERACTION_FLOW.md` 与 `DATA_CONTRACTS.md`。

## 文件所有权

见 `docs/tasks/FILE_OWNERSHIP.md`。

核心规则：

- SHARED_MEMORY 仅 C0
- domain / 统一 Mock / 全局路由主题 仅 C0/C1
- 业务线程只改自己的 pages/components
- 跨模块需求走 REQUESTS

## 当前 Gate

**Gate 1：PASS（APPROVE_MERGE）**

- C1 基座已验收：六路由、Store、LocalStorage、公共三态可用
- 功能 Commit：`8432b6b0c71cb2b7746e5b5c544e8aa1aebcac14`
- 报告：`docs/tasks/GATE_1_REPORT.md`
- 下一波：并行 C2 / C3 / C4（Wave 2）

## 当前阻塞

无阻塞。风险见 `RISKS_AND_BLOCKERS.md`。

## 完成标准（Gate 0）

- 治理文档齐全且非空
- C0—C7 ROLE 齐全
- C1—C7 START 可复制
- 数据协议与路由冻结
- UI 参考图已映射
- 前端骨架可 install / lint / build / test
- `validate:governance` 通过

## 最新决策

7. 2026-07-26 Gate1：C1 基座 APPROVE_MERGE，允许启动 C2/C3/C4。

1. 使用 npm + Vite React TS
2. 统一 Demo 项目 ID = `demo-local-001`
3. 业务页 Gate 0 仅占位，不提前做完整交互
4. LocalStorage key = `videoagent:mvp:v1`
5. UI 参考图保留在 `UI/`，不改名不修改像素

## 当前风险

- UI 参考图文件名含空格与特殊字符，引用时需注意路径编码
- Playwright 浏览器二进制可能未预装，e2e 可能需额外 `npx playwright install`
- 多线程并行前需 C1 先交付基座
