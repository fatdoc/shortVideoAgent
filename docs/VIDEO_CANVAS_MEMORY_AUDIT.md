# 视频画布记忆功能审计

## 1. 两套记忆

| 类型 | 保存内容 | 范围 | 存储 | 实际使用 |
|---|---|---|---|---|
| Agent 对话记忆 | 用户消息、Agent 回复、摘要、Embedding | `isolationKey`隔离的会话/项目 | SQLite `memories` | 进入 Script/Production 决策 Agent Prompt |
| Continuity 记忆 | 项目视觉规则、实体、版本、状态、镜头契约、关系、参考、审核 | 项目和镜头 | `sc_continuity_*`等结构化表 | 进入 legacy MVP 图片/视频 `resolvedPrompt` |

## 2. Agent 对话记忆

核心：`apps/storycanvas/src/utils/agent/memory.ts`、`embedding.ts`。

```text
用户消息
-> Agent route 取得 isolationKey
-> Memory.add() 写 memories 和 Embedding
-> Memory.get() 查询 shortTerm/summaries/rag
-> buildMemPrompt()
-> runDecisionAI() 调用 u.Ai.Text()
-> 可选 runAgent()
-> 子 Agent 结果和最终回复再次 Memory.add()
```

当前限制：短期 5 条、摘要 10 条、RAG 3 条、深度检索摘要 5 条、每 10 条消息摘要、摘要最长 500。

结构示例来自真实表字段和写入代码；当前 `memories`表为空：

```json
{
  "id": "<uuid>",
  "isolationKey": "<projectId>:scriptAgent[:episodesId]",
  "type": "message",
  "role": "user",
  "name": null,
  "content": "<用户输入>",
  "embedding": "[<float>, ...]",
  "relatedMessageIds": null,
  "summarized": 0,
  "createTime": 1785660000000
}
```

业务判断：它是真实进入文本决策的上下文记忆，但不是结构化角色/服装/道具/场景记忆，也不会直接进入图片或视频模型。

## 3. Continuity 记忆

核心：`apps/storycanvas/src/services/storycanvas/continuityMemory.ts:resolveShotContext()`。

```text
项目视觉规则 + 实体 + 实体版本
-> 镜头契约 + 镜头关系 + 参考绑定
-> resolveShotContext()
-> 校验 contextRevision
-> resolvedPrompt
-> createMvpGenerationTask()
-> u.Ai.Image() / u.Ai.Video()
```

`resolvedPrompt`包含项目规则、实体标准、当前外观、开始状态、必须保持项、动作、摄影、切镜关系、当前任务和禁止变化规则。

当前只读数据证据：

| 表 | 数量 |
|---|---:|
| `sc_continuity_profiles` | 1 |
| `sc_entities` | 3 |
| `sc_entity_versions` | 3 |
| `sc_shot_contracts` | 8 |
| `sc_shot_relations` | 7 |
| `sc_reference_bindings` | 6 |
| `sc_world_events` | 0 |
| `sc_continuity_reviews` | 0 |
| `sc_tasks` | 0 |

实体为 `haidilao-brand`、`sanlitun-store`、`member-rights`，没有真实人物角色服装连续性数据。

实际结构示例：

```json
{
  "profile": {
    "revision": 1,
    "style": {
      "visualStyle": "写实本地生活短视频",
      "aspectRatio": "9:16",
      "platform": "抖音",
      "store": "海底捞火锅·北京三里屯店"
    },
    "rules": ["不得承诺绝对最低价", "权益以门店实际规则为准"]
  },
  "shotContract": {
    "entitySlugs": ["haidilao-brand", "sanlitun-store"],
    "mustPreserve": ["海底捞品牌身份", "三里屯门店上下文"],
    "requiredState": {
      "haidilao-brand.visible": true,
      "sanlitun-store.location": "北京市朝阳区三里屯商圈"
    }
  }
}
```

## 4. 对十五个记忆问题的回答

| 问题 | 结论 |
|---|---|
| 保存什么 | 对话文本/摘要/Embedding；结构化项目、实体、状态、契约、关系、参考 |
| 级别 | 对话按 isolationKey；Continuity 按项目/镜头 |
| 存储 | SQLite `memories`和 `sc_*`表 |
| 谁写入 | Agent Memory、Package Adapter、Continuity API、世界事件逻辑 |
| 何时读取 | Agent 决策前；MVP 生成任务创建前 |
| 哪些模型使用 | 文本决策使用对话记忆；legacy 图片/视频使用 Continuity |
| 如何拼 Prompt | `buildMemPrompt()`和 `resolveShotContext().resolvedPrompt` |
| 自动更新 | 对话会追加和摘要；世界事件当前为 0，不能证明持续更新 |
| 用户编辑 | Agent 配置页可查看/清理；canonical Continuity UI 为只读 |
| 删除 | 有 clear/delAll 接口；精细删除和业务影响不完整 |
| 角色/场景/道具/风格 | Continuity Schema 支持 entity type 和 style；当前数据主要是品牌/门店/权益 |
| 角色服装 | Schema 可放外观，当前数据没有可验证人物服装记录 |
| 镜头前后状态 | Schema 和关系支持；`world_events=0`，实际闭环未证明 |
| 上下文增长 | 摘要缓解，但 shortTerm/summaries/rag 可重复，仍有增长和重复成本 |
| 旧记忆污染 | 摘要不会自动修正过期事实，存在污染风险 |
| 保存未使用 | 对话记忆不直接进入图/视频；canonical 不调用真实生成，因此存在认知断点 |

## 5. 风险

- 当前消息可能同时进入短期、RAG和正式 user message。
- shortTerm、summaries、rag缺少可靠去重。
- 旧摘要不会因新事实自动失效。
- 子 Agent只收到决策 Agent整理的任务，可能丢失上下文。
- 摘要和深度检索本身会产生文本模型费用。
- WebSocket `isolationKey`与 `projectId`的强绑定无法确认。
- 当前 canonical 只读且不调用真实模型，无法验证 Continuity 对最终画面的效果。

