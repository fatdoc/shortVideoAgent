import { runControlApiMigrationGate } from './migrationGate.js';

process.exitCode = await runControlApiMigrationGate(process.env, {
  info(line) {
    process.stdout.write(`${line}\n`);
  },
  error(line) {
    process.stderr.write(`${line}\n`);
  },
});
