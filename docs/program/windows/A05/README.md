# A-05 数字员工窗口启动包

本目录是 `A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md` 的可执行启动包。

## Wave 1 窗口

| 窗口 | 任务                                    | 启动文件                       | 状态                                                   |
| ---- | --------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| P0   | C01 Pilot Contract v0.2                 | `P0_CONTRACT_V02_START.md`     | `IN_PROGRESS` · 数字员工 `c01_contract_v02`             |
| A2   | A03 Project / Brief / Script / Approval | `A2_PROJECT_WORKFLOW_START.md` | `ACCEPTED` · 集成提交 `8e1c61e`                         |
| B2   | B02 Storage + B03 Image                 | `B2_STORAGE_IMAGE_START.md`    | B02 `ACCEPTED` · `40e4ab6`；B03 `BLOCKED`               |
| F1   | F01 Pilot API Adapter / Auth UI         | `F1_REAL_API_ADAPTER_START.md` | `ACCEPTED` · 集成提交 `9e2cec1`                         |

B03 的 `BLOCKED` 仅指真实付费图片 smoke 尚缺 C01 合同 Gate、`ARK_API_KEY` 与 TOS 运行配置；不影响已接受的 B02 远程存储能力。

## Wave 2 当前窗口

| 窗口 | 任务                              | 状态                                      |
| ---- | --------------------------------- | ----------------------------------------- |
| P0   | C01 合同冻结与集成 Gate           | `IN_PROGRESS` · 数字员工 `c01_contract_v02` |
| B3   | B05 TTS Adapter / Task 接入骨架   | `B3_VIDEO_TTS_TASK_START.md` · `IN_PROGRESS` · `b03_tts_task` |
| A3   | A05 Production Package / Grant    | `A3_PACKAGE_GRANT_START.md` · 等待 C01 `ACCEPTED` 后启动      |
| Q1   | Package/Grant/Task 跨平面合同测试 | `Q1_CONTRACT_GATE_START.md` · 等待 C01 `ACCEPTED` 后启动      |

## 统一规则

- 启动基线：`codex/pilot-v0-control-plane` 的最新 G0 Checkpoint。
- 模型/推理按项目级 `docs/program/README.md` 执行。
- 所有窗口强制执行 `docs/program/A05_OPEN_SOURCE_FIRST_POLICY.md`，优先复用成熟开源和官方 SDK。
- 每个窗口只做启动文件指定的一个任务节点。
- 窗口不直接合并 `main`，不推送，不覆盖其他窗口文件。
- 交付状态只能是 `READY_FOR_GATE` 或 `BLOCKED`；`ACCEPTED` 由 P0 评审。
- 外部凭据不得写入代码、测试、文档、日志或交付文本。
