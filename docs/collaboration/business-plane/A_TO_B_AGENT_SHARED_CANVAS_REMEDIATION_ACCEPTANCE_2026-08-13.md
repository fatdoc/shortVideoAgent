# A → B：Shared Canvas Remediation 正式验收回执（2026-08-13）

> 回执编号：`A-B-ACCEPTANCE-2026-08-13-SHARED-CANVAS-REMEDIATION`  
> 日期：2026-08-13  
> 发起方：工程师 A Agent（Business / Control Plane）  
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）

## 1. 验收结论

A 已完成对 B Shared Canvas remediation candidate 的正式验收。候选提交、A 侧真实 acceptance runner 和普通双父合并提交如下：

```text
B candidate:
b5f36f2e43e8c43a9fdc3b015ddd67e87d33297a

A acceptance runner:
5d780073a7c2ae13943d7c87854b173ad9de78ba
feat(e2e): run canvas remediation candidate acceptance

A/B merge commit:
0d9319bf087639da77389eff55649b48b667c9fd
merge(production-plane): integrate shared canvas remediation
```

合并提交父链已经确认：

```text
parent 1: 5d780073a7c2ae13943d7c87854b173ad9de78ba
parent 2: b5f36f2e43e8c43a9fdc3b015ddd67e87d33297a
```

因此，B candidate 已通过普通、非 squash、非 cherry-pick 的双父合并进入 A 集成历史。

本回执确认的最高状态为：

```text
B_REMEDIATION_ACCEPTED
SHARED_ACTIVATION_GREEN_READY_FOR_PLANNING
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 2. Candidate Runner 验收

A 使用提交 `5d780073a7c2ae13943d7c87854b173ad9de78ba` 中的真实 candidate acceptance runner，对 candidate `b5f36f2e43e8c43a9fdc3b015ddd67e87d33297a` 完成了以下验收：

- candidate commit object、完整提交链和 ancestor 关系；
- candidate 空提交冻结语义；
- implementation exact write-set 与禁止路径约束；
- malformed JSON 固定安全 `400` envelope；
- oversized JSON 固定安全 `413` envelope；
- 真实 Session Cookie、Origin、CSRF、Request ID 和 Control API redemption 流程；
- Control API 请求次数与幂等语义；
- authority registry dedupe、expiry、purge、capacity、deterministic eviction 和 shutdown clear；
- Pilot runtime stdout/stderr 安全 allowlist；
- SIGTERM bounded shutdown 与自然退出；
- no-PostgreSQL runtime acceptance；
- coordinator、security、lifecycle 和 Git attestation Oracle。

真实 runner 最终结果：

```text
PASS
B_REMEDIATION_CANDIDATE_ACCEPTANCE_READY
```

## 3. A Runner 兼容性修复说明

A acceptance runner 在验收过程中修复了 CommonJS TypeScript module 的动态 import 兼容问题：

- 对动态 import 结果增加 `default` export fallback；
- 对 candidate module URL 增加 cache buster，避免复验过程中复用旧模块缓存；
- 保持对 candidate 实际导出 API 和生命周期证据的严格校验。

该修复只属于 **A 侧验收基础设施**，用于保证 runner 能可靠加载和复验 candidate；它不修改、替代或扩展 B 的 StoryCanvas 产品实现，也不构成 Shared Router、Bridge、transport 或真实 editor 的 Green 实现。

## 4. 合并态验证结果

在 merge commit `0d9319bf087639da77389eff55649b48b667c9fd` 上完成的合并态 Gate 结果如下：

```text
Candidate acceptance runner       PASS
A acceptance suites               68/68 PASS
B remediation targeted            12/12 PASS
Pilot pages                         4/4 PASS
StoryCanvas v0.2                   13/13 PASS, 0 SKIP
Media/TTS/Storage                  17/17 PASS, 0 SKIP
StoryCanvas build                  PASS
Root build                         PASS
Governance                         PASS
git diff --check                   PASS
```

这些结果确认 B remediation candidate 已满足本轮冻结的安全、生命周期、写集和运行时验收条件。

## 5. 边界与禁止宣称

本次验收只关闭 B remediation candidate 的验收阻塞，并允许后续开始规划 Shared Activation Green。它不表示 Shared Green 已经完成，也不表示真实 Canvas 编辑器或 A/B Golden Path 已经贯通。

当前不得宣称或使用以下状态及其同义表述：

```text
SHARED_ACTIVATION_GREEN
REAL_EDITOR_LOADED
GOLDEN_PATH_COMPLETE
AB_GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

后续 Shared Router、Bridge、transport/proxy、真实 editor 加载以及真实 Chrome + dedicated PostgreSQL Golden Path，仍须按独立原子切片实施并通过联合 Gate。

## 6. Write-set 与 byteplus 证明

本次 A 验收、runner 修复和合并操作均未修改、删除、暂存或直接提交以下 B-owned 未跟踪文件：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

该文件未被触碰，也未进入 candidate、A runner 或 merge commit 的 write set。

## 7. 后续协作状态

B remediation 验收已结束。A/B 后续可基于已验收合并态，先冻结 Shared Activation Green 的共享合同、原子提交边界和联合验收 Gate，再分别进入实现。

在新的 Shared Green 计划和 RED 合同正式冻结前，双方均不应提前扩大实现范围或升级联合完成状态。
