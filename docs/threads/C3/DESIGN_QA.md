# C3 DESIGN QA · Wave 2.5

## Comparison Target

- Source visual truth：`UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (3).png`
- Source pixels：1672×941
- Implementation route：`/projects/demo-local-001/brand`
- Implementation screenshot：`/tmp/c3-after-1672x941.png`
- Implementation pixels：1672×941
- CSS viewport：1672×941
- Density normalization：source 与 implementation 均按 1672×941、1:1 像素尺寸比较
- State：统一 Demo，默认“商家资料”Tab，未保存修改为 false

## Evidence

- Full-view comparison：`/tmp/c3-reference-vs-implementation.png`
- Focused merchant / facts comparison：`/tmp/c3-reference-vs-implementation-facts.png`
- Responsive evidence：`/tmp/c3-after-1440x900.png`
- 1672×941：`scrollWidth = clientWidth = 1672`
- 1440×900：`scrollWidth = clientWidth = 1440`
- Primary interactions：事实库 Tab、商家资料 Tab、编辑抽屉、商家名称输入、保存资料、保存成功态
- Console：最终刷新后 0 条新增 error

## Required Fidelity Surfaces

- Fonts and typography：沿用项目冻结的中文无衬线体系；标题、辅助文字、表头、正文层级与图 3 接近；事实内容不再逐字竖排
- Spacing and layout rhythm：顶部操作区、四指标、五 Tab、三列正文均使用 10—12px 紧凑节奏；轻边框与 8—10px 圆角取代超高卡片
- Colors and visual tokens：使用冻结主色 `#1677FF`，绿 / 橙 / 红承载确认、待复核与风险状态
- Image quality and asset fidelity：仓库无参考图 Logo / 人物照片，按用户资产约束使用仓库已安装 Ant Design 图标；未新增手绘、生成或占位图片，已提交 `REQ-C3-003`
- Copy and content：保留 C1—C8、套餐、人物 IP、禁用词、引用、风险及统一 Demo 文案，不复制或改写主数据
- Responsiveness：1440×900 三列仍完整，无页面横向裁切；1320 以下降为两列，1024 以下降为单列

## Comparison History

### Iteration 1 · Spark Baseline

- [P1] 事实表被放入等宽三分之一列，标题与事实内容逐字竖排
- Evidence：事实面板宽 427px、页面 `scrollHeight = 4797`
- [P1] 默认“事实语料”Tab 将商家、套餐、IP、禁用词、引用和风险拆散，首屏与图 3 信息架构不一致
- Fix：默认改为“商家资料”，使用左 1.08 / 中 1.4 / 右 0.96 三列；事实表改为固定紧凑列宽与两行截断

### Iteration 2 · Post-fix

- Evidence：事实面板宽 426px 时内容横向可读；页面 `scrollHeight = 1307`
- Evidence：1672×941 与 1440×900 均无 document 横向溢出
- Evidence：同屏展示商家、套餐、事实、禁用词、IP、引用与风险
- Result：C3 所有权范围内无剩余 P0 / P1 / P2

## Residual P3 / External Scope

- 公共深色侧栏与顶部 breadcrumb 不同于图 3 的浅色 shell，已提交 `REQ-C3-002`
- 真实 Logo / 人物头像资产缺失，已提交 `REQ-C3-003`
- 生产 bundle 约 1.29MB，沿用 R-006

## final result

passed
