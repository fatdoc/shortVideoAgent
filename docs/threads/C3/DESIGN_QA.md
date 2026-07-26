# C3 DESIGN QA · Wave 2.5 Round 2

## Comparison Target

- Source：`UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (3).png`
- Source pixels：`1672×941`
- Route：`/projects/demo-local-001/brand`
- Implementation：`/tmp/c3-round2-final-1672x941.jpg`
- Comparison：`/tmp/c3-round2-final-comparison.png`
- Content comparison：`/tmp/c3-round2-final-content-comparison.png`
- Responsive：`/tmp/c3-round2-final-1440x900.jpg`

## Measured Result

- `1672×941`：`scrollWidth = clientWidth = 1672`
- Dashboard grid：`x=237, y=304, width=1402`
- Columns：约 `416 / 550 / 416px`
- Merchant panel：`x=237, y=304, width=416, height=431`
- Facts panel：`x=237, y=745, width=416`
- `1440×900`：`scrollWidth = clientWidth = 1440`，无横向裁切

## Required Surfaces

- 顶部标题 / 品牌选择 / 导出 / 编辑 / 更多：通过
- 四个紧凑指标：通过
- 五 Tab 信息架构：通过
- 首屏三列比例与纵向起点：通过
- 商家资料真实品牌视觉：通过
- 套餐、事实语料、禁用词、老板 IP、引用记录、风险提醒同屏密度：通过
- 海底捞三里屯业务文案：通过
- Store / LocalStorage、事实保存、进入脚本：通过

## Issue Ledger

- [P1][closed] 通用店铺图标不符合品牌视觉：改为参考图裁取的海底捞 Logo
- [P1][closed] 首屏三列比例与参考图偏差：改为 `1 / 1.322 / 1`
- [P1][closed] 套餐 / 事实 / IP / 引用 / 风险未形成同屏讲解密度：重构为三列面板
- [P2][closed] 商家卡过短导致事实区提前约 32px：商家卡对齐 `431px`，事实区对齐 `y=745`
- [P2][closed] 禁用词与 IP 分栏比例偏差：改为约 `1.25 / 0.95`
- [P2][closed] 缺少老板真实人物视觉：改为参考图裁取的张勇头像

## Interaction Evidence

- 五 Tab：品牌规则、商品套餐、IP人物记忆、事实库、商家资料均返回 `aria-selected=true`
- 编辑保存：商家名称保存后 Store 更新；浏览器抽屉关闭
- 自动化：事实状态保存与进入脚本均通过
- Brief CTA：跨 Brand / Script smoke 通过，品牌页记忆位于首屏以下，不影响参考图首屏

## Residual External Scope

- 全局深色 shell 与图 3 浅色 shell 不同，属于禁止修改的公共范围，见 `REQ-C3-002`
- 主包 chunk warning 延续既有 R-006

## final result

passed
