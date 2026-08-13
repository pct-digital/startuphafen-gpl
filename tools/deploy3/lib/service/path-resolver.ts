/**
 * Path Resolver Service
 *
 * Encapsulates the directory structure conventions used by deploy3.
 * Provides path resolution for both deploy3 core operations and hooks.
 *
 * Directory structure conventions:
 * - DEPLOY_ROOT: /opt (all deployments happen under this directory)
 * - App Path: /opt/<APP_NAME>/ (each app gets its own directory)
 * - Version Path: /opt/<APP_NAME>/<DEPLOY_TAG>/ (each deployed version)
 * - Active Link: /opt/<APP_NAME>/active (symlink to currently active version)
 * - Logs: /opt/<APP_NAME>/logs/ (container logs directory)
 * - Maintenance Certs: /opt/<APP_NAME>/maintenance-certs/ (SSL cert cache for maintenance page)
 * - Lock File: /tmp/deploy.lock (deployment lock file)
 *
 * ZIP package structure:
 * - <DEPLOY_TAG>/apps/<APP_NAME>-backend/assets/ (backend assets)
 * - <DEPLOY_TAG>/apps/<APP_NAME>-backend/assets/deployment/ (deployment config)
 */

import * as path from 'path';
import { ComposeOptions } from '../../infra/docker-client';

/**
 * Configuration for PathResolver
 */
export interface PathResolverConfig {
  /** Application name (e.g., "startuphafen") */
  appName: string;
  /** Root directory for all deployments (default: /opt) */
  deployRoot?: string;
  /** Name of the symlink pointing to active version (default: active) */
  activeLinkName?: string;
}

/**
 * Default values for path conventions
 */
const DEFAULTS = {
  DEPLOY_ROOT: '/opt',
  ACTIVE_LINK_NAME: 'active',
  LOCK_FILE: '/tmp/deploy.lock',
  SERVER_SETUP_PLAYBOOK_FILENAME: 'server-setup-playbook.yaml',
} as const;

/**
 * PathResolver - Encapsulates deployment directory structure conventions
 *
 * This class provides path resolution for the standard deploy3 directory layout.
 * It is used by both deploy3 core services and by application hooks.
 */
export class PathResolver {
  private readonly appName: string;
  private readonly deployRoot: string;
  private readonly activeLinkName: string;

  constructor(config: PathResolverConfig) {
    this.appName = config.appName;
    this.deployRoot = config.deployRoot ?? DEFAULTS.DEPLOY_ROOT;
    this.activeLinkName = config.activeLinkName ?? DEFAULTS.ACTIVE_LINK_NAME;
  }

  // ============================================================================
  // Core Application Paths
  // ============================================================================

  /**
   * Get the root path for this application
   * @returns Path like /opt/startuphafen
   */
  getAppPath(): string {
    return path.join(this.deployRoot, this.appName);
  }

  /**
   * Get the path to the active symlink
   * @returns Path like /opt/startuphafen/active
   */
  getActiveLinkPath(): string {
    return path.join(this.getAppPath(), this.activeLinkName);
  }

  /**
   * Get the path to a specific deployed version
   * @param deployTag - The deployment tag (e.g., "25.0617.1430.15")
   * @returns Path like /opt/startuphafen/25.0617.1430.15
   */
  getVersionPath(deployTag: string): string {
    return path.join(this.getAppPath(), deployTag);
  }

  /**
   * Get the path to the logs directory
   * @returns Path like /opt/startuphafen/logs
   */
  getLogsPath(): string {
    return path.join(this.getAppPath(), 'logs');
  }

  /**
   * Get the path to the maintenance page SSL certificate cache
   * @returns Path like /opt/startuphafen/maintenance-certs
   */
  getMaintenanceCertsPath(): string {
    return path.join(this.getAppPath(), 'maintenance-certs');
  }

  /**
   * Get the path to a control script
   * @param scriptName - The script name
   * @returns Path like /opt/startuphafen/start.sh
   */
  getControlScriptPath(scriptName: string): string {
    return path.join(this.getAppPath(), scriptName);
  }

  /**
   * Get the path to the environment marker file. A file that if it exists marks this environment as the given environment. Content does not matter
   * @param environment - The environment ('staging' or 'production')
   * @returns Path like /opt/startuphafen/staging or /opt/startuphafen/production
   */
  getEnvironmentMarkerPath(environment: 'staging' | 'production'): string {
    return path.join(this.getAppPath(), environment);
  }

  // ============================================================================
  // Backend Assets Paths
  // ============================================================================

  /**
   * Get the backend folder name (convention: <appName>-backend)
   * @returns Folder name like startuphafen-backend
   */
  getBackendFolderName(): string {
    return `${this.appName}-backend`;
  }

  /**
   * Get the backend assets path for the active version (via symlink)
   * @returns Path like /opt/startuphafen/active/apps/startuphafen-backend/assets
   */
  getActiveBackendAssetsPath(): string {
    return path.join(
      this.getActiveLinkPath(),
      'apps',
      this.getBackendFolderName(),
      'assets'
    );
  }

  /**
   * Get the backend assets path for a specific deployed version
   * @param deployTag - The deployment tag
   * @returns Path like /opt/startuphafen/25.0617.1430.15/apps/startuphafen-backend/assets
   */
  getVersionBackendAssetsPath(deployTag: string): string {
    return path.join(
      this.getVersionPath(deployTag),
      'apps',
      this.getBackendFolderName(),
      'assets'
    );
  }

  // ============================================================================
  // Deployment Configuration Paths
  // ============================================================================

  /**
   * Get the deployment directory for a specific version
   * @param deployTag - The deployment tag
   * @returns Path like /opt/startuphafen/25.0617.1430.15/apps/startuphafen-backend/assets/deployment
   */
  getVersionDeploymentPath(deployTag: string): string {
    return path.join(this.getVersionBackendAssetsPath(deployTag), 'deployment');
  }

  /**
   * Get the environment config file path for a specific version
   * @param deployTag - The deployment tag
   * @param environment - The environment (staging or production)
   * @returns Path like /opt/startuphafen/25.0617.1430.15/apps/startuphafen-backend/assets/deployment/staging.json
   */
  getVersionEnvironmentConfigPath(
    deployTag: string,
    environment: 'staging' | 'production'
  ): string {
    return path.join(
      this.getVersionDeploymentPath(deployTag),
      `${environment}.json`
    );
  }

  /**
   * Build ComposeOptions for docker compose operations.
   *
   * This is the canonical way to get compose options - ensures workdir, files,
   * and envFile are all correctly set relative to the backend assets directory.
   *
   * @param deployTag - The deployment tag
   * @param composeFiles - Compose file paths from deployment config (relative to deployment dir)
   * @returns ComposeOptions ready to pass to DockerClient
   */
  buildComposeOptions(
    deployTag: string,
    composeFiles: string[]
  ): ComposeOptions {
    const backendAssetsPath = this.getVersionBackendAssetsPath(deployTag);
    const resolvedFiles = this.resolveComposeFilePaths(composeFiles, deployTag);
    const envFilePath = path.join(backendAssetsPath, '.env');

    return {
      workdir: backendAssetsPath,
      files: resolvedFiles,
      envFile: envFilePath,
    };
  }

  /**
   * Resolve compose file paths relative to backend assets directory.
   * Internal helper - prefer buildComposeOptions() for external use.
   */
  private resolveComposeFilePaths(
    composeFilePaths: string[],
    deployTag: string
  ): string[] {
    const deploymentDir = this.getVersionDeploymentPath(deployTag);
    const backendAssetsPath = this.getVersionBackendAssetsPath(deployTag);

    return composeFilePaths.map((file) => {
      const absolutePath = path.resolve(deploymentDir, file);
      return path.relative(backendAssetsPath, absolutePath);
    });
  }

  // ============================================================================
  // Infrastructure Paths
  // ============================================================================

  /**
   * Get the deployment lock file path
   * @returns Path like /tmp/deploy.lock
   */
  getLockFilePath(): string {
    return DEFAULTS.LOCK_FILE;
  }

  // ============================================================================
  // ZIP Package Paths (relative paths within deployment ZIP)
  // ============================================================================

  /**
   * Get the deployment directory path within the ZIP
   * @param deployTag - The deployment tag (root directory in ZIP)
   * @returns Relative path like 25.0617.1430.15/apps/startuphafen-backend/assets/deployment/
   */
  getZipDeploymentPath(deployTag: string): string {
    return `${deployTag}/apps/${this.getBackendFolderName()}/assets/deployment/`;
  }

  /**
   * Get the environment config file path within the ZIP
   * @param deployTag - The deployment tag
   * @param environment - The environment (staging or production)
   * @returns Relative path like 25.0617.1430.15/apps/startuphafen-backend/assets/deployment/staging.json
   */
  getZipEnvironmentConfigPath(
    deployTag: string,
    environment: 'staging' | 'production'
  ): string {
    return `${deployTag}/apps/${this.getBackendFolderName()}/assets/deployment/${environment}.json`;
  }

  /**
   * Get the hooks directory path within the ZIP
   * @param deployTag - The deployment tag
   * @returns Relative path like 25.0617.1430.15/apps/startuphafen-backend/assets/deployment/hooks/
   */
  getZipHooksPath(deployTag: string): string {
    return `${deployTag}/apps/${this.getBackendFolderName()}/assets/deployment/hooks/`;
  }

  /**
   * Get a specific hook file path within the ZIP
   * @param deployTag - The deployment tag
   * @param hookName - The hook filename (e.g., "maintenance.js")
   * @returns Relative path like 25.0617.1430.15/apps/startuphafen-backend/assets/deployment/hooks/maintenance.js
   */
  getZipHookPath(deployTag: string, hookName: string): string {
    return `${deployTag}/apps/${this.getBackendFolderName()}/assets/deployment/hooks/${hookName}`;
  }

  /**
   * Get the server-setup directory path within the ZIP
   * @param deployTag - The deployment tag
   * @returns Relative path like 25.0617.1430.15/apps/startuphafen-backend/assets/deployment/server-setup/
   */
  getZipServerSetupPath(deployTag: string): string {
    return `${deployTag}/apps/${this.getBackendFolderName()}/assets/deployment/server-setup/`;
  }

  /**
   * Get the server-setup playbook filename
   * @returns Filename like server-setup-playbook.yaml
   */
  getServerSetupPlaybookFileName(): string {
    return DEFAULTS.SERVER_SETUP_PLAYBOOK_FILENAME;
  }

  /**
   * Get the server-setup playbook path within the ZIP
   * @param deployTag - The deployment tag
   * @returns Relative path like 25.0617.1430.15/apps/startuphafen-backend/assets/deployment/server-setup/server-setup-playbook.yaml
   */
  getZipServerSetupPlaybookPath(deployTag: string): string {
    return path.join(
      this.getZipServerSetupPath(deployTag),
      this.getServerSetupPlaybookFileName()
    );
  }

  // ============================================================================
  // Static Utilities
  // ============================================================================

  /**
   * Get the deployment root path
   * Static utility that doesn't require app name
   */
  getDeployRoot(): string {
    return this.deployRoot;
  }
}
