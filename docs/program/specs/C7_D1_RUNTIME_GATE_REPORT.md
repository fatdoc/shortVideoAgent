# C7 D1 Runtime Gate Report

> 日期：2026-07-30
>
> Static Gate：`GO`
>
> Runtime Gate：`GO_FOR_INTERNAL_DEMO`
>
> 缺陷：`P0=0 / P1=0 / P2=0`

## 1. 验证结果

| Gate | 结果 | 证据 |
|---|---|---|
| SaaS tests | PASS | 43/43 |
| SaaS lint | PASS | ESLint |
| SaaS build | PASS | TypeScript + Vite production build |
| Governance | PASS | `validate:governance` |
| StoryCanvas core tests | PASS | 35/35，通过 Node 22 + tsx 执行同一测试清单 |
| StoryCanvas typecheck | PASS | `yarn lint` |
| StoryCanvas frontend tests | PASS | 9/9 canonical grant-first tests |
| StoryCanvas frontend build | PASS | Vite production build |
| StoryCanvas root build | PASS | frontend、sanitize、backend、Electron main |
| HTTP package | PASS | `201`, canonical project/package |
| Handoff | PASS | request/grant/ready，父窗 `handoff_ready` |
| Success settlement | PASS | 120 reserved，100 consumed，20 released |
| Failure settlement | PASS | 80 reserved，0 consumed，80 released |
| Receipt Outbox | PASS | 4/4 `acknowledged` |
| Wrong project | PASS | `403 PROJECT_SCOPE_MISMATCH` |
| FALLBACK playback | PASS | HTTP 200、`video/mp4`、浏览器播放 readyState 4 |
| Reset | PASS | 0/5、available 1000、reserved 0 |
| Visual width | PASS | 1672×941、1440×900、1280×720 无页面横向溢出 |

## 2. 运行中关闭的问题

1. `window.fetch` 未绑定导致浏览器 `Illegal invocation`。
   - 修复：Bridge 默认 fetch 绑定 `globalThis`。
2. StoryCanvas 全局旧 JWT 中间件先于 production grant 路由返回 401。
   - 修复：仅白名单 `/api/production/v0.1/`；该前缀继续由显式 project-scoped grant 校验。
3. 子窗首次 grant request 与父窗监听存在竞态。
   - 修复：子窗在未收到 grant 时每 500ms 重发同一 canonical request，收到 grant 立即停止。
4. 深链下 StoryCanvas Logo 相对路径破图。
   - 修复：改用仓库已有 `/media/storycanvas-logo.png`。
5. StoryCanvas 前端测试仍断言 legacy “南城咖啡”路径。
   - 修复：改为 9 项 canonical grant-first、scope、成功/失败和 FALLBACK 测试。

## 3. Runtime 事实

```text
package HTTP: 201
projectId: demo-local-001
packageId: package-demo-local-001-v1
handoff: handoff_ready
tasks: 2
acknowledged receipts: 4
artifact: 1, playable=true
wrong project: 403 PROJECT_SCOPE_MISMATCH
media: 2,155,679 bytes
media SHA-256: 55370297920ad6f957a3bbcdb4cbdc2ff088ba7594062a07c589b7a6db3727ef
```

完整机器可读记录见 `docs/program/evidence/d1-runtime-evidence.json`。

## 4. 环境说明

- StoryCanvas 原工作目录中的 SQLite 保留了早期旧 Brief package，正确返回 `IDEMPOTENCY_CONFLICT`；未删除、未覆盖该数据。
- 最终完整证据使用 `/tmp` 隔离数据目录和当前 main fixture，代码、模型与前端均来自当前工作树。
- 内置浏览器会清除跨源 `_blank` 子窗 opener，因此保留 timeout/fail-closed 证据；正常 Chromium popup 完成 request/grant/ready。
- StoryCanvas 官方 `yarn test` 受本机 Electron 安装二进制影响；同一测试文件清单通过 Node 22 + tsx 执行并取得 35/35。

## 5. Truth 边界

- 本报告批准内部 Demo，不批准生产发布。
- Demo task/asset 为 `MOCK-CONTRACT`，真实生成统计为 0。
- FALLBACK 为 `SELF_GENERATED_SYNTHETIC / DEMO_ONLY / 非 REAL`。
- Technical QA passed 不等于 editorial QA 或 brand QA。
- 120/100/20/80 为演示额度，不是人民币、供应商 token 或正式报价。
