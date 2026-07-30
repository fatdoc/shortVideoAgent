# StoryCanvas AI 阶段 1 开发报告

执行日期：2026-07-20  
阶段：模型配置层  
状态：完成

## 交付结果

- 新增 `config/models.json`，配置 LLM、主/备图片和视频模型角色。
- 新增严格 Zod Schema、加载器、供应商种子、Agent 绑定和启动初始化。
- `openai`、`volcengine` 已写入现有供应商体系并启用。
- 16 个文本 Agent 已绑定 `openai:gpt-5.2`。
- OpenAI Vendor 已支持 `gpt-image-2` 文生图和参考图编辑。
- 新增 `models:seed`、`models:doctor` 命令。
- 修复数据库启动初始化的循环依赖，应用现在显式等待数据库就绪。

## 安全边界

- `config/models.json` 只保存环境变量名，不保存密钥值。
- 种子过程不会把环境变量中的 API Key 值写入 SQLite。
- 运行时按能力、供应商和模型注入密钥。
- 诊断输出只显示“已配置/缺失”，不输出 Key。
- 默认诊断为 dry-run，不触发收费图片或视频请求。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `yarn test` | 7/7 通过 |
| `yarn lint` | 通过 |
| `yarn build` | 通过 |
| `yarn models:seed` | 通过 |
| `yarn models:doctor` | 通过，缺 Key 项安全跳过 |
| 生产后端启动 | 通过 |
| 默认账号登录 | HTTP 200 |
| FireRed 离线降级 | 健康接口 HTTP 200，状态 `offline` |

## 未执行项

- 尚未配置 `LLM_API_KEY`、`OPENAI_API_KEY`、`ARK_API_KEY`。
- 未执行真实 LLM、图片或视频付费调用。
- FireRed MCP 仍缺 TransNet 大型权重。

## 下一步

进入阶段 2：实现统一领域 Zod Schema、11 张 `sc_*` 表的事务型 Migration、checksum/回滚测试和安全媒体目录服务。阶段 2 不删除、不重命名任何上游 `o_*` 表或列。
