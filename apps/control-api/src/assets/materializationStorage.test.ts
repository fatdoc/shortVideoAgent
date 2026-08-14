import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalCanvasAssetStorageReader } from './materializationStorage.js';

const roots: string[] = [];

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), 'control-materialization-'));
  roots.push(value);
  await mkdir(join(value, 'tenant-assets'));
  return value;
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true })));
});

describe('LocalCanvasAssetStorageReader', () => {
  it('accepts the frozen 3-byte minimal JPEG and derives exact facts', async () => {
    const storageRoot = await root();
    const bytes = Buffer.from([0xff, 0xd8, 0xff]);
    await writeFile(join(storageRoot, 'tenant-assets', 'source.jpg'), bytes);
    const result = await new LocalCanvasAssetStorageReader(storageRoot).read(
      'tenant-assets/source.jpg',
    );
    expect(result).toEqual({
      bytes,
      mimeType: 'image/jpeg',
      byteSize: 3,
      checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    });
  });

  it('classifies a decodable one-byte source as MIME_UNSUPPORTED, not empty', async () => {
    const storageRoot = await root();
    await writeFile(join(storageRoot, 'tenant-assets', 'one.bin'), Buffer.from([0xff]));
    await expect(
      new LocalCanvasAssetStorageReader(storageRoot).read('tenant-assets/one.bin'),
    ).rejects.toMatchObject({ code: 'CANVAS_MATERIALIZATION_MIME_UNSUPPORTED' });
  });

  it('accepts exactly 8 MiB and rejects 8 MiB plus one without returning bytes', async () => {
    const storageRoot = await root();
    const exact = Buffer.alloc(8 * 1024 * 1024);
    exact.set([0xff, 0xd8, 0xff]);
    await writeFile(join(storageRoot, 'tenant-assets', 'exact.jpg'), exact);
    await expect(
      new LocalCanvasAssetStorageReader(storageRoot).read('tenant-assets/exact.jpg'),
    ).resolves.toMatchObject({ mimeType: 'image/jpeg', byteSize: 8 * 1024 * 1024 });

    const tooLarge = Buffer.concat([exact, Buffer.from([0])]);
    await writeFile(join(storageRoot, 'tenant-assets', 'large.jpg'), tooLarge);
    await expect(
      new LocalCanvasAssetStorageReader(storageRoot).read('tenant-assets/large.jpg'),
    ).rejects.toMatchObject({ code: 'CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE' });
  });

  it('rejects traversal, absolute/scheme references, symlinks and unreadable sources', async () => {
    const storageRoot = await root();
    const outside = join(await root(), 'outside.jpg');
    await writeFile(outside, Buffer.from([0xff, 0xd8, 0xff]));
    await symlink(outside, join(storageRoot, 'tenant-assets', 'link.jpg'));
    for (const reference of [
      '../outside.jpg',
      '/etc/passwd',
      'file:///etc/passwd',
      'https://bucket.example/private.jpg',
      'tenant-assets/link.jpg',
      'tenant-assets/missing.jpg',
    ]) {
      await expect(new LocalCanvasAssetStorageReader(storageRoot).read(reference)).rejects.toMatchObject({
        code: 'CANVAS_MATERIALIZATION_SOURCE_UNAVAILABLE',
      });
    }
  });
});
