import type { Knex } from "knex";

export interface StoryCanvasMigration {
  version: string;
  checksum: string;
  up: (knex: Knex) => Promise<void>;
  down: (knex: Knex) => Promise<void>;
}
