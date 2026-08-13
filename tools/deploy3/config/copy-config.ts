/**
 * Copy Configuration Schema
 *
 * Defines the data structure for database copy operations between environments.
 * Used by prep-copy.ts to build the config and copy.ts to execute.
 *
 * Design principles:
 * - Discriminated union on `type` field for future extensibility (e.g., MongoDB)
 * - Reuses PostgresConnectionConfig from postgres helper
 * - SSH config matches existing deploy3 patterns
 */

import { z } from 'zod';
import { PostgresConnectionConfigSchema } from '../lib/hooks/helpers/postgres/postgres';

// =============================================================================
// SSH Config (reused pattern from config/ssh.ts but as data, not from env vars)
// =============================================================================

/**
 * Zod schema for SSH configuration stored in copy config file.
 */
export const CopySshConfigSchema = z.object({
  host: z.string().min(1, 'SSH host is required'),
  port: z.number().int().min(1).max(65535).default(22),
  user: z.string().default('root'),
  keyData: z.string().min(1, 'SSH private key is required'),
});

export type CopySshConfig = z.infer<typeof CopySshConfigSchema>;

// =============================================================================
// Endpoint Config (source or target)
// =============================================================================

/**
 * Zod schema for a copy endpoint (source or target server).
 */
export const CopyEndpointConfigSchema = z.object({
  ssh: CopySshConfigSchema,
  /** Domain for sed replacement (e.g., "staging.example.com") */
  domain: z.string().min(1, 'Domain is required'),
});

export type CopyEndpointConfig = z.infer<typeof CopyEndpointConfigSchema>;

// =============================================================================
// Database Copy Configs (discriminated union for extensibility)
// =============================================================================

/**
 * Zod schema for a Postgres database copy configuration.
 */
export const PostgresDatabaseCopyConfigSchema = z.object({
  type: z.literal('postgres'),
  /** Source database connection configuration */
  sourceConfig: PostgresConnectionConfigSchema,
  /** Target database connection configuration */
  targetConfig: PostgresConnectionConfigSchema,
});

export type PostgresDatabaseCopyConfig = z.infer<
  typeof PostgresDatabaseCopyConfigSchema
>;

/**
 * Discriminated union of all database copy configurations.
 * Extend this union when adding support for other database types (e.g., MongoDB).
 */
export const DatabaseCopyConfigSchema = z.discriminatedUnion('type', [
  PostgresDatabaseCopyConfigSchema,
  // Future: MongoDatabaseCopyConfigSchema,
]);

export type DatabaseCopyConfig = z.infer<typeof DatabaseCopyConfigSchema>;

// =============================================================================
// Top-level Copy Config
// =============================================================================

/**
 * Zod schema for the complete copy configuration.
 */
export const CopyConfigSchema = z.object({
  /** Application name (e.g., "startuphafen") - used for path resolution */
  appName: z.string().min(1, 'Application name is required'),
  source: CopyEndpointConfigSchema,
  target: CopyEndpointConfigSchema,
  databases: z
    .array(DatabaseCopyConfigSchema)
    .min(1, 'At least one database is required'),
  /**
   * Allow copying to a production target.
   * Set by prep-copy.ts when --allow-production was passed (i.e. the operator
   * explicitly confirmed overwriting a production environment).
   * Downgrades the production smoke test from a failure to a warning.
   */
  allowProductionTarget: z.boolean().optional().default(false),
  /**
   * Optional config override for source deployment config.
   * Extracted from source environment's DEPLOY_OVERWRITE_CONFIG.
   * If source has no deploy3 config file, this acts as the full config.
   * If source has a config file, this is merged over it.
   */
  sourceConfigOverride: z.record(z.unknown()).optional(),
  /**
   * Optional config override for target deployment config.
   * Extracted from target environment's DEPLOY_OVERWRITE_CONFIG.
   * Merged over the target's deployment config when loading.
   */
  targetConfigOverride: z.record(z.unknown()).optional(),
});

export type CopyConfig = z.infer<typeof CopyConfigSchema>;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Parse and validate a copy configuration from JSON.
 *
 * @param json - JSON string or parsed object
 * @returns Validated CopyConfig
 * @throws Error if validation fails
 */
export function parseCopyConfig(json: string | unknown): CopyConfig {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  const result = CopyConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Copy config validation failed: ${issues}`);
  }

  return result.data;
}
