import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { ensureProjectMediaDirectories, PROJECT_MEDIA_KINDS, resolveProjectMediaPath, sha256File } from "./projectMedia";

let root = "";

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "storycanvas-media-"));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

test("creates the isolated project media directory structure", async () => {
  const projectRoot = await ensureProjectMediaDirectories(42, root);
  for (const kind of PROJECT_MEDIA_KINDS) {
    assert.equal(path.dirname(resolveProjectMediaPath(42, kind, randomUUID(), kind === "metadata" ? "json" : "png", root)), path.join(projectRoot, kind));
  }
});

test("constructs paths from safe IDs and rejects traversal input", () => {
  const assetId = randomUUID();
  assert.equal(resolveProjectMediaPath(7, "videos", assetId, ".mp4", root), path.join(root, "7", "videos", `${assetId}.mp4`));
  assert.throws(() => resolveProjectMediaPath(7, "videos", "../../escape", "mp4", root));
  assert.throws(() => resolveProjectMediaPath(7, "videos", assetId, "../../sh", root));
});

test("calculates stable SHA-256 hashes", async () => {
  const filePath = path.join(root, "hash.txt");
  await writeFile(filePath, "StoryCanvas");
  assert.equal(await sha256File(filePath), "e88418719430acd2f12dd0eb172bb6320e2c0e6ac734f1b06a8b39ff8d9b3d5a");
});
