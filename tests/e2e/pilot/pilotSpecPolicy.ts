import { Buffer } from 'node:buffer';

const SPEC_SOURCE_REQUIRED = 'PILOT_E2E_SPEC_SOURCE_REQUIRED';
const SPEC_SOURCE_TOO_LARGE = 'PILOT_E2E_SPEC_SOURCE_TOO_LARGE';
const SPEC_FOCUSED_FORBIDDEN = 'PILOT_E2E_SPEC_FOCUSED_FORBIDDEN';
const SPEC_SKIP_FORBIDDEN = 'PILOT_E2E_SPEC_SKIP_FORBIDDEN';
const SPEC_FIXME_FORBIDDEN = 'PILOT_E2E_SPEC_FIXME_FORBIDDEN';
const SPEC_FORBIDDEN_MARKER = 'PILOT_E2E_SPEC_FORBIDDEN_MARKER';
const SPEC_NO_TESTS = 'PILOT_E2E_SPEC_NO_TESTS';

const MAX_SPEC_SOURCE_BYTES = 256 * 1024;

const PLAYWRIGHT_SCOPE = String.raw`(?:test\s*\.\s*describe|test|describe)`;
const FOCUSED_DECLARATION = new RegExp(String.raw`\b${PLAYWRIGHT_SCOPE}\s*\.\s*only\s*\(`);
const SKIPPED_DECLARATION = new RegExp(String.raw`\b${PLAYWRIGHT_SCOPE}\s*\.\s*skip\s*\(`);
const FIXME_DECLARATION = /\btest\s*\.\s*fixme\s*\(/;
const TEST_DECLARATION = /\btest\s*\(/;

const FORBIDDEN_BROWSER_MARKERS = [
  '/api/v1/internal/canvas-entries/redeem',
  'x-production-plane-internal-token',
  'x-storycanvas-demo-grant',
  'demoprojectgrant',
  'demo_project_id',
  'localstorage',
  'sessionstorage',
  'mock-contract',
] as const;

function fail(code: string): never {
  throw new Error(code);
}

function maskCharacter(character: string): string {
  return character === '\n' || character === '\r' ? character : ' ';
}

/**
 * Masks comments and quoted text while preserving source length and line breaks.
 * This is deliberately a bounded lexical scan, not a TypeScript AST parser. The
 * policy is an additional static Oracle; the Playwright JSON zero-skip Oracle
 * remains authoritative for the executed Golden Path result.
 */
function maskCommentsAndQuotedText(source: string): string {
  let masked = '';
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '/' && next === '/') {
      masked += '  ';
      index += 2;
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        masked += ' ';
        index += 1;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      masked += '  ';
      index += 2;
      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          masked += '  ';
          index += 2;
          break;
        }
        masked += maskCharacter(source[index]);
        index += 1;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      const quote = character;
      masked += ' ';
      index += 1;
      while (index < source.length) {
        const quotedCharacter = source[index];
        masked += maskCharacter(quotedCharacter);
        index += 1;

        if (quotedCharacter === '\\' && index < source.length) {
          masked += maskCharacter(source[index]);
          index += 1;
          continue;
        }
        if (quotedCharacter === quote) break;
      }
      continue;
    }

    masked += character;
    index += 1;
  }

  return masked;
}

/**
 * Masks comments but preserves quoted text so forbidden browser dependencies
 * remain visible even when supplied as request URLs, header names, or other
 * string arguments. Template expressions re-enter code mode so comments inside
 * `${...}` are masked as comments rather than treated as template text.
 */
function maskComments(source: string): string {
  type Context = { kind: 'code'; templateExpressionDepth: number | null } | { kind: 'template' };

  const contexts: Context[] = [{ kind: 'code', templateExpressionDepth: null }];
  let masked = '';
  let index = 0;

  while (index < source.length) {
    const context = contexts[contexts.length - 1];
    const character = source[index];
    const next = source[index + 1];

    if (context?.kind === 'template') {
      masked += character;
      index += 1;

      if (character === '\\' && index < source.length) {
        masked += source[index];
        index += 1;
        continue;
      }
      if (character === '`') {
        contexts.pop();
        continue;
      }
      if (character === '$' && next === '{') {
        masked += next;
        index += 1;
        contexts.push({ kind: 'code', templateExpressionDepth: 1 });
      }
      continue;
    }

    if (character === '/' && next === '/') {
      masked += '  ';
      index += 2;
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        masked += ' ';
        index += 1;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      masked += '  ';
      index += 2;
      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          masked += '  ';
          index += 2;
          break;
        }
        masked += maskCharacter(source[index]);
        index += 1;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      const quote = character;
      masked += character;
      index += 1;
      while (index < source.length) {
        const quotedCharacter = source[index];
        masked += quotedCharacter;
        index += 1;

        if (quotedCharacter === '\\' && index < source.length) {
          masked += source[index];
          index += 1;
          continue;
        }
        if (quotedCharacter === quote) break;
      }
      continue;
    }

    if (character === '`') {
      masked += character;
      index += 1;
      contexts.push({ kind: 'template' });
      continue;
    }

    masked += character;
    index += 1;

    if (context?.kind === 'code' && context.templateExpressionDepth !== null) {
      if (character === '{') context.templateExpressionDepth += 1;
      if (character === '}') {
        context.templateExpressionDepth -= 1;
        if (context.templateExpressionDepth === 0) contexts.pop();
      }
    }
  }

  return masked;
}

function containsForbiddenBrowserMarker(source: string): boolean {
  const commentFreeSource = maskComments(source).toLowerCase();
  return FORBIDDEN_BROWSER_MARKERS.some((marker) => commentFreeSource.includes(marker));
}

export function assertPilotSpecPolicy(source: unknown): void {
  if (typeof source !== 'string' || source.trim().length === 0) {
    fail(SPEC_SOURCE_REQUIRED);
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_SPEC_SOURCE_BYTES) {
    fail(SPEC_SOURCE_TOO_LARGE);
  }

  if (containsForbiddenBrowserMarker(source)) fail(SPEC_FORBIDDEN_MARKER);

  const policySource = maskCommentsAndQuotedText(source);

  if (FOCUSED_DECLARATION.test(policySource)) fail(SPEC_FOCUSED_FORBIDDEN);
  if (SKIPPED_DECLARATION.test(policySource)) fail(SPEC_SKIP_FORBIDDEN);
  if (FIXME_DECLARATION.test(policySource)) fail(SPEC_FIXME_FORBIDDEN);
  if (!TEST_DECLARATION.test(policySource)) fail(SPEC_NO_TESTS);
}
