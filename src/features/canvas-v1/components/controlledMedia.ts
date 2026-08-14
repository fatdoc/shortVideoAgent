const FORBIDDEN_MEDIA_MARKER = /(?:asset|blob|data|javascript):|(?:x-amz-|x-tos-|signature|credential|access[_-]?token)/iu;
const CONTROLLED_PATH = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=@%/-]+$/u;

/**
 * Media view inputs are projections, not URL authority. Only an unsigned,
 * same-origin absolute path may reach a Canvas V1 DOM media sink.
 */
export function controlledMediaSrc(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || !CONTROLLED_PATH.test(value)) return null;
  if (value.includes('?') || value.includes('#') || value.includes('\\') || /%(?![0-9a-f]{2})/iu.test(value)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (FORBIDDEN_MEDIA_MARKER.test(decoded)) return null;
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  return value;
}
