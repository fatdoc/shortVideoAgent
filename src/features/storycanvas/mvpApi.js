const fallbackApiBase = import.meta.env.VITE_API_URL || "http://localhost:10588/api";

async function resolveApiBase() {
  if (window.location.protocol !== "file:") return fallbackApiBase;
  const response = await fetch("toonflow://getappurl");
  const payload = await response.json();
  return payload.url || fallbackApiBase;
}

function getMessage(payload, fallback) {
  if (payload?.message && payload.message !== "成功") return payload.message;
  if (payload?.data?.message) return payload.data.message;
  return fallback;
}

export function createMvpClient() {
  let apiBasePromise;
  let token = window.sessionStorage.getItem("storycanvas:mvp-token") || "";
  let productionGrant = null;

  function projectIdFromDeepLink() {
    if (window.location.protocol === "file:") return "demo-local-001";
    const match = window.location.pathname.match(/^\/(?:storycanvas|production\/canvas)\/([^/]+)\/?$/);
    if (!match) throw new Error("D1 StoryCanvas 必须使用 /production/canvas/demo-local-001 深链");
    const projectId = decodeURIComponent(match[1]);
    if (projectId !== "demo-local-001") {
      throw new Error(`PROJECT_SCOPE_MISMATCH：拒绝非 canonical 深链 ${projectId}`);
    }
    return projectId;
  }

  function requireGrant() {
    if (!productionGrant) {
      throw new Error("EXPLICIT_GRANT_REQUIRED：等待控制平面通过内存 bridge 提交当前 Mock grant");
    }
    return productionGrant;
  }

  function encodeGrantHeader(grant) {
    const bytes = new TextEncoder().encode(JSON.stringify(grant));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function getApiBase() {
    apiBasePromise ??= resolveApiBase();
    return apiBasePromise;
  }

  async function login() {
    const apiBase = await getApiBase();
    const response = await fetch(`${apiBase}/login/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: import.meta.env.VITE_MVP_USERNAME || "admin",
        password: import.meta.env.VITE_MVP_PASSWORD || "admin123",
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.data?.token) {
      throw new Error(getMessage(payload, "本地 MVP 登录失败"));
    }
    token = payload.data.token;
    window.sessionStorage.setItem("storycanvas:mvp-token", token);
  }

  async function request(path, init = {}, retry = true) {
    if (!token) await login();
    const apiBase = await getApiBase();
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        ...init.headers,
      },
    });
    if (response.status === 401 && retry) {
      token = "";
      window.sessionStorage.removeItem("storycanvas:mvp-token");
      await login();
      return request(path, init, false);
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(getMessage(payload, `请求失败（HTTP ${response.status}）`));
    return payload.data;
  }

  return {
    setProductionGrant: (grant) => {
      productionGrant = grant && typeof grant === "object" ? structuredClone(grant) : null;
    },
    clearProductionGrant: () => {
      productionGrant = null;
    },
    acceptPackage: (productionPackage, grant, requestedCapabilityId) => request(
      "/production/v0.1/packages",
      {
        method: "POST",
        body: JSON.stringify({
          package: productionPackage,
          grant,
          ...(requestedCapabilityId ? { requestedCapabilityId } : {}),
        }),
      },
    ),
    bootstrap: async () => {
      const projectId = projectIdFromDeepLink();
      const grant = requireGrant();
      const grantHeaders = { "X-StoryCanvas-Demo-Grant": encodeGrantHeader(grant) };
      const [production, productionTasks] = await Promise.all([
        request(
          `/production/v0.1/projects/${encodeURIComponent(projectId)}`,
          { headers: grantHeaders },
        ),
        request(
          `/production/v0.1/projects/${encodeURIComponent(projectId)}/tasks`,
          { headers: grantHeaders },
        ),
      ]);
      return {
        projectId: production.project.internalProjectId,
        production,
        productionTasks,
        continuity: production.continuity,
        recentTasks: [],
        capabilities: {
          keyConfigured: false,
          image: {
            vendor: "DemoGenerator",
            model: "deterministic-demo-v1",
            available: false,
            truthMode: "MOCK-CONTRACT",
          },
          video: {
            vendor: "NONE",
            model: "D1 canonical mode",
            available: false,
            truthMode: "MOCK-CONTRACT",
          },
        },
      };
    },
    getProductionProject: () => request(
      "/production/v0.1/projects/demo-local-001",
      { headers: { "X-StoryCanvas-Demo-Grant": encodeGrantHeader(requireGrant()) } },
    ),
    runDemoScenario: (scenario) => request(
      `/production/v0.1/projects/demo-local-001/demo-provider/${encodeURIComponent(scenario)}`,
      { method: "POST", body: JSON.stringify({ grant: requireGrant() }) },
    ),
    getProductionReceipts: (status = "pending") => request(
      `/production/v0.1/receipts?projectId=demo-local-001&status=${encodeURIComponent(status)}`,
      { headers: { "X-StoryCanvas-Demo-Grant": encodeGrantHeader(requireGrant()) } },
    ),
    acknowledgeProductionReceipt: (receiptId, deliveryId) => request(
      `/production/v0.1/receipts/${encodeURIComponent(receiptId)}/ack`,
      { method: "POST", body: JSON.stringify({ grant: requireGrant(), deliveryId }) },
    ),
    getProductionArtifacts: () => request(
      "/production/v0.1/projects/demo-local-001/artifacts",
      { headers: { "X-StoryCanvas-Demo-Grant": encodeGrantHeader(requireGrant()) } },
    ),
    createFallbackExport: () => request(
      "/production/v0.1/projects/demo-local-001/fallback-export",
      { method: "POST", body: JSON.stringify({ grant: requireGrant() }) },
    ),
    getContinuity: async () => (await request(
      "/production/v0.1/projects/demo-local-001",
      { headers: { "X-StoryCanvas-Demo-Grant": encodeGrantHeader(requireGrant()) } },
    )).continuity,
    updateShotContinuity: async () => {
      throw new Error("CANONICAL_SCOPE_READ_ONLY：当前 D1 grant 不包含画布写 scope");
    },
    createTask: async () => {
      throw new Error("LEGACY_MODE_DISABLED：D1 canonical 模式禁止调用 /mvp/generation");
    },
    getTask: async () => {
      throw new Error("LEGACY_MODE_DISABLED：D1 canonical 模式禁止轮询 /mvp/generation");
    },
    exportVideo: async () => {
      throw new Error("LEGACY_MODE_DISABLED：D1 canonical 模式禁止调用 /mvp/export");
    },
    getCharacters: () => request("/mvp/characters"),
    generateCharacter: (input) => request("/mvp/characters/generate", { method: "POST", body: JSON.stringify(input) }),
    uploadCharacter: (input) => request("/mvp/characters/upload", { method: "POST", body: JSON.stringify(input) }),
    getCharacterTask: (taskId) => request(`/mvp/characters/tasks/${encodeURIComponent(taskId)}`),
    bindCharacter: (assetId, entityId) => request(
      "/mvp/characters/bind",
      { method: "POST", body: JSON.stringify({ assetId, entityId }) },
    ),
  };
}
