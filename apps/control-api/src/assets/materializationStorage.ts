import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { CanvasMaterializationError, materializationError } from './materializationErrors.js';
import { detectCanvasMaterializationMime } from './materializationParser.js';
import {
  CANVAS_MATERIALIZATION_MAX_BYTES,
  type CanvasAssetMaterializationBytes,
  type CanvasAssetMaterializationStorage,
} from './materializationTypes.js';

const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/;

function sourceUnavailable(): never {
  throw materializationError('CANVAS_MATERIALIZATION_SOURCE_UNAVAILABLE');
}

function isContained(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child.length > 0 && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function validateRoot(root: string): string {
  if (!isAbsolute(root) || resolve(root) !== root || parse(root).root === root) sourceUnavailable();
  return root;
}

function validateReference(reference: string): string[] {
  if (!REFERENCE.test(reference) || isAbsolute(reference) || reference.includes('\\')) {
    sourceUnavailable();
  }
  const segments = reference.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    sourceUnavailable();
  }
  return segments;
}

export class LocalCanvasAssetStorageReader implements CanvasAssetMaterializationStorage {
  private readonly configuredRoot: string;

  constructor(root: string) {
    this.configuredRoot = validateRoot(root);
  }

  async read(storageReference: string): Promise<CanvasAssetMaterializationBytes> {
    try {
      const segments = validateReference(storageReference);
      const root = await realpath(this.configuredRoot);
      if (!isAbsolute(root) || parse(root).root === root) sourceUnavailable();

      let current = root;
      for (const segment of segments) {
        current = resolve(current, segment);
        if (!isContained(root, current)) sourceUnavailable();
        const stat = await lstat(current);
        if (stat.isSymbolicLink()) sourceUnavailable();
      }

      const target = await realpath(current);
      if (!isContained(root, target)) sourceUnavailable();
      const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) sourceUnavailable();
        if (stat.size === 0) throw materializationError('CANVAS_MATERIALIZATION_SOURCE_EMPTY');
        if (stat.size > CANVAS_MATERIALIZATION_MAX_BYTES) {
          throw materializationError('CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE');
        }
        const bytes = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < bytes.length) {
          const result = await handle.read(bytes, offset, bytes.length - offset, offset);
          if (result.bytesRead === 0) break;
          offset += result.bytesRead;
        }
        if (offset === 0) throw materializationError('CANVAS_MATERIALIZATION_SOURCE_EMPTY');
        if (offset !== bytes.length) sourceUnavailable();
        const extra = Buffer.alloc(1);
        if ((await handle.read(extra, 0, 1, offset)).bytesRead > 0) {
          throw materializationError('CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE');
        }
        const mimeType = detectCanvasMaterializationMime(bytes);
        if (!mimeType) throw materializationError('CANVAS_MATERIALIZATION_MIME_UNSUPPORTED');
        return {
          bytes,
          mimeType,
          byteSize: bytes.length,
          checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
        };
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error instanceof CanvasMaterializationError) throw error;
      sourceUnavailable();
    }
  }
}
