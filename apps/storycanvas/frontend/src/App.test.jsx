import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  setProductionGrant: vi.fn(),
  clearProductionGrant: vi.fn(),
  bootstrap: vi.fn(),
  getContinuity: vi.fn(),
  updateShotContinuity: vi.fn(),
  createTask: vi.fn(),
  getTask: vi.fn(),
  exportVideo: vi.fn(),
  getCharacters: vi.fn(),
  generateCharacter: vi.fn(),
  uploadCharacter: vi.fn(),
  getCharacterTask: vi.fn(),
  bindCharacter: vi.fn(),
  runDemoScenario: vi.fn(),
  createFallbackExport: vi.fn(),
}));

vi.mock("./mvpApi", () => ({
  createMvpClient: () => api,
}));

import { App } from "./App.jsx";

const CONTROL_PLANE_ORIGIN = "http://localhost:5173";
const grant = {
  grantId: "grant-demo-local-001",
  projectId: "demo-local-001",
  packageId: "package-demo-local-001-v1",
  scopes: ["production:read", "generation:demo"],
  expiresAt: "2026-07-31T00:00:00.000Z",
};

const shotDescriptions = [
  "门店外景与三里屯夜色",
  "顾客进入海底捞门店",
  "服务员热情迎接入座",
  "招牌番茄锅底上桌",
  "牛肉下锅的近景镜头",
  "朋友围桌分享美食",
  "权益图卡与套餐说明",
  "门店定位与行动号召",
];

const shots = shotDescriptions.map((description, index) => {
  const order = index + 1;
  return {
    id: `shot-${String(order).padStart(2, "0")}`,
    internalId: 100 + order,
    order,
    duration: order === 7 ? 5 : 4,
    description,
    screenText: order === 7 ? "海底捞三里屯店 双人套餐" : description,
    narration: order === 7 ? "套餐权益以门店实际公示为准。" : `镜头 ${order} 旁白`,
    imagePrompt: `海底捞三里屯店竖屏画面 ${order}`,
    videoPrompt: `镜头 ${order} 平稳推进`,
    sourceType: order === 7 ? "generated-card" : "controlled-reference",
    riskLevel: order === 7 ? "medium" : "low",
    status: "approved",
    matchStatus: order === 5 ? "reshoot" : "matched",
    assignee: order === 7 ? "DemoGenerator" : "门店运营",
    assetId: order === 7 ? null : `asset-${order}`,
  };
});

const continuity = {
  profile: {
    id: "continuity-demo-local-001",
    revision: 1,
    style: { visualStyle: "真实门店纪实" },
    rules: ["不得虚构套餐价格", "不得承诺排队时间"],
  },
  entities: [
    {
      id: "brand-haidilao",
      slug: "haidilao",
      entityType: "brand",
      name: "海底捞",
      canonical: { description: "海底捞品牌与门店视觉", invariants: ["品牌标识不得变形"] },
      references: [],
    },
    {
      id: "store-sanlitun",
      slug: "sanlitun-store",
      entityType: "location",
      name: "海底捞三里屯店",
      canonical: { description: "北京市朝阳区三里屯门店", invariants: ["不得错配门店"] },
      references: [],
    },
  ],
  events: [],
  shots: Object.fromEntries(shots.map((shot) => [
    String(shot.internalId),
    {
      contract: {
        shotId: shot.internalId,
        entitySlugs: ["haidilao", "sanlitun-store"],
        transition: { relationType: shot.order === 1 ? "opening" : "same-scene-cut" },
        statePatch: {},
        mustPreserve: ["品牌身份", "门店身份"],
      },
      relation: shot.order === 1
        ? null
        : { relationType: "same-scene-cut", usePreviousEndFrame: false, preserve: ["品牌身份"] },
      stateAtStart: {},
      entities: [
        { id: "brand-haidilao", slug: "haidilao", name: "海底捞" },
        { id: "store-sanlitun", slug: "sanlitun-store", name: "海底捞三里屯店" },
      ],
      references: [],
      errors: [],
      warnings: [],
    },
  ])),
};

const production = {
  package: {
    packageId: "package-demo-local-001-v1",
    packageVersion: "1.0.0",
    contractVersion: "0.1",
    status: "accepted",
    digest: "sha256:8b53d8963fce7148",
    sourceSuiteDigest: "sha256:control-plane-d1",
  },
  project: {
    projectId: "demo-local-001",
    internalProjectId: "storycanvas-demo-local-001",
    name: "海底捞三里屯店夏日套餐推广",
    platform: "抖音",
    aspectRatio: "9:16",
  },
  script: { id: "script-demo-local-001-v1" },
  shots,
  claims: [
    { id: "C1", text: "品牌为海底捞，演示门店为三里屯店。" },
    { id: "C2", text: "套餐权益以门店实际公示为准。" },
    { id: "C3", text: "演示不构成价格承诺。" },
  ],
  riskRules: {
    restrictions: ["不得虚构价格", "不得承诺免排队"],
    prohibitedWords: ["全网最低", "永久有效"],
  },
  truthManifest: {
    entries: [
      { capabilityId: "demo.local-life-golden-path", mode: "MOCK-CONTRACT" },
      { capabilityId: "provider.video-generation", mode: "UNAVAILABLE" },
    ],
  },
  links: { returnPath: "/enterprise/projects/demo-local-001" },
  continuity,
};

const fallbackArtifact = {
  artifactId: "demo-local-001-fallback-synthetic-v1",
  status: "DEMO_ONLY",
  playable: true,
  mediaUrl: "http://localhost:50188/media/d1/demo-local-001-fallback-synthetic-v1.mp4",
  technicalQa: "passed",
  editorialQa: "not_evaluated",
  brandQa: "not_approved",
  dimensions: { width: 540, height: 960 },
  durationSeconds: 6,
  codecs: { video: "h264", audio: "aac" },
};

function installOpener() {
  const opener = { postMessage: vi.fn() };
  Object.defineProperty(window, "opener", { configurable: true, value: opener });
  return opener;
}

function dispatchGrant(opener, overrides = {}, origin = CONTROL_PLANE_ORIGIN) {
  const event = new MessageEvent("message", {
    data: {
      type: "storycanvas:d1-grant",
      projectId: "demo-local-001",
      packageId: "package-demo-local-001-v1",
      grant,
      ...overrides,
    },
    origin,
  });
  Object.defineProperty(event, "source", { value: opener });
  window.dispatchEvent(event);
}

async function renderWithGrant() {
  const opener = installOpener();
  render(<App />);
  await waitFor(() => {
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storycanvas:d1-grant-request" }),
      CONTROL_PLANE_ORIGIN,
    );
  });
  dispatchGrant(opener);
  expect(await screen.findByText("D1 生产包已接受")).toBeInTheDocument();
  return opener;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "opener", { configurable: true, value: null });
});

describe("StoryCanvas D1 canonical production canvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.bootstrap.mockResolvedValue({
      projectId: "storycanvas-demo-local-001",
      production,
      productionTasks: [],
      continuity,
      recentTasks: [],
      capabilities: {
        keyConfigured: false,
        image: { available: false, model: "deterministic-demo-v1", truthMode: "MOCK-CONTRACT" },
        video: { available: false, model: "D1 canonical mode", truthMode: "MOCK-CONTRACT" },
      },
    });
    api.runDemoScenario.mockImplementation(async (scenario) => ({
      task: scenario === "success"
        ? {
          generationTaskId: "task-shot-07-success",
          shotId: "shot-07",
          taskType: "image.generate",
          status: "succeeded",
          progress: 100,
          output: { mediaType: "image" },
          truthMode: "MOCK-CONTRACT",
        }
        : {
          generationTaskId: "task-shot-05-failure",
          shotId: "shot-05",
          taskType: "video.generate",
          status: "failed",
          progress: 100,
          error: { code: "DEMO_PROVIDER_FAILURE", message: "演示 Provider 失败" },
          truthMode: "MOCK-CONTRACT",
        },
    }));
    api.createFallbackExport.mockResolvedValue(fallbackArtifact);
  });

  it("requires an explicit in-memory grant when not opened by the control plane", async () => {
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    render(<App />);

    expect(await screen.findByText(/EXPLICIT_GRANT_REQUIRED/)).toBeInTheDocument();
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "D1 canonical 不可用" })).toBeDisabled();
  });

  it("requests and accepts the canonical grant before loading the eight-shot package", async () => {
    const opener = await renderWithGrant();

    expect(api.setProductionGrant).toHaveBeenCalledWith(grant);
    expect(api.bootstrap).toHaveBeenCalledTimes(1);
    expect(screen.getByText("海底捞三里屯店夏日套餐推广")).toBeInTheDocument();
    expect(screen.getByText("镜头数量：8")).toBeInTheDocument();
    expect(screen.getAllByText("MOCK-CONTRACT").length).toBeGreaterThan(0);
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storycanvas:d1-ready", projectId: "demo-local-001" }),
      CONTROL_PLANE_ORIGIN,
    );
  });

  it("rejects a grant message from an untrusted origin", async () => {
    const opener = installOpener();
    render(<App />);
    dispatchGrant(opener, {}, "https://untrusted.example");

    expect(await screen.findByText(/GRANT_BRIDGE_ORIGIN_REJECTED/)).toBeInTheDocument();
    expect(api.setProductionGrant).not.toHaveBeenCalled();
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it("rejects project and package scope mismatches before bootstrapping", async () => {
    const opener = installOpener();
    render(<App />);
    dispatchGrant(opener, { projectId: "another-project" });

    expect(await screen.findByText(/GRANT_BRIDGE_SCOPE_MISMATCH/)).toBeInTheDocument();
    expect(api.setProductionGrant).not.toHaveBeenCalled();
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it("keeps the canonical project, script, memory, assets, and canvas workspaces connected", async () => {
    const user = userEvent.setup();
    await renderWithGrant();

    await user.click(screen.getByRole("button", { name: "项目" }));
    expect(await screen.findByRole("heading", { name: "项目总览" })).toBeInTheDocument();
    expect(screen.getByText("批准事实与规则")).toBeInTheDocument();
    expect(screen.getByText(/全网最低、永久有效/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "脚本" }));
    expect(await screen.findByRole("heading", { name: "脚本编辑" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "记忆" }));
    expect(await screen.findByRole("heading", { name: "世界记忆" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "素材" }));
    expect(await screen.findByRole("heading", { name: "素材库" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回画布" }));
    expect(await screen.findByText("海底捞三里屯店 双人套餐")).toBeInTheDocument();
  });

  it("registers the shot-07 success path as MOCK-CONTRACT without claiming real AI", async () => {
    const user = userEvent.setup();
    const opener = installOpener();
    const { container } = render(<App />);
    dispatchGrant(opener);
    await screen.findByText("D1 生产包已接受");

    await user.click(container.querySelectorAll(".shot-node")[6]);
    await user.click(screen.getByRole("button", { name: "登记权益图卡 · MOCK-CONTRACT" }));

    expect(api.runDemoScenario).toHaveBeenCalledWith("success");
    expect(await screen.findByText(/任务、资产与回执已登记/)).toBeInTheDocument();
    expect(screen.getByText("MOCK 登记：1")).toBeInTheDocument();
    expect(screen.getByText("真实生成：0")).toBeInTheDocument();
  });

  it("registers the shot-05 failure without fabricating an output asset", async () => {
    const user = userEvent.setup();
    const opener = installOpener();
    const { container } = render(<App />);
    dispatchGrant(opener);
    await screen.findByText("D1 生产包已接受");

    await user.click(container.querySelectorAll(".shot-node")[4]);
    await user.click(screen.getByRole("button", { name: "视频" }));
    await user.click(screen.getByRole("button", { name: "登记失败任务 · MOCK-CONTRACT" }));

    expect(api.runDemoScenario).toHaveBeenCalledWith("failure");
    expect(await screen.findByText(/没有伪造输出资产/)).toBeInTheDocument();
    expect(screen.getByText("演示 Provider 失败")).toBeInTheDocument();
  });

  it("registers and exposes the playable synthetic fallback with explicit QA truth labels", async () => {
    const user = userEvent.setup();
    await renderWithGrant();
    await user.click(screen.getByRole("button", { name: "项目" }));
    await user.click(await screen.findByRole("button", { name: "登记本地合成 Demo · FALLBACK" }));

    expect(api.createFallbackExport).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("本地纯合成 FALLBACK 演示片")).toHaveAttribute(
      "src",
      fallbackArtifact.mediaUrl,
    );
    expect(screen.getByText(/本地合成演示片，仅验证流程/)).toBeInTheDocument();
    expect(screen.getByText(/technical playback QA: passed/)).toBeInTheDocument();
  });

  it("clears the in-memory grant when the canvas unmounts", async () => {
    const opener = installOpener();
    const view = render(<App />);
    dispatchGrant(opener);
    await screen.findByText("D1 生产包已接受");

    view.unmount();
    expect(api.clearProductionGrant).toHaveBeenCalled();
  });
});
