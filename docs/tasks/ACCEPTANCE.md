# 统一验收标准 · ACCEPTANCE

## 代码要求

- TypeScript 无错误（`tsc -b` / build）
- lint 通过
- build 通过
- 测试通过（相关范围）
- 无明显控制台错误
- 不越权修改目录
- 不复制公共主数据

## UI 要求

- 1440×900 下布局完整
- 与 UI 参考图风格一致
- 颜色、间距、圆角、阴影统一
- 关键按钮有 hover / loading / disabled
- 有空状态、加载状态、错误状态

## 交互要求

- 关键按钮不是静态摆设
- 点击后有状态变化
- 页面之间数据一致
- 刷新后核心数据保留
- 主流程可以走通

## 线程交付要求

- 更新 STATUS
- 更新 HANDOFF
- 更新 CHANGELOG
- REQUESTS 已处理或明确记录
- 提供 Commit Hash

## Gate 专用

### Gate 0
治理完整 + 骨架可运行 + validate:governance 通过

### Gate 1
基座完成，六路由与 store 可用

### Gate 2
C2/C3/C4 主交互可用且数据一致

### Gate 3
C5/C6 连通，时间线与素材状态一致

### Final
C7 测试 + Demo Checklist + C0 签核
