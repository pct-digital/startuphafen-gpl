/**
 * Keycloak Server Helper
 *
 * Provides utilities for running a temporary Keycloak server during deployment.
 * Used for operations that require the Keycloak REST API, such as user import.
 *
 * The temporary server runs on the target server and is accessed from the CI
 * runner via an SSH tunnel.
 */

import { randomBytes } from 'crypto';
import { DockerClient } from '../../../../infra/docker-client';
import { SshClient } from '../../../../infra/ssh-client';
import { logger } from '../../../utils/logger';
import { quoteShellArg } from '../../../utils/shell';
import { SshTunnelHelper, TunnelInfo } from '../ssh-tunnel';
import { PostgresConnectionConfig } from '../postgres/postgres';

/** Default health check timeout in milliseconds (120 seconds) */
const DEFAULT_HEALTH_TIMEOUT_MS = 120_000;

/** Health check interval in milliseconds */
const HEALTH_CHECK_INTERVAL_MS = 1000;

/**
 * Configuration for KeycloakServerHelper
 */
export interface KeycloakServerHelperConfig {
  /** Docker client for remote operations */
  docker: DockerClient;
  /** SSH client for tunnel operations */
  ssh: SshClient;
  /** Keycloak Docker image to use */
  keycloakImage: string;
  /** Docker network for container communication (used only for local databases) */
  dockerNetwork: string;
  /** Local database container names - if KC DB host is in this list, use docker network */
  localDatabaseComposeServiceNames: string[];
}

/**
 * Admin credentials for the temporary Keycloak server
 */
export interface AdminCredentials {
  username: string;
  password: string;
}

/**
 * Options for withServer()
 */
export interface WithServerOptions {
  /** Keycloak database connection config */
  dbConfig: PostgresConnectionConfig;

  /** Realm name to toggle SSL for */
  realmName: string;

  /**
   * Whether to use an SSH tunnel to access the server.
   * Default: true
   */
  useTunnel?: boolean;

  /**
   * Whether to disable SSL requirement during the operation.
   * This is needed because we access Keycloak via localhost (not HTTPS).
   * Default: true
   */
  disableSsl?: boolean;

  /**
   * Keycloak HTTP port inside the container.
   * Default: 8080
   */
  httpPort?: number;

  /**
   * Keycloak health port inside the container.
   * Default: 9000
   */
  healthPort?: number;

  /**
   * Timeout for waiting for Keycloak to become healthy, in milliseconds.
   * Default: 120000 (120 seconds)
   */
  healthTimeoutMs?: number;
}

/** Container name for the temporary Keycloak server */
const TEMP_CONTAINER_NAME = 'deploy3-keycloak-import';

/**
 * Helper for running a temporary Keycloak server.
 * Provided to hooks via context.helpers.keycloak.server
 */
export class KeycloakServerHelper {
  private readonly docker: DockerClient;
  private readonly ssh: SshClient;
  private readonly keycloakImage: string;
  private readonly dockerNetwork: string;
  private readonly localDatabaseComposeServiceNames: string[];
  private readonly tunnelHelper: SshTunnelHelper;

  constructor(config: KeycloakServerHelperConfig) {
    this.docker = config.docker;
    this.ssh = config.ssh;
    this.keycloakImage = config.keycloakImage;
    this.dockerNetwork = config.dockerNetwork;
    this.localDatabaseComposeServiceNames =
      config.localDatabaseComposeServiceNames;
    this.tunnelHelper = new SshTunnelHelper(config.ssh);
  }

  /**
   * Check if the database host is a local container (needs docker network).
   */
  private isLocalDatabase(host: string): boolean {
    return this.localDatabaseComposeServiceNames.includes(host);
  }

  /**
   * Build environment variables for Keycloak database connection.
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
   * Build environment variables for Keycloak server startup.
   */
  private buildServerEnvVars(dbConfig: PostgresConnectionConfig): string[] {
    return [
      ...this.buildDbEnvVars(dbConfig),
      'KC_HEALTH_ENABLED=true',
      'KC_HOSTNAME_STRICT=false',
      'KC_HTTP_ENABLED=true',
      'KC_PROXY=edge',
      'KC_PROXY_HEADERS=xforwarded',
    ];
  }

  /**
   * Start the temporary Keycloak server.
   */
  private startServer(
    dbConfig: PostgresConnectionConfig,
    httpPort: number,
    healthPort: number
  ): void {
    logger.info('Starting temporary Keycloak server...');

    const env = this.buildServerEnvVars(dbConfig);

    // Only use docker network if the KC database is a local container
    const useNetwork = this.isLocalDatabase(dbConfig.host);

    this.docker.run(this.keycloakImage, 'start-dev', {
      rm: true,
      detach: true,
      name: TEMP_CONTAINER_NAME,
      network: useNetwork ? this.dockerNetwork : undefined,
      env,
      ports: [`${healthPort}:9000`, `${httpPort}:8080`],
    });
  }

  /**
   * Stop the temporary Keycloak server.
   */
  private stopServer(): void {
    logger.info('Stopping temporary Keycloak server...');

    try {
      this.docker.stop(TEMP_CONTAINER_NAME);
      logger.info('Temporary Keycloak server stopped');
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (!msg.includes('No such container')) {
        logger.error(`Failed to stop Keycloak container: ${msg}`);
        throw e;
      }
      // Container already gone, that's fine
    }
  }

  /**
   * Wait for the Keycloak server to become healthy.
   */
  private async waitForHealth(
    healthPort: number,
    timeoutMs: number
  ): Promise<void> {
    const startTime = Date.now();

    logger.info(
      `Waiting for Keycloak to become healthy (timeout: ${
        timeoutMs / 1000
      }s)...`
    );

    let lastError: any = null;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = this.ssh.exec(
          `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${healthPort}/health`,
          { silent: true }
        );

        if (result.trim() === '200') {
          logger.info('Keycloak temporary server is ready');
          return;
        }
      } catch (e) {
        lastError = e;
        // Health check failed, will retry
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed > 0 && elapsed % 10 === 0) {
        logger.debug(`Still waiting for Keycloak... (${elapsed}s elapsed)`);
      }

      await this.sleep(HEALTH_CHECK_INTERVAL_MS);
    }

    logger.error(
      'Failed to get temporary keycloak ready, last error',
      lastError
    );
    throw new Error(
      `Keycloak did not become healthy within ${timeoutMs / 1000} seconds`
    );
  }

  /**
   * Sleep for a given duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a cryptographically secure random string.
   */
  private generateRandomString(length: number): string {
    return randomBytes(length).toString('base64url').slice(0, length);
  }

  /**
   * Generate temporary admin credentials.
   */
  private generateTempCredentials(): AdminCredentials {
    return {
      username: `deploy3-tmp-${this.generateRandomString(8)}`,
      password: this.generateRandomString(32),
    };
  }

  /**
   * Create a temporary admin user via kc.sh bootstrap-admin in a one-off container.
   * This runs before the server starts to avoid port conflicts.
   * Works regardless of existing DB state.
   */
  private bootstrapTempAdmin(
    dbConfig: PostgresConnectionConfig,
    credentials: AdminCredentials
  ): void {
    logger.debug(`Creating temporary admin user '${credentials.username}'...`);

    const passwordEnvVar = 'KC_TEMP_ADMIN_PASSWORD';

    // Only use docker network if the KC database is a local container
    const useNetwork = this.isLocalDatabase(dbConfig.host);

    this.docker.run(
      this.keycloakImage,
      `bootstrap-admin user --username ${quoteShellArg(
        credentials.username
      )} --password:env ${passwordEnvVar} --no-prompt`,
      {
        rm: true,
        network: useNetwork ? this.dockerNetwork : undefined,
        env: [
          ...this.buildDbEnvVars(dbConfig),
          `${passwordEnvVar}=${credentials.password}`,
          'KC_HEALTH_ENABLED=false',
        ],
      }
    );

    logger.debug('Temporary admin user created');
  }

  /** Path to kcadm.sh inside the Keycloak container */
  private readonly kcadmCmd = '/opt/keycloak/bin/kcadm.sh';

  /** Internal server URL for kcadm.sh (inside container) */
  private readonly kcadmServerUrl = 'http://localhost:8080';

  /**
   * Authenticate kcadm.sh with the Keycloak server.
   * Must be called before other kcadm.sh commands.
   */
  private kcadmAuthenticate(
    adminUsername: string,
    adminPassword: string
  ): void {
    this.docker.exec(
      TEMP_CONTAINER_NAME,
      `${this.kcadmCmd} config credentials --server ${
        this.kcadmServerUrl
      } --realm master --user ${quoteShellArg(
        adminUsername
      )} --password ${quoteShellArg(adminPassword)}`
    );
  }

  /**
   * Delete a user from the master realm via kcadm.sh.
   */
  private deleteAdminUser(credentials: AdminCredentials): void {
    logger.debug(`Deleting temporary admin user '${credentials.username}'...`);

    try {
      // Authenticate
      this.kcadmAuthenticate(credentials.username, credentials.password);

      // Find user ID via kcadm.sh
      const usersJson = this.docker.exec(
        TEMP_CONTAINER_NAME,
        `${this.kcadmCmd} get users -r master -q username=${quoteShellArg(
          credentials.username
        )} --fields id,username`
      );

      let users: Array<{ id: string; username: string }>;
      try {
        users = JSON.parse(usersJson || '[]');
      } catch {
        logger.warn(`Failed to parse kcadm.sh output: ${usersJson}`);
        return;
      }

      logger.debug(
        `deleteAdminUser: kcadm.sh returned ${
          users.length
        } user(s): ${JSON.stringify(
          users.map((u) => ({ id: u.id, username: u.username }))
        )}`
      );
      // Keycloak usernames are case-insensitive
      const user = users.find(
        (u) => u.username?.toLowerCase() === credentials.username.toLowerCase()
      );

      if (!user) {
        logger.warn(
          `Temporary admin user '${credentials.username}' not found for deletion`
        );
        return;
      }

      // Delete user via kcadm.sh
      this.docker.exec(
        TEMP_CONTAINER_NAME,
        `${this.kcadmCmd} delete users/${user.id} -r master`
      );

      logger.debug('Temporary admin user deleted');
    } catch (e) {
      const err = e as Error;
      logger.warn(`Failed to delete temporary admin user: ${err.message}`, e);
    }
  }

  /**
   * Set the sslRequired setting for a realm via kcadm.sh.
   * Note: Uses localhost:8080 because that's the internal container port (external port is mapped to it).
   */
  private setSslRequired(
    realmName: string,
    value: 'NONE' | 'EXTERNAL',
    adminUsername: string,
    adminPassword: string
  ): void {
    logger.info(
      `Setting sslRequired=${value} for realm '${realmName}' and 'master'`
    );

    // Authenticate
    this.kcadmAuthenticate(adminUsername, adminPassword);

    // Update app realm
    this.docker.exec(
      TEMP_CONTAINER_NAME,
      `${this.kcadmCmd} update realms/${quoteShellArg(
        realmName
      )} -s sslRequired=${value}`
    );

    // Update master realm
    this.docker.exec(
      TEMP_CONTAINER_NAME,
      `${this.kcadmCmd} update realms/master -s sslRequired=${value}`
    );
  }

  /**
   * Execute work with a temporary Keycloak server running.
   *
   * This method:
   * 1. Creates a temporary admin user via kc.sh bootstrap-admin (one-off container)
   * 2. Starts a temporary Keycloak server on the target host
   * 3. Waits for it to become healthy
   * 4. (Optional) Opens an SSH tunnel from CI runner to the server
   * 5. (Optional) Disables SSL requirement for API access
   * 6. Runs the callback with the server URL and admin credentials
   * 7. (Cleanup) Re-enables SSL requirement
   * 8. (Cleanup) Deletes the temporary admin user
   * 9. (Cleanup) Closes the tunnel
   * 10. (Cleanup) Stops the Keycloak server
   *
   * Cleanup happens even if the callback throws an error.
   *
   * @param options - Server configuration
   * @param work - Async callback receiving the server URL and admin credentials
   * @returns The result of the work callback
   *
   * @example
   * await helpers.keycloak.server.withServer(
   *   {
   *     dbConfig: kcDbConfig,
   *     realmName: 'myapp',
   *   },
   *   async (serverUrl, adminCredentials) => {
   *     // serverUrl = "http://localhost:54321" (via tunnel)
   *     // adminCredentials = { username: 'deploy3-tmp-xyz', password: '...' }
   *     await helpers.keycloak.userImport.importUsers({
   *       host: serverUrl,
   *       adminUsername: adminCredentials.username,
   *       adminPassword: adminCredentials.password,
   *       ...
   *     });
   *   }
   * );
   */
  async withServer<T>(
    options: WithServerOptions,
    work: (serverUrl: string, adminCredentials: AdminCredentials) => Promise<T>
  ): Promise<T> {
    const {
      dbConfig,
      realmName,
      useTunnel = true,
      disableSsl = true,
      httpPort = 8080,
      healthPort = 9000,
      healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
    } = options;

    // Generate temporary admin credentials
    const tempCredentials = this.generateTempCredentials();

    // Create temporary admin user in one-off container (before starting server)
    this.bootstrapTempAdmin(dbConfig, tempCredentials);

    // Start the server
    this.startServer(dbConfig, httpPort, healthPort);

    // Track what we need to clean up
    let sslDisabled = false;

    try {
      // Wait for health
      await this.waitForHealth(healthPort, healthTimeoutMs);

      // Disable SSL if requested
      if (disableSsl) {
        this.setSslRequired(
          realmName,
          'NONE',
          tempCredentials.username,
          tempCredentials.password
        );
        sslDisabled = true;
      }

      // Execute work with or without tunnel
      if (useTunnel) {
        return await this.tunnelHelper.withTunnel(
          { remotePort: httpPort },
          async (tunnel: TunnelInfo) => {
            const serverUrl = `http://localhost:${tunnel.localPort}`;
            logger.debug(`Keycloak accessible at ${serverUrl} (via tunnel)`);
            return await work(serverUrl, tempCredentials);
          }
        );
      } else {
        // No tunnel - caller must handle connectivity themselves
        const serverUrl = `http://127.0.0.1:${httpPort}`;
        logger.debug(`Keycloak accessible at ${serverUrl} (no tunnel)`);
        return await work(serverUrl, tempCredentials);
      }
    } finally {
      // Cleanup: re-enable SSL
      if (sslDisabled) {
        try {
          this.setSslRequired(
            realmName,
            'EXTERNAL',
            tempCredentials.username,
            tempCredentials.password
          );
        } catch (e) {
          logger.warn(`Failed to re-enable SSL: ${(e as Error).message}`);
        }
      }

      // Cleanup: delete temporary admin user
      try {
        this.deleteAdminUser(tempCredentials);
      } catch (e) {
        logger.warn(
          `Failed to delete temporary admin user: ${(e as Error).message}`
        );
      }

      // Cleanup: stop server
      try {
        this.stopServer();
      } catch (e) {
        logger.warn(`Failed to stop Keycloak server: ${(e as Error).message}`);
      }
    }
  }
}
