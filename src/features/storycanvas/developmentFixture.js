export const developmentEditorBootstrap = {
  serviceState: "ready",
  notice: "B 工程独立开发入口：当前编辑数据仅存在于页面内存，不代表生产授权或真实生成回执。",
  production: {
    project: {
      projectId: "b-storycanvas-editor-local",
      name: "门店探店视频 · 画布开发项目",
    },
    package: {
      packageId: "b-editor-local-package",
      packageVersion: 1,
    },
    links: { returnPath: "/" },
    claims: [],
    riskRules: {
      restrictions: ["不得虚构门店价格、套餐和服务能力"],
      prohibitedWords: [],
    },
    truthManifest: { entries: [] },
  },
  shots: [
    {
      id: 0,
      internalId: 0,
      externalId: "dev-shot-storefront",
      order: 0,
      section: "镜头 00",
      title: "门店外景开场",
      shortTitle: "门店外景",
      description: "从街道环境推进到门店招牌，建立探店地点。",
      imagePrompt: "真实本地生活门店外景，白天，自然光，稳定构图。",
      videoPrompt: "镜头从街道缓慢推进到门店招牌，保持真实探店质感。",
      screenText: "今天带你探一家附近好店",
      duration: 4,
      range: "00:00–00:04",
      status: "waiting",
      sourceType: "live",
      riskLevel: "low",
      matchStatus: "unmatched",
    },
    {
      id: 1,
      internalId: 1,
      externalId: "dev-shot-offer",
      order: 1,
      section: "镜头 01",
      title: "主推套餐展示",
      shortTitle: "套餐展示",
      description: "展示门店主推商品、环境和真实到店体验。",
      imagePrompt: "本地生活门店主推套餐近景，真实食物质感，暖色自然灯光。",
      videoPrompt: "近景展示商品细节，再切换到顾客真实体验场景。",
      screenText: "到店前先看真实体验",
      duration: 5,
      range: "00:04–00:09",
      status: "waiting",
      sourceType: "live",
      riskLevel: "low",
      matchStatus: "unmatched",
    },
  ],
  continuity: {
    shots: {},
    entities: {},
    events: [],
    profile: { revision: 1 },
  },
  capabilities: {
    keyConfigured: false,
    image: { available: false, truthMode: "LOCAL-DEVELOPMENT" },
    video: { available: false, truthMode: "LOCAL-DEVELOPMENT" },
  },
};

export const developmentEditorApi = {
  getCharacters: async () => [],
  getTask: async () => {
    throw new Error("本地画布尚未连接生成任务服务。");
  },
  getCharacterTask: async () => {
    throw new Error("本地画布尚未连接角色生成服务。");
  },
  createTask: async () => {
    throw new Error("请先连接 StoryCanvas API 后再创建真实生成任务。");
  },
  updateShotContinuity: async () => developmentEditorBootstrap.continuity,
  exportVideo: async () => {
    throw new Error("请先连接 StoryCanvas API 后再执行真实导出。");
  },
  createFallbackExport: async () => {
    throw new Error("独立开发入口不登记 Demo/Fallback 导出。");
  },
  uploadCharacter: async () => {
    throw new Error("请先连接 StoryCanvas API 后再上传角色素材。");
  },
  generateCharacter: async () => {
    throw new Error("请先连接 StoryCanvas API 后再生成角色素材。");
  },
  bindCharacter: async () => {
    throw new Error("请先连接 StoryCanvas API 后再绑定角色素材。");
  },
};
