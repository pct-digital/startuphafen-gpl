/**
 * Deployment Configuration Schema
 *
 * Zod schema for staging.json/production.json files in the deployment package.
 * These files contain environment-specific configuration for deployments.
 */

import { z } from 'zod';

/** Default Keycloak Docker image */

/** Default Docker network for compose services */
export const DEFAULT_DOCKER_NETWORK = 'assets_local';

/**
 * Schema for deployment configuration (staging.json / production.json)
 */
export const DeploymentConfigSchema = z.object({
  /** Application name (e.g., "startuphafen") - used for path resolution */
  appName: z.string().min(1),

  /** Minimum required disk space in GB (default: 30) */
  minDiskSpaceGB: z.number().int().positive().default(30),

  /** Minimum required free physical memory in MB (default: 1200) */
  minFreeMemoryMB: z.number().int().positive().default(1200),

  /** Docker compose files to use (relative to the json file) */
  composeFiles: z.array(z.string()).min(1),

  /** Maintenance page message shown during deployment */
  maintenanceMessage: z.string().optional(),

  /**
   * Docker volumes for local databases (e.g., ["pgdata", "kcpgdata"]).
   * If set, deploy3 will ensure these volumes exist before starting services.
   * If not set or empty, databases are assumed to be remote.
   */
  localDatabaseVolumes: z.array(z.string()).optional(),

  /**
   * Local database container/service names that need to be started for DB operations.
   * These are Docker Compose service names that match the 'host' field in connection configs.
   *
   * When a database operation targets a host in this array, the helper will:
   * 1. Start the corresponding Docker Compose service
   * 2. Perform the operation
   * 3. Stop the service when done
   *
   * Example: ["database", "keycloak-database"]
   * - If connection.host === "keycloak-database", start that service before queries
   * - If connection.host === "10.0.0.5" (not in array), assume remote DB
   */
  localDatabaseComposeServiceNames: z.array(z.string()).optional(),

  /**
   * Postgres Docker image to use for database operations (e.g., "postgres:15").
   * Required if the maintenance hook needs to create/check databases.
   * Should match the major version of your actual database server.
   */
  postgresImage: z.string().optional(),

  /**
   * Keycloak Docker image to use for realm import/export operations.
   * Required if using Keycloak helpers (cli, server).
   * Should match the version used by your application.
   */
  keycloakImage: z.string().optional(),

  /**
   * Docker network for database/service connections.
   * Default: "assets_local"
   * Used when connecting to local database containers from dockerized tools.
   */
  dockerNetwork: z.string().default(DEFAULT_DOCKER_NETWORK),
});

/**
 * Parsed deployment configuration type
 */
export type DeploymentConfig = z.infer<typeof DeploymentConfigSchema>;

/**
 * Parse DEPLOY_OVERWRITE_CONFIG from environment or raw JSON string.
 * Used to override deployment config values from CI variables.
 *
 * @param envOrJson - Environment dict containing DEPLOY_OVERWRITE_CONFIG, or the raw JSON string
 * @returns Parsed config override object, or undefined if not set
 * @throws Error if the value is set but not valid JSON
 */
export function parseConfigOverride(
  envOrJson: Record<string, string> | string | undefined
): Record<string, unknown> | undefined {
  if (envOrJson === undefined) {
    return undefined;
  }

  // If it's a string, parse it directly
  if (typeof envOrJson === 'string') {
    if (!envOrJson.trim()) {
      return undefined;
    }
    try {
      return JSON.parse(envOrJson);
    } catch (e) {
      throw new Error(
        `DEPLOY_OVERWRITE_CONFIG is not valid JSON: ${(e as Error).message}`
      );
    }
  }

  // If it's an env dict, extract the value
  const overwriteConfigJson = envOrJson['DEPLOY_OVERWRITE_CONFIG'];
  if (!overwriteConfigJson) {
    return undefined;
  }

  try {
    return JSON.parse(overwriteConfigJson);
  } catch (e) {
    throw new Error(
      `DEPLOY_OVERWRITE_CONFIG is not valid JSON: ${(e as Error).message}`
    );
  }
}
