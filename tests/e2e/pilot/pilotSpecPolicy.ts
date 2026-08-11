import { Buffer } from 'node:buffer';

const SPEC_SOURCE_REQUIRED = 'PILOT_E2E_SPEC_SOURCE_REQUIRED';
const SPEC_SOURCE_TOO_LARGE = 'PILOT_E2E_SPEC_SOURCE_TOO_LARGE';
const SPEC_FOCUSED_FORBIDDEN = 'PILOT_E2E_SPEC_FOCUSED_FORBIDDEN';
const SPEC_SKIP_FORBIDDEN = 'PILOT_E2E_SPEC_SKIP_FORBIDDEN';
const SPEC_FIXME_FORBIDDEN = 'PILOT_E2E_SPEC_FIXME_FORBIDDEN';
const SPEC_NO_TESTS = 'PILOT_E2E_SPEC_NO_TESTS';

const MAX_SPEC_SOURCE_BYTES = 256 * 1024;

const PLAYWRIGHT_SCOPE = String.raw`(?:test\s*\.\s*describe|test|describe)`;
const FOCUSED_DECLARATION = new RegExp(String.raw`\b${PLAYWRIGHT_SCOPE}\s*\.\s*only\s*\(`);
const SKIPPED_DECLARATION = new RegExp(String.raw`\b${PLAYWRIGHT_SCOPE}\s*\.\s*skip\s*\(`);
const FIXME_DECLARATION = /\btest\s*\.\s*fixme\s*\(/;
const TEST_DECLARATION = /\btest\s*\(/;

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

export function assertPilotSpecPolicy(source: unknown): void {
  if (typeof source !== 'string' || source.trim().length === 0) {
    fail(SPEC_SOURCE_REQUIRED);
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_SPEC_SOURCE_BYTES) {
    fail(SPEC_SOURCE_TOO_LARGE);
  }

  const policySource = maskCommentsAndQuotedText(source);

  if (FOCUSED_DECLARATION.test(policySource)) fail(SPEC_FOCUSED_FORBIDDEN);
  if (SKIPPED_DECLARATION.test(policySource)) fail(SPEC_SKIP_FORBIDDEN);
  if (FIXME_DECLARATION.test(policySource)) fail(SPEC_FIXME_FORBIDDEN);
  if (!TEST_DECLARATION.test(policySource)) fail(SPEC_NO_TESTS);
}
