# BytePlus 独立 TTS 端口

## 当前结论

- 现有 `ARK_API_KEY` 服务于海外 ModelArk 图片/视频调用，不等同于独立 TTS 权限。
- Seedance 的可选生成音轨与“按脚本文本单独合成配音”是两种能力。
- 仓库尚无可核验的 BytePlus TTS 官方协议、SDK 或已开通账号样例，因此不猜测 URL、请求体和鉴权字段。
- 独立 TTS 默认关闭；没有已注册协议 Transport 时，Readiness 必须保持阻断。

## 已实现边界

`src/services/storycanvas/byteplusTts.ts` 提供：

- 供应商无关的 TTS 输入、音频结果与 Transport 端口；
- 显式 `BYTEPLUS_TTS_ENABLED` / `BYTEPLUS_TTS_PROTOCOL` 门禁；
- 由已核验 Transport 声明凭据环境变量，Readiness 只返回变量名、不返回值；
- 同一幂等键并发合并、不同载荷冲突阻断、可重试错误释放重试；
- 鉴权、权限、限流、超时、服务不可用和非法响应的稳定错误码；
- `onStarted` / `onSucceeded` / `onFailed` Hooks，后续可接 `sc_tasks` 或冻结后的 C01 任务合同。

旧的火山供应商模板不再把空字符串当作 TTS 成功结果，而是明确返回 `TTS_PROTOCOL_UNVERIFIED`。通用 `Ai.Audio` 同样不再吞掉异常或保存空音频。

## 接入真实协议的验收门槛

拿到已开通的 BytePlus TTS 产品信息后，再新增一个 `BytePlusTtsTransport`：

1. 协议来源必须是 BytePlus 官方文档、官方 SDK 或经批准的公开实现，并登记版本和许可证。
2. Transport 自己声明 `requiredEnvironment`，真实值只进入服务端环境。
3. 必须把 `idempotencyKey` 传给供应商的幂等字段；如果供应商不支持，需在任务存储层建立持久化幂等记录。
4. 必须验证 MP3/WAV 实际音频、请求 ID、超时、限流、无权限和重复请求。
5. 真实付费 Smoke 必须由人工显式开启，不能由 Readiness 或自动测试触发。

## 当前环境变量

```text
BYTEPLUS_TTS_ENABLED=false
BYTEPLUS_TTS_PROTOCOL=
```

协议专属的 App ID、Token、Cluster、Resource ID 或签名密钥字段，必须按实际开通产品的官方合同确定；当前代码不会凭经验猜字段。
