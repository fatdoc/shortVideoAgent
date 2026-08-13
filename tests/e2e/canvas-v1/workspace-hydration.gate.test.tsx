import React from "react";
import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCanvasWorkspaceV01 } from "../../../src/features/canvas-v1/model/workspaceContract";
import { useCanvasV1ViewState } from "../../../src/features/canvas-v1/model/viewState";
import { CanvasV1Page, type CanvasV1PageProps } from "../../../src/features/canvas-v1/pages/CanvasV1Page";

const fixture = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "docs/program/contracts/canvas-v1/fixtures/workspace-materialization.json"),
  "utf8",
));

function hydrateProps(): CanvasV1PageProps {
  const workspace = parseCanvasWorkspaceV01(fixture.workspaceResponse);
  const taskEvents = Object.fromEntries(
    workspace.shots.flatMap((shot) => shot.event === null ? [] : [[shot.shotId, shot.event]]),
  );
  return {
    projectName: workspace.project.projectName,
    loadState: "loaded",
    bootstrap: workspace.bootstrap,
    document: workspace.document,
    shots: workspace.shots.map(({ requirements: _requirements, event: _event, thumbnailUrl, ...shot }) => ({
      ...shot,
      ...(thumbnailUrl === null ? {} : { thumbnailUrl }),
    })),
    assets: workspace.assets.map(({ materialization: _materialization, targetEntityId, ...asset }) => ({
      ...asset,
      ...(targetEntityId === null ? {} : { targetEntityId }),
    })),
    taskEvents,
    saveState: workspace.saveState,
    commandContext: { requestedByActorId: workspace.project.requestedByActorId },
    onCommand: vi.fn(),
  };
}

describe("G5 additive workspace real CanvasV1Page hydration", () => {
  beforeEach(() => useCanvasV1ViewState.getState().resetView());
  afterEach(cleanup);

  it("renders every real canonical page fact without demo or component defaults", () => {
    const props = hydrateProps();
    const view = render(<CanvasV1Page {...props} />);
    expect(screen.getByText("门店探店获客视频")).toBeInTheDocument();
    expect(screen.queryByText("门店探店视频", { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByText("镜头 01").length).toBeGreaterThan(0);
    expect(screen.getByText("今天带你探一家适合朋友聚餐的门店，先看招牌套餐。")).toBeInTheDocument();
    expect(screen.getByText("门店讲解员站在明亮入口，向镜头介绍招牌套餐。")).toBeInTheDocument();
    expect(screen.getByText("虚拟人物")).toBeInTheDocument();
    expect(screen.getByText("已保存")).toBeInTheDocument();
    expect(screen.getAllByLabelText("生成中").length).toBeGreaterThan(0);
    expect(screen.getByText("任务正在处理")).toBeInTheDocument();

    const images = [...view.container.querySelectorAll("img")];
    expect(images.some((image) => image.getAttribute("src") === fixture.workspaceResponse.shots[0].outputs[0].previewUrl)).toBe(true);
    expect(view.container.innerHTML.toLowerCase()).not.toMatch(/asset:\/\/|contentbase64|storagereference|signedurl|x-tos-|x-amz-/);
  });

  it("maps the persisted event under its exact parent shot and no alternate key", () => {
    const props = hydrateProps();
    const shotId = fixture.workspaceResponse.shots[0].shotId;
    const event = fixture.workspaceResponse.shots[0].event;
    expect(Object.keys(props.taskEvents)).toEqual([shotId]);
    expect(props.taskEvents[shotId]).toEqual(event);
    expect(props.taskEvents[event.eventId]).toBeUndefined();
    render(<CanvasV1Page {...props} />);
    expect(screen.getByText("任务正在处理")).toBeInTheDocument();
  });
});
