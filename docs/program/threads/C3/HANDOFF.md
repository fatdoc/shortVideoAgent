# C3 HANDOFF

- 状态：READY_FOR_C0_REVIEW
- 基线：Program Gate T0；`/Users/docfat/.codex/worktrees/4506/videoagent`；detached HEAD `d2357eb`
- 分支/提交：未创建分支，未提交（遵循首轮任务约束）
- 已完成：
  - `docs/program/specs/C3_CREDIT_PRICING_SETTLEMENT_V0_1.md`
  - AI 视频额度、RateCard、五层价格和价格快照
  - Wallet、CreditLot、append-only CreditLedger 及九类动作
  - 批发差价、结算对账、异常规则和三个完整算例
- 未完成：
  - C1/C4 会签与 C0 批准
  - Capability/SKU 正式计量值
  - 真实售价、支付、税务、开票和会计规则
- 合同版本：兼容 `INTEGRATION_CONTRACT.md` v0.1；未修改公共合同
- 影响范围：仅 C3 商业计量规格和 C3 独立线程记忆
- 风险：真实资金与客户承诺仍需用户、财务和法务批准；详见 `REQUESTS.md`
- 验证证据：已核对必读治理、历史 Gate、冻结合同和算例算术；按任务要求未运行测试
- 下游第一步：C1 确认转拨边界，C4 将本规格映射为控制平面数据/API，C0 审核并冻结 T1 语义
