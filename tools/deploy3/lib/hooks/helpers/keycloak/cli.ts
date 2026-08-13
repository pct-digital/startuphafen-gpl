/**
 * Keycloak CLI Helper
 *
 * Provides utilities for running Keycloak CLI commands (kc.sh) via Docker.
 * Used for realm import and user export operations.
 *
 * These operations run on the target server via SSH, using a temporary Keycloak
 * container that connects to the database (local or remote).
 */

import { DockerClient } from '../../../../infra/docker-client';
import { RemoteFileSystem } from '../../../../infra/file-system';
import { logger } from '../../../utils/logger';
import {
  PostgresConnectionConfig,
  DatabaseSession,
} from '../postgres/postgres';

/**
 * Configuration for KeycloakCliHelper
 */
export interface KeycloakCliHelperConfig {
  /** Docker client for remote operations */
  docker: DockerClient;
  /** Remote file system for directory operations */
  remoteFs: RemoteFileSystem;
  /** Keycloak Docker image to use */
  keycloakImage: string;
  /** Docker network for container communication (used only for local databases) */
  dockerNetwork: string;
  /** Local database container names - if KC DB host is in this list, use docker network */
  localDatabaseComposeServiceNames: string[];
}

/**
 * Options for Keycloak CLI operations
 */
export interface KeycloakCliOptions {
  /** Keycloak database connection config */
  dbConfig: PostgresConnectionConfig;
  /** Realm name for the operation */
  realmName: string;
}

/**
 * Helper for running Keycloak CLI commands.
 * Provided to hooks via context.helpers.keycloak.cli
 */
export class KeycloakCliHelper {
  private readonly docker: DockerClient;
  private readonly remoteFs: RemoteFileSystem;
  private readonly keycloakImage: string;
  private readonly dockerNetwork: string;
  private readonly localDatabaseComposeServiceNames: string[];

  constructor(config: KeycloakCliHelperConfig) {
    this.docker = config.docker;
    this.remoteFs = config.remoteFs;
    this.keycloakImage = config.keycloakImage;
    this.dockerNetwork = config.dockerNetwork;
    this.localDatabaseComposeServiceNames =
      config.localDatabaseComposeServiceNames;
  }

  /**
   * Check if the database host is a local container (needs docker network).
   */
  private isLocalDatabase(host: string): boolean {
    return this.localDatabaseComposeServiceNames.includes(host);
  }

  /**
   * Build environment variables for Keycloak database connection.
   * Converts our PostgresConnectionConfig to Keycloak's expected env vars.
   */
  private buildDbEnvVars(dbConfig: PostgresConnectionConfig): string[] {
    const port = dbConfig.port ?? 5432;
    const jdbcUrl = `jdbc:postgresql://${dbConfig.host}:${port}/${dbConfig.database}`;

    return [
      'KC_DB=postgres',
      `KC_DB_URL=${jdbcUrl}`,
      `KC_DB_USERNAME=${dbConfig.user}`,
      `KC_DB_PASSWORD=${dbConfig.password}`,
    ];
  }

  /**
   * Run a Keycloak CLI command via Docker.
   *
   * @param command - The Keycloak command (e.g., "export --realm myapp --dir /data")
   * @param dbConfig - Database connection configuration
   * @param volumes - Volume mounts for the container
   */
  private runKeycloakCommand(
    command: string,
    dbConfig: PostgresConnectionConfig,
    volumes: string[] = []
  ): void {
    const env = this.buildDbEnvVars(dbConfig);

    // Only use docker network if the KC database is a local container
    const useNetwork = this.isLocalDatabase(dbConfig.host);

    this.docker.run(this.keycloakImage, command, {
      rm: true,
      network: useNetwork ? this.dockerNetwork : undefined,
      env,
      volumes,
    });
  }

  /**
   * Export users from a Keycloak realm to JSON files.
   *
   * This runs `kc.sh export --realm <name> --dir <outputDir>` which produces
   * JSON files containing user data. The files can later be imported via the
   * Keycloak REST API (partialImport).
   *
   * @param outputDir - Directory on the target server to export users to
   * @param options - Realm name and database config
   *
   * @example
   * await helpers.keycloak.cli.exportUsers('/opt/myapp/keycloak-users', {
   *   realmName: 'myapp',
   *   dbConfig: kcDbConfig,
   * });
   */
  exportUsers(outputDir: string, options: KeycloakCliOptions): void {
    const { realmName, dbConfig } = options;

    logger.debug(`Exporting users from realm '${realmName}' to ${outputDir}`);

    // Ensure output directory exists and is writable
    this.remoteFs.mkdir(outputDir);

    // Check if directory exists and get its current permissions
    const originalPermissions = this.remoteFs.getPermissions(outputDir);

    try {
      // Keycloak runs as user 1000, needs write access
      this.remoteFs.chmod(outputDir, '777');

      // Run export command
      // The volume mount makes outputDir available inside the container at the same path
      this.runKeycloakCommand(
        `export --realm ${realmName} --dir ${outputDir}`,
        dbConfig,
        [`${outputDir}:${outputDir}`]
      );

      logger.debug(`User export completed to ${outputDir}`);
    } finally {
      // Restore permissions: original if existed, otherwise sensible default
      this.remoteFs.chmod(outputDir, originalPermissions ?? '755');
    }
  }

  /**
   * Import a Keycloak realm from a JSON file.
   *
   * This runs `kc.sh import --file <realmFile>` which replaces/updates the
   * realm configuration. WARNING: This will overwrite existing realm settings
   * and remove users not in the import file.
   *
   * @param realmFile - Path to the realm.json file on the target server
   * @param options - Realm name (for logging) and database config
   *
   * @example
   * await helpers.keycloak.cli.importRealm('/opt/myapp/keycloak/import/realm.json', {
   *   realmName: 'myapp',
   *   dbConfig: kcDbConfig,
   * });
   */
  importRealm(realmFile: string, options: KeycloakCliOptions): void {
    const { realmName, dbConfig } = options;

    logger.debug(`Importing realm '${realmName}' from ${realmFile}`);

    // Get the directory containing the realm file for the volume mount
    const realmDir = realmFile.substring(0, realmFile.lastIndexOf('/'));

    this.runKeycloakCommand(`import --file ${realmFile}`, dbConfig, [
      `${realmDir}:${realmDir}`,
    ]);

    logger.info(`Keycloak realm '${realmName}' imported`);
  }

  /**
   * Check if a Keycloak realm exists in the database.
   *
   * This queries the Keycloak database directly to check for realm existence.
   * Handles the case where the realm table or name column doesn't exist yet
   * (fresh Keycloak installation).
   *
   * @param db - Database session from withDatabase()
   * @param realmName - Name of the realm to check
   * @returns true if the realm exists, false otherwise
   *
   * @example
   * await helpers.postgres.helper.withDatabase(kcDbConfig, async (db) => {
   *   const exists = helpers.keycloak.cli.realmExists(db, 'myapp');
   *   if (exists) {
   *     // Export users before realm import
   *   }
   * });
   */
  realmExists(db: DatabaseSession, realmName: string): boolean {
    const tableExists = db.queryScalar(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'realm' LIMIT 1`
    );

    if (tableExists !== '1') {
      logger.debug('Keycloak realm table does not exist yet (fresh DB)');
      return false;
    }

    // Check if name column exists (may not exist in a fresh Keycloak DB before first import)
    const columnExists = db.queryScalar(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'realm' AND column_name = 'name' LIMIT 1`
    );

    if (columnExists !== '1') {
      logger.debug('Keycloak name column does not exist yet (fresh DB)');
      return false;
    }

    const result = db.queryScalar(
      `SELECT 1 FROM realm WHERE name='${realmName}' LIMIT 1`
    );

    return result === '1';
  }
}
