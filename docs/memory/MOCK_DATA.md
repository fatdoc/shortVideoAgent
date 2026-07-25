# Mock 数据说明 · MOCK DATA

## 主数据文件

`src/mocks/demoWorkspace.ts`

## 持久化

- Key：`videoagent:mvp:v1`
- 实现：`src/services/storage.ts`
- API：`src/services/mockApi.ts`（带延迟）

## 统一项目

- id：`demo-local-001`
- name：海底捞火锅·北京三里屯店探店视频

## 预设内容摘要

- Brand facts：C1—C8
- Scripts：A/B/C 三版，默认 A
- Storyboard：8 镜
- Assets：8 条（含待补拍/缺镜）
- Timeline：基础 clips + QA 状态

## 素材状态对照

| 素材 | status |
|---|---|
| 门店外景 | matched |
| 服务员迎接 | matched |
| 锅底特写 | matched |
| 毛肚特写 | matched |
| 虾滑制作 | reshoot |
| 用餐环境 | matched |
| 会员权益 | missing |
| 门店夜景 | matched |

## 规则

1. 禁止业务线程复制另一份主 Mock
2. 页面内临时 UI state 可以本地 useState
3. 需要新增字段/实体：走 REQUESTS
4. reset 必须回到 `cloneDemoWorkspace()`
