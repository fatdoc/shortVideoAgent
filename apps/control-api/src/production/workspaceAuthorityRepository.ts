import type { Knex } from 'knex';
import {
  ProductionAuthorityResourceNotFoundError,
  verifyProductionPackageAuthority,
  type ProductionPackageAuthorityInput,
  type VerifiedProductionPackageAuthority,
} from './authority.js';
import { ProductionDomainError } from './errors.js';
import {
  CanvasWorkspaceAuthorityLookupError,
  type CanvasWorkspaceProductionAuthority,
  type CanvasWorkspaceProductionAuthorityInput,
  type CanvasWorkspaceProductionAuthorityStore,
} from '../assets/workspaceAuthorityTypes.js';

type ProductionAuthorityVerifier = (
  database: Knex.Transaction,
  input: ProductionPackageAuthorityInput,
) => Promise<VerifiedProductionPackageAuthority>;

type ProjectRow = { name: string };
type ScriptRow = { script_version_id: string; version: number };
type StoryboardRow = { storyboard_version_id: string; version: number };

export class PostgresCanvasWorkspaceAuthorityRepository
  implements CanvasWorkspaceProductionAuthorityStore
{
  constructor(
    private readonly database: Knex,
    private readonly verifier: ProductionAuthorityVerifier = verifyProductionPackageAuthority,
  ) {}

  async readExact(
    input: CanvasWorkspaceProductionAuthorityInput,
  ): Promise<CanvasWorkspaceProductionAuthority> {
    try {
      return await this.database.transaction(
        async (transaction) => {
          const verified = await this.verifier(transaction, input);
          const project = (await transaction('control_plane.projects')
            .select('name')
            .where({ tenant_id: input.tenantId, project_id: input.projectId })
            .first()) as ProjectRow | undefined;
          if (!project || typeof project.name !== 'string' || project.name.length === 0) {
            throw new CanvasWorkspaceAuthorityLookupError('project');
          }

          const script = (await transaction('control_plane.script_versions')
            .select('script_version_id', 'version')
            .where({
              tenant_id: input.tenantId,
              project_id: input.projectId,
              script_version_id: verified.scriptVersionId,
            })
            .first()) as ScriptRow | undefined;
          if (!script || !Number.isSafeInteger(script.version) || script.version < 1) {
            throw new CanvasWorkspaceAuthorityLookupError('script');
          }

          const storyboard = (await transaction('control_plane.storyboard_versions')
            .select('storyboard_version_id', 'version')
            .where({
              tenant_id: input.tenantId,
              project_id: input.projectId,
              storyboard_version_id: verified.storyboardVersionId,
            })
            .first()) as StoryboardRow | undefined;
          if (!storyboard || !Number.isSafeInteger(storyboard.version) || storyboard.version < 1) {
            throw new CanvasWorkspaceAuthorityLookupError('storyboard');
          }

          return {
            projectName: project.name,
            scriptId: script.script_version_id,
            scriptVersion: script.version,
            storyboardId: storyboard.storyboard_version_id,
            storyboardVersion: storyboard.version,
          };
        },
        {
          isolationLevel: 'repeatable read',
          readOnly: true,
        },
      );
    } catch (error) {
      if (error instanceof CanvasWorkspaceAuthorityLookupError) throw error;
      if (error instanceof ProductionAuthorityResourceNotFoundError) {
        throw new CanvasWorkspaceAuthorityLookupError('package');
      }
      if (error instanceof ProductionDomainError) {
        throw new CanvasWorkspaceAuthorityLookupError('dependency');
      }
      throw new CanvasWorkspaceAuthorityLookupError('dependency');
    }
  }
}
