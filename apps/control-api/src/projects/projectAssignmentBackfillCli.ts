import { readFile } from 'node:fs/promises';
import type { Knex } from 'knex';
import { loadConfig } from '../config.js';
import { createDatabase } from '../db/client.js';
import {
  runProjectAssignmentBackfill,
  type ProjectAssignmentBackfillResult,
} from './projectAssignmentBackfill.js';

const GENERIC_FAILURE_MESSAGE = '项目授权回填失败。';

type ProjectAssignmentBackfillCliDependencies = {
  readManifestFile: (path: string) => Promise<string>;
  openDatabase: (environment: NodeJS.ProcessEnv) => Knex;
  runBackfill: (database: Knex, input: unknown) => Promise<ProjectAssignmentBackfillResult>;
  writeOutput: (message: string) => void;
  writeError: (message: string) => void;
};

const defaultDependencies: ProjectAssignmentBackfillCliDependencies = {
  readManifestFile: (path) => readFile(path, 'utf8'),
  openDatabase: (environment) => createDatabase(loadConfig(environment)),
  runBackfill: (database, input) => runProjectAssignmentBackfill(database, input),
  writeOutput: (message) => console.info(message),
  writeError: (message) => console.error(message),
};

export async function executeProjectAssignmentBackfillCli(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: ProjectAssignmentBackfillCliDependencies = defaultDependencies,
): Promise<number> {
  let database: Knex | undefined;

  try {
    const manifestPath = environment.PROJECT_ASSIGNMENT_MANIFEST_PATH?.trim();
    if (!manifestPath) throw new Error('manifest path missing');

    const source = await dependencies.readManifestFile(manifestPath);
    if (source.trim().length === 0) throw new Error('manifest file empty');
    const input: unknown = JSON.parse(source);

    database = dependencies.openDatabase(environment);
    const result = await dependencies.runBackfill(database, input);
    dependencies.writeOutput(
      JSON.stringify({
        event: result.replay
          ? 'project_assignment_backfill_replayed'
          : 'project_assignment_backfill_completed',
        ...result,
      }),
    );
    return 0;
  } catch {
    dependencies.writeError(GENERIC_FAILURE_MESSAGE);
    return 1;
  } finally {
    await database?.destroy();
  }
}

if (process.env.NODE_ENV !== 'test') {
  executeProjectAssignmentBackfillCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
