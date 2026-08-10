import { runMigrationGateEnvironmentBoundary } from './migrationGate.js';

process.exitCode = runMigrationGateEnvironmentBoundary(process.env, {
  error(line) {
    process.stderr.write(`${line}\n`);
  },
});
