import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Knex publishes types for its package root but not for its explicit ESM runtime entry.
// @ts-expect-error the runtime entry is intentionally paired with the package's public Knex type below
import controlKnex from "../../apps/control-api/node_modules/knex/knex.mjs";
// @ts-expect-error the runtime entry is intentionally paired with the package's public Knex type below
import storyKnex from "../../apps/storycanvas/node_modules/knex/knex.mjs";
import type { Knex } from "../../apps/control-api/node_modules/knex/types/index.js";
import type { Knex as StoryKnex } from "../../apps/storycanvas/node_modules/knex/types/index.js";

import { hashPassword } from "../../apps/control-api/src/auth/password.js";
import { CanvasActivationService } from "../../apps/control-api/src/assets/activationService.js";
import { CanvasAssetMaterializationService } from "../../apps/control-api/src/assets/materializationService.js";
import { PostgresCanvasAssetMaterializationRepository } from "../../apps/control-api/src/assets/materializationRepository.js";
import { LocalCanvasAssetStorageReader } from "../../apps/control-api/src/assets/materializationStorage.js";
import { PostgresCanvasAssetAuthorityRepository } from "../../apps/control-api/src/assets/repository.js";
import { CanvasAssetAuthorityService } from "../../apps/control-api/src/assets/service.js";
import { PostgresCanvasAssetSessionAuthorityRepository } from "../../apps/control-api/src/assets/sessionRepository.js";
import { CanvasAssetSessionAuthorityService } from "../../apps/control-api/src/assets/sessionService.js";
import type { AssetAuthorityRecord, AssetCategory } from "../../apps/control-api/src/assets/types.js";
import { CanvasWorkspaceAuthorityService } from "../../apps/control-api/src/assets/workspaceAuthorityService.js";
import { PostgresCanvasEntryRepository } from "../../apps/control-api/src/canvasEntries/repository.js";
import { CanvasEntryService } from "../../apps/control-api/src/canvasEntries/service.js";
import { loadConfig } from "../../apps/control-api/src/config.js";
import { CONTROL_API_MIGRATION_NAMES } from "../../apps/control-api/src/db/migrationContract.js";
import { migratePilotE2eDatabase } from "../../apps/control-api/src/e2e/resetSeed.js";
import {
  PILOT_LOCAL_ACCOUNTS,
  parsePilotLocalAccountPassword,
  resetMigrateSeedPilotLocalAccounts,
} from "../../apps/control-api/src/e2e/localAccounts.js";
import {
  pilotE2eFixtureIds,
} from "../../apps/control-api/src/e2e/fixtures.js";
import { PostgresInvitationRepository } from "../../apps/control-api/src/invitations/repository.js";
import { InvitationService } from "../../apps/control-api/src/invitations/service.js";
import type { InvitationActor } from "../../apps/control-api/src/invitations/types.js";
import { payloadDigest } from "../../apps/control-api/src/projects/digest.js";
import { PostgresContentStore } from "../../apps/control-api/src/projects/repository.js";
import type { SessionActor } from "../../apps/control-api/src/projects/types.js";
import { ProjectGrantTokenService } from "../../apps/control-api/src/production/grantToken.js";
import { PostgresProductionStore } from "../../apps/control-api/src/production/repository.js";
import { PostgresCanvasWorkspaceAuthorityRepository } from "../../apps/control-api/src/production/workspaceAuthorityRepository.js";
import type { ProjectProductionPackageV03 } from "../../apps/control-api/src/production/types.js";
import { createStoryboardDraftRevision } from "../../apps/control-api/src/storyboards/contract.js";
import { PostgresStoryboardAuthorityStore } from "../../apps/control-api/src/storyboards/repository.js";
import { StoryboardAuthorityService } from "../../apps/control-api/src/storyboards/service.js";
import { PostgresTermsRepository } from "../../apps/control-api/src/terms/repository.js";
import { TermsService } from "../../apps/control-api/src/terms/service.js";
import type { TermsActor } from "../../apps/control-api/src/terms/types.js";

import * as storyMigrationsNamespace from "../../apps/storycanvas/src/lib/storycanvasMigrations.js";
import * as assetMaterializationNamespace from "../../apps/storycanvas/src/services/storycanvas/canvas-v1/assetMaterialization.js";
import * as authorityAcceptanceNamespace from "../../apps/storycanvas/src/services/storycanvas/canvas-v1/runtimeAuthorityAcceptance.js";
import * as workspacePrepareNamespace from "../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js";
import type { CanvasProductionScope } from "../../apps/storycanvas/src/services/storycanvas/assets-v1/scope.js";
import type {
  CanvasWorkspaceAuthorityV01,
} from "../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js";

const storyMigrations = ((storyMigrationsNamespace as { default?: unknown }).default
  ?? storyMigrationsNamespace) as typeof storyMigrationsNamespace;
const assetMaterialization = ((assetMaterializationNamespace as { default?: unknown }).default
  ?? assetMaterializationNamespace) as typeof assetMaterializationNamespace;
const authorityAcceptance = ((authorityAcceptanceNamespace as { default?: unknown }).default
  ?? authorityAcceptanceNamespace) as typeof authorityAcceptanceNamespace;
const workspacePrepare = ((workspacePrepareNamespace as { default?: unknown }).default
  ?? workspacePrepareNamespace) as typeof workspacePrepareNamespace;
const { runStoryCanvasMigrations } = storyMigrations;
const { CanvasV1AssetMaterializer } = assetMaterialization;
const { acceptCanvasV1RuntimeAuthority } = authorityAcceptance;
const { CanvasV1WorkspacePreparer } = workspacePrepare;

type LocalManualCaseTarget = "local" | "test";
type LocalAccountRole = typeof PILOT_LOCAL_ACCOUNTS[number]["role"];
type CaseAuthority = {
  actor: SessionActor;
  projectId: string;
  roles: LocalAccountRole[];
  userIds: Record<typeof PILOT_LOCAL_ACCOUNTS[number]["accountKey"], string>;
  membershipIds: Record<typeof PILOT_LOCAL_ACCOUNTS[number]["accountKey"], string>;
};

export type LocalManualCaseOptions = {
  target: LocalManualCaseTarget;
  databaseUrl: string;
  storyRoot: string;
  assetStorageRoot: string;
  projectId: string | null;
  accountPassword: string | null;
  projectGrantSigningSecret: string;
  projectGrantActiveKid: string;
  canvasEntryDigestSecret: string;
  canvasActivationSecret: string;
  canvasApprovalSecret: string;
  resetTestTarget: boolean;
  environment: NodeJS.ProcessEnv;
};

export type LocalManualCaseSummary = {
  target: LocalManualCaseTarget;
  status: "BLOCKED_NO_PROVIDER";
  providerConfigured: false;
  paidProviderCalls: 0;
  semanticFingerprint: string;
  entry: {
    handle: string;
    tenantId: string;
    projectId: string;
    packageId: string;
    expiresAt: string;
  };
  control: {
    migrationCount: number;
    roles: string[];
    projectName: string;
    authorityCounts: {
      brief: number;
      script: number;
      scriptApproval: number;
      storyboard: number;
      storyboardApproval: number;
      package: number;
      activeGrant: number;
      assets: number;
      authorizedAssets: number;
      approvedAssets: number;
    };
    operationsCounts: {
      members: { platform: number; channel: number; tenant: number };
      revokedInvitations: { platform: number; channel: number; tenant: number };
      terms: { documents: number; drafts: number; published: number; consents: number };
    };
  };
  story: {
    migrationCount: number;
    localProjectId: number;
    factCounts: {
      projectMapping: number;
      acceptedPackage: number;
      document: number;
      projectedAssets: number;
      requirements: number;
      readiness: number;
      media: number;
      assetMapping: number;
      providerBindings: number;
      entityBindings: number;
    };
    readinessReasonCodes: string[];
  };
};

const rootDir = path.resolve(import.meta.dirname, "../..");
const STORY_ROOT_BASENAME = /^videoagent-story-local-case(?:-test-[A-Za-z0-9._-]+)?$/u;
const UUID_NAMESPACE = "de2fa034-cd10-5a5b-bf5e-73453b50a638";
const CASE_VERSION = "canvas-local-manual-case-v1";
const OPERATIONS_NOW = new Date("2026-08-14T09:00:00.000Z");
const TERMS_DOCUMENT_CODE = "canvas-local-case-terms";
const TERMS_TITLE = "完整本地人工案例运营条款 [CANVAS_FULL_CASE_TERMS]";
const TERMS_VERSION_LABEL = "v1-local-draft";
const TERMS_CONTENT = [
  "[CANVAS_FULL_CASE_TERMS] 本文件仅用于本地人工案例的 Platform Terms 运营页面校验。",
  "状态固定为 DRAFT，不构成发布条款、用户同意或付费承诺。",
].join("\n");
const REDEEMER = "storycanvas-production-plane";
const expectedReasonCodes = [
  "PROVIDER_UNAVAILABLE",
  "ENTITY_BINDING_MISSING",
  "CAPABILITY_UNAVAILABLE",
] as const;

const caseIds = {
  brandFacts: [
    "71000000-0000-4000-8000-000000000001",
    "71000000-0000-4000-8000-000000000002",
    "71000000-0000-4000-8000-000000000003",
  ],
  storyboard: {
    draftRevisionId: "72000000-0000-4000-8000-000000000001",
    shotIds: [
      "72000000-0000-4000-8000-000000000002",
      "72000000-0000-4000-8000-000000000003",
      "72000000-0000-4000-8000-000000000004",
    ],
    commandId: "72000000-0000-4000-8000-000000000005",
    receiptId: "72000000-0000-4000-8000-000000000006",
  },
} as const;

const assetFixtures: readonly {
  category: Extract<AssetCategory, "virtual_character" | "store" | "product" | "brand">;
  displayName: string;
  sourcePath: string;
  storageReference: string;
}[] = [
  {
    category: "virtual_character",
    displayName: "咖啡门店讲解员",
    sourcePath: "public/media/reference-barista.png",
    storageReference: "local-manual-case/reference-barista.png",
  },
  {
    category: "store",
    displayName: "街角咖啡门店",
    sourcePath: "public/media/reference-cafe.png",
    storageReference: "local-manual-case/reference-cafe.png",
  },
  {
    category: "product",
    displayName: "手冲咖啡招牌套餐",
    sourcePath: "public/media/shot-03-pourover.png",
    storageReference: "local-manual-case/shot-03-pourover.png",
  },
  {
    category: "brand",
    displayName: "VideoAgent 门店品牌标识",
    sourcePath: "public/media/storycanvas-logo.png",
    storageReference: "local-manual-case/storycanvas-logo.png",
  },
] as const;

function fail(code: string): never {
  throw new Error(code);
}

function parseTarget(argv: readonly string[]): LocalManualCaseTarget {
  const inline = argv.find((value) => value.startsWith("--target="));
  const separated = argv.findIndex((value) => value === "--target");
  const value = inline?.slice("--target=".length)
    ?? (separated >= 0 ? argv[separated + 1] : undefined);
  if (value !== "local" && value !== "test") fail("LOCAL_CASE_TARGET_INVALID");
  return value;
}

function parseSecret(value: string | undefined, code: string): string {
  if (!value || Buffer.byteLength(value, "utf8") < 32 || value.length > 512) fail(code);
  return value;
}

function parseDatabaseUrl(value: string | undefined, target: LocalManualCaseTarget): string {
  if (!value) fail("LOCAL_CASE_DATABASE_URL_REQUIRED");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail("LOCAL_CASE_DATABASE_URL_INVALID");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) {
    fail("LOCAL_CASE_DATABASE_MUST_BE_LOOPBACK");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    fail("LOCAL_CASE_DATABASE_URL_INVALID");
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (target === "local" ? databaseName !== "videoagent_control" : !databaseName.endsWith("_test")) {
    fail("LOCAL_CASE_DATABASE_TARGET_INVALID");
  }
  return value;
}

function parseRoot(value: string | undefined, code: string): string {
  if (!value || !path.isAbsolute(value)) fail(code);
  const normalized = path.resolve(value);
  if (normalized !== value || path.parse(normalized).root === normalized || normalized.includes("\0")) {
    fail(code);
  }
  return normalized;
}

function containsPath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function parseLocalManualCaseOptions(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): LocalManualCaseOptions {
  const target = parseTarget(argv);
  if (target === "test" && environment.PILOT_E2E !== "true") {
    fail("LOCAL_CASE_TEST_MODE_REQUIRED");
  }
  const databaseUrl = parseDatabaseUrl(
    target === "local" ? environment.DATABASE_URL : environment.CONTROL_API_TEST_DATABASE_URL,
    target,
  );
  const storyRoot = parseRoot(environment.STORYCANVAS_LOCAL_CASE_ROOT, "LOCAL_CASE_STORY_ROOT_INVALID");
  const assetStorageRoot = parseRoot(environment.CANVAS_ASSET_STORAGE_ROOT, "LOCAL_CASE_ASSET_ROOT_INVALID");
  if (!STORY_ROOT_BASENAME.test(path.basename(storyRoot))) fail("LOCAL_CASE_STORY_ROOT_INVALID");
  if (containsPath(storyRoot, assetStorageRoot) || containsPath(assetStorageRoot, storyRoot)) {
    fail("LOCAL_CASE_ROOTS_OVERLAP");
  }
  const accountPassword = target === "test" || environment.PILOT_LOCAL_ACCOUNT_PASSWORD
    ? parsePilotLocalAccountPassword(environment.PILOT_LOCAL_ACCOUNT_PASSWORD)
    : null;
  const needsDevelopmentFallback = target === "local" && (
    !environment.RECHARGE_PAYMENT_DIGEST_SECRET
    || !environment.CANVAS_ACTIVATION_IDEMPOTENCY_SECRET
    || !environment.CANVAS_APPROVAL_FINGERPRINT_SECRET
  );
  const controlConfig = needsDevelopmentFallback ? loadConfig(environment) : null;
  const projectGrantActiveKid = environment.PROJECT_GRANT_ACTIVE_KID?.trim();
  if (!projectGrantActiveKid || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(projectGrantActiveKid)) {
    fail("LOCAL_CASE_PROJECT_GRANT_KID_INVALID");
  }
  const projectId = environment.PILOT_LOCAL_CASE_PROJECT_ID?.trim() || null;
  if (projectId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(projectId)) {
    fail("LOCAL_CASE_PROJECT_ID_INVALID");
  }
  return {
    target,
    databaseUrl,
    storyRoot,
    assetStorageRoot,
    projectId,
    accountPassword,
    projectGrantSigningSecret: parseSecret(
      environment.PROJECT_GRANT_SIGNING_SECRET,
      "LOCAL_CASE_PROJECT_GRANT_SECRET_INVALID",
    ),
    projectGrantActiveKid,
    canvasEntryDigestSecret: parseSecret(
      environment.RECHARGE_PAYMENT_DIGEST_SECRET ?? controlConfig?.rechargePaymentDigestSecret,
      "LOCAL_CASE_ENTRY_DIGEST_SECRET_INVALID",
    ),
    canvasActivationSecret: parseSecret(
      environment.CANVAS_ACTIVATION_IDEMPOTENCY_SECRET
        ?? controlConfig?.canvasActivationIdempotencySecret,
      "LOCAL_CASE_ACTIVATION_SECRET_INVALID",
    ),
    canvasApprovalSecret: parseSecret(
      environment.CANVAS_APPROVAL_FINGERPRINT_SECRET
        ?? controlConfig?.canvasApprovalFingerprintSecret,
      "LOCAL_CASE_APPROVAL_SECRET_INVALID",
    ),
    resetTestTarget: true,
    environment: { ...environment },
  };
}

function stableUuid(name: string): string {
  const bytes = createHash("sha1")
    .update(Buffer.from(UUID_NAMESPACE.replaceAll("-", ""), "hex"))
    .update(name, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonValue<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function exactRow(
  row: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
  code = "LOCAL_CASE_FOUNDATION_CONFLICT",
): void {
  if (!row) fail(code);
  for (const [key, value] of Object.entries(expected)) {
    if (row[key] !== value) fail(code);
  }
}

async function ensureLocalFoundation(database: Knex, password: string | null): Promise<void> {
  const ids = pilotE2eFixtureIds;
  const accountOrganization: Record<string, string> = {
    platformAdmin: ids.organizations.platform,
    channelAdminA: ids.organizations.channelA,
    tenantAdminA: ids.organizations.tenantA,
    tenantOperatorA: ids.organizations.tenantA,
  };
  const organizationRows = [
    {
      organization_id: ids.organizations.platform,
      organization_type: "PLATFORM",
      display_name: "VideoAgent 本地平台",
      status: "active",
      parent_organization_id: null,
    },
    {
      organization_id: ids.organizations.channelA,
      organization_type: "CHANNEL",
      display_name: "VideoAgent 本地渠道",
      status: "active",
      parent_organization_id: ids.organizations.platform,
    },
    {
      organization_id: ids.organizations.tenantA,
      organization_type: "TENANT",
      display_name: "街角咖啡门店",
      status: "active",
      parent_organization_id: ids.organizations.channelA,
    },
  ];

  let passwordHash: string | null = null;
  await database.transaction(async (transaction) => {
    await transaction.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [CASE_VERSION]);
    for (const organization of organizationRows) {
      await transaction("control_plane.organizations").insert(organization)
        .onConflict("organization_id").ignore();
      const row = await transaction("control_plane.organizations")
        .where({ organization_id: organization.organization_id }).first();
      exactRow(row, {
        organization_id: organization.organization_id,
        organization_type: organization.organization_type,
        status: "active",
        parent_organization_id: organization.parent_organization_id,
      });
    }
    await transaction("control_plane.tenants").insert({
      tenant_id: ids.tenants.tenantA,
      organization_id: ids.organizations.tenantA,
      display_name: "街角咖啡门店",
      status: "active",
    }).onConflict("tenant_id").ignore();
    exactRow(await transaction("control_plane.tenants").where({ tenant_id: ids.tenants.tenantA }).first(), {
      tenant_id: ids.tenants.tenantA,
      organization_id: ids.organizations.tenantA,
      status: "active",
    });
    await transaction("control_plane.channels").insert({
      channel_id: ids.channels.channelA,
      organization_id: ids.organizations.channelA,
    }).onConflict("channel_id").ignore();
    exactRow(await transaction("control_plane.channels").where({ channel_id: ids.channels.channelA }).first(), {
      channel_id: ids.channels.channelA,
      organization_id: ids.organizations.channelA,
    });

    for (const account of PILOT_LOCAL_ACCOUNTS) {
      const userId = ids.users[account.accountKey];
      const existingUser = await transaction("control_plane.users").where({ user_id: userId }).first();
      if (!existingUser) {
        if (!password) fail("LOCAL_CASE_ACCOUNT_PASSWORD_REQUIRED");
        passwordHash ??= await hashPassword(password);
        await transaction("control_plane.users").insert({
          user_id: userId,
          email: account.email,
          display_name: account.displayName,
          password_hash: passwordHash,
          status: "active",
        });
      }
      const user = await transaction("control_plane.users").where({ user_id: userId }).first();
      exactRow(user, { user_id: userId, email: account.email, status: "active" });
      const membershipId = ids.memberships[account.accountKey];
      const organizationId = accountOrganization[account.accountKey];
      await transaction("control_plane.organization_memberships").insert({
        membership_id: membershipId,
        user_id: userId,
        organization_id: organizationId,
        status: "active",
        primary_role_code: account.role,
        version: 1,
      }).onConflict("membership_id").ignore();
      await transaction("control_plane.organization_membership_roles").insert({
        membership_id: membershipId,
        role_code: account.role,
      }).onConflict(["membership_id", "role_code"]).ignore();
      exactRow(
        await transaction("control_plane.organization_memberships")
          .where({ membership_id: membershipId }).first(),
        {
          membership_id: membershipId,
          user_id: userId,
          organization_id: organizationId,
          status: "active",
          primary_role_code: account.role,
          version: 1,
        },
      );
    }

    await transaction("control_plane.projects").insert({
      project_id: ids.project,
      tenant_id: ids.tenants.tenantA,
      name: "街角咖啡 · 人工案例",
      status: "active",
      platform: "douyin",
      aspect_ratio: "9:16",
      target_duration_seconds: 30,
      created_by: ids.users.tenantAdminA,
    }).onConflict("project_id").ignore();
    exactRow(await transaction("control_plane.projects").where({ project_id: ids.project }).first(), {
      project_id: ids.project,
      tenant_id: ids.tenants.tenantA,
      status: "active",
      platform: "douyin",
      aspect_ratio: "9:16",
      target_duration_seconds: 30,
    });
    await transaction("control_plane.project_assignments").insert({
      project_assignment_id: ids.projectAssignment,
      project_id: ids.project,
      membership_id: ids.memberships.tenantOperatorA,
      tenant_id: ids.tenants.tenantA,
      organization_id: ids.organizations.tenantA,
      access_level: "editor",
      status: "active",
      assignment_source: "manual",
      backfill_run_id: null,
      created_by: ids.users.tenantAdminA,
      revoked_at: null,
    }).onConflict("project_assignment_id").ignore();
    exactRow(
      await transaction("control_plane.project_assignments")
        .where({ project_assignment_id: ids.projectAssignment }).first(),
      {
        project_assignment_id: ids.projectAssignment,
        project_id: ids.project,
        membership_id: ids.memberships.tenantOperatorA,
        status: "active",
        assignment_source: "manual",
      },
    );
  });
}

async function resolveLocalAuthority(
  database: Knex,
  options: LocalManualCaseOptions,
): Promise<CaseAuthority> {
  const users = await database("control_plane.users")
    .select("user_id", "email", "status")
    .whereIn("email", PILOT_LOCAL_ACCOUNTS.map(({ email }) => email));
  if (users.length === 0 && options.accountPassword) {
    await ensureLocalFoundation(database, options.accountPassword);
    return await resolveLocalAuthority(database, { ...options, accountPassword: null });
  }
  if (users.length !== PILOT_LOCAL_ACCOUNTS.length) fail("LOCAL_CASE_ACCOUNT_FACTS_AMBIGUOUS");

  const membershipIds = {} as CaseAuthority["membershipIds"];
  const userIds = {} as CaseAuthority["userIds"];
  let operatorMembership: Record<string, unknown> | null = null;
  for (const account of PILOT_LOCAL_ACCOUNTS) {
    const matches = users.filter(({ email }) => email === account.email);
    if (matches.length !== 1 || matches[0].status !== "active") {
      fail("LOCAL_CASE_ACCOUNT_FACTS_AMBIGUOUS");
    }
    const memberships = await database("control_plane.organization_memberships")
      .where({ user_id: matches[0].user_id, status: "active" })
      .limit(2);
    if (memberships.length !== 1 || memberships[0].primary_role_code !== account.role) {
      fail("LOCAL_CASE_ROLE_FACTS_INVALID");
    }
    membershipIds[account.accountKey] = String(memberships[0].membership_id);
    userIds[account.accountKey] = String(matches[0].user_id);
    if (account.accountKey === "tenantOperatorA") operatorMembership = memberships[0];
  }
  if (!operatorMembership) fail("LOCAL_CASE_OPERATOR_MISSING");
  const organizationId = String(operatorMembership.organization_id);
  const organization = await database("control_plane.organizations")
    .where({ organization_id: organizationId, organization_type: "TENANT", status: "active" })
    .first();
  const tenantRows = await database("control_plane.tenants")
    .where({ organization_id: organizationId, status: "active" }).limit(2);
  if (!organization || tenantRows.length !== 1) fail("LOCAL_CASE_TENANT_FACTS_INVALID");
  const tenantId = String(tenantRows[0].tenant_id);
  const projectId = options.projectId ?? stableUuid(`${CASE_VERSION}:project:${tenantId}`);
  await database.transaction(async (transaction) => {
    await transaction.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `${CASE_VERSION}:project:${tenantId}`,
    ]);
    if (!options.projectId) {
      await transaction("control_plane.projects").insert({
        project_id: projectId,
        tenant_id: tenantId,
        name: "街角咖啡 · 完整本地人工案例 [CANVAS_FULL_CASE_PROJECT]",
        status: "active",
        platform: "douyin",
        aspect_ratio: "9:16",
        target_duration_seconds: 30,
        created_by: userIds.tenantAdminA,
      }).onConflict("project_id").ignore();
    }
    const project = await transaction("control_plane.projects")
      .where({ project_id: projectId, tenant_id: tenantId, status: "active" }).first();
    if (!project) fail("LOCAL_CASE_PROJECT_FACTS_AMBIGUOUS");
    const existingAssignments = await transaction("control_plane.project_assignments").where({
      project_id: projectId,
      membership_id: membershipIds.tenantOperatorA,
      tenant_id: tenantId,
      organization_id: organizationId,
      status: "active",
    }).limit(2);
    if (existingAssignments.length === 0 && !options.projectId) {
      await transaction("control_plane.project_assignments").insert({
        project_assignment_id: stableUuid(`${CASE_VERSION}:assignment:${projectId}`),
        project_id: projectId,
        membership_id: membershipIds.tenantOperatorA,
        tenant_id: tenantId,
        organization_id: organizationId,
        access_level: "editor",
        status: "active",
        assignment_source: "manual",
        backfill_run_id: null,
        created_by: userIds.tenantAdminA,
        revoked_at: null,
      });
    }
  });
  const assignments = await database("control_plane.project_assignments").where({
    project_id: projectId,
    membership_id: membershipIds.tenantOperatorA,
    tenant_id: tenantId,
    organization_id: organizationId,
    status: "active",
  }).limit(2);
  if (assignments.length !== 1 || assignments[0].access_level !== "editor") {
    fail("LOCAL_CASE_PROJECT_ASSIGNMENT_INVALID");
  }
  return {
    projectId,
    roles: PILOT_LOCAL_ACCOUNTS.map(({ role }) => role),
    userIds,
    membershipIds,
    actor: {
      userId: userIds.tenantOperatorA,
      membershipId: membershipIds.tenantOperatorA,
      organizationId: tenantId,
      organizationType: "TENANT",
      tenantId,
      membershipVersion: Number(operatorMembership.version),
      primaryRole: "content_operator",
      roles: ["content_operator"],
    },
  };
}

type OperationsCaseFacts = {
  organizationIds: { platform: string; channel: string; tenant: string };
  invitationIds: { platform: string; channel: string; tenant: string };
  termsDocumentId: string;
  termsVersionId: string;
};

const forbiddenCommerceTables = [
  "credit_conversion_rule_versions",
  "wallets",
  "recharge_orders",
  "recharge_order_events",
  "payment_events",
  "commission_rule_versions",
  "commission_calculation_outcomes",
  "commission_accruals",
  "commission_reversals",
  "commission_settlements",
  "commission_settlement_items",
] as const;

async function commerceCounts(database: Knex): Promise<Record<string, number>> {
  return Object.fromEntries(await Promise.all(forbiddenCommerceTables.map(async (table) => {
    const row = await database(`control_plane.${table}`).count<{ count: string | number }[]>("* as count").first();
    return [table, Number(row?.count ?? 0)];
  })));
}

async function resolveOperationsActor(
  database: Knex,
  authority: CaseAuthority,
  accountKey: "platformAdmin" | "channelAdminA" | "tenantAdminA",
  organizationType: InvitationActor["organizationType"],
  requiredRole: "platform_admin" | "channel_admin" | "tenant_admin",
): Promise<InvitationActor> {
  const membershipId = authority.membershipIds[accountKey];
  const userId = authority.userIds[accountKey];
  const membership = await database("control_plane.organization_memberships as membership")
    .join(
      "control_plane.organizations as organization",
      "organization.organization_id",
      "membership.organization_id",
    )
    .select(
      "membership.membership_id",
      "membership.user_id",
      "membership.organization_id",
      "membership.primary_role_code",
      "organization.organization_type",
    )
    .where({
      "membership.membership_id": membershipId,
      "membership.user_id": userId,
      "membership.status": "active",
      "organization.organization_type": organizationType,
      "organization.status": "active",
    })
    .first();
  const roleRows = await database("control_plane.organization_membership_roles")
    .select("role_code")
    .where({ membership_id: membershipId });
  const roles = roleRows.map(({ role_code }) => String(role_code));
  if (!membership || membership.primary_role_code !== requiredRole || !roles.includes(requiredRole)) {
    fail("LOCAL_CASE_OPERATIONS_ACTOR_INVALID");
  }
  return {
    userId,
    membershipId,
    organizationId: String(membership.organization_id),
    organizationType,
    roles: roles as InvitationActor["roles"],
  };
}

function invitationToken(scope: "platform" | "channel" | "tenant"): string {
  return createHash("sha256").update(`${CASE_VERSION}:invitation-token:${scope}`, "utf8")
    .digest("base64url");
}

function assertRevokedInvitation(
  value: Awaited<ReturnType<InvitationService["revokeInvitation"]>>["value"],
  expected: {
    invitationId: string;
    actor: InvitationActor;
    invitationType: "PLATFORM" | "CHANNEL" | "TENANT_MEMBER";
    targetEmail: string | null;
    targetOrganizationId: string | null;
    attributionChannelId: string | null;
    maxUses: number;
  },
): void {
  if (
    value.invitationId !== expected.invitationId
    || value.issuerMembershipId !== expected.actor.membershipId
    || value.issuerOrganizationId !== expected.actor.organizationId
    || value.invitationType !== expected.invitationType
    || value.targetEmailNormalized !== expected.targetEmail
    || value.targetOrganizationId !== expected.targetOrganizationId
    || value.attributionChannelId !== expected.attributionChannelId
    || value.maxUses !== expected.maxUses
    || value.usedCount !== 0
    || value.status !== "revoked"
    || value.revokedByMembershipId !== expected.actor.membershipId
    || value.revokedAt === null
  ) {
    fail("LOCAL_CASE_INVITATION_CONFLICT");
  }
}

async function ensureOperationsCase(
  database: Knex,
  authority: CaseAuthority,
): Promise<OperationsCaseFacts> {
  const commerceBefore = await commerceCounts(database);
  const facts = await database.transaction(async (transaction) => {
    await transaction.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `${CASE_VERSION}:operations`,
    ]);
    const platform = await resolveOperationsActor(
      transaction,
      authority,
      "platformAdmin",
      "PLATFORM",
      "platform_admin",
    );
    const channel = await resolveOperationsActor(
      transaction,
      authority,
      "channelAdminA",
      "CHANNEL",
      "channel_admin",
    );
    const tenant = await resolveOperationsActor(
      transaction,
      authority,
      "tenantAdminA",
      "TENANT",
      "tenant_admin",
    );
    const channelRow = await transaction("control_plane.channels")
      .select("channel_id")
      .where({ organization_id: channel.organizationId })
      .limit(2);
    if (channelRow.length !== 1) fail("LOCAL_CASE_CHANNEL_FACTS_INVALID");
    const channelId = String(channelRow[0].channel_id);

    const invitationFacts = [
      {
        scope: "platform" as const,
        actor: platform,
        invitationType: "PLATFORM" as const,
        targetEmail: "canvas-local-platform@example.invalid",
        targetOrganizationId: null,
        attributionChannelId: null,
        maxUses: 1,
      },
      {
        scope: "channel" as const,
        actor: channel,
        invitationType: "CHANNEL" as const,
        targetEmail: null,
        targetOrganizationId: null,
        attributionChannelId: channelId,
        maxUses: 100,
      },
      {
        scope: "tenant" as const,
        actor: tenant,
        invitationType: "TENANT_MEMBER" as const,
        targetEmail: "canvas-local-tenant@example.invalid",
        targetOrganizationId: tenant.organizationId,
        attributionChannelId: null,
        maxUses: 1,
      },
    ];
    const invitationIds = {} as OperationsCaseFacts["invitationIds"];
    for (const seed of invitationFacts) {
      const invitationId = stableUuid(`${CASE_VERSION}:invitation:${seed.scope}`);
      const service = new InvitationService(
        new PostgresInvitationRepository(
          transaction,
          () => OPERATIONS_NOW,
          () => invitationId,
        ),
        {
          now: () => OPERATIONS_NOW,
          createToken: () => invitationToken(seed.scope),
        },
      );
      if (seed.scope === "platform") {
        await service.createPlatformInvitation(seed.actor, {
          targetEmail: seed.targetEmail!,
          attributionChannelId: null,
          idempotencyKey: `${CASE_VERSION}:invitation:platform`,
        });
      } else if (seed.scope === "channel") {
        await service.createChannelInvitation(seed.actor, {
          idempotencyKey: `${CASE_VERSION}:invitation:channel`,
        });
      } else {
        await service.createTenantMemberInvitation(seed.actor, {
          targetEmail: seed.targetEmail!,
          idempotencyKey: `${CASE_VERSION}:invitation:tenant`,
        });
      }
      const revoked = await service.revokeInvitation(seed.actor, invitationId);
      assertRevokedInvitation(revoked.value, { invitationId, ...seed });
      invitationIds[seed.scope] = invitationId;
    }

    const termsDocumentId = stableUuid(`${CASE_VERSION}:terms:document`);
    const termsVersionId = stableUuid(`${CASE_VERSION}:terms:version`);
    const termsActor: TermsActor = {
      userId: platform.userId,
      organizationType: platform.organizationType,
      roles: platform.roles,
    };
    const terms = new TermsService(new PostgresTermsRepository(
      transaction,
      () => OPERATIONS_NOW,
      (entity) => entity === "document" ? termsDocumentId : termsVersionId,
    ));
    let document = await transaction("control_plane.terms_documents")
      .whereRaw("lower(document_code) = lower(?)", [TERMS_DOCUMENT_CODE])
      .first();
    if (!document) {
      await terms.createDocument(termsActor, {
        documentCode: TERMS_DOCUMENT_CODE,
        title: TERMS_TITLE,
      });
      document = await transaction("control_plane.terms_documents")
        .where({ terms_document_id: termsDocumentId })
        .first();
    }
    exactRow(document, {
      terms_document_id: termsDocumentId,
      document_code: TERMS_DOCUMENT_CODE,
      title: TERMS_TITLE,
      status: "active",
    }, "LOCAL_CASE_TERMS_CONFLICT");
    let version = await transaction("control_plane.terms_versions")
      .where({
        terms_document_id: termsDocumentId,
        locale: "zh-CN",
        version_label: TERMS_VERSION_LABEL,
      })
      .first();
    if (!version) {
      await terms.createDraft(termsActor, {
        termsDocumentId,
        versionLabel: TERMS_VERSION_LABEL,
        content: TERMS_CONTENT,
        locale: "zh-CN",
        mustReaccept: false,
        supersedesTermsVersionId: null,
      });
      version = await transaction("control_plane.terms_versions")
        .where({ terms_version_id: termsVersionId })
        .first();
    }
    exactRow(version, {
      terms_version_id: termsVersionId,
      terms_document_id: termsDocumentId,
      version_label: TERMS_VERSION_LABEL,
      status: "DRAFT",
      content: TERMS_CONTENT,
      locale: "zh-CN",
      must_reaccept: false,
      published_at: null,
      effective_at: null,
      published_by: null,
      supersedes_terms_version_id: null,
    }, "LOCAL_CASE_TERMS_CONFLICT");
    if (await transaction("control_plane.user_consents")
      .where({ terms_version_id: termsVersionId }).first()) {
      fail("LOCAL_CASE_TERMS_CONSENT_CONFLICT");
    }
    return {
      organizationIds: {
        platform: platform.organizationId,
        channel: channel.organizationId,
        tenant: tenant.organizationId,
      },
      invitationIds,
      termsDocumentId,
      termsVersionId,
    };
  });
  const commerceAfter = await commerceCounts(database);
  if (JSON.stringify(commerceAfter) !== JSON.stringify(commerceBefore)) {
    fail("LOCAL_CASE_FORBIDDEN_COMMERCE_MUTATION");
  }
  return facts;
}

async function prepareControlFoundation(options: LocalManualCaseOptions): Promise<void> {
  if (options.target === "test" && options.resetTestTarget) {
    if (!options.accountPassword) fail("LOCAL_CASE_ACCOUNT_PASSWORD_REQUIRED");
    await resetMigrateSeedPilotLocalAccounts({
      ...options.environment,
      PILOT_E2E: "true",
      CONTROL_API_TEST_DATABASE_URL: options.databaseUrl,
      PILOT_LOCAL_ACCOUNT_PASSWORD: options.accountPassword,
    });
    return;
  }
  const database = controlKnex({ client: "pg", connection: options.databaseUrl, pool: { min: 0, max: 1 } });
  try {
    await migratePilotE2eDatabase(database);
  } finally {
    await database.destroy();
  }
}

async function assertControlPrivileges(database: Knex): Promise<void> {
  const requiredTables = [
    "users",
    "organization_memberships",
    "organizations",
    "tenants",
    "projects",
    "project_assignments",
    "creative_briefs",
    "script_versions",
    "script_approvals",
    "storyboard_versions",
    "storyboard_approvals",
    "production_packages",
    "project_grants",
    "idempotency_records",
    "canvas_entries",
    "canvas_asset_sessions",
    "canvas_asset_records",
    "canvas_asset_materialization_attempts",
    "invitations",
    "terms_documents",
    "terms_versions",
    "user_consents",
  ];
  const result = await database.raw<{ rows: { table_name: string; allowed: boolean }[] }>(`
    select required.table_name,
      has_table_privilege(
        current_user,
        format('control_plane.%I', required.table_name),
        'SELECT,INSERT,UPDATE'
      ) as allowed
    from unnest(?::text[]) as required(table_name)
  `, [requiredTables]);
  if (result.rows.length !== requiredTables.length || result.rows.some(({ allowed }) => !allowed)) {
    fail("LOCAL_CASE_CONTROL_PRIVILEGES_INCOMPLETE");
  }
}

const briefPayload = {
  objective: "[CANVAS_FULL_CASE_BRIEF] 为街角咖啡门店制作一条真实、克制、可核验的 30 秒探店短视频。",
  audience: ["附近三公里内的咖啡爱好者", "工作日午后到店顾客"],
  platforms: ["douyin"],
  brandPolicySnapshot: {
    facts: [
      {
        factId: caseIds.brandFacts[0],
        text: "[CANVAS_FULL_CASE_BRAND] 门店主营现磨咖啡与手冲体验。",
        sourceReference: "local-case://store-profile/menu",
        approved: true as const,
      },
      {
        factId: caseIds.brandFacts[1],
        text: "招牌套餐包含一杯当日手冲与一份烘焙点心。",
        sourceReference: "local-case://store-profile/signature-set",
        approved: true as const,
      },
      {
        factId: caseIds.brandFacts[2],
        text: "门店提供现场咖啡豆风味讲解，不承诺医疗或功效结果。",
        sourceReference: "local-case://store-profile/service-boundary",
        approved: true as const,
      },
    ],
    prohibitedTerms: ["治愈", "全网最低", "百分百有效"],
    requiredDisclosures: ["实际产品与价格以门店当日公示为准"],
    sourceDigest: `sha256:${sha256("street-corner-coffee-local-case-brand-policy-v1")}`,
  },
};

const scriptPayload = {
  title: "街角咖啡探店 · 人工批准脚本",
  content: [
    "[CANVAS_FULL_CASE_SCRIPT] [CANVAS_FULL_CASE_PRODUCTION] 镜头一：从门店外景进入，讲解员介绍这里主营现磨咖啡与手冲体验。",
    "镜头二：展示吧台与咖啡师准备过程，说明招牌套餐包含当日手冲和烘焙点心。",
    "镜头三：以成品近景收尾，提示产品与价格以门店当日公示为准。",
  ].join("\n"),
};

async function ensureApprovedContent(database: Knex, authority: CaseAuthority): Promise<{
  briefId: string;
  scriptId: string;
  scriptApprovalId: string;
  storyboardId: string;
  storyboardApprovalId: string;
}> {
  const currentActor = authority.actor;
  const projectId = authority.projectId;
  const content = new PostgresContentStore(database);
  const brief = await content.createCanonicalBriefVersionForTrustedSeed(
    currentActor,
    projectId,
    briefPayload,
    {
      operation: `brief.create:${projectId}`,
      key: `${CASE_VERSION}:brief`,
      payload: { payload: briefPayload },
    },
  );
  if (!brief) fail("LOCAL_CASE_BRIEF_FAILED");
  const script = await content.createScriptVersion(currentActor, projectId, scriptPayload, {
    operation: `script.create:${projectId}`,
    key: `${CASE_VERSION}:script`,
    payload: { payload: scriptPayload },
  });
  if (!script) fail("LOCAL_CASE_SCRIPT_FAILED");
  const scriptApproval = await content.createApproval(
    currentActor,
    projectId,
    script.value.id,
    { status: "approved", factRiskStatus: "cleared" },
    {
      operation: `script.approval.create:${projectId}:${script.value.id}`,
      key: `${CASE_VERSION}:script-approval`,
      payload: { status: "approved", factRiskStatus: "cleared" },
    },
  );
  if (!scriptApproval) fail("LOCAL_CASE_SCRIPT_APPROVAL_FAILED");

  const storyboardService = new StoryboardAuthorityService(
    new PostgresStoryboardAuthorityStore(database),
  );
  const draft = createStoryboardDraftRevision({
    objectType: "StoryboardDraftRevision",
    contractVersion: "0.2",
    status: "draft",
    tenantId: currentActor.tenantId,
    projectId,
    approvedScriptVersionId: script.value.id,
    approvedScriptDigest: `sha256:${payloadDigest(scriptPayload)}`,
    draftRevisionId: caseIds.storyboard.draftRevisionId,
    revisionNumber: 1,
    previousRevisionId: null,
    shots: [
      {
        shotId: caseIds.storyboard.shotIds[0],
        sequence: 1,
        description: "[CANVAS_FULL_CASE_STORYBOARD] 门店外景与招牌入画，咖啡门店讲解员介绍现磨咖啡和手冲体验",
        durationSeconds: 6,
        sourceMode: "mixed",
      },
      {
        shotId: caseIds.storyboard.shotIds[1],
        sequence: 2,
        description: "吧台中景展示咖啡师称豆、研磨与注水，讲解招牌套餐构成",
        durationSeconds: 8,
        sourceMode: "mixed",
      },
      {
        shotId: caseIds.storyboard.shotIds[2],
        sequence: 3,
        description: "手冲咖啡与烘焙点心成品近景收尾，并展示价格以门店公示为准的提示",
        durationSeconds: 8,
        sourceMode: "mixed",
      },
    ],
    sourceReceipt: {
      providerId: "storycanvas",
      sourceSystem: "storycanvas",
      sourceContractVersion: "0.2",
      commandId: caseIds.storyboard.commandId,
      receiptId: caseIds.storyboard.receiptId,
      receiptDigest: `sha256:${sha256("street-corner-coffee-storyboard-receipt-v1")}`,
      receivedAt: "2026-08-14T08:00:00.000Z",
    },
    generationPolicy: {
      policyId: "local-manual-case-human-reviewed",
      policyVersion: "1.0.0",
    },
    validationSummary: { status: "passed", issueCodes: [] },
    createdAt: "2026-08-14T08:00:01.000Z",
  });
  const storyboard = await storyboardService.createVersion(currentActor, projectId, {
    draft,
    idempotencyKey: `${CASE_VERSION}:storyboard`,
  });
  const storyboardApproval = await storyboardService.createApproval(
    currentActor,
    projectId,
    storyboard.value.id,
    {
      expectedVersion: 1,
      status: "approved",
      factRiskStatus: "cleared",
      idempotencyKey: `${CASE_VERSION}:storyboard-approval`,
    },
  );
  return {
    briefId: brief.value.id,
    scriptId: script.value.id,
    scriptApprovalId: scriptApproval.value.id,
    storyboardId: storyboard.value.id,
    storyboardApprovalId: storyboardApproval.value.id,
  };
}

async function currentExactPackage(
  database: Knex,
  authority: CaseAuthority,
  scriptId: string,
  storyboardId: string,
  now: Date,
): Promise<ProjectProductionPackageV03 | null> {
  const rows = await database("control_plane.production_packages")
    .select("snapshot")
    .where({
      tenant_id: authority.actor.tenantId,
      project_id: authority.projectId,
      contract_version: "0.3",
      status: "ready",
      approved_script_version_id: scriptId,
      approved_storyboard_version_id: storyboardId,
    })
    .where("expires_at", ">", new Date(now.getTime() + 20 * 60_000))
    .orderBy("package_version", "desc")
    .limit(2);
  if (!rows[0]) return null;
  const value = jsonValue<ProjectProductionPackageV03>(rows[0].snapshot);
  return value.scriptVersionId === scriptId && value.storyboardVersionId === storyboardId
    ? value
    : null;
}

async function ensurePackageAndGrant(
  database: Knex,
  options: LocalManualCaseOptions,
  authority: CaseAuthority,
  scriptId: string,
  storyboardId: string,
): Promise<{
  production: PostgresProductionStore;
  productionPackage: ProjectProductionPackageV03;
}> {
  const now = new Date();
  const production = new PostgresProductionStore(
    database,
    new ProjectGrantTokenService(options.projectGrantSigningSecret, options.projectGrantActiveKid),
  );
  let productionPackage = await currentExactPackage(database, authority, scriptId, storyboardId, now);
  if (!productionPackage) {
    const day = now.toISOString().slice(0, 10);
    const created = await production.createPackage(
      authority.actor,
      authority.projectId,
      {
        scriptVersionId: scriptId,
        storyboardVersionId: storyboardId,
        capabilityRequirements: ["video.generate"],
        expiresInSeconds: 86_400,
      },
      {
        operation: "production.package.create",
        key: `${CASE_VERSION}:package:${day}`,
        scope: { projectId: authority.projectId },
        payload: {
          scriptVersionId: scriptId,
          storyboardVersionId: storyboardId,
          capabilityRequirements: ["video.generate"],
          expiresInSeconds: 86_400,
        },
      },
    );
    if (!created) fail("LOCAL_CASE_PACKAGE_FAILED");
    productionPackage = created.value;
  }

  const activeGrants = await database("control_plane.project_grants")
    .where({
      tenant_id: authority.actor.tenantId,
      project_id: authority.projectId,
      package_id: productionPackage.packageId,
      status: "active",
      revoked_at: null,
    })
    .where("expires_at", ">", new Date(now.getTime() + 5 * 60_000))
    .limit(2);
  if (activeGrants.length > 1) fail("LOCAL_CASE_GRANT_AMBIGUOUS");
  if (!activeGrants[0]) {
    const bucket = Math.floor(now.getTime() / (15 * 60_000));
    const grant = await production.issueGrant(
      authority.actor,
      authority.projectId,
      {
        packageId: productionPackage.packageId,
        requestedCapabilities: ["video.generate"],
        requestedScopes: ["production.package.read", "production.task.write"],
        ttlSeconds: 900,
      },
      {
        operation: "production.grant.issue",
        key: `${CASE_VERSION}:grant:${bucket}`,
        scope: { projectId: authority.projectId },
        payload: {
          packageId: productionPackage.packageId,
          requestedCapabilities: ["video.generate"],
          requestedScopes: ["production.package.read", "production.task.write"],
          ttlSeconds: 900,
        },
      },
    );
    if (!grant) fail("LOCAL_CASE_GRANT_FAILED");
  }
  return { production, productionPackage };
}

function entryServices(
  database: Knex,
  production: PostgresProductionStore,
  options: LocalManualCaseOptions,
): { entry: CanvasEntryService; activation: CanvasActivationService } {
  const entry = new CanvasEntryService(
    new PostgresCanvasEntryRepository(database, undefined, undefined, production),
    options.canvasEntryDigestSecret,
  );
  return {
    entry,
    activation: new CanvasActivationService(entry, options.canvasActivationSecret),
  };
}

async function createSetupSession(
  database: Knex,
  production: PostgresProductionStore,
  productionPackage: ProjectProductionPackageV03,
  options: LocalManualCaseOptions,
  authority: CaseAuthority,
  sessionAuthority: CanvasAssetSessionAuthorityService,
): Promise<{ canvasSessionId: string; productionPackage: ProjectProductionPackageV03 }> {
  const services = entryServices(database, production, options);
  const activated = await services.activation.activate(
    authority.actor,
    authority.projectId,
    productionPackage.packageId,
    { activationAttemptId: randomUUID() },
  );
  const canvasSessionId = `pcs_${randomBytes(24).toString("base64url")}`;
  const redemption = await services.entry.redeemEntry({
    handle: activated.entry.handle,
    tenantId: activated.entry.tenantId,
    projectId: activated.entry.projectId,
    packageId: activated.entry.packageId,
    idempotencyKey: `${CASE_VERSION}:setup-redeem:${randomUUID()}`,
    redeemedBy: REDEEMER,
  });
  await sessionAuthority.registerSession({
    handle: activated.entry.handle,
    tenantId: activated.entry.tenantId,
    projectId: activated.entry.projectId,
    packageId: activated.entry.packageId,
    canvasSessionId,
    actorId: authority.actor.userId,
  });
  return { canvasSessionId, productionPackage: redemption.value.productionPackage };
}

async function copyAssetFixtures(assetStorageRoot: string): Promise<Map<AssetCategory, {
  checksum: string;
  storageReference: string;
  displayName: string;
}>> {
  const output = new Map<AssetCategory, { checksum: string; storageReference: string; displayName: string }>();
  for (const fixture of assetFixtures) {
    const source = path.resolve(rootDir, fixture.sourcePath);
    const sourceStat = await stat(source);
    if (!sourceStat.isFile() || sourceStat.size < 1 || sourceStat.size > 8 * 1024 * 1024) {
      fail("LOCAL_CASE_ASSET_SOURCE_INVALID");
    }
    const target = path.resolve(assetStorageRoot, fixture.storageReference);
    if (!containsPath(assetStorageRoot, target) || target === assetStorageRoot) {
      fail("LOCAL_CASE_ASSET_REFERENCE_INVALID");
    }
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    const checksum = `sha256:${sha256(await readFile(target))}`;
    output.set(fixture.category, {
      checksum,
      storageReference: fixture.storageReference,
      displayName: fixture.displayName,
    });
  }
  return output;
}

function assertExistingAsset(
  record: AssetAuthorityRecord,
  authority: CaseAuthority,
  expected: { packageId: string; category: AssetCategory; checksum: string; storageReference: string; displayName: string },
): void {
  if (
    record.tenantId !== authority.actor.tenantId ||
    record.projectId !== authority.projectId ||
    record.packageId !== expected.packageId ||
    record.category !== expected.category ||
    record.checksum !== expected.checksum ||
    record.storageReference !== expected.storageReference ||
    record.displayName !== expected.displayName ||
    record.provenanceKind !== "customer_upload" ||
    record.rightsBasis !== "customer_owned" ||
    record.reuseScope !== "project"
  ) {
    fail("LOCAL_CASE_ASSET_CONFLICT");
  }
}

async function ensureAssets(
  database: Knex,
  options: LocalManualCaseOptions,
  packageId: string,
  canvasSessionId: string,
  authority: CaseAuthority,
  sessionAuthority: CanvasAssetSessionAuthorityService,
): Promise<AssetAuthorityRecord[]> {
  const fixtures = await copyAssetFixtures(options.assetStorageRoot);
  return await database.transaction(async (transaction) => {
    await transaction.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `${CASE_VERSION}:assets:${packageId}`,
    ]);
    const repository = new PostgresCanvasAssetAuthorityRepository(transaction);
    const existing = (await repository.listAssets({
      tenantId: authority.actor.tenantId,
      projectId: authority.projectId,
    })).filter((asset) => asset.packageId === packageId);
    for (const fixture of assetFixtures) {
      const facts = fixtures.get(fixture.category)!;
      const matches = existing.filter((asset) => asset.category === fixture.category);
      if (matches.length > 1) fail("LOCAL_CASE_ASSET_AMBIGUOUS");
      let record: AssetAuthorityRecord | undefined = matches[0];
      const service = new CanvasAssetAuthorityService(repository, options.canvasApprovalSecret, {
        sessionAuthority,
        newId: () => stableUuid(`${CASE_VERSION}:asset:${packageId}:${fixture.category}`),
      });
      if (!record) {
        await service.createAsset(authority.actor, authority.projectId, {
          packageId,
          canvasSessionId,
          category: fixture.category,
          displayName: facts.displayName,
          provenance: { kind: "customer_upload", sourceAssetId: null },
          rights: { status: "pending", basis: "customer_owned", validFrom: null, validUntil: null },
          storageReference: facts.storageReference,
          checksum: facts.checksum,
          reuseScope: "project",
          controlledPreviewUrl: null,
        });
        record = await repository.getAsset({
          tenantId: authority.actor.tenantId,
          projectId: authority.projectId,
          assetId: stableUuid(`${CASE_VERSION}:asset:${packageId}:${fixture.category}`),
        }) ?? undefined;
      }
      if (!record) fail("LOCAL_CASE_ASSET_FAILED");
      assertExistingAsset(record, authority, { packageId, category: fixture.category, ...facts });
      if (record.rightsStatus === "pending") {
        await service.transitionRights(authority.actor, authority.projectId, record.assetId, {
          status: "authorized",
          validFrom: new Date(Date.now() - 60_000).toISOString(),
          validUntil: null,
        });
      } else if (record.rightsStatus !== "authorized" || !record.rightsValidFrom) {
        fail("LOCAL_CASE_ASSET_RIGHTS_CONFLICT");
      }
      record = (await repository.getAsset({
        tenantId: authority.actor.tenantId,
        projectId: authority.projectId,
        assetId: record.assetId,
      }))!;
      if (record.approvalStatus === "pending") {
        await service.transitionApproval(authority.actor, authority.projectId, record.assetId, {
          status: "approved",
        });
      } else if (record.approvalStatus !== "approved") {
        fail("LOCAL_CASE_ASSET_APPROVAL_CONFLICT");
      }
    }
    const completed = (await repository.listAssets({
      tenantId: authority.actor.tenantId,
      projectId: authority.projectId,
    })).filter((asset) => asset.packageId === packageId);
    if (completed.length !== assetFixtures.length) fail("LOCAL_CASE_ASSET_COUNT_INVALID");
    return completed;
  });
}

async function ensureLegacyStoryAnchors(database: StoryKnex): Promise<void> {
  if (!await database.schema.hasTable("o_project")) {
    await database.schema.createTable("o_project", (table) => {
      table.integer("id").primary();
      table.string("projectType");
      table.string("imageModel");
      table.string("imageQuality");
      table.string("videoModel");
      table.text("name");
      table.text("intro");
      table.text("type");
      table.text("artStyle");
      table.text("directorManual");
      table.text("mode");
      table.text("videoRatio");
      table.integer("createTime");
      table.integer("userId");
    });
  }
  if (!await database.schema.hasTable("o_script")) {
    await database.schema.createTable("o_script", (table) => {
      table.integer("id").primary();
      table.text("name");
      table.text("content");
      table.integer("projectId");
      table.integer("extractState");
      table.integer("createTime");
      table.text("errorReason");
    });
  }
  if (!await database.schema.hasTable("o_image")) {
    await database.schema.createTable("o_image", (table) => {
      table.integer("id").primary();
      table.text("filePath");
      table.text("type");
      table.integer("assetsId");
      table.text("model");
      table.text("resolution");
      table.text("state");
      table.text("errorReason");
    });
  }
  if (!await database.schema.hasTable("o_storyboard")) {
    await database.schema.createTable("o_storyboard", (table) => {
      table.integer("id").primary();
      table.integer("scriptId");
      table.text("prompt");
      table.text("filePath");
      table.text("duration");
      table.text("state");
      table.integer("trackId");
      table.text("reason");
      table.text("track");
      table.text("videoDesc");
      table.integer("shouldGenerateImage");
      table.integer("projectId");
      table.integer("flowId");
      table.integer("index");
      table.integer("createTime");
    });
  }
  if (!await database.schema.hasTable("o_video")) {
    await database.schema.createTable("o_video", (table) => {
      table.integer("id").primary();
      table.text("filePath");
      table.text("errorReason");
      table.integer("time");
      table.text("state");
      table.integer("scriptId");
      table.integer("projectId");
      table.integer("videoTrackId");
    });
  }
}

async function ensureStoryProject(
  database: StoryKnex,
  authority: CaseAuthority,
  projectName: string,
): Promise<number> {
  const mappings = await database("sc_external_mappings")
    .where({
      system: "saas-control-plane",
      entityType: "project",
      externalId: authority.projectId,
    })
    .limit(2);
  if (mappings.length > 1) fail("LOCAL_CASE_STORY_PROJECT_AMBIGUOUS");
  if (mappings[0]) {
    const localProjectId = Number(mappings[0].localId);
    if (!Number.isSafeInteger(localProjectId) || localProjectId < 1
      || !await database("o_project").where({ id: localProjectId }).first()) {
      fail("LOCAL_CASE_STORY_PROJECT_CONFLICT");
    }
    return localProjectId;
  }
  const [{ maximum }] = await database("o_project").max({ maximum: "id" });
  const localProjectId = Number(maximum ?? 0) + 1;
  await database.transaction(async (transaction) => {
    await transaction("o_project").insert({
      id: localProjectId,
      projectType: "store-visit",
      name: projectName,
      intro: "街角咖啡完整本地人工案例",
      type: "探店短视频",
      mode: "canvas-v1",
      videoRatio: "9:16",
      createTime: Date.now(),
      userId: 1,
    });
    await transaction("sc_external_mappings").insert({
      id: stableUuid(`${CASE_VERSION}:story-project:${authority.projectId}`),
      system: "saas-control-plane",
      entityType: "project",
      localId: String(localProjectId),
      externalId: authority.projectId,
      metadataJson: JSON.stringify({ tenantId: authority.actor.tenantId, source: CASE_VERSION }),
      createdAt: new Date().toISOString(),
    });
  });
  return localProjectId;
}

async function storyHydrated(
  database: StoryKnex,
  authority: CaseAuthority,
  packageId: string,
  assetId: string,
): Promise<boolean> {
  const scope = {
    tenantId: authority.actor.tenantId,
    projectId: authority.projectId,
    packageId,
  };
  const [packages, documents, assets, requirements, readiness, mappings] = await Promise.all([
    database("sc_production_packages").where({ packageId, tenantId: authority.actor.tenantId }),
    database("sc_canvas_v1_documents").where(scope),
    database("sc_canvas_v1_asset_records").where(scope),
    database("sc_canvas_v1_requirements").where(scope),
    database("sc_canvas_v1_readiness").where(scope),
    database("sc_external_mappings").where({
      system: "saas-control-plane",
      entityType: "canvas-v1-asset",
      externalId: assetId,
    }),
  ]);
  return packages.length === 1 && documents.length === 1 && assets.length === 4
    && requirements.length === 3 && readiness.length === 3 && mappings.length === 1;
}

async function hydrateStory(
  controlDatabase: Knex,
  storyDatabase: StoryKnex,
  options: LocalManualCaseOptions,
  authority: CaseAuthority,
  sessionAuthority: CanvasAssetSessionAuthorityService,
  assetsRepository: PostgresCanvasAssetAuthorityRepository,
  productionPackage: ProjectProductionPackageV03,
  localProjectId: number,
  setupSession: { canvasSessionId: string; productionPackage: ProjectProductionPackageV03 },
  primaryAsset: AssetAuthorityRecord,
): Promise<void> {
  if (setupSession.productionPackage.packageId !== productionPackage.packageId) {
    fail("LOCAL_CASE_SETUP_PACKAGE_CONFLICT");
  }
  const scope: CanvasProductionScope = {
    tenantId: authority.actor.tenantId,
    projectId: authority.projectId,
    packageId: productionPackage.packageId,
    canvasSessionId: setupSession.canvasSessionId,
    actorId: authority.actor.userId,
    localProjectId,
  };
  await acceptCanvasV1RuntimeAuthority(storyDatabase, setupSession.productionPackage);
  const workspaceAuthority = new CanvasWorkspaceAuthorityService({
    sessionAuthority,
    productionAuthority: new PostgresCanvasWorkspaceAuthorityRepository(controlDatabase),
    assets: assetsRepository,
  });
  const prepared = await new CanvasV1WorkspacePreparer({
    database: storyDatabase,
    authorityClient: {
      fetch: async (request) => await workspaceAuthority.read(request) as unknown as CanvasWorkspaceAuthorityV01,
    },
    capabilityAvailable: () => false,
  }).prepare({
    scope,
    approvedPackage: {
      scriptVersionId: productionPackage.scriptVersionId,
      storyboardVersionId: productionPackage.storyboardVersionId,
      approvedScript: { content: productionPackage.approvedScript.content },
      storyboard: productionPackage.storyboard,
    },
    requestId: `${CASE_VERSION}:workspace:${randomUUID()}`,
  });
  const projectedPrimary = prepared.authority.assets.find(({ assetId }) => assetId === primaryAsset.assetId);
  if (!projectedPrimary) fail("LOCAL_CASE_PRIMARY_ASSET_MISSING");
  const controlMaterialization = new CanvasAssetMaterializationService({
    sessionAuthority,
    assets: assetsRepository,
    storage: new LocalCanvasAssetStorageReader(options.assetStorageRoot),
    attempts: new PostgresCanvasAssetMaterializationRepository(controlDatabase),
  });
  await new CanvasV1AssetMaterializer({
    database: storyDatabase,
    client: {
      materialize: async (request) => await controlMaterialization.materialize(request),
    },
    projectsRoot: path.join(options.storyRoot, "projects"),
  }).materialize({
    scope,
    asset: projectedPrimary,
    requestId: `${CASE_VERSION}:materialize:${randomUUID()}`,
    materializationAttemptId: randomUUID(),
  });
}

async function ensureFinalEntry(
  database: Knex,
  production: PostgresProductionStore,
  options: LocalManualCaseOptions,
  authority: CaseAuthority,
  packageId: string,
): Promise<LocalManualCaseSummary["entry"]> {
  const existing = await database("control_plane.canvas_entries")
    .where({
      tenant_id: authority.actor.tenantId,
      project_id: authority.projectId,
      package_id: packageId,
      created_by: authority.actor.userId,
      state: "active",
    })
    .where("expires_at", ">", new Date())
    .orderBy("issued_at", "desc")
    .first();
  const services = entryServices(database, production, options);
  const value = existing
    ? await services.entry.readEntry(authority.actor, authority.projectId, String(existing.handle))
    : (await services.activation.activate(
      authority.actor,
      authority.projectId,
      packageId,
      { activationAttemptId: randomUUID() },
    )).entry;
  return {
    handle: value.handle,
    tenantId: value.tenantId,
    projectId: value.projectId,
    packageId: value.packageId,
    expiresAt: value.expiresAt,
  };
}

async function countRows(
  database: Knex | StoryKnex,
  table: string,
  where: Record<string, unknown>,
): Promise<number> {
  const queryDatabase = database as unknown as Knex;
  const row = await queryDatabase(table).where(where).count<{ count: string | number }[]>("* as count").first();
  return Number(row?.count ?? 0);
}

async function buildSummary(input: {
  options: LocalManualCaseOptions;
  controlDatabase: Knex;
  storyDatabase: StoryKnex;
  contentIds: Awaited<ReturnType<typeof ensureApprovedContent>>;
  authority: CaseAuthority;
  operations: OperationsCaseFacts;
  productionPackage: ProjectProductionPackageV03;
  primaryAssetId: string;
  localProjectId: number;
  entry: LocalManualCaseSummary["entry"];
}): Promise<LocalManualCaseSummary> {
  const scope = {
    tenantId: input.authority.actor.tenantId,
    projectId: input.authority.projectId,
    packageId: input.productionPackage.packageId,
  };
  const project = await input.controlDatabase("control_plane.projects")
    .where({ project_id: input.authority.projectId }).first();
  const roleRows = await input.controlDatabase("control_plane.organization_memberships")
    .select("primary_role_code")
    .whereIn("membership_id", Object.values(input.authority.membershipIds));
  const roles = input.authority.roles;
  if (roleRows.length !== roles.length
    || new Set(roleRows.map(({ primary_role_code }) => primary_role_code)).size !== roles.length
    || roles.some((role) => !roleRows.some(({ primary_role_code }) => primary_role_code === role))) {
    fail("LOCAL_CASE_ROLE_FACTS_INVALID");
  }
  const assets = await input.controlDatabase("control_plane.canvas_asset_records").where({
    tenant_id: input.authority.actor.tenantId,
    project_id: input.authority.projectId,
    package_id: input.productionPackage.packageId,
  });
  const readinessRows = await input.storyDatabase("sc_canvas_v1_readiness").where(scope);
  const observed = new Set<string>();
  for (const row of readinessRows) {
    const projection = jsonValue<Record<string, unknown>>(String(row.projectionJson));
    const codes = Array.isArray(projection.reasonCodes) ? projection.reasonCodes : [];
    for (const code of codes) if (typeof code === "string") observed.add(code);
  }
  const readinessReasonCodes = expectedReasonCodes.filter((code) => observed.has(code));
  if (readinessReasonCodes.length !== expectedReasonCodes.length) {
    fail("LOCAL_CASE_READINESS_NOT_BLOCKED");
  }
  const assetMappings = await input.storyDatabase("sc_external_mappings").where({
    system: "saas-control-plane",
    entityType: "canvas-v1-asset",
    externalId: input.primaryAssetId,
  });
  const media = assetMappings.length === 1
    ? await input.storyDatabase("sc_media_assets").where({ id: assetMappings[0].localId })
    : [];
  const factCounts = {
    projectMapping: await countRows(input.storyDatabase, "sc_external_mappings", {
      system: "saas-control-plane",
      entityType: "project",
      externalId: input.authority.projectId,
    }),
    acceptedPackage: await countRows(input.storyDatabase, "sc_production_packages", {
      tenantId: input.authority.actor.tenantId,
      externalProjectId: input.authority.projectId,
      packageId: input.productionPackage.packageId,
    }),
    document: await countRows(input.storyDatabase, "sc_canvas_v1_documents", scope),
    projectedAssets: await countRows(input.storyDatabase, "sc_canvas_v1_asset_records", scope),
    requirements: await countRows(input.storyDatabase, "sc_canvas_v1_requirements", scope),
    readiness: readinessRows.length,
    media: media.length,
    assetMapping: assetMappings.length,
    providerBindings: await countRows(input.storyDatabase, "sc_canvas_v1_provider_bindings", scope),
    entityBindings: await countRows(input.storyDatabase, "sc_canvas_v1_entity_bindings", scope),
  };
  const authorityCounts = {
    brief: await countRows(input.controlDatabase, "control_plane.creative_briefs", { brief_id: input.contentIds.briefId }),
    script: await countRows(input.controlDatabase, "control_plane.script_versions", { script_version_id: input.contentIds.scriptId }),
    scriptApproval: await countRows(input.controlDatabase, "control_plane.script_approvals", { approval_id: input.contentIds.scriptApprovalId }),
    storyboard: await countRows(input.controlDatabase, "control_plane.storyboard_versions", { storyboard_version_id: input.contentIds.storyboardId }),
    storyboardApproval: await countRows(input.controlDatabase, "control_plane.storyboard_approvals", { storyboard_approval_id: input.contentIds.storyboardApprovalId }),
    package: await countRows(input.controlDatabase, "control_plane.production_packages", { package_id: input.productionPackage.packageId }),
    activeGrant: Number((await input.controlDatabase("control_plane.project_grants").where({
      package_id: input.productionPackage.packageId,
      status: "active",
      revoked_at: null,
    }).where("expires_at", ">", new Date())).length),
    assets: assets.length,
    authorizedAssets: assets.filter(({ rights_status }) => rights_status === "authorized").length,
    approvedAssets: assets.filter(({ approval_status }) => approval_status === "approved").length,
  };
  const operationsCounts = {
    members: {
      platform: await countRows(input.controlDatabase, "control_plane.organization_memberships", {
        organization_id: input.operations.organizationIds.platform,
        status: "active",
      }),
      channel: await countRows(input.controlDatabase, "control_plane.organization_memberships", {
        organization_id: input.operations.organizationIds.channel,
        status: "active",
      }),
      tenant: await countRows(input.controlDatabase, "control_plane.organization_memberships", {
        organization_id: input.operations.organizationIds.tenant,
        status: "active",
      }),
    },
    revokedInvitations: {
      platform: await countRows(input.controlDatabase, "control_plane.invitations", {
        invitation_id: input.operations.invitationIds.platform,
        status: "revoked",
      }),
      channel: await countRows(input.controlDatabase, "control_plane.invitations", {
        invitation_id: input.operations.invitationIds.channel,
        status: "revoked",
      }),
      tenant: await countRows(input.controlDatabase, "control_plane.invitations", {
        invitation_id: input.operations.invitationIds.tenant,
        status: "revoked",
      }),
    },
    terms: {
      documents: await countRows(input.controlDatabase, "control_plane.terms_documents", {
        terms_document_id: input.operations.termsDocumentId,
        status: "active",
      }),
      drafts: await countRows(input.controlDatabase, "control_plane.terms_versions", {
        terms_version_id: input.operations.termsVersionId,
        status: "DRAFT",
      }),
      published: await countRows(input.controlDatabase, "control_plane.terms_versions", {
        terms_document_id: input.operations.termsDocumentId,
        status: "PUBLISHED",
      }),
      consents: await countRows(input.controlDatabase, "control_plane.user_consents", {
        terms_version_id: input.operations.termsVersionId,
      }),
    },
  };
  const [migrationRow] = await input.controlDatabase("control_api_migrations").count("* as count");
  const [storyMigrationRow] = await input.storyDatabase("sc_migrations").count("* as count");
  const semanticFacts = {
    projectId: input.authority.projectId,
    packageId: input.productionPackage.packageId,
    packageDigest: input.productionPackage.payloadDigest,
    entryHandle: input.entry.handle,
    roles,
    authorityCounts,
    operationsCounts,
    factCounts,
    readinessReasonCodes,
  };
  return {
    target: input.options.target,
    status: "BLOCKED_NO_PROVIDER",
    providerConfigured: false,
    paidProviderCalls: 0,
    semanticFingerprint: sha256(JSON.stringify(semanticFacts)),
    entry: input.entry,
    control: {
      migrationCount: Number(migrationRow?.count ?? 0),
      roles,
      projectName: String(project.name),
      authorityCounts,
      operationsCounts,
    },
    story: {
      migrationCount: Number(storyMigrationRow?.count ?? 0),
      localProjectId: input.localProjectId,
      factCounts,
      readinessReasonCodes,
    },
  };
}

export async function runLocalManualCase(
  options: LocalManualCaseOptions,
): Promise<LocalManualCaseSummary> {
  if (options.target === "test" && options.resetTestTarget) {
    await rm(options.storyRoot, { recursive: true, force: true });
  }
  await mkdir(options.storyRoot, { recursive: true });
  await mkdir(options.assetStorageRoot, { recursive: true });
  await prepareControlFoundation(options);

  const controlDatabase = controlKnex({
    client: "pg",
    connection: options.databaseUrl,
    pool: { min: 0, max: 2 },
  });
  const storyDatabase = storyKnex({
    client: "better-sqlite3",
    connection: { filename: path.join(options.storyRoot, "db2.sqlite") },
    useNullAsDefault: true,
  }) as StoryKnex;
  try {
    const migrations = await controlDatabase("control_api_migrations").count<{ count: string }[]>("* as count").first();
    if (Number(migrations?.count ?? 0) !== CONTROL_API_MIGRATION_NAMES.length) {
      fail("LOCAL_CASE_CONTROL_MIGRATIONS_INCOMPLETE");
    }
    await assertControlPrivileges(controlDatabase);
    const authority = await resolveLocalAuthority(controlDatabase, options);
    const operations = await ensureOperationsCase(controlDatabase, authority);
    await ensureLegacyStoryAnchors(storyDatabase);
    await runStoryCanvasMigrations(storyDatabase);
    const project = await controlDatabase("control_plane.projects")
      .where({ project_id: authority.projectId }).first();
    if (!project) fail("LOCAL_CASE_PROJECT_MISSING");
    const localProjectId = await ensureStoryProject(storyDatabase, authority, String(project.name));

    const contentIds = await ensureApprovedContent(controlDatabase, authority);
    const { production, productionPackage } = await ensurePackageAndGrant(
      controlDatabase,
      options,
      authority,
      contentIds.scriptId,
      contentIds.storyboardId,
    );
    const sessionAuthority = new CanvasAssetSessionAuthorityService(
      new PostgresCanvasAssetSessionAuthorityRepository(controlDatabase),
    );
    const assetsRepository = new PostgresCanvasAssetAuthorityRepository(controlDatabase);
    let packageAssets = (await assetsRepository.listAssets({
      tenantId: authority.actor.tenantId,
      projectId: authority.projectId,
    })).filter(({ packageId }) => packageId === productionPackage.packageId);
    let primaryAsset = packageAssets.find(({ category }) => category === "virtual_character");
    const alreadyHydrated = primaryAsset
      ? await storyHydrated(storyDatabase, authority, productionPackage.packageId, primaryAsset.assetId)
      : false;
    if (packageAssets.length !== assetFixtures.length || !primaryAsset || !alreadyHydrated) {
      const setupSession = await createSetupSession(
        controlDatabase,
        production,
        productionPackage,
        options,
        authority,
        sessionAuthority,
      );
      packageAssets = await ensureAssets(
        controlDatabase,
        options,
        productionPackage.packageId,
        setupSession.canvasSessionId,
        authority,
        sessionAuthority,
      );
      primaryAsset = packageAssets.find(({ category }) => category === "virtual_character");
      if (!primaryAsset) fail("LOCAL_CASE_PRIMARY_ASSET_MISSING");
      if (!await storyHydrated(storyDatabase, authority, productionPackage.packageId, primaryAsset.assetId)) {
        await hydrateStory(
          controlDatabase,
          storyDatabase,
          options,
          authority,
          sessionAuthority,
          assetsRepository,
          productionPackage,
          localProjectId,
          setupSession,
          primaryAsset,
        );
      }
    }
    if (!primaryAsset) fail("LOCAL_CASE_PRIMARY_ASSET_MISSING");
    const entry = await ensureFinalEntry(
      controlDatabase,
      production,
      options,
      authority,
      productionPackage.packageId,
    );
    return await buildSummary({
      options,
      controlDatabase,
      storyDatabase,
      contentIds,
      authority,
      operations,
      productionPackage,
      primaryAssetId: primaryAsset.assetId,
      localProjectId,
      entry,
    });
  } finally {
    await Promise.all([controlDatabase.destroy(), storyDatabase.destroy()]);
  }
}

async function main(): Promise<void> {
  try {
    const summary = await runLocalManualCase(parseLocalManualCaseOptions(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({ event: "canvas_local_manual_case_ready", ...summary })}\n`);
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error
      && typeof error.code === "string"
      ? error.code
      : error instanceof Error ? error.message : "LOCAL_CASE_FAILED";
    process.stderr.write(`${JSON.stringify({
      event: "canvas_local_manual_case_failed",
      code: errorCode,
    })}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
