/**
 * Postgres Validation Helper
 *
 * Provides validation methods for environment variables needed by PostgresHelper.
 * Used in pre-down hooks to fail fast before stopping the application.
 *
 * These validations ensure that when the maintenance hook later calls
 * postgres.parseBackendSecrets() or postgres.parseKeycloakDbFromDockerEnv(),
 * they won't fail unexpectedly.
 */

import { logger } from '../../../utils/logger';
import { DeploymentConfig } from '../../../../config/deployment-config';
import { DockerClient } from '../../../../infra/docker-client';
import {
  parseBackendSecrets,
  parseKeycloakDbFromDockerEnv,
  PostgresConnectionConfig,
  PostgresHelper,
} from './postgres';

/**
 * Result of version parsing for Postgres.
 */
export interface PostgresVersion {
  major: number;
  minor: number;
  raw: string;
}

/**
 * Configuration for version compatibility check.
 */
export interface VersionCheckConfig {
  /** Docker client for running psql --version */
  docker: DockerClient;
  /** Postgres helper for querying the database */
  postgresHelper: PostgresHelper;
  /** Postgres Docker image to check client version from */
  postgresImage: string;
  /** Database connection configuration to check server version */
  dbConfig: PostgresConnectionConfig;
}

/**
 * Helper for validating Postgres-related environment variables.
 * Used in pre-down hooks to fail fast if configuration is invalid.
 */
export class PostgresValidationHelper {
  /**
   * Validate that APP_BACKEND_SECRETS contains valid JSON matching the expected schema.
   * Call this in pre-down hook to ensure postgres.parseBackendSecrets() will succeed later.
   *
   * @param backendSecretsJson - JSON string from APP_BACKEND_SECRETS env var
   * @throws Error if JSON is invalid or missing required fields
   *
   * @example
   * // In pre-down.js
   * context.helpers.postgres.validateBackendSecretsOrThrow(env.APP_BACKEND_SECRETS);
   */
  validateBackendSecretsOrThrow(backendSecretsJson: string | undefined): void {
    if (!backendSecretsJson) {
      throw new Error('APP_BACKEND_SECRETS is not set');
    }

    // Call the parsing function - it throws on invalid input
    // We discard the result since we only care about validation here
    parseBackendSecrets(backendSecretsJson);

    logger.debug('APP_BACKEND_SECRETS validation passed');
  }

  /**
   * Validate that DEPLOY_DOCKER_ENV contains valid Keycloak database configuration.
   * Call this in pre-down hook to ensure postgres.parseKeycloakDbFromDockerEnv() will succeed later.
   *
   * @param dockerEnv - Content of DEPLOY_DOCKER_ENV (KEY=value per line)
   * @throws Error if required variables are missing or KC_DB_URL format is invalid
   *
   * @example
   * // In pre-down.js
   * context.helpers.postgres.validateKeycloakDbFromDockerEnvOrThrow(env.DEPLOY_DOCKER_ENV);
   */
  validateKeycloakDbFromDockerEnvOrThrow(dockerEnv: string | undefined): void {
    if (!dockerEnv) {
      throw new Error('DEPLOY_DOCKER_ENV is not set');
    }

    // Call the parsing function - it throws on invalid input
    // We discard the result since we only care about validation here
    parseKeycloakDbFromDockerEnv(dockerEnv);

    logger.debug('Keycloak database config validation passed');
  }

  /**
   * Validate that postgresImage is configured in deployment config.
   *
   * Without this, PostgresHelper will throw a cryptic proxy error at runtime.
   *
   * @param deploymentConfig - Parsed deployment configuration
   * @throws Error if postgresImage is not set
   */
  validatePostgresImageConfigured(deploymentConfig: DeploymentConfig): void {
    if (!deploymentConfig.postgresImage) {
      throw new Error(
        "Deployment config is missing 'postgresImage'. " +
          'This is required for database operations during maintenance.'
      );
    }

    logger.debug(
      `Postgres image configured: ${deploymentConfig.postgresImage}`
    );
  }

  /**
   * Test database connectivity by running SELECT 1.
   *
   * @param postgresHelper - Postgres helper for database access
   * @param dbConfig - Database connection configuration
   * @param label - Human-readable label for log messages (e.g., "App database", "Keycloak database")
   * @throws Error if database is unreachable or SELECT 1 fails
   *
   * @example
   * // In pre-down.js
   * const appDbConfig = helpers.postgres.helper.parseBackendSecrets(env.APP_BACKEND_SECRETS);
   * await helpers.postgres.validation.testConnectivity(helpers.postgres.helper, appDbConfig, "App database");
   */
  async testConnectivity(
    postgresHelper: PostgresHelper,
    dbConfig: PostgresConnectionConfig,
    label: string
  ): Promise<void> {
    const connStr = `${dbConfig.host}:${dbConfig.port ?? 5432}/${
      dbConfig.database
    }`;

    await postgresHelper.withDatabase(dbConfig, (db) => {
      const result = db.queryScalar('SELECT 1');
      if (result !== '1') {
        throw new Error(
          `${label} connectivity test failed: expected '1', got '${result}'. Database: ${connStr}`
        );
      }
      logger.debug(`${label} reachable: ${connStr}`);
    });
  }

  /**
   * Extract Postgres client version from a Docker image by running `psql --version`.
   *
   * @param docker - Docker client
   * @param postgresImage - Docker image to extract version from
   * @returns Parsed version object
   * @throws Error if version cannot be parsed
   */
  getClientVersion(
    docker: DockerClient,
    postgresImage: string
  ): PostgresVersion {
    const versionOutput = docker
      .run(postgresImage, 'psql --version', { rm: true })
      .trim();
    const match = versionOutput.match(/psql \(PostgreSQL\) (\d+)\.(\d+)/);

    if (!match) {
      throw new Error(
        `Could not parse Postgres client version from: ${versionOutput}`
      );
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      raw: versionOutput,
    };
  }

  /**
   * Query Postgres server version from a database.
   *
   * @param postgresHelper - Postgres helper for database access
   * @param dbConfig - Database connection configuration
   * @returns Parsed version object
   * @throws Error if version cannot be parsed or database is unreachable
   */
  async getServerVersion(
    postgresHelper: PostgresHelper,
    dbConfig: PostgresConnectionConfig
  ): Promise<PostgresVersion> {
    return postgresHelper.withDatabase(dbConfig, (db) => {
      const serverVersion = db.queryScalar('SHOW server_version');
      const match = serverVersion?.match(/^(\d+)\.(\d+)/);

      if (!match || serverVersion == null) {
        throw new Error(
          `Could not parse Postgres server version: ${serverVersion}. ` +
            `Database: ${dbConfig.host}:${dbConfig.port ?? 5432}/${
              dbConfig.database
            }`
        );
      }

      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        raw: serverVersion,
      };
    });
  }

  /**
   * Validate that Postgres client and server versions are compatible.
   *
   * - Major version mismatch: throws Error (can cause data corruption)
   * - Minor version mismatch: logs warning (usually safe)
   *
   * @param config - Version check configuration
   * @throws Error if major versions don't match
   *
   * @example
   * // In pre-down.js
   * await helpers.postgres.validation.validateVersionCompatibility({
   *   docker: context.docker,
   *   postgresHelper: helpers.postgres.helper,
   *   postgresImage: deploymentConfig.postgresImage,
   *   dbConfig: appDbConfig,
   * });
   */
  async validateVersionCompatibility(
    config: VersionCheckConfig
  ): Promise<void> {
    const { docker, postgresHelper, postgresImage, dbConfig } = config;

    logger.debug(
      `Extracting Postgres client version from image: ${postgresImage}`
    );
    const clientVersion = this.getClientVersion(docker, postgresImage);

    logger.debug(
      `Querying Postgres server version from ${dbConfig.host}:${
        dbConfig.port ?? 5432
      }/${dbConfig.database}`
    );
    const serverVersion = await this.getServerVersion(postgresHelper, dbConfig);

    // Check major version - ERROR if mismatch
    if (serverVersion.major !== clientVersion.major) {
      throw new Error(
        `Postgres major version mismatch! ` +
          `Server: ${serverVersion.major}.${serverVersion.minor} (${serverVersion.raw}) ` +
          `at ${dbConfig.host}:${dbConfig.port ?? 5432}/${
            dbConfig.database
          }, ` +
          `Client: ${clientVersion.major}.${clientVersion.minor} from image ${postgresImage}. ` +
          `This can cause data corruption or migration failures.`
      );
    }

    // Check minor version - WARN if mismatch
    if (serverVersion.minor !== clientVersion.minor) {
      logger.warn(
        `Postgres minor version mismatch: ` +
          `Server: ${serverVersion.major}.${serverVersion.minor} (${serverVersion.raw}), ` +
          `Client: ${clientVersion.major}.${clientVersion.minor}. ` +
          `This is usually safe but consider upgrading.`
      );
    }

    logger.debug(
      `Postgres version OK: server=${serverVersion.major}.${serverVersion.minor} (${serverVersion.raw}), ` +
        `client=${clientVersion.major}.${clientVersion.minor} from ${postgresImage}`
    );
  }
}
