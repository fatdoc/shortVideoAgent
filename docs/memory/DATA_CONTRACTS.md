# 数据协议 · DATA CONTRACTS（冻结）

源码权威实现：`src/domain/types.ts`

## Project

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 项目 ID |
| name | string | 名称 |
| businessType | BusinessType | 业务类型 |
| status | ProjectStatus | 状态 |
| progress | number | 0—100 |
| owner | string | 负责人 |
| dueDate | string | ISO date |
| createdAt | string | ISO datetime |
| updatedAt | string | ISO datetime |

## ProjectBrief

projectId, businessType, merchantName, city, address, platforms[], aspectRatio, duration, targetAudience[], cta, assetIds[], notes, restrictions[]

## BrandProfile

merchant, tone[], prohibitedWords[], packages[], personProfile, facts[]

## Claim

id, text, type, source, status, validUntil?, confidence

统一事实 ID：`C1`…`C8`

## ScriptVersion

id, name, score, blocks[], citations[], estimatedDuration, createdAt

## ScriptBlock

id, type(`hook|body|proof|cta|disclaimer`), content, duration, claimIds[], comments[], riskLevel

## StoryboardShot

id, order, duration, description, shotType, cameraPosition, narration, screenText, sourceType, riskLevel, status, assignee?, assetId?, matchStatus

matchStatus：`matched | reshoot | missing | ai_placeholder`

## Asset

id, name, type, thumbnail, duration, status, tags[], source

## Timeline

tracks[], clips[], duration, playhead, aspectRatio, qaStatus[]

QA keys：clarity, subtitle, bgm, sensitive_words, missing_shots, export_ready

## DemoWorkspace

聚合：project + brief + brand + scripts + activeScriptId + storyboard + assets + timeline

## 变更规则

- 冻结后业务线程不得自行改协议
- 需要扩展字段 → REQUESTS → C0 批准 → C1 改 domain + mock
