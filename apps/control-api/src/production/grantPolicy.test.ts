import { describe, expect, it } from 'vitest';
import { assertGrantRequestAllowed } from './grantPolicy.js';

describe('ProjectGrant least-privilege policy', () => {
  it('accepts task scopes needed by a requested video capability', () => {
    expect(() =>
      assertGrantRequestAllowed(
        ['video.generate', 'media.export'],
        ['video.generate'],
        ['production.package.read', 'production.task.write', 'production.receipt.write'],
      ),
    ).not.toThrow();
  });

  it('rejects client capability expansion beyond the immutable package', () => {
    expect(() =>
      assertGrantRequestAllowed(
        ['video.generate'],
        ['audio.tts'],
        ['production.package.read', 'production.task.write'],
      ),
    ).toThrowError(expect.objectContaining({ code: 'CAPABILITY_SCOPE_DENIED', status: 403 }));
  });

  it('rejects export scope unless media.export is one of the requested capabilities', () => {
    expect(() =>
      assertGrantRequestAllowed(
        ['video.generate', 'media.export'],
        ['video.generate'],
        ['production.package.read', 'production.export.write'],
      ),
    ).toThrowError(expect.objectContaining({ code: 'CAPABILITY_SCOPE_DENIED', status: 403 }));
  });
});
