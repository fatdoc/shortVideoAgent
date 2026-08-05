# A-05 数字员工窗口启动包

本目录是 `A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md` 的可执行启动包。

## Wave 1 窗口

| 窗口 | 任务                                    | 启动文件                       | 状态         |
| ---- | --------------------------------------- | ------------------------------ | ------------ |
| P0   | C01 Pilot Contract v0.2                 | `P0_CONTRACT_V02_START.md`     | 主窗口执行   |
| A2   | A03 Project / Brief / Script / Approval | `A2_PROJECT_WORKFLOW_START.md` | 待创建新窗口 |
| B2   | B02 Storage + B03 Image                 | `B2_STORAGE_IMAGE_START.md`    | 待创建新窗口 |
| F1   | F01 Pilot API Adapter / Auth UI         | `F1_REAL_API_ADAPTER_START.md` | 待创建新窗口 |

## 统一规则

- 启动基线：`codex/pilot-v0-control-plane` 的最新 G0 Checkpoint。
- 模型/推理按项目级 `docs/program/README.md` 执行。
- 每个窗口只做启动文件指定的一个任务节点。
- 窗口不直接合并 `main`，不推送，不覆盖其他窗口文件。
- 交付状态只能是 `READY_FOR_GATE` 或 `BLOCKED`；`ACCEPTED` 由 P0 评审。
- 外部凭据不得写入代码、测试、文档、日志或交付文本。
