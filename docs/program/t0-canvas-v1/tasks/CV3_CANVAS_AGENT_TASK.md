# CV3 · Canvas Agent 工程师任务书

> 员工：`CV3`
> 任务 ID：`T0-CV1-03`
> 前置：`G2 ACCEPTED`
> 目标 Gate：`G4 Agent`
> 初始状态：`NOT_STARTED`

## 1. 任务目标

实现 LibTV 风格 Creator + Agent 双入口中的 Agent 侧，但 Agent 只能通过已经验收的 Canvas Command Service 工作，不能拥有更高权限。

## 2. 独占写集

```text
apps/storycanvas/src/agents/canvas-v1/**
apps/storycanvas/data/skills/canvas-v1/**
apps/storycanvas/src/agents/canvas-v1/*.test.ts
```
如需要向 Command Service 增加能力，提交 `REQ-T0CV1-CV3-*` 给 CV2/CV0，不直接修改 CV2 文件。

## 3. 首日 Agent 能力

工具白名单：

```text
list_project_assets
inspect_asset_readiness
analyze_script_entities
propose_missing_assets
create_virtual_character
sync_provider_asset
bind_asset_to_entity
generate_shot
get_generation_task
select_shot_output
save_canvas_document
export_playlist              # 仅 capability 可用时
```

Agent 流程：

```text
读取批准脚本/分镜安全投影
→ 提取人物/场景/商品/品牌要求
→ 检查项目资产
→ 提出缺失资产计划
→ 等待用户批准高成本/权利相关动作
→ 调用 CanvasCommand
→ 查询任务
→ 返回安全状态
```

## 4. 人工批准点

以下动作必须停下等待用户明确确认：

- 创建真实收费图片/视频任务；
- 使用或更换真人/虚拟人物身份；
- 接受新的权利声明；
- 批量生成多个镜头；
- 选择输出覆盖当前成片版本；
- 导出或发布。

## 5. Agent 安全边界

Agent 不得：

- 访问数据库；
- 直调 Seedance/Seedream/BytePlus；
- 获取 Provider Group/Asset URI、Token、Grant、Digest、Package snapshot；
- 把普通真人照片标为已认证；
- 绕过 `ShotReadiness`；
- 修改批准脚本/分镜事实；
- 自动执行全部视频生产；
- 使用旧 Production Agent 的 Demo/MVP 工具；
- 把 provider raw body 输出到消息或日志。

## 6. 测试

先写 RED：

1. 缺失资产只提出计划，不生成；
2. readiness false 时 `generate_shot` 被阻止；
3. 高成本命令缺用户确认被阻止；
4. Agent 和 UI 产生相同 CanvasCommand schema；
5. 工具参数跨 tenant/project 被拒绝；
6. 工具输出无 secret/forbidden markers；
7. response-loss replay 不重复生成；
8. Agent 无法调用白名单外工具。

## 7. 原子提交

```text
CV3-A test(agent): freeze canvas agent tool policy
CV3-B feat(agent): add asset analysis and readiness tools
CV3-C feat(agent): add approved canvas command tools
CV3-D docs(agent): publish G4 evidence and limitations
```

## 8. G4 验收

- UI/Agent command fixture 字节级/语义一致；
- readiness/rights/cost 三层门禁通过；
- 无直接 Provider/DB 访问；
- Agent 输出安全；
- Agent 可完成“分析→缺失计划→确认→指定镜头任务”的受控流程；
- 不宣称完整自动视频生产。

## 9. 启动提示词

```text
你是 CV3，T0-CV1 Canvas Agent 工程师。G2 未被 CV0 标记 ACCEPTED 前不要写
Agent 实现。开工时报告配置、worktree、branch、baseline、Master Plan 版本、
exact write set/no-write set 和计划 RED。

实现 LibTV 风格 Creator + Agent 双入口中的 Agent 侧。Agent 只能调用冻结的
Canvas Command Service，不能直连数据库、Provider 或内部 URI。首日只支持资产
分析、缺失计划、虚拟人物创建、同步/绑定、指定镜头生成、任务查询和结果选择。
高成本、人物身份、批量生成和导出必须等待用户确认。

严格遵守 Master Plan 通用提示词，不修改 CV2/CV5/UI/Router/Bridge/byteplus.ts，
按 RED→GREEN→回归形成原子提交并申请 G4。
```
