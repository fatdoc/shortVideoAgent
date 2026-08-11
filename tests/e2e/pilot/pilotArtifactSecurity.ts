import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const FORBIDDEN_ARTIFACT_EXTENSIONS = new Set(['.har', '.webm', '.zip']);

const FORBIDDEN_TEXT_MARKERS = [
  /\bx-production-plane-internal-token\s*[:=]/i,
  /["']?(?:internal[_-]?redemption[_-]?token|production[_-]?plane[_-]?internal[_-]?token)["']?\s*[:=]/i,
  /\bauthorization\s*[:=]\s*bearer\b/i,
  /["']?(?:raw[_ -]?grant[_ -]?token|grant[_ -]?access[_ -]?token|project[_ -]?grant[_ -]?token|access[_ -]?token)["']?\s*[:=]/i,
  /["']?grant[_-]?id["']?\s*[:=]/i,
  /["']?(?:package|grant|entry|script|storyboard)(?:[_-]?payload)?[_-]?digest["']?\s*[:=]/i,
  /["']?redemption[_-]?(?:idempotency[_-]?key|request[_-]?digest)["']?\s*[:=]/i,
  /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/i,
  /["']?(?:pgpassword|postgres(?:ql)?[_-]?password|database[_-]?password)["']?\s*[:=]/i,
  /(?:\/private)?\/tmp\/[^\s"'<>]*storycanvas[^\s"'<>]*/i,
  /\/private\/var\/folders\/[^\s"'<>]*storycanvas[^\s"'<>]*/i,
  /\b(?:PostgresError|SequelizeDatabaseError|QueryFailedError)\b/i,
  /\b(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,256}\b(?:FROM|INTO|SET|VALUES)\b/i,
  /(?:^|\n)\s*at\s+(?:async\s+)?(?:[\w$.<>]+\s+\()?[^)\n]+:\d+:\d+\)?/m,
  /["']?(?:provider|upstream)(?:[_-]?(?:response|error))?[_-]?body["']?\s*[:=]/i,
] as const;

export interface PilotArtifactSensitiveValue {
  label: string;
  value: string;
}

export interface PilotArtifactServiceStream {
  stdout?: string;
  stderr?: string;
}

export interface PilotArtifactSecurityEvidence {
  sensitiveValues?: readonly PilotArtifactSensitiveValue[];
  serviceOutput?: {
    controlApi?: PilotArtifactServiceStream;
    storyCanvas?: PilotArtifactServiceStream;
  };
}

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

function sensitiveNeedles(
  secrets: readonly string[],
  evidence: PilotArtifactSecurityEvidence,
): Buffer[] {
  return [...secrets, ...(evidence.sensitiveValues ?? []).map(({ value }) => value)]
    .filter((value) => value.length >= 8)
    .map((value) => Buffer.from(value));
}

function containsNeedle(content: Buffer, needles: readonly Buffer[]): boolean {
  return needles.some((needle) => content.indexOf(needle) >= 0);
}

function containsForbiddenMarker(content: Buffer | string): boolean {
  const text = typeof content === 'string' ? content : content.toString('utf8');
  return FORBIDDEN_TEXT_MARKERS.some((marker) => marker.test(text));
}

function serviceOutput(evidence: PilotArtifactSecurityEvidence): string[] {
  const output = evidence.serviceOutput;
  if (!output) return [];
  return [
    output.controlApi?.stdout,
    output.controlApi?.stderr,
    output.storyCanvas?.stdout,
    output.storyCanvas?.stderr,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
}

export async function assertPilotBrowserArtifactsSafe(
  root: string,
  secrets: readonly string[],
  evidence: PilotArtifactSecurityEvidence = {},
): Promise<void> {
  const needles = sensitiveNeedles(secrets, evidence);
  for (const path of await artifactFiles(root)) {
    if (FORBIDDEN_ARTIFACT_EXTENSIONS.has(extname(path).toLowerCase())) {
      throw new Error('PILOT_E2E_ARTIFACT_CAPTURE_FORBIDDEN');
    }
    const artifact = await readFile(path);
    if (containsNeedle(artifact, needles)) {
      throw new Error('PILOT_E2E_ARTIFACT_SECRET_LEAK');
    }
    if (containsForbiddenMarker(artifact)) {
      throw new Error('PILOT_E2E_SENSITIVE_MARKER_LEAK');
    }
  }

  for (const output of serviceOutput(evidence)) {
    if (containsNeedle(Buffer.from(output), needles)) {
      throw new Error('PILOT_E2E_SERVICE_OUTPUT_SECRET_LEAK');
    }
    if (containsForbiddenMarker(output)) {
      throw new Error('PILOT_E2E_SENSITIVE_MARKER_LEAK');
    }
  }
}
