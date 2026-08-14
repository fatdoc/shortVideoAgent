import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const depsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT || rootDir;

function controlDependency(packageName) {
  const packageFile = path.join(depsRoot, "apps/control-api/node_modules", packageName, "package.json");
  if (!fs.existsSync(packageFile)) throw new Error(`missing Control dependency ${packageName}`);
  const manifest = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  return path.join(path.dirname(packageFile), manifest.main || "index.js");
}

export default {
  resolve: {
    alias: {
      express: controlDependency("express"),
      supertest: controlDependency("supertest"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/canvas-v1/control-authority-scope.revalidation.test.ts"],
    setupFiles: [],
  },
};
