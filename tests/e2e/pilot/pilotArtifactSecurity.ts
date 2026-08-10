import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const FORBIDDEN_ARTIFACT_EXTENSIONS = new Set(['.har', '.webm', '.zip']);

async function artifactFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await artifactFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function assertPilotBrowserArtifactsSafe(
  root: string,
  secrets: readonly string[],
): Promise<void> {
  const needles = secrets
    .filter((secret) => secret.length >= 8)
    .map((secret) => Buffer.from(secret));
  for (const path of await artifactFiles(root)) {
    if (FORBIDDEN_ARTIFACT_EXTENSIONS.has(extname(path).toLowerCase())) {
      throw new Error('PILOT_E2E_ARTIFACT_CAPTURE_FORBIDDEN');
    }
    const artifact = await readFile(path);
    if (needles.some((needle) => artifact.indexOf(needle) >= 0)) {
      throw new Error('PILOT_E2E_ARTIFACT_SECRET_LEAK');
    }
  }
}
