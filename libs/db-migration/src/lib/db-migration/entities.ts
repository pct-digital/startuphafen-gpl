import { z } from 'zod';

export interface DbVersionsTableRow {
  id: number;
  version: number;
  migration_ts: Date;
  rollback_sql: string | null;
  forward_sql: string;
}

export interface ResetFileContent {
  version: number;
  content: string[];
  fileName: string;
}

export interface MigrationProcessed {
  id?: number;
  version: number;
  up: string[];
  down: string[];
}

export const DBMigrationSchema = z.object({
  disable: z.boolean().optional(),
  migrationsDirectory: z.string().optional(),
  isDev: z.boolean().optional(),
});

export const DbMigrationFullConfig = DBMigrationSchema.required({
  migrationsDirectory: true,
});

export type DbMigrationConfig = z.infer<typeof DBMigrationSchema>;

export type DbMigrationFullConfig = z.infer<typeof DbMigrationFullConfig>;
