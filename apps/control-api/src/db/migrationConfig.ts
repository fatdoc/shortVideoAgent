import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Knex } from 'knex';

export function migrationConfig(moduleUrl: string): Knex.MigratorConfig {
  const currentDirectory = dirname(fileURLToPath(moduleUrl));
  const extension = extname(fileURLToPath(moduleUrl));

  return {
    directory: join(currentDirectory, 'migrations'),
    extension: extension === '.ts' ? 'ts' : 'js',
    tableName: 'control_api_migrations',
    schemaName: 'public',
    loadExtensions: extension === '.ts' ? ['.ts'] : ['.js'],
  };
}
