import crypto from 'node:crypto';
import type { Knex } from 'knex';

import type { PilotCanvasRedemption } from '../pilotCanvasCapability';
import { CanvasCommandServiceError } from './errors';

type ApprovedPackage = PilotCanvasRedemption['productionPackage'];

type MappingRow = {
  localId: string;
};

type PackageRow = {
  id: string;
  packageId: string;
  packageVersion: number;
  contractVersion: string;
  tenantId: string;
  externalProjectId: string;
  internalProjectId: number;
  payloadDigest: string;
  sourceSuiteDigest: string;
  snapshotJson: string;
  status: string;
};

const CANVAS_V1_ACCEPTANCE_SOURCE_DIGEST = `sha256:${crypto
  .createHash('sha256')
  .update('canvas-v1-runtime-authority-acceptance/0.3')
  .digest('hex')}`;

function stableId(value: ApprovedPackage): string {
  const bytes = crypto.createHash('sha256').update([
    'canvas-v1-package',
    value.tenantId,
    value.projectId,
    value.packageId,
    String(value.packageVersion),
  ].join(':')).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(',')}}`;
}

export async function acceptCanvasV1RuntimeAuthority(
  database: Knex,
  approvedPackage: ApprovedPackage,
): Promise<number> {
  if (
    approvedPackage.contractVersion !== '0.3' ||
    approvedPackage.status !== 'ready' ||
    Date.parse(approvedPackage.expiresAt) <= Date.now()
  ) {
    throw new CanvasCommandServiceError('CANVAS_CAPABILITY_UNAVAILABLE');
  }
  return database.transaction(async (transaction) => {
    const mappings = await transaction<MappingRow>('sc_external_mappings')
      .select('localId')
      .where({
        system: 'saas-control-plane',
        entityType: 'project',
        externalId: approvedPackage.projectId,
      })
      .limit(2);
    if (mappings.length !== 1) {
      throw new CanvasCommandServiceError('CANVAS_CAPABILITY_UNAVAILABLE');
    }
    const mapping = mappings[0];
    const localProjectId = Number(mapping?.localId);
    const project = Number.isSafeInteger(localProjectId) && localProjectId > 0
      ? await transaction('o_project').where({ id: localProjectId }).first()
      : null;
    if (!project) {
      throw new CanvasCommandServiceError('CANVAS_CAPABILITY_UNAVAILABLE');
    }

    const snapshotJson = canonical(approvedPackage);
    const candidates = await transaction<PackageRow>('sc_production_packages')
      .where({
        packageId: approvedPackage.packageId,
        packageVersion: approvedPackage.packageVersion,
      })
      .limit(3);
    const sameIdentity = candidates.filter(
      (candidate) =>
        candidate.tenantId === approvedPackage.tenantId &&
        candidate.externalProjectId === approvedPackage.projectId,
    );
    if (sameIdentity.length > 1 || candidates.length !== sameIdentity.length) {
      throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH');
    }
    const existing = sameIdentity[0];
    if (existing) {
      if (
        existing.contractVersion !== '0.3' ||
        existing.status !== 'accepted' ||
        existing.tenantId !== approvedPackage.tenantId ||
        existing.externalProjectId !== approvedPackage.projectId ||
        Number(existing.internalProjectId) !== localProjectId ||
        Number(existing.packageVersion) !== approvedPackage.packageVersion ||
        existing.payloadDigest !== approvedPackage.payloadDigest ||
        existing.sourceSuiteDigest !== CANVAS_V1_ACCEPTANCE_SOURCE_DIGEST ||
        existing.snapshotJson !== snapshotJson
      ) {
        throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH');
      }
      return localProjectId;
    }

    const acceptedAt = new Date().toISOString();
    await transaction('sc_production_packages').insert({
        id: stableId(approvedPackage),
        packageId: approvedPackage.packageId,
        packageVersion: approvedPackage.packageVersion,
        contractVersion: approvedPackage.contractVersion,
        tenantId: approvedPackage.tenantId,
        externalProjectId: approvedPackage.projectId,
        internalProjectId: localProjectId,
        idempotencyKey: `canvas-v1-accept:${approvedPackage.packageId}:${approvedPackage.packageVersion}`,
        payloadDigest: approvedPackage.payloadDigest,
        sourceSuiteDigest: CANVAS_V1_ACCEPTANCE_SOURCE_DIGEST,
        capabilityIdsJson: JSON.stringify(approvedPackage.capabilityRequirements),
        snapshotJson,
        status: 'accepted',
        errorCode: null,
        errorJson: null,
        acceptedAt,
        createdAt: acceptedAt,
      }).onConflict().ignore();
    const racedRows = await transaction<PackageRow>('sc_production_packages')
      .where({
        packageId: approvedPackage.packageId,
        packageVersion: approvedPackage.packageVersion,
        tenantId: approvedPackage.tenantId,
        externalProjectId: approvedPackage.projectId,
      })
      .limit(2);
    const raced = racedRows.length === 1 ? racedRows[0] : null;
    if (
      !raced ||
      raced.payloadDigest !== approvedPackage.payloadDigest ||
      raced.sourceSuiteDigest !== CANVAS_V1_ACCEPTANCE_SOURCE_DIGEST ||
      raced.snapshotJson !== snapshotJson ||
      Number(raced.internalProjectId) !== localProjectId
    ) {
      throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH');
    }
    return localProjectId;
  });
}
