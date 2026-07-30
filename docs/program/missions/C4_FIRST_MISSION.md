# C4 首轮任务书 · 控制平面架构 v0.1

## 前置

先吸收 C1/C3 提案；未决字段使用 `PROPOSED`，不得自行冻结。

## 任务

1. 绘制控制平面领域上下文和聚合根。
2. 提出 tenant/organization/project 授权模型。
3. 定义项目生产包、短期项目令牌、任务回执和用量回执 API 草案。
4. 设计上游 Key 托管、下游平台 Key、审计和幂等。
5. 给出 Demo Mock → 商业 MVP → 生产服务的演进路线。

## 输出

架构提案、数据字典、API 草案、安全边界、迁移计划和 Request。

## 验收

SaaS 不读 StoryCanvas SQLite；前端不持有上游 Key；不先造复杂微服务。
