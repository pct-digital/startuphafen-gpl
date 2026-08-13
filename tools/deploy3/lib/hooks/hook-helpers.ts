import { DockerClient, ComposeOptions } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { SshClient } from '../../infra/ssh-client';
import {
  DeploymentConfig,
  DEFAULT_DOCKER_NETWORK,
} from '../../config/deployment-config';
import { MergeDeepHelper } from './helpers/merge-deep';
import { KeycloakUserImportHelper } from './helpers/keycloak/user-import';
import { KeycloakRealmMergeHelper } from './helpers/keycloak/realm-merge';
import { KeycloakCliHelper } from './helpers/keycloak/cli';
import { KeycloakServerHelper } from './helpers/keycloak/server';
import { KeycloakValidationHelper } from './helpers/keycloak/validation';
import { KeycloakAdminUserHelper } from './helpers/keycloak/admin-user';
import {
  PostgresHelper,
  PostgresHelperConfig,
} from './helpers/postgres/postgres';
import { PostgresValidationHelper } from './helpers/postgres/validation';
import { TestRunnerHelper } from './helpers/test-runner';
import { SshTunnelHelper } from './helpers/ssh-tunnel';
import { EnvHelper } from './helpers/env-helper';
import { ContainerStabilityHelper } from './helpers/container-stability';

// =============================================================================
// Common Helpers (available to ALL hooks)
// =============================================================================

/**
 * Helpers available to all hooks regardless of lifecycle stage.
 * These are safe to use at any point in the deployment.
 */
export interface CommonHookHelpers {
  /** Deep object merging utility */
  mergeDeep: MergeDeepHelper;
  /** Test runner factory for smoke tests */
  testRunner: TestRunnerHelper;
  /**
   * SSH tunnel helper for accessing services from the target server's network.
   * Use this to reach services that are only accessible from the target server,
   * such as localhost-bound services or internal network resources.
   */
  sshTunnel: SshTunnelHelper;
  /**
   * Environment variable helper for parsing values from env-file content.
   * Defaults to DEPLOY_DOCKER_ENV when no content is provided.
   */
  env: EnvHelper;
}

// =============================================================================
// Hook-specific Helpers
// =============================================================================

/**
 * Postgres helpers available during pre-down.
 */
export interface PreDownPostgresHelpers {
  /**
   * Validation helpers for environment variables.
   * Use to validate that environment variables are correctly configured
   * before the maintenance hook tries to use them.
   */
  validation: PostgresValidationHelper;
  /**
   * Full PostgresHelper for database operations.
   * Use withDatabase() to test connectivity without disrupting running containers.
   * The helper is idempotent: if a container is already running, it won't be stopped.
   */
  helper: PostgresHelper;
}

/**
 * Helpers for pre-down hooks.
 * Runs before the old version is stopped - only read-only/validation helpers.
 */
export interface PreDownHookHelpers extends CommonHookHelpers {
  /**
   * PostgreSQL helpers including validation and database operations.
   * The database helper is idempotent: won't stop containers that were already running.
   */
  postgres: PreDownPostgresHelpers;
  /**
   * Keycloak validation helpers.
   * Use to validate that environment variables and config are correctly set
   * before the maintenance hook tries to use them.
   */
  keycloak: KeycloakValidationHelper;
}

/**
 * Keycloak helpers available during maintenance.
 */
export interface MaintenanceKeycloakHelpers {
  /**
   * Merges keycloak realm configuration from templates, environment overlays, and secrets.
   * Requires .env file to exist (written by orchestrator before maintenance hook).
   */
  realmMerge: KeycloakRealmMergeHelper;
  /**
   * Imports users into Keycloak via the partial import API.
   * Use within keycloak.server.withServer() to ensure Keycloak is running.
   */
  userImport: KeycloakUserImportHelper;
  /**
   * Keycloak CLI operations: exportUsers() and importRealm().
   * These run Keycloak CLI commands via Docker on the target server.
   */
  cli: KeycloakCliHelper;
  /**
   * Temporary Keycloak server management.
   * Use withServer() to spin up a temporary Keycloak for API operations.
   */
  server: KeycloakServerHelper;
  /**
   * Admin user management via REST API.
   * Use to create/configure admin users with non-temporary credentials.
   * Must be used within keycloak.server.withServer() to have a running Keycloak.
   */
  adminUser: KeycloakAdminUserHelper;
}

/**
 * Postgres helpers available during maintenance.
 */
export interface MaintenancePostgresHelpers {
  /**
   * Full PostgresHelper for database operations.
   * Use withDatabase() for query operations (handles local container lifecycle).
   * Use ensureDatabase() for simple database existence checks.
   */
  helper: PostgresHelper;
  /**
   * Validation helpers for version checks.
   * Use for local database version compatibility checks.
   */
  validation: PostgresValidationHelper;
}

/**
 * Helpers for maintenance hooks.
 * Runs during maintenance window - includes setup/destructive helpers.
 */
export interface MaintenanceHookHelpers extends CommonHookHelpers {
  /** Keycloak configuration and user management */
  keycloak: MaintenanceKeycloakHelpers;
  /**
   * PostgreSQL database helpers.
   * Requires postgresImage to be set in deployment config.
   */
  postgres: MaintenancePostgresHelpers;
}

/**
 * Helpers for post-up hooks.
 * Runs after the new version is started - only verification helpers.
 */
export interface PostUpHookHelpers extends CommonHookHelpers {
  /**
   * Container stability checker.
   * Use to verify that services are running and stay running after deployment.
   */
  containerStability: ContainerStabilityHelper;
}

// =============================================================================
// Helper Factory Functions
// =============================================================================

/**
 * Creates helpers common to all hook types.
 * @param ssh - SSH client for the target server (needed for tunnel helper)
 * @param env - Environment variables from hook context
 */
function createCommonHelpers(
  ssh: SshClient,
  env: Record<string, string>
): CommonHookHelpers {
  return {
    mergeDeep: new MergeDeepHelper(),
    testRunner: new TestRunnerHelper(),
    sshTunnel: new SshTunnelHelper(ssh),
    env: new EnvHelper(env),
  };
}

/**
 * Configuration for creating pre-down helpers.
 */
export interface PreDownHelpersConfig {
  /** SSH client for the target server */
  ssh: SshClient;
  /** Docker client for the target server */
  docker: DockerClient;
  /** Deployment configuration */
  deploymentConfig: DeploymentConfig;
  /** Compose options for managing local database containers */
  composeOptions: ComposeOptions;
  /** Environment variables from hook context */
  env: Record<string, string>;
}

/**
 * Creates helpers for pre-down hooks.
 */
export function createPreDownHelpers(
  config: PreDownHelpersConfig
): PreDownHookHelpers {
  const { ssh, docker, deploymentConfig, composeOptions, env } = config;

  const dockerNetwork =
    deploymentConfig.dockerNetwork ?? DEFAULT_DOCKER_NETWORK;
  const localDatabaseComposeServiceNames =
    deploymentConfig.localDatabaseComposeServiceNames ?? [];

  // Create postgres helper - will throw if used without postgresImage configured
  const postgresImage = deploymentConfig.postgresImage;
  const postgresHelper = postgresImage
    ? new PostgresHelper({
        docker,
        postgresImage,
        dockerNetwork,
        localDatabaseComposeServiceNames,
        composeOptions,
      } satisfies PostgresHelperConfig)
    : new Proxy({} as PostgresHelper, {
        get(_target, prop) {
          throw new Error(
            `Cannot use postgres helper: 'postgresImage' is not configured in deployment config. ` +
              `Attempted to access: postgres.helper.${String(prop)}`
          );
        },
      });

  return {
    ...createCommonHelpers(ssh, env),
    postgres: {
      validation: new PostgresValidationHelper(),
      helper: postgresHelper,
    },
    keycloak: new KeycloakValidationHelper(),
  };
}

/**
 * Configuration for creating maintenance helpers.
 */
export interface MaintenanceHelpersConfig {
  /** SSH client for the target server */
  ssh: SshClient;
  /** Docker client for the target server */
  docker: DockerClient;
  /** Remote file system for accessing files on the target server */
  remoteFs: RemoteFileSystem;
  /** Deployment configuration */
  deploymentConfig: DeploymentConfig;
  /** Compose options for managing local database containers */
  composeOptions: ComposeOptions;
  /** Environment variables from hook context */
  env: Record<string, string>;
}

/**
 * Creates helpers for maintenance hooks.
 */
export function createMaintenanceHelpers(
  config: MaintenanceHelpersConfig
): MaintenanceHookHelpers {
  const { ssh, docker, remoteFs, deploymentConfig, composeOptions, env } =
    config;

  const dockerNetwork =
    deploymentConfig.dockerNetwork ?? DEFAULT_DOCKER_NETWORK;
  const localDatabaseComposeServiceNames =
    deploymentConfig.localDatabaseComposeServiceNames ?? [];

  // Create postgres helper - will throw if used without postgresImage configured
  const postgresImage = deploymentConfig.postgresImage;
  const postgresHelper = postgresImage
    ? new PostgresHelper({
        docker,
        postgresImage,
        dockerNetwork,
        localDatabaseComposeServiceNames,
        composeOptions,
      } satisfies PostgresHelperConfig)
    : new Proxy({} as PostgresHelper, {
        get(_target, prop) {
          throw new Error(
            `Cannot use postgres helper: 'postgresImage' is not configured in deployment config. ` +
              `Attempted to access: postgres.${String(prop)}`
          );
        },
      });

  // Create keycloak helpers - cli and server will throw if used without keycloakImage configured
  const keycloakImage = deploymentConfig.keycloakImage;
  const keycloakCliHelper = keycloakImage
    ? new KeycloakCliHelper({
        docker,
        remoteFs,
        keycloakImage,
        dockerNetwork,
        localDatabaseComposeServiceNames,
      })
    : new Proxy({} as KeycloakCliHelper, {
        get(_target, prop) {
          throw new Error(
            `Cannot use keycloak.cli helper: 'keycloakImage' is not configured in deployment config. ` +
              `Attempted to access: keycloak.cli.${String(prop)}`
          );
        },
      });

  const keycloakServerHelper = keycloakImage
    ? new KeycloakServerHelper({
        docker,
        ssh,
        keycloakImage,
        dockerNetwork,
        localDatabaseComposeServiceNames,
      })
    : new Proxy({} as KeycloakServerHelper, {
        get(_target, prop) {
          throw new Error(
            `Cannot use keycloak.server helper: 'keycloakImage' is not configured in deployment config. ` +
              `Attempted to access: keycloak.server.${String(prop)}`
          );
        },
      });

  return {
    ...createCommonHelpers(ssh, env),
    keycloak: {
      realmMerge: new KeycloakRealmMergeHelper(remoteFs),
      userImport: new KeycloakUserImportHelper(remoteFs),
      cli: keycloakCliHelper,
      server: keycloakServerHelper,
      adminUser: new KeycloakAdminUserHelper(),
    },
    postgres: {
      helper: postgresHelper,
      validation: new PostgresValidationHelper(),
    },
  };
}

/**
 * Configuration for creating post-up helpers.
 */
export interface PostUpHelpersConfig {
  /** SSH client for the target server */
  ssh: SshClient;
  /** Docker client for the target server */
  docker: DockerClient;
  /** Compose options for container operations */
  composeOptions: ComposeOptions;
  /** Environment variables from hook context */
  env: Record<string, string>;
}

/**
 * Creates helpers for post-up hooks.
 */
export function createPostUpHelpers(
  config: PostUpHelpersConfig
): PostUpHookHelpers {
  const { ssh, docker, composeOptions, env } = config;

  return {
    ...createCommonHelpers(ssh, env),
    containerStability: new ContainerStabilityHelper({
      docker,
      ssh,
      composeOptions,
    }),
  };
}
