# Design QA · 六页 UI 复刻终验

- 日期：2026-07-26
- 验收人：C0
- 目标：按 `UI/` 中 6 张参考图复刻可讲解的前端交互 Demo
- 视口：`1672 × 941`
- 状态：统一案例 `demo-local-001`，脚本 A，分镜 8 镜，初剪 5 轨

## 同尺寸全画布证据

| 页面 | 参考图 | 实现截图 | 同画布对照 |
|---|---|---|---|
| 工作台 | `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (1).png` | `docs/audits/ui-alignment-2026-07-26/01-dashboard-integration-v3.png` | `docs/audits/ui-alignment-2026-07-26/01-dashboard-comparison-v3.png` |
| Brief | `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (2).png` | `docs/audits/ui-alignment-2026-07-26/02-brief-integration-v2.png` | `docs/audits/ui-alignment-2026-07-26/02-brief-comparison-v2.png` |
| 品牌大脑 | `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (3).png` | `docs/audits/ui-alignment-2026-07-26/03-brand-integration-v2.png` | `docs/audits/ui-alignment-2026-07-26/03-brand-comparison-v2.png` |
| 脚本 | `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (4).png` | `docs/audits/ui-alignment-2026-07-26/04-script-integration-v2.png` | `docs/audits/ui-alignment-2026-07-26/04-script-comparison-v2.png` |
| 分镜 | `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (5).png` | `docs/audits/ui-alignment-2026-07-26/05-storyboard-integration-v2.png` | `docs/audits/ui-alignment-2026-07-26/05-storyboard-comparison-v2.png` |
| 初剪 | `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (6).png` | `docs/audits/ui-alignment-2026-07-26/06-rough-cut-integration-v2.png` | `docs/audits/ui-alignment-2026-07-26/06-rough-cut-comparison-v2.png` |

以上实现截图均实测为 `1672 × 941`。各业务线程另保留 `1440 × 900` 无横向裁切证据。

## 聚焦证据

- Dashboard / Brief：`docs/threads/C2/evidence/`
- 品牌：`docs/threads/C3/DESIGN_QA.md`
- 脚本：`docs/threads/C4/DESIGN_QA.md`
- 分镜：`docs/threads/C5/design-qa.md`
- 初剪：`docs/threads/C6/DESIGN_QA.md`

## 迭代记录

1. 首轮否决：旧实现存在深色壳层、单案例空白工作台、缺少步骤条、品牌/脚本首屏密度不足、分镜蓝色占位、初剪时间线空轨。
2. 第二轮修复：统一浅色 shell；工作台补 5 KPI、5 案例和下半屏模块；Brief 改五步紧凑布局；品牌/脚本改三栏首屏；分镜与初剪换真实餐饮图片。
3. C0 集成复核：补齐工作台参考 KPI、初剪五轨内容、跨页 CTA 语义与最新 smoke 契约。
4. 干净浏览器会话实走：`Dashboard → Brief → Script → Storyboard → Rough Cut`，播放按钮进入“暂停”，console error 为 0。

## 缺陷分级结论

- P0：0
- P1：0
- P2：0
- P3：保留统一 Mock 案例数量/时间等演示数据差异；构建仍有既有 large-chunk warning，不影响演示。

## 工程门禁

- `npm run test -- --maxWorkers=1`：13 files / 61 tests PASS
- `npm run lint`：PASS
- `npm run build`：PASS
- `npm run validate:governance`：PASS
- 干净浏览器主链路：PASS，console error 0

final result: passed
