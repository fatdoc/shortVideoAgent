const { app, BrowserWindow } = require("electron");
const { writeFile } = require("node:fs/promises");
const path = require("node:path");

const outputPath = process.argv[2] ?? path.join(process.cwd(), "docs/design/storycanvas-canvas-implementation-qa.png");
const viewportWidth = Number(process.argv[3] ?? 1487);
const viewportHeight = Number(process.argv[4] ?? 1058);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: viewportWidth,
    height: viewportHeight,
    backgroundColor: "#f8f8f6",
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  await window.loadFile(path.join(process.cwd(), "data/web/index.html"));
  await new Promise((resolve) => setTimeout(resolve, 350));

  const screenshot = await window.webContents.capturePage();
  await writeFile(outputPath, screenshot.toPNG());
  console.log(`[design-qa] captured ${outputPath}`);

  window.destroy();
  app.exit(0);
}).catch((error) => {
  console.error("[design-qa] capture failed", error);
  app.exit(1);
});
