# A-BIZ-02.1 · Terms 版本、发布与 Public Current 计划

> 日期：2026-08-07
> 分支：`dev/business-plane`
> 基线：`db103f3 feat(workbench): add pilot page handoff contract`
> 状态：`A_BIZ_02_1_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`

## 1. 目标与顺序

A-BIZ-02 必须按 `Terms → Invitation → Registration` 推进。本节点先建立服务端 Terms 事实源，使后续注册事务能够在数据库事务内重新读取当前发布版本并 fail closed。

本节点只完成：

- `TermsDocument`、`TermsVersion`、`UserConsent` 的通用 Schema 与生命周期；
- Terms Repository / Service；
- Public current Terms API；
- PLATFORM `platform_admin` 管理与发布 API；
- 状态机、权限、并发、审计和错误合同测试。

本节点不完成：

- 正式用户须知正文、正式 document code、locale 或法务审批；
- Invitation、Registration 或注册页面；
- 真实支付、计费、额度或佣金；
- Demo/LocalStorage Terms fallback；
- B 的 StoryCanvas 或生产页面改动。

正式正文和发布审批仍为 TBD。TBD 只阻塞正式 Terms 发布与公开注册放量，不阻塞通用底座开发。

## 2. 冻结领域模型

### 2.1 TermsDocument

```text
terms_document_id uuid PK
document_code text（大小写不敏感唯一，非空）
title text（非空）
status active | retired
created_at / updated_at timestamptz
```

规则：

- `document_code` 是稳定业务标识，创建后不可修改；
- `active → retired` 为单向状态；
- Document 有 Version 后不得删除；
- migration 不写入任何正式或占位 Document。

### 2.2 TermsVersion

```text
terms_version_id uuid PK
terms_document_id uuid FK
version_label text
status DRAFT | PUBLISHED | RETIRED
content text
content_digest text（SHA-256 lowercase hex）
locale text
published_at timestamptz nullable
effective_at timestamptz nullable
published_by uuid nullable FK users
supersedes_terms_version_id uuid nullable self FK
must_reaccept boolean
created_at / updated_at timestamptz
```

规则：

- 同一 Document + locale 下 `version_label` 唯一；
- DRAFT 可编辑正文、digest、locale、版本号、生效时间和 `must_reaccept`；
- `content_digest` 必须等于 UTF-8 正文 SHA-256，不接受空正文、空 digest 或伪造 digest；
- 状态只允许 `DRAFT → PUBLISHED → RETIRED`；
- PUBLISHED 必须有 `published_at`、`effective_at`、`published_by`；DRAFT 不得伪造发布证据；
- PUBLISHED 后正文、digest、locale、版本号、生效时间、发布人、替代关系和 `must_reaccept` 均不可修改；
- PUBLISHED/RETIRED Version 不得删除；
- `supersedes_terms_version_id` 必须属于同一 Document 与 locale，且不能指向自身；
- 同一 Document + locale + effectiveAt 的 PUBLISHED Version 唯一，避免 current 选择歧义；
- 允许未来生效的 PUBLISHED Version 与当前版本同时存在；current 由服务端选择 `effective_at <= now()` 中 effectiveAt 最新者，不能用“唯一 PUBLISHED”约束破坏预发布能力；
- 旧 PUBLISHED Version 即使仍保留发布证据，也不是 current，注册使用旧版本必须由 Service 拒绝。

### 2.3 UserConsent

```text
user_consent_id uuid PK
user_id uuid FK
terms_version_id uuid FK
content_digest_snapshot text
accepted_at timestamptz
acceptance_context text
registration_id uuid nullable（02.3 再补 FK）
evidence_metadata jsonb
created_at timestamptz
```

规则：

- 只允许引用 PUBLISHED/RETIRED 的历史发布版本，不允许引用 DRAFT；
- digest snapshot 必须等于 Version digest；
- `accepted_at`、`acceptance_context` 和 evidence 必须显式提供；
- UserConsent append-only，禁止 UPDATE/DELETE；撤回、再次同意或升级另建事件；
- `registration_id` 先保存 UUID 关联键，不提前创建 Registration 表；02.3 创建 Registration 后再用独立 migration 增加 FK；
- 不在普通列保存原始密码、Token、Cookie、Authorization Header；IP/User-Agent/设备证据的必要性和保存期限未会签前只允许调用方传入已批准的最小 JSON evidence，Service 层严格白名单化。

## 3. Migration 011 与回滚边界（02.1A）

新增：

```text
apps/control-api/src/db/migrations/011_terms_versioning.ts
apps/control-api/src/db/termsVersioning.postgres.test.ts
```

PostgreSQL 合同至少覆盖：

1. Document code 大小写不敏感唯一、非空，code 创建后不可修改；
2. Document 状态只允许 active/retired，retired 不可恢复；
3. Version 状态、非空正文和 SHA-256 digest 一致性；
4. DRAFT 可编辑，发布证据必须与状态一致；
5. 状态只允许 DRAFT → PUBLISHED → RETIRED；
6. PUBLISHED 字段不可原地修改，PUBLISHED/RETIRED 不可删除；
7. 同 Document + locale 的版本号唯一；
8. PUBLISHED effectiveAt 不得产生 current 选择歧义；
9. supersedes 只能指向同 Document/locale 且不能自引用；
10. Consent 不接受 DRAFT 或错误 digest；
11. Consent append-only；
12. migration 001～011 从空库加载及 replay no-op；
13. down migration 在存在 PUBLISHED/RETIRED Version 或 Consent 时 fail closed；仅无审计事实时允许删除空底座。

先新增测试并确认因 migration/表缺失产生有效 RED，再实现最小 migration。

## 4. Repository / Service（02.1B）

候选文件：

```text
apps/control-api/src/terms/types.ts
apps/control-api/src/terms/errors.ts
apps/control-api/src/terms/digest.ts
apps/control-api/src/terms/repository.ts
apps/control-api/src/terms/service.ts
apps/control-api/src/terms/*.test.ts
```

冻结能力：

- 创建 Document；
- 创建 DRAFT；
- 编辑 DRAFT；
- 发布 Version；
- Retire Version / Document；
- 读取 Public current；
- 后续 Registration 在同一事务内校验 current version 与 digest；
- 写入 append-only Consent。

服务规则：

- 所有写操作使用事务；发布同 Document + locale 时使用数据库锁，避免并发产生歧义；
- 发布请求只接受有效 PLATFORM `platform_admin` Actor；
- 发布是幂等操作：相同 Version 的相同发布命令返回同一结果，冲突 payload 返回稳定 409；
- current 选择固定为：Document active、Version PUBLISHED、locale 精确匹配、`effective_at <= asOf`，按 `effective_at DESC, published_at DESC, terms_version_id DESC`；数据库唯一约束保证前两项时间不产生业务歧义；
- 无 current 返回稳定 `TERMS_NOT_AVAILABLE`，不得回退 DRAFT、RETIRED、旧 locale、Demo 或硬编码正文；
- 生产 migration、bootstrap 和测试 fixture 不写正式用户须知。

## 5. HTTP API（02.1C）

冻结路径：

```text
GET   /api/v1/public/terms/current?documentCode=...&locale=...
POST  /api/v1/platform/terms/documents
POST  /api/v1/platform/terms/documents/:documentId/versions
PATCH /api/v1/platform/terms/versions/:versionId
POST  /api/v1/platform/terms/versions/:versionId/publish
POST  /api/v1/platform/terms/versions/:versionId/retire
```

边界：

- Public current 不依赖登录，但必须显式提交 `documentCode` 与 `locale`；
- Public 响应只返回注册展示所需字段：document/version ID、code、title、label、locale、content、digest、effectiveAt、mustReaccept；不返回发布者、内部审计或 Consent 统计；
- 管理 API 只接受有效 PLATFORM Context 的 `platform_admin`；无 Session 为 401，非 PLATFORM/无权限为 403；
- 无 current 返回 `503 TERMS_NOT_AVAILABLE`，供后续 Registration 统一 fail closed；
- 非法输入 400，资源不存在 404，状态/幂等冲突 409，未知错误 500；
- Terms Router 独立于 Tenant Project Router，不复用 Project Scope；
- `createApp()` 的共享 bootstrap 改动作为 02.1C 独立小提交，并通知 B。

## 6. Test-first 与提交切片

### Commit 1：计划冻结

```text
docs(business-plane): freeze terms versioning plan
```

### Commit 2：02.1A Schema

```text
feat(control-api): add terms versioning schema
```

Gate：定向 PostgreSQL、migration chain、Control API 全量单 worker、typecheck、build、Prettier、ESLint、`git diff --check`。

### Commit 3：02.1B Domain / Service

```text
feat(control-api): add terms publishing service
```

Gate：current 选择、发布权限调用边界、并发/幂等、stale 和 Consent 合同。

### Commit 4：02.1C HTTP API / bootstrap

```text
feat(control-api): expose terms management api
```

Gate：Public current、401/403/404/409/503/5xx、日志敏感字段、Control API 全量和 root 相关回归。

### Commit 5：02.1 收口记忆（如不随切片同步）

```text
docs(business-plane): close terms versioning slice
```

每个提交只暂存明确文件，禁止 `git add .`。

## 7. 文件边界与 B 协作

A 可修改：

```text
apps/control-api/src/db/migrations/011_terms_versioning.ts
apps/control-api/src/db/*terms*.test.ts
apps/control-api/src/terms/**
apps/control-api/src/app.ts                    # 仅 02.1C 独立共享提交
apps/control-api/src/app.test.ts               # 仅 02.1C
apps/control-api/src/db/migrationChain.postgres.test.ts
docs/program/threads/C0/**
```

A 不修改：

```text
apps/storycanvas/**
src/features/storycanvas/**
src/pages/production/IntegratedStoryCanvasPage*
src/pages/script-editor/**
src/pages/storyboard/**
src/components/script/**
src/components/storyboard/**
```

`apps/storycanvas/data/vendor/byteplus.ts` 是 B 的未跟踪运行时文件，继续不修改、不删除、不暂存、不提交。

02.1A/02.1B 不触碰 B 共享面；02.1C 如修改 `apps/control-api/src/app.ts`，单独提交并通知 B 同步该 commit。

## 8. 完成标准

A-BIZ-02.1 只有同时满足以下条件才收口：

- migration 011 与全 migration chain 通过；
- DRAFT 可编辑、PUBLISHED immutable、状态机与 supersedes Scope 由数据库和 Service 双层保护；
- Public current 只返回当前可用发布版本；无版本明确 fail closed；
- 只有 PLATFORM `platform_admin` 可以管理和发布；
- UserConsent append-only 且 digest 可审计；
- 无正式/占位条款进入 migration、bootstrap 或生产默认值；
- 定向、Control API 全量、root 相关 Gate、TypeScript、Build、Lint、Prettier、Governance 和 diff check 通过；
- C0 状态、CHANGELOG 与桌面知识库同步；
- B 独占目录 tracked diff 为零，B 未跟踪文件保持原样。

## 9. 下一步

计划独立提交后进入 02.1A：先写 PostgreSQL 合同测试并确认 RED，再实现 migration `011_terms_versioning.ts`。02.1A 完成并独立提交后，可连续进入 02.1B；只有出现数据库环境、未批准业务口径或共享集成冲突时暂停报告。
