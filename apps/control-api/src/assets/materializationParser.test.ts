import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  parseCanvasAssetMaterializationRequest,
  parseCanvasAssetMaterializationResponse,
} from './materializationParser.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff]);

function request() {
  return {
    objectType: 'CanvasAssetMaterializationRequest',
    contractVersion: '0.1',
    tenantId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    packageId: '33333333-3333-4333-8333-333333333333',
    canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
    assetId: '88888888-8888-4888-8888-888888888888',
    actorId: '12121212-1212-4212-8212-121212121212',
    materializationAttemptId: '90909090-9090-4090-8090-909090909090',
    requestId: 'req-materialization-001',
    occurredAt: '2026-08-14T02:00:00.000Z',
  };
}

function responseForBytes(bytes = jpeg) {
  const { actorId: _actorId, objectType: _objectType, ...common } = request();
  return {
    objectType: 'CanvasAssetMaterialization',
    ...common,
    materializationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    category: 'virtual_character',
    mimeType: 'image/jpeg',
    byteSize: bytes.length,
    checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    contentEncoding: 'base64',
    contentBase64: bytes.toString('base64'),
    replayed: false,
  };
}

const response = () => responseForBytes();

describe('Canvas materialization strict parsers', () => {
  it('accepts only the frozen request and canonical UTC timestamps', () => {
    expect(parseCanvasAssetMaterializationRequest(request())).toEqual(request());
    for (const occurredAt of [
      '2026-99-99T99:99:99.999Z',
      '2026-02-30T02:00:00.000Z',
      '2026-08-14T02:00:00.000+00:00',
      '2026-08-14T02:00:00Z',
    ]) {
      expect(() =>
        parseCanvasAssetMaterializationRequest({ ...request(), occurredAt }),
      ).toThrow('CANVAS_MATERIALIZATION_REQUEST_INVALID');
    }
    expect(() =>
      parseCanvasAssetMaterializationRequest({ ...request(), mimeType: 'image/jpeg' }),
    ).toThrow('CANVAS_MATERIALIZATION_REQUEST_INVALID');
  });

  it('performs a final strict response, base64, MIME, size and checksum verification', () => {
    expect(parseCanvasAssetMaterializationResponse(response())).toEqual(response());
    const mutations = [
      [{ ...response(), storageReference: 'private/file.jpg' }, 'RESPONSE_INVALID'],
      [{ ...response(), contentBase64: 'not base64' }, 'RESPONSE_INVALID'],
      [{ ...response(), byteSize: 4 }, 'CONTENT_INTEGRITY_FAILED'],
      [{ ...response(), checksum: `sha256:${'0'.repeat(64)}` }, 'CONTENT_INTEGRITY_FAILED'],
      [{ ...response(), mimeType: 'image/png' }, 'CONTENT_INTEGRITY_FAILED'],
      [{ ...response(), mimeType: 'image/gif' }, 'MIME_UNSUPPORTED'],
      [{ ...response(), category: 'store' }, 'CATEGORY_UNSUPPORTED'],
    ] as const;
    for (const [value, code] of mutations) {
      expect(() => parseCanvasAssetMaterializationResponse(value)).toThrow(
        `CANVAS_MATERIALIZATION_${code}`,
      );
    }
  });

  it('parses canonical base64 at decoded byte boundaries without uncaught runtime errors', () => {
    const exactLimit = Buffer.alloc(8 * 1024 * 1024);
    exactLimit.set(jpeg);
    expect(() => parseCanvasAssetMaterializationResponse(responseForBytes(exactLimit))).not.toThrow();

    const cases = [
      [responseForBytes(Buffer.from([0xff])), 'CANVAS_MATERIALIZATION_MIME_UNSUPPORTED'],
      [responseForBytes(Buffer.concat([exactLimit, Buffer.from([0])])), 'CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE'],
      [
        { ...response(), contentBase64: 'A'.repeat(11_184_816) },
        'CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE',
      ],
      [{ ...response(), contentBase64: '%%%%' }, 'CANVAS_MATERIALIZATION_RESPONSE_INVALID'],
      [{ ...response(), contentBase64: '/9j=' }, 'CANVAS_MATERIALIZATION_RESPONSE_INVALID'],
    ] as const;
    for (const [value, code] of cases) {
      try {
        parseCanvasAssetMaterializationResponse(value);
        throw new Error('expected Canvas materialization parsing to fail');
      } catch (error) {
        expect(error).toMatchObject({ name: 'CanvasMaterializationError', code });
      }
    }
  });

  it('normalizes unexpected parser runtime failures to the fixed response error', () => {
    const throwing = new Proxy(
      {},
      {
        get() {
          throw new RangeError('untrusted getter failed');
        },
      },
    );
    for (const input of [null, undefined, true, 1, 'base64', [], throwing]) {
      expect(() => parseCanvasAssetMaterializationResponse(input)).toThrow(
        'CANVAS_MATERIALIZATION_RESPONSE_INVALID',
      );
      try {
        parseCanvasAssetMaterializationResponse(input);
      } catch (error) {
        expect(error).toMatchObject({ name: 'CanvasMaterializationError' });
      }
    }
  });
});
