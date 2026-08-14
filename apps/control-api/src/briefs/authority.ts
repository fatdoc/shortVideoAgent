import { randomUUID } from 'node:crypto';
import { payloadDigest } from '../projects/digest.js';
import {
  browserSafeBriefPayloadSchema,
  canonicalBriefPayloadSchema,
  type BrowserSafeBriefPayload,
  type CanonicalBriefPayload,
} from './schema.js';

export function deriveCanonicalBriefPayload(input: BrowserSafeBriefPayload): CanonicalBriefPayload {
  const safe = browserSafeBriefPayloadSchema.parse(input);
  const authorityInput = {
    objective: safe.objective,
    audience: safe.audience,
    platforms: safe.platforms,
    brandFacts: safe.brandFacts,
    prohibitedTerms: safe.prohibitedTerms,
    requiredDisclosures: safe.requiredDisclosures,
  };
  return canonicalBriefPayloadSchema.parse({
    objective: safe.objective,
    audience: safe.audience,
    platforms: safe.platforms,
    brandPolicySnapshot: {
      facts: safe.brandFacts.map((fact) => ({
        factId: randomUUID(),
        text: fact.text,
        sourceReference: fact.sourceReference,
        approved: true as const,
      })),
      prohibitedTerms: safe.prohibitedTerms,
      requiredDisclosures: safe.requiredDisclosures,
      sourceDigest: `sha256:${payloadDigest(authorityInput)}`,
    },
  });
}

export function projectBrowserSafeBriefPayload(payload: unknown): BrowserSafeBriefPayload {
  const canonical = canonicalBriefPayloadSchema.parse(payload);
  return browserSafeBriefPayloadSchema.parse({
    objective: canonical.objective,
    audience: canonical.audience,
    platforms: canonical.platforms,
    brandFacts: canonical.brandPolicySnapshot.facts.map((fact) => ({
      text: fact.text,
      sourceReference: fact.sourceReference,
    })),
    prohibitedTerms: canonical.brandPolicySnapshot.prohibitedTerms,
    requiredDisclosures: canonical.brandPolicySnapshot.requiredDisclosures,
    factsConfirmed: true,
  });
}
