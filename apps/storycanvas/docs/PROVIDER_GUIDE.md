# Provider Guide

## 原则

- UI 只选择逻辑 Provider，不直接调用第三方。
- API Key 不进入渲染进程、SQLite 明文、日志或 Git。
- Provider 返回统一 `GenerationResult`，所有响应经 Zod 校验。
- Mock 是默认可运行路径，自动测试禁止收费调用。

## 现状

Toonflow 已有可编程供应商机制：`o_vendorConfig`、`data/vendor/*.ts`、`src/utils/vendor.ts`，覆盖 OpenAI Compatible、DeepSeek、Qwen、Gemini、Claude 及图片/视频供应商。阶段 1 在其上增加稳定的领域接口，而不是重写整套供应商系统。

## 目标接口

```ts
interface TextModelProvider {
  generateCreativeBrief(input: unknown): Promise<CreativeBrief>;
  generateScript(input: unknown): Promise<ScriptVersion>;
  generateStoryboard(input: unknown): Promise<Shot[]>;
  reviseContent(input: unknown): Promise<unknown>;
}

interface VideoModelProvider {
  textToVideo(input: VideoGenerationInput): Promise<GenerationResult>;
  imageToVideo(input: VideoGenerationInput): Promise<GenerationResult>;
  getTaskStatus(taskId: string): Promise<GenerationResult>;
  cancelTask?(taskId: string): Promise<void>;
}
```

图片、TTS、ASR 使用同样的 `submit/status/cancel` 思路。

## 第一阶段 Provider

- `MockTextProvider`：固定餐饮探店 Brief、脚本和 8 个分镜。
- `MockImageProvider`：生成带分镜编号的 9:16 占位图。
- `MockVideoProvider`：用 FFmpeg 生成短静态测试片段并模拟进度。
- OpenAI-Compatible 文本/图片示例。
- Custom HTTP 图片/视频示例；端点和字段通过设置配置。

## 配置与密钥

健康检查环境变量：

```bash
export OPENSTORYLINE_BASE_URL=http://127.0.0.1:7860
export OPENSTORYLINE_MCP_URL=http://127.0.0.1:8001/mcp
export OPENSTORYLINE_TIMEOUT_MS=2000
```

FireRed 真正剪辑还需要其 LLM/VLM 六个配置项：model、base_url、api_key 各两组。开发阶段优先环境变量，产品阶段改用 Electron `safeStorage`/系统钥匙串并把引用传给受控子进程。

## 重试与成本

- 查询：指数退避，默认 3 次。
- 创建/生成：必须有 `idempotencyKey`，重试前先查状态。
- 成本由 Provider 返回用量后计算；预估与实际分开保存。
- 取消失败不能伪装成功，任务进入可继续查询的中间状态。

