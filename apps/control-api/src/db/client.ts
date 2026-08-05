import knex, { type Knex } from 'knex';
import type { ControlApiConfig } from '../config.js';

export function createDatabase(config: ControlApiConfig): Knex {
  return knex({
    client: 'pg',
    connection: {
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl === 'require' ? { rejectUnauthorized: true } : false,
    },
    pool: {
      min: 0,
      max: 10,
      acquireTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    },
  });
}

export async function probeDatabase(database: Knex): Promise<void> {
  await database.raw('select 1 as ready');
}
