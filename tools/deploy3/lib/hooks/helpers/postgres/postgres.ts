/**
 * Postgres Helper
 *
 * Provides utilities for database initialization during deployment.
 * Supports both local databases (Docker volumes) and remote databases.
 *
 * All database operations use Docker to run psql commands, avoiding the need
 * for psql to be installed on the target server.
 */

import { z } from 'zod';
import { DockerClient, ComposeOptions } from '../../../../infra/docker-client';
import { RemoteFileSystem } from '../../../../infra/file-system';
import { logger } from '../../../utils/logger';

/**
 * Connection configuration for a PostgreSQL database.
 */
export interface PostgresConnectionConfig {
  /** Database host */
  host: string;
  /** Database port (default: 5432) */
  port?: number;
  /** Database user */
  user: string;
  /** Database password */
  password: string;
  /** Database name */
  database: string;
}

/**
 * Configuration for PostgresHelper
 */
export interface PostgresHelperConfig {
  /** Docker client for remote operations */
  docker: DockerClient;
  /** Postgres Docker image to use */
  postgresImage: string;
  /** Docker network for local database connections */
  dockerNetwork: string;
  /** Local database container names (service names that match host field) */
  localDatabaseComposeServiceNames: string[];
  /** Compose options for starting/stopping local containers */
  composeOptions: ComposeOptions;
}

/**
 * Configuration for writing a psql script
 */
export interface WritePsqlScriptConfig {
  /** Absolute path on the remote server where the script should be written */
  scriptPath: string;
  /** Database connection configuration */
  connectionConfig: PostgresConnectionConfig;
  /** Remote file system to write the script */
  fs: RemoteFileSystem;
}

/**
 * Zod schema for PostgresConnectionConfig.
 * Used for runtime validation of database connection configurations.
 */
export const PostgresConnectionConfigSchema = z.object({
  host: z.string().min(1, 'host is required'),
  port: z.number().int().positive().optional(),
  user: z.string().min(1, 'user is required'),
  password: z.string(),
  database: z.string().min(1, 'database is required'),
});

/**
 * Zod schema for validating APP_BACKEND_SECRETS JSON structure.
 * Expects the standard knex connection format.
 */
export const BackendSecretsSchema = z.object({
  knex: z.object({
    connection: PostgresConnectionConfigSchema,
  }),
});

/**
 * Zod schema for validating parsed Keycloak database connection.
 * Port is required here because it's always parsed from KC_DB_URL.
 */
export const KeycloakDbConfigSchema = PostgresConnectionConfigSchema.extend({
  host: z.string().min(1, 'KC_DB_URL host is required'),
  port: z.number().int().positive(), // required for keycloak (parsed from JDBC URL)
  user: z.string().min(1, 'KC_DB_USERNAME is required'),
});

// =============================================================================
// Standalone Parsing Functions
// =============================================================================

/**
 * Parse PostgreSQL connection config from APP_BACKEND_SECRETS JSON.
 * Expects the standard knex connection format under the property "knex"
 *
 * @param backendSecretsJson - JSON string from APP_BACKEND_SECRETS env var
 * @returns Connection configuration for the application database
 * @throws Error if JSON is invalid or missing required fields
 */
export function parseBackendSecrets(
  backendSecretsJson: string
): PostgresConnectionConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(backendSecretsJson);
  } catch (e) {
    throw new Error(
      `APP_BACKEND_SECRETS is not valid JSON: ${(e as Error).message}`
    );
  }

  const result = BackendSecretsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`APP_BACKEND_SECRETS validation failed: ${issues}`);
  }

  const conn = result.data.knex.connection;

  return {
    host: conn.host,
    port: conn.port ?? 5432,
    user: conn.user,
    password: conn.password,
    database: conn.database,
  };
}

/**
 * Parse PostgreSQL connection config from DEPLOY_DOCKER_ENV for Keycloak database.
 * Parses the JDBC URL format used by Keycloak: jdbc:postgresql://host:port/database
 *
 * @param dockerEnv - Content of DEPLOY_DOCKER_ENV (KEY=value per line)
 * @returns Connection configuration for the Keycloak database
 * @throws Error if required variables are missing or KC_DB_URL format is invalid
 */
export function parseKeycloakDbFromDockerEnv(
  dockerEnv: string
): PostgresConnectionConfig {
  const getValue = (key: string): string | undefined => {
    const match = dockerEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : undefined;
  };

  const kcDbUrl = getValue('KC_DB_URL');
  const kcDbUser = getValue('KC_DB_USERNAME');
  const kcDbPassword = getValue('KC_DB_PASSWORD');

  if (!kcDbUrl) {
    throw new Error('DEPLOY_DOCKER_ENV missing KC_DB_URL');
  }

  // Parse JDBC URL: jdbc:postgresql://host:port/database
  const urlMatch = kcDbUrl.match(/jdbc:postgresql:\/\/([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    throw new Error(
      `Invalid KC_DB_URL format: ${kcDbUrl}. Expected jdbc:postgresql://host:port/database`
    );
  }

  const rawConfig = {
    host: urlMatch[1],
    port: parseInt(urlMatch[2], 10),
    user: kcDbUser,
    password: kcDbPassword ?? '',
    database: urlMatch[3],
  };

  const result = KeycloakDbConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Keycloak database config validation failed: ${issues}`);
  }

  // Return as PostgresConnectionConfig - the schema validation ensures all required fields are present
  return {
    host: result.data.host,
    port: result.data.port,
    user: result.data.user,
    password: result.data.password,
    database: result.data.database,
  };
}

/**
 * Database session for executing queries within a withDatabase() block.
 * Provides query methods that work against the connected database.
 */
export interface DatabaseSession {
  /**
   * Execute a SQL query and return the raw output.
   * @param sql - SQL query to execute
   * @returns Raw psql output as string
   */
  query(sql: string): string;

  /**
   * Execute a SQL query and return a single scalar value.
   * @param sql - SQL query that returns a single value
   * @returns The trimmed result, or null if empty
   */
  queryScalar(sql: string): string | null;

  /**
   * Execute a SQL statement (no result expected).
   * @param sql - SQL statement to execute
   */
  exec(sql: string): void;

  /**
   * Execute a SQL query and return rows as objects.
   * @param sql - SQL query to execute
   * @returns Array of row objects with column names as keys
   */
  queryRows(sql: string): Record<string, string>[];

  /** The connection config for this session */
  readonly config: PostgresConnectionConfig;
}

/**
 * Helper for PostgreSQL database operations during deployment.
 * Provided to hooks via context.helpers.postgres
 */
export class PostgresHelper {
  private readonly docker: DockerClient;
  private readonly postgresImage: string;
  private readonly dockerNetwork: string;
  private readonly localDatabaseComposeServiceNames: string[];
  private readonly composeOptions: ComposeOptions;

  constructor(config: PostgresHelperConfig) {
    this.docker = config.docker;
    this.postgresImage = config.postgresImage;
    this.dockerNetwork = config.dockerNetwork;
    this.localDatabaseComposeServiceNames =
      config.localDatabaseComposeServiceNames;
    this.composeOptions = config.composeOptions;
  }

  // =========================================================================
  // Resource Block Pattern: withDatabase
  // =========================================================================

  /**
   * Execute work with a database connection, handling local container lifecycle automatically.
   *
   * If the database host matches a local container name (from localDatabaseComposeServiceNames config),
   * the container is started before work and stopped after. For remote databases, no container
   * management is performed.
   *
   * This is the preferred way to interact with databases as it:
   * - Abstracts away local vs remote database differences
   * - Ensures containers are properly started/stopped
   * - Provides a clean session API for queries
   *
   * @param config - Database connection configuration
   * @param work - Async callback receiving a DatabaseSession
   * @returns The result of the work callback
   *
   * @example
   * // Check if Keycloak realm exists
   * const exists = await helpers.postgres.withDatabase(kcDbConfig, async (db) => {
   *   const result = db.queryScalar("SELECT 1 FROM realm WHERE name='myapp'");
   *   return result === '1';
   * });
   */
  async withDatabase<T>(
    config: PostgresConnectionConfig,
    work: (session: DatabaseSession) => Promise<T> | T
  ): Promise<T> {
    const isLocal = this.isLocalDatabase(config.host);
    let servicesWeStarted: string[] = [];

    if (isLocal) {
      let runningBefore: string[];
      try {
        runningBefore = this.docker.getRunningComposeServices(
          this.composeOptions
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Check for common "directory not found" errors
        if (msg.includes('no such file or directory') || msg.includes('open')) {
          throw new Error(
            `Cannot access local database '${config.host}': compose working directory does not exist. ` +
              `This typically happens when calling withDatabase() for local databases in the pre-down hook, ` +
              `which is not supported because the deployment package hasn't been unpacked yet. ` +
              `For local databases, skip connectivity tests in pre-down and run them in the maintenance hook instead. ` +
              `Original error: ${msg}`
          );
        }
        throw error;
      }

      const wasRunning = runningBefore.includes(config.host);
      if (!wasRunning) {
        logger.debug(`Starting local database container: ${config.host}`);
        this.docker.composeUp(this.composeOptions, [config.host]);

        // Find all services that got started (including dependencies)
        const runningAfter = this.docker.getRunningComposeServices(
          this.composeOptions
        );
        servicesWeStarted = runningAfter.filter(
          (s) => !runningBefore.includes(s)
        );
        if (servicesWeStarted.length > 1) {
          logger.debug(
            `Also started dependencies: ${servicesWeStarted
              .filter((s) => s !== config.host)
              .join(', ')}`
          );
        }

        // Wait for Postgres to be ready to accept connections
        await this.waitForPostgresReady(config);
      } else {
        logger.debug(
          `Local database container already running: ${config.host}`
        );
      }
    }

    try {
      const session = this.createSession(config, isLocal);
      return await work(session);
    } finally {
      if (servicesWeStarted.length > 0) {
        logger.debug(
          `Stopping services we started: ${servicesWeStarted.join(', ')}`
        );
        this.docker.composeDown(this.composeOptions, servicesWeStarted);
      }
    }
  }

  /**
   * Check if a host corresponds to a local database container.
   */
  private isLocalDatabase(host: string): boolean {
    return this.localDatabaseComposeServiceNames.includes(host);
  }

  /**
   * Wait for Postgres to be ready to accept connections.
   * Uses pg_isready to check server status until it succeeds or times out.
   */
  private async waitForPostgresReady(
    config: PostgresConnectionConfig,
    maxAttempts = 30,
    delayMs = 1000
  ): Promise<void> {
    const port = config.port ?? 5432;

    logger.debug(
      `Waiting for Postgres to be ready at ${config.host}:${port}...`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.docker.run(
          this.postgresImage,
          `pg_isready -h ${config.host} -p ${port} -U ${config.user}`,
          { rm: true, network: this.dockerNetwork }
        );
        logger.debug(`Postgres is ready after ${attempt} attempt(s)`);
        return;
      } catch {
        if (attempt === maxAttempts) {
          throw new Error(
            `Postgres at ${
              config.host
            }:${port} not ready after ${maxAttempts} attempts (${
              (maxAttempts * delayMs) / 1000
            }s). ` + `The database container may have failed to start.`
          );
        }
        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Create a database session for executing queries.
   */
  private createSession(
    config: PostgresConnectionConfig,
    isLocal: boolean
  ): DatabaseSession {
    const port = config.port ?? 5432;
    const connectionString = `postgresql://${config.user}:${config.password}@${config.host}:${port}/${config.database}`;

    // For local databases, use the docker network; for remote, no network needed
    const network = isLocal ? this.dockerNetwork : undefined;

    const runPsql = (sql: string, flags = ''): string => {
      return this.docker.run(
        this.postgresImage,
        `psql "${connectionString}" ${flags} -c "${sql.replace(/"/g, '\\"')}"`,
        { rm: true, network }
      );
    };

    return {
      config,

      query(sql: string): string {
        return runPsql(sql);
      },

      queryScalar(sql: string): string | null {
        const result = runPsql(sql, '-t').trim();
        return result === '' ? null : result;
      },

      queryRows(sql: string): Record<string, string>[] {
        // Use CSV format for reliable parsing
        const csv = runPsql(sql, '--csv');
        const lines = csv.trim().split('\n');
        if (lines.length === 0) return [];

        // First line is header
        const headers = lines[0].split(',');

        // Parse remaining lines as data rows
        return lines.slice(1).map((line) => {
          const values = line.split(',');
          const row: Record<string, string> = {};
          for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = values[i] ?? '';
          }
          return row;
        });
      },

      exec(sql: string): void {
        runPsql(sql);
      },
    };
  }

  // =========================================================================
  // Local Database (Docker Volumes)
  // =========================================================================

  /**
   * Ensure all specified Docker volumes exist, creating them if necessary.
   * Used for local database mode where databases run in Docker containers.
   *
   * @param volumes - Array of volume names to ensure exist
   */
  ensureLocalVolumes(volumes: string[]): void {
    for (const volume of volumes) {
      if (!this.docker.volumeExists(volume)) {
        logger.debug(`Creating Docker volume: ${volume}`);
        this.docker.volumeCreate(volume);
      } else {
        logger.debug(`Docker volume already exists: ${volume}`);
      }
    }
  }

  // =========================================================================
  // Direct Database Operations (for simple cases)
  // =========================================================================

  /**
   * Check if a PostgreSQL database exists.
   * For local databases, use withDatabase() instead to ensure the container is running.
   *
   * @param config - Connection configuration (connects to 'postgres' db to check)
   * @returns true if the database exists, false otherwise
   */
  databaseExists(config: PostgresConnectionConfig): boolean {
    const port = config.port ?? 5432;
    const connectionString = `postgresql://${config.user}:${config.password}@${config.host}:${port}/postgres`;
    const network = this.isLocalDatabase(config.host)
      ? this.dockerNetwork
      : undefined;

    try {
      const result = this.docker.run(
        this.postgresImage,
        `psql "${connectionString}" -t -c "SELECT 1 FROM pg_database WHERE datname='${config.database}'"`,
        { rm: true, network }
      );

      const exists = result.trim() === '1';
      logger.debug(`Database '${config.database}' exists: ${exists}`);
      return exists;
    } catch (e) {
      logger.warn(
        `Error checking database existence for '${config.database}': ${
          (e as Error).message
        }`
      );
      return false;
    }
  }

  /**
   * Create a PostgreSQL database.
   * For local databases, use withDatabase() instead to ensure the container is running.
   *
   * @param config - Connection configuration (connects to 'postgres' db to create)
   * @throws Error if database creation fails
   */
  createDatabase(config: PostgresConnectionConfig): void {
    const port = config.port ?? 5432;
    const connectionString = `postgresql://${config.user}:${config.password}@${config.host}:${port}/postgres`;
    const network = this.isLocalDatabase(config.host)
      ? this.dockerNetwork
      : undefined;

    this.docker.run(
      this.postgresImage,
      `psql "${connectionString}" -c "CREATE DATABASE \\"${config.database}\\""`,
      { rm: true, network }
    );

    logger.debug(`Successfully created database: ${config.database}`);
  }

  /**
   * Ensure a PostgreSQL database exists, creating it if necessary.
   * For local databases, use withDatabase() instead to ensure the container is running.
   *
   * @param config - Connection configuration
   */
  ensureDatabase(config: PostgresConnectionConfig): void {
    if (!this.databaseExists(config)) {
      logger.debug(`Database '${config.database}' does not exist, creating...`);
      this.createDatabase(config);
    } else {
      logger.debug(`Database '${config.database}' already exists`);
    }
  }

  // =========================================================================
  // Parsing Utilities (delegate to standalone functions)
  // =========================================================================

  /**
   * Parse PostgreSQL connection config from APP_BACKEND_SECRETS JSON.
   * @see parseBackendSecrets for details
   */
  parseBackendSecrets(backendSecretsJson: string): PostgresConnectionConfig {
    return parseBackendSecrets(backendSecretsJson);
  }

  /**
   * Parse PostgreSQL connection config from DEPLOY_DOCKER_ENV for Keycloak database.
   * @see parseKeycloakDbFromDockerEnv for details
   */
  parseKeycloakDbFromDockerEnv(dockerEnv: string): PostgresConnectionConfig {
    return parseKeycloakDbFromDockerEnv(dockerEnv);
  }

  // =========================================================================
  // Script Generation
  // =========================================================================

  /**
   * Write a psql.sh script to the remote server that opens an interactive psql shell.
   *
   * The generated script:
   * - Uses the configured postgres image
   * - Connects to the docker network if the database is local
   * - Opens an interactive psql session with the provided credentials
   *
   * @param config - Script configuration
   */
  writePsqlScript(config: WritePsqlScriptConfig): void {
    const { scriptPath, connectionConfig, fs } = config;
    const port = connectionConfig.port ?? 5432;
    const isLocal = this.isLocalDatabase(connectionConfig.host);

    // Build connection string
    const connectionString = `postgresql://${connectionConfig.user}:${connectionConfig.password}@${connectionConfig.host}:${port}/${connectionConfig.database}`;

    // Build docker run command
    const networkFlag = isLocal ? `--net=${this.dockerNetwork} ` : '';
    const dockerCmd = `docker run -it --rm ${networkFlag}${this.postgresImage} psql "${connectionString}"`;

    const scriptContent = `#!/bin/bash
# Auto-generated by deploy3 - do not edit manually
# Opens an interactive psql shell to the database
${dockerCmd}
`;

    fs.writeFile(scriptPath, scriptContent, { silent: true });
    fs.chmod(scriptPath, '755', { silent: true });
    logger.debug(`Wrote psql script: ${scriptPath}`);
  }
}
