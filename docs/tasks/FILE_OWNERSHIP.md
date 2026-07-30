# 文件所有权 · FILE OWNERSHIP

## 项目级治理

| 路径 | Owner | 其他员工 |
|---|---|---|
| `docs/program/COMMON_MEMORY.md` | C0 | 只读，可提 Request |
| `docs/program/PROJECT_CHARTER.md` | C0 | 只读 |
| `docs/program/ARCHITECTURE.md` | C0（C4/C5 提案） | 只读 |
| `docs/program/INTEGRATION_CONTRACT.md` | C0（C4/C5 会签） | 只读 |
| `docs/program/employees/**` | C0 | 只读 |
| `docs/program/missions/**` | C0 | 只读 |
| `docs/program/threads/C{n}/**` | C{n} | 只读 |
| `docs/program/templates/**` | C0 | 只读 |
| `docs/threads/**`、Gate 报告 | 历史 Owner | 保留，不覆盖历史证据 |

## 商业 SaaS 仓库

| 范围 | 主要 Owner | 规则 |
|---|---|---|
| 租户/渠道规格与未来模块 | C1 | 与 C3/C4 会签 |
| 场景 Agent、能力和产品规格 | C2 | 与 C3/C6 会签 |
| 钱包、额度、订单和结算规格/未来模块 | C3 | 与 C1/C4 会签 |
| `src/domain`、公共 Store/Service/Mock、权限/API 适配 | C4 | 公共协议需 C0 批准 |
| 现有业务 Demo 页面和跨系统体验 | C6 | 不自行改业务语义 |
| `src/tests`、`tests`、发布清单 | C7 | 业务修复走 Request |
| `UI/**` | 只读资产 | 任何员工禁止修改 |

## StoryCanvas 仓库

- 主要 Owner：C5。
- 路径：`/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent`。
- C5 保留现有成果，只做增量修改。
- C4/C6/C7 不直接修改 StoryCanvas 核心代码；通过 Request 与合同协作。

## 冲突处理

发现冲突或意外改动后停止写入，记录 Request，由 C0 指定唯一写入人。禁止 reset、checkout 或覆盖他人成果。
