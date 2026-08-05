import { createHash } from 'node:crypto';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

export function contractPayloadDigest(value: unknown): string {
  const unsigned = structuredClone(value) as Record<string, unknown>;
  delete unsigned.payloadDigest;
  return `sha256:${createHash('sha256').update(canonicalJson(unsigned)).digest('hex')}`;
}

export function tokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}
