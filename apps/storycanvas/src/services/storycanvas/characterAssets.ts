import crypto from "node:crypto";
import sharp from "sharp";
import u from "@/utils";
import { db } from "@/utils/db";
import { loadModels, resolveModelTarget } from "@/config/loadModels";
import {
  createBytePlusImageAsset,
  getBytePlusAsset,
  getBytePlusAssetConfig,
  getBytePlusAssetGroup,
  hasBytePlusAssetConfig,
  listBytePlusAssets,
  toAssetUri,
  waitForBytePlusAsset,
  type BytePlusAssetItem,
} from "./byteplusAssets";
import {
  getBytePlusTosUploadTarget,
  resolveBytePlusTosTarget,
  uploadBytePlusAssetSource,
} from "./byteplusTos";
import { ensureMvpProject } from "./mvpGeneration";
import { getMvpContinuityWorkspace } from "./continuityMemory";
import { persistCharacterAssetBinding } from "./characterAssetBinding";

export type CharacterImageModel = "seedream" | "image2";

export interface CharacterProfile {
  name: string;
  age: string;
  height: string;
  bodyType: string;
  style: string;
  personality: string;
  appearance: string;
  wardrobe: string;
  setting: string;
}

export interface CreateCharacterInput {
  profile: CharacterProfile;
  imageModel: CharacterImageModel;
  referenceImage?: string;
  additionalPrompt?: string;
  idempotencyKey: string;
}

export interface UploadCharacterInput {
  profile: CharacterProfile;
  image: string;
  idempotencyKey: string;
}

interface MediaAssetRow {
  id: string;
  projectId: number;
  type: string;
  source: string;
  originalName: string | null;
  mimeType: string;
  byteSize: number;
  localPath: string;
  remoteUrl: string | null;
  width: number | null;
  height: number | null;
  provider: string | null;
  prompt: string | null;
  sha256: string;
  rightsNote: string | null;
  metadataJson: string;
  createdAt: string;
}

interface CharacterTaskRow {
  id: string;
  projectId: number;
  taskType: string;
  provider: string;
  status: string;
  progress: number;
  inputJson: string;
  outputJson: string | null;
  errorJson: string | null;
  idempotencyKey: string;
  externalTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CharacterMetadata {
  profile?: CharacterProfile;
  generationModel?: string;
  remoteAssetId?: string;
  groupId?: string;
  assetUri?: string;
  remoteStatus?: string;
  sourceType?: "generated" | "uploaded" | "remote";
}

interface CharacterTaskOutput {
  characterAssetId?: string;
  remoteAssetId?: string;
  previewPath?: string;
  model?: string;
}

const CHARACTER_TASK_TYPE = "mvp_character_asset_generation";

function parseJson<T>(source: string | null | undefined, fallback: T): T {
  if (!source) return fallback;
  try {
    return JSON.parse(source) as T;
  } catch {
    return fallback;
  }
}

function now() {
  return new Date().toISOString();
}

function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function decodeDataImage(value: string): { buffer: Buffer; mimeType: string } {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error("上传内容不是有效的 PNG、JPEG 或 WebP 图片。");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) throw new Error("上传图片为空。");
  if (buffer.length > 30_000_000) throw new Error("上传图片不能超过 30 MB。");
  return {
    buffer,
    mimeType: match[1].toLowerCase().replace("image/jpg", "image/jpeg"),
  };
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

async function downloadImage(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`角色设定板下载失败（HTTP ${response.status}）。`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("角色设定板下载结果为空。");
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return {
    buffer,
    mimeType: contentType.startsWith("image/") ? contentType : "image/jpeg",
  };
}

export function buildCharacterBoardPrompt(profile: CharacterProfile, additionalPrompt = "") {
  const sections = [
    "请创作一张高完成度的「电影级角色设定板」。",
    `角色名称：${profile.name}`,
    `年龄：${profile.age || "根据参考图合理设定"}`,
    `身高：${profile.height || "根据角色比例合理设定"}`,
    `体型：${profile.bodyType || "自然、符合角色身份"}`,
    `风格方向：${profile.style || "电影级风格化写实"}`,
    `性格关键词：${profile.personality || "克制、真实、有故事感"}`,
    `外貌特征：${profile.appearance || "严格继承参考图的人物身份与独特记忆点"}`,
    `服装设定：${profile.wardrobe || "符合角色职业与社会身份，所有角度严格一致"}`,
    `场景气质：${profile.setting || "电影项目角色开发提案"}`,
    "",
    "生成影视或动画项目开发用的高级角色提案板，不是普通三视图。",
    "版面必须包含：一张主视觉角色立像；正面、3/4、侧面、背面、3/4背面的全身转面；正面、3/4、侧面、低头、抬头、动态角度的头部研究；一张电影感情绪肖像；服装与配件拆解；少量角色名、身高刻度、材质与性格标注。",
    "横版大画幅，中性灰或浅灰提案板背景；不要规则网格，不要机械对称，构图略带不对称并具有美术指导感。",
    "角色像真实演员被电影镜头捕捉，而不是摆拍模特。所有角度的五官、身材比例、发型、服装必须严格一致；皮肤、布料、金属、皮革材质真实。整张图高级、清晰、专业，具备电影感、角色感、故事感和高一致性。",
    additionalPrompt.trim(),
  ];
  return sections.filter(Boolean).join("\n");
}

async function generateSeedreamCharacterBoard(input: CreateCharacterInput) {
  const models = await loadModels();
  const target = resolveModelTarget(models.image.fallback);
  if (!target.apiKey) throw new Error(`缺少 ${models.image.fallback.apiKeyEnv}，无法生成虚拟人物。`);

  const body: Record<string, unknown> = {
    model: target.model,
    prompt: buildCharacterBoardPrompt(input.profile, input.additionalPrompt),
    response_format: "url",
    watermark: false,
    sequential_image_generation: "disabled",
    size: "2848x1600",
  };
  if (input.referenceImage) body.image = input.referenceImage;

  const response = await fetch(`${target.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${target.apiKey.replace(/^Bearer\s+/i, "")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const raw = await response.text();
  let payload: {
    data?: Array<{ url?: string; error?: { code?: string; message?: string } }>;
    error?: { code?: string; message?: string };
  } = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`虚拟人物生成失败（HTTP ${response.status}）：模型返回了非 JSON 响应。`);
  }
  if (!response.ok || payload.error) {
    const providerError = payload.error;
    throw new Error(`虚拟人物生成失败（HTTP ${response.status}）：${providerError?.code ? `${providerError.code}: ` : ""}${providerError?.message || "未知错误"}`);
  }
  const item = payload.data?.find((candidate) => candidate.url);
  if (!item?.url) {
    const itemError = payload.data?.find((candidate) => candidate.error)?.error;
    throw new Error(`虚拟人物生成失败：${itemError?.message || "模型没有返回图片地址"}`);
  }
  return {
    url: item.url,
    model: `${target.vendor}:${target.model}`,
    prompt: String(body.prompt),
  };
}

async function generateImage2CharacterBoard(input: CreateCharacterInput) {
  const models = await loadModels();
  const target = resolveModelTarget(models.image.primary);
  if (!target.apiKey) throw new Error(`缺少 ${models.image.primary.apiKeyEnv}，无法使用 Image 2 生成虚拟人物。`);

  const prompt = buildCharacterBoardPrompt(input.profile, input.additionalPrompt);
  const requestFields = {
    model: target.model,
    prompt,
    size: "1536x1024",
    quality: "high",
    output_format: "png",
  };
  let response: Response;
  if (input.referenceImage) {
    const decoded = decodeDataImage(input.referenceImage);
    const form = new FormData();
    for (const [key, value] of Object.entries(requestFields)) form.append(key, value);
    form.append(
      "image",
      new Blob([new Uint8Array(decoded.buffer)], { type: decoded.mimeType }),
      `character-reference.${extensionForMime(decoded.mimeType)}`,
    );
    response = await fetch(`${target.baseUrl}/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.apiKey.replace(/^Bearer\s+/i, "")}`,
      },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
  } else {
    response = await fetch(`${target.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.apiKey.replace(/^Bearer\s+/i, "")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestFields),
      signal: AbortSignal.timeout(180_000),
    });
  }

  const raw = await response.text();
  let payload: {
    data?: Array<{ url?: string; b64_json?: string; error?: { code?: string; message?: string } }>;
    error?: { code?: string; message?: string };
  } = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Image 2 虚拟人物生成失败（HTTP ${response.status}）：模型返回了非 JSON 响应。`);
  }
  if (!response.ok || payload.error) {
    throw new Error(
      `Image 2 虚拟人物生成失败（HTTP ${response.status}）：`
      + `${payload.error?.code ? `${payload.error.code}: ` : ""}`
      + `${payload.error?.message || "未知错误"}`,
    );
  }
  const item = payload.data?.find((candidate) => candidate.url || candidate.b64_json);
  if (item?.url) {
    return {
      url: item.url,
      model: `${target.vendor}:${target.model}`,
      prompt,
    };
  }
  if (item?.b64_json) {
    const buffer = Buffer.from(item.b64_json, "base64");
    if (!buffer.length) throw new Error("Image 2 返回了空图片。");
    return {
      buffer,
      mimeType: "image/png",
      model: `${target.vendor}:${target.model}`,
      prompt,
    };
  }
  const itemError = payload.data?.find((candidate) => candidate.error)?.error;
  throw new Error(`Image 2 虚拟人物生成失败：${itemError?.message || "模型没有返回图片数据"}`);
}

function generateCharacterBoard(input: CreateCharacterInput) {
  return input.imageModel === "image2"
    ? generateImage2CharacterBoard(input)
    : generateSeedreamCharacterBoard(input);
}

async function persistMediaAsset(
  projectId: number,
  buffer: Buffer,
  mimeType: string,
  options: {
    name: string;
    source: "generated" | "uploaded" | "remote";
    prompt?: string;
    remoteUrl?: string;
    remoteAssetId?: string;
    remoteStatus?: string;
    generationModel?: string;
    profile: CharacterProfile;
  },
) {
  const sha256 = hashBuffer(buffer);
  const existing = await u.db<MediaAssetRow>("sc_media_assets").where({ projectId, sha256 }).first();
  const metadata = await sharp(buffer).metadata();
  const assetId = existing?.id || crypto.randomUUID();
  const extension = extensionForMime(mimeType);
  const localPath = existing?.localPath || `/mvp/${projectId}/characters/${assetId}.${extension}`;
  if (!existing) await u.oss.writeFile(localPath, buffer);

  const groupId = hasBytePlusAssetConfig() ? getBytePlusAssetConfig().groupId : undefined;
  const metadataJson = JSON.stringify({
    ...parseJson<CharacterMetadata>(existing?.metadataJson, {}),
    profile: options.profile,
    generationModel: options.generationModel,
    remoteAssetId: options.remoteAssetId,
    groupId,
    assetUri: options.remoteAssetId ? toAssetUri(options.remoteAssetId) : undefined,
    remoteStatus: options.remoteStatus || (options.remoteAssetId ? "Active" : "Local"),
    sourceType: options.source,
  } satisfies CharacterMetadata);

  if (existing) {
    await u.db("sc_media_assets").where({ id: existing.id }).update({
      originalName: `${options.name}.${extension}`,
      remoteUrl: options.remoteUrl || existing.remoteUrl,
      provider: options.remoteAssetId ? "byteplus-modelark" : existing.provider,
      prompt: options.prompt || existing.prompt,
      width: metadata.width || existing.width,
      height: metadata.height || existing.height,
      metadataJson,
    });
  } else {
    await u.db("sc_media_assets").insert({
      id: assetId,
      projectId,
      type: "character",
      source: options.source,
      originalName: `${options.name}.${extension}`,
      mimeType,
      byteSize: buffer.length,
      localPath,
      remoteUrl: options.remoteUrl || null,
      thumbnailPath: null,
      durationMs: null,
      width: metadata.width || null,
      height: metadata.height || null,
      fps: null,
      provider: options.remoteAssetId ? "byteplus-modelark" : "local",
      prompt: options.prompt || null,
      sha256,
      rightsNote: "由用户上传或授权生成，仅用于当前 StoryCanvas 项目。",
      metadataJson,
      createdAt: now(),
    });
  }

  if (options.remoteAssetId) {
    const mapping = await u.db("sc_external_mappings")
      .where({ system: "byteplus-modelark", entityType: "character-asset", localId: assetId })
      .first();
    const mappingValues = {
      externalId: options.remoteAssetId,
      metadataJson: JSON.stringify({ groupId, assetUri: toAssetUri(options.remoteAssetId) }),
    };
    if (mapping) {
      await u.db("sc_external_mappings").where({ id: mapping.id }).update(mappingValues);
    } else {
      await u.db("sc_external_mappings").insert({
        id: crypto.randomUUID(),
        system: "byteplus-modelark",
        entityType: "character-asset",
        localId: assetId,
        ...mappingValues,
        createdAt: now(),
      });
    }
  }

  return u.db<MediaAssetRow>("sc_media_assets").where({ id: assetId }).first();
}

async function toPublicCharacterAsset(row: MediaAssetRow) {
  const metadata = parseJson<CharacterMetadata>(row.metadataJson, {});
  return {
    id: row.id,
    name: metadata.profile?.name || row.originalName?.replace(/\.[^.]+$/, "") || "未命名角色",
    source: row.source,
    status: metadata.remoteStatus || "Local",
    remoteAssetId: metadata.remoteAssetId,
    assetUri: metadata.assetUri,
    groupId: metadata.groupId,
    generationModel: metadata.generationModel,
    profile: metadata.profile,
    previewUrl: await u.oss.getFileUrl(row.localPath),
    remoteUrl: row.remoteUrl,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    synced: Boolean(metadata.remoteAssetId),
  };
}

function remoteProfile(item: BytePlusAssetItem): CharacterProfile {
  const name = item.Name || item.Id || item.AssetId || "海外角色资产";
  return {
    name,
    age: "",
    height: "",
    bodyType: "",
    style: "电影级风格化写实",
    personality: "",
    appearance: "",
    wardrobe: "",
    setting: "",
  };
}

function remoteAssetId(item: BytePlusAssetItem) {
  return item.Id || item.AssetId;
}

async function importRemoteAsset(projectId: number, item: BytePlusAssetItem) {
  const id = remoteAssetId(item);
  if (!id) throw new Error("海外资产缺少资产 ID。");
  const existingMapping = await u.db("sc_external_mappings")
    .where({ system: "byteplus-modelark", entityType: "character-asset", externalId: id })
    .first();
  if (existingMapping) {
    return u.db<MediaAssetRow>("sc_media_assets").where({ id: existingMapping.localId }).first();
  }
  if (!item.URL) throw new Error("海外资产没有可下载的预览地址。");
  const downloaded = await downloadImage(item.URL);
  return persistMediaAsset(projectId, downloaded.buffer, downloaded.mimeType, {
    name: item.Name || id,
    source: "remote",
    remoteUrl: item.URL,
    remoteAssetId: id,
    remoteStatus: item.Status || "Active",
    profile: remoteProfile(item),
  });
}

async function updateCharacterTask(taskId: string, values: Record<string, unknown>) {
  await u.db("sc_tasks").where({ id: taskId }).update({ ...values, updatedAt: now() });
}

async function runCharacterGeneration(
  taskId: string,
  projectId: number,
  input: CreateCharacterInput,
) {
  try {
    await updateCharacterTask(taskId, { status: "running", progress: 10 });
    const generated = await generateCharacterBoard(input);
    await updateCharacterTask(taskId, { progress: 45 });

    let downloaded: { buffer: Buffer; mimeType: string };
    let sourceUrl: string;
    if ("buffer" in generated && generated.buffer && generated.mimeType) {
      downloaded = { buffer: generated.buffer, mimeType: generated.mimeType };
      sourceUrl = await uploadBytePlusAssetSource(downloaded.buffer, downloaded.mimeType, input.profile.name);
    } else if ("url" in generated && generated.url) {
      sourceUrl = generated.url;
      downloaded = await downloadImage(generated.url);
    } else {
      throw new Error("图片模型没有返回可用的角色设定板。");
    }
    const config = getBytePlusAssetConfig();
    const remoteAssetIdValue = await createBytePlusImageAsset(
      sourceUrl,
      `${input.profile.name}-${taskId.slice(0, 8)}`,
      config,
      downloaded.mimeType,
    );
    await updateCharacterTask(taskId, { externalTaskId: remoteAssetIdValue, progress: 65 });
    const approved = await waitForBytePlusAsset(remoteAssetIdValue, config);
    const asset = await persistMediaAsset(projectId, downloaded.buffer, downloaded.mimeType, {
      name: input.profile.name,
      source: "generated",
      prompt: generated.prompt,
      remoteUrl: approved.URL || sourceUrl,
      remoteAssetId: remoteAssetIdValue,
      remoteStatus: approved.Status || "Active",
      generationModel: generated.model,
      profile: input.profile,
    });
    if (!asset) throw new Error("虚拟人物已生成，但本地资产记录创建失败。");

    await updateCharacterTask(taskId, {
      status: "succeeded",
      progress: 100,
      outputJson: JSON.stringify({
        characterAssetId: asset.id,
        remoteAssetId: remoteAssetIdValue,
        previewPath: asset.localPath,
        model: generated.model,
      }),
      errorJson: null,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await updateCharacterTask(taskId, {
      status: "failed",
      progress: 100,
      errorJson: JSON.stringify({ code: "CHARACTER_ASSET_ERROR", message }),
    });
  }
}

export async function createCharacterGenerationTask(input: CreateCharacterInput) {
  const projectId = await ensureMvpProject();
  const existing = await u.db<CharacterTaskRow>("sc_tasks").where({ idempotencyKey: input.idempotencyKey }).first();
  if (existing) return toPublicCharacterTask(existing);
  getBytePlusAssetConfig();
  const models = await loadModels();
  const target = input.imageModel === "image2" ? models.image.primary : models.image.fallback;
  const resolvedTarget = resolveModelTarget(target);
  if (!resolvedTarget.apiKey) {
    throw new Error(`缺少 ${target.apiKeyEnv}，无法使用 ${input.imageModel === "image2" ? "Image 2" : "Seedream"} 生成虚拟人物。`);
  }
  if (input.imageModel === "image2") await getBytePlusTosUploadTarget();

  const taskId = crypto.randomUUID();
  const createdAt = now();
  await u.db("sc_tasks").insert({
    id: taskId,
    projectId,
    taskType: CHARACTER_TASK_TYPE,
    provider: target.vendor,
    status: "queued",
    progress: 0,
    inputJson: JSON.stringify({
      profile: input.profile,
      imageModel: input.imageModel,
      model: `${target.vendor}:${target.model}`,
      additionalPrompt: input.additionalPrompt || "",
      hasReferenceImage: Boolean(input.referenceImage),
    }),
    outputJson: null,
    errorJson: null,
    idempotencyKey: input.idempotencyKey,
    externalTaskId: null,
    createdAt,
    updatedAt: createdAt,
  });
  void runCharacterGeneration(taskId, projectId, input);
  const row = await u.db<CharacterTaskRow>("sc_tasks").where({ id: taskId }).first();
  return toPublicCharacterTask(row!);
}

export async function uploadLocalCharacter(input: UploadCharacterInput) {
  const projectId = await ensureMvpProject();
  const decoded = decodeDataImage(input.image);
  const asset = await persistMediaAsset(projectId, decoded.buffer, decoded.mimeType, {
    name: input.profile.name,
    source: "uploaded",
    profile: input.profile,
  });
  if (!asset) throw new Error("上传角色保存失败。");
  return toPublicCharacterAsset(asset);
}

export async function toPublicCharacterTask(row: CharacterTaskRow) {
  const output = parseJson<CharacterTaskOutput>(row.outputJson, {});
  const taskError = parseJson<{ message?: string }>(row.errorJson, {});
  return {
    id: row.id,
    status: row.status,
    progress: Number(row.progress),
    characterAssetId: output.characterAssetId,
    remoteAssetId: output.remoteAssetId,
    model: output.model,
    previewUrl: output.previewPath ? await u.oss.getFileUrl(output.previewPath) : undefined,
    error: taskError.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getCharacterGenerationTask(taskId: string) {
  const row = await u.db<CharacterTaskRow>("sc_tasks").where({ id: taskId, taskType: CHARACTER_TASK_TYPE }).first();
  return row ? toPublicCharacterTask(row) : undefined;
}

async function getCharacterImageModels(assetConfigured: boolean, tosReady: boolean) {
  const models = await loadModels();
  const seedream = resolveModelTarget(models.image.fallback);
  const image2 = resolveModelTarget(models.image.primary);
  return [
    {
      id: "seedream" as const,
      label: "Seedream",
      vendor: seedream.vendor,
      model: seedream.model,
      available: assetConfigured && Boolean(seedream.apiKey),
      keyConfigured: Boolean(seedream.apiKey),
      trustedUploadReady: assetConfigured,
      description: "海外 BytePlus 原生生成，直接注册可信人物资产。",
    },
    {
      id: "image2" as const,
      label: "Image 2",
      vendor: image2.vendor,
      model: image2.model,
      available: assetConfigured && tosReady && Boolean(image2.apiKey),
      keyConfigured: Boolean(image2.apiKey),
      trustedUploadReady: assetConfigured && tosReady,
      description: "OpenAI 高质量角色设定板，经新加坡 TOS 中转后注册同一资产组。",
    },
  ];
}

export async function getCharacterAssetWorkspace() {
  const projectId = await ensureMvpProject();
  const localRows = await u.db<MediaAssetRow>("sc_media_assets")
    .where({ projectId, type: "character" })
    .orderBy("createdAt", "desc");
  const localAssets = await Promise.all(localRows.map(toPublicCharacterAsset));
  const configured = hasBytePlusAssetConfig();
  if (!configured) {
    return {
      configured: false,
      group: null,
      assets: localAssets,
      imageModels: await getCharacterImageModels(false, false),
      remoteError: "尚未配置海外 BytePlus 资产库 AK/SK 与 group。",
    };
  }

  try {
    const config = getBytePlusAssetConfig();
    const [group, remoteListing] = await Promise.all([
      getBytePlusAssetGroup(config),
      listBytePlusAssets(config),
    ]);
    const localRemoteIds = new Set(localAssets.map((asset) => asset.remoteAssetId).filter(Boolean));
    const tosReady = Boolean(resolveBytePlusTosTarget(remoteListing.Items || []));
    const remoteOnly = (remoteListing.Items || [])
      .filter((item) => item.AssetType === "Image" && remoteAssetId(item) && !localRemoteIds.has(remoteAssetId(item)))
      .map((item) => ({
        id: remoteAssetId(item)!,
        name: item.Name || remoteAssetId(item)!,
        source: "remote",
        status: item.Status || "Processing",
        remoteAssetId: remoteAssetId(item)!,
        assetUri: toAssetUri(remoteAssetId(item)!),
        groupId: config.groupId,
        profile: remoteProfile(item),
        previewUrl: item.URL,
        remoteUrl: item.URL,
        createdAt: item.CreateTime,
        synced: item.Status === "Active",
      }));
    return {
      configured: true,
      group: {
        id: config.groupId,
        name: group.Name || config.groupId,
        type: group.GroupType || "AIGC",
      },
      assets: [...localAssets, ...remoteOnly],
      imageModels: await getCharacterImageModels(true, tosReady),
      remoteError: null,
    };
  } catch (cause) {
    return {
      configured: true,
      group: { id: getBytePlusAssetConfig().groupId, name: "海外资产组", type: "AIGC" },
      assets: localAssets,
      imageModels: await getCharacterImageModels(
        true,
        Boolean(resolveBytePlusTosTarget([])),
      ),
      remoteError: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export async function bindCharacterAssetToEntity(assetKey: string, entityId: string) {
  const projectId = await ensureMvpProject();
  let asset = await u.db<MediaAssetRow>("sc_media_assets").where({ id: assetKey, projectId, type: "character" }).first();
  if (!asset && assetKey.startsWith("asset-")) {
    const remote = await getBytePlusAsset(assetKey);
    asset = await importRemoteAsset(projectId, remote);
  }
  if (!asset) throw new Error("虚拟人物资产不存在。");

  const entity = await u.db("sc_entities").where({ id: entityId, projectId, entityType: "character" }).first();
  if (!entity) throw new Error("要绑定的人物记忆不存在。");
  const metadata = parseJson<CharacterMetadata>(asset.metadataJson, {});
  const canonical = parseJson<Record<string, unknown>>(entity.canonicalJson, {});
  const timestamp = now();

  await persistCharacterAssetBinding(db, {
    projectId,
    entityId,
    canonical,
    assetId: asset.id,
    assetLocalPath: asset.localPath,
    remoteAssetId: metadata.remoteAssetId,
    assetUri: metadata.assetUri,
    characterProfile: metadata.profile,
    referenceId: crypto.randomUUID(),
    timestamp,
  });

  return getMvpContinuityWorkspace(projectId);
}

export async function getShotCharacterAssetContext(projectId: number, shotId: number) {
  const contract = await u.db("sc_shot_contracts").where({ projectId, shotId }).first();
  const entitySlugs = parseJson<string[]>(contract?.entitySlugsJson, []);
  if (!entitySlugs.length) return { assetUris: [], unboundCharacters: [] };
  const entities = await u.db("sc_entities")
    .where({ projectId, entityType: "character" })
    .whereIn("slug", entitySlugs);
  const resolved = entities.map((entity) => ({
    name: entity.name,
    assetUri: parseJson<Record<string, unknown>>(entity.canonicalJson, {}).assetUri,
  }));
  return {
    assetUris: [...new Set(resolved
      .map((entity) => entity.assetUri)
      .filter((value): value is string => typeof value === "string" && value.startsWith("asset://")))],
    unboundCharacters: resolved
      .filter((entity) => typeof entity.assetUri !== "string" || !entity.assetUri.startsWith("asset://"))
      .map((entity) => entity.name),
  };
}

export async function getShotCharacterAssetUris(projectId: number, shotId: number) {
  return (await getShotCharacterAssetContext(projectId, shotId)).assetUris;
}
