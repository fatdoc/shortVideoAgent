# FireRed Patches

固定上游：`04297707e7607dd398e906262235d0797068e7b4`。

## 当前状态

阶段 0 **没有修改 FireRed 核心代码**。`upstream/FireRed-OpenStoryline` 保持干净的 Git submodule。

唯一兼容处理位于 StoryCanvas 集成目录：

- `integrations/openstoryline/requirements.constraints.txt` 固定 `langgraph-prebuilt==1.0.8`。
- 原因：requirements 的合法解析结果 1.0.9/1.0.10 在运行时导入不存在的 `langgraph.runtime.ExecutionInfo`。
- 该处理只影响本地环境，不改变上游 requirements、Demo 或 API。

## 后续补丁规则

- 优先在 Toonflow Adapter/Wrapper 解决。
- 必须修改 FireRed 时，使用独立 integration 分支并在此记录文件、原因、测试和回退方法。
- 不删除原有端点，不破坏原生 Web Demo。
- 可以上游贡献的问题优先提交独立 PR，StoryCanvas 继续固定已验证 Commit。

