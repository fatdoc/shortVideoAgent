import React from "react";
import { createRoot } from "react-dom/client";
import { developmentEditorApi, developmentEditorBootstrap } from "./developmentFixture";
import { StoryCanvasEditorHarness } from "./StoryCanvasEditorHarness";

const root = document.getElementById("storycanvas-editor-root");

if (!root) {
  throw new Error("StoryCanvas development root is missing.");
}

createRoot(root).render(
  <React.StrictMode>
    <StoryCanvasEditorHarness api={developmentEditorApi} bootstrap={developmentEditorBootstrap} />
  </React.StrictMode>,
);
