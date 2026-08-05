import { loadConfig } from '../config.js';
import { createDatabase } from './client.js';
import { migrationConfig } from './migrationConfig.js';

const database = createDatabase(loadConfig());

try {
  const [batch, migrations] = await database.migrate.latest(migrationConfig(import.meta.url));
  console.info(JSON.stringify({ event: 'database_migrated', batch, migrations }));
} finally {
  await database.destroy();
}
