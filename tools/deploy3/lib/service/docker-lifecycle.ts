/**
 * Docker Lifecycle Service
 *
 * Manages Docker Compose service lifecycle:
 * - Starting and stopping application versions
 * - Writing Docker .env files with variable expansion
 * - Reading deployment configs from stopped versions
 */

import { DockerClient } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { PathResolver } from './path-resolver';
import {
  DeploymentConfig,
  DeploymentConfigSchema,
} from '../../config/deployment-config';
import { expandEnvVariables } from '../utils/env-expander';
import { Logger } from '../utils/logger';

/**
 * Configuration for DockerLifecycleService
 */
export interface DockerLifecycleServiceConfig {
  docker: DockerClient;
  fs: RemoteFileSystem;
  pathResolver: PathResolver;
  logger: Logger;
}

/**
 * DockerLifecycleService - Manages Docker Compose service lifecycle
 */
export class DockerLifecycleService {
  private readonly docker: DockerClient;
  private readonly fs: RemoteFileSystem;
  private readonly pathResolver: PathResolver;
  private readonly logger: Logger;

  constructor(config: DockerLifecycleServiceConfig) {
    this.docker = config.docker;
    this.fs = config.fs;
    this.pathResolver = config.pathResolver;
    this.logger = config.logger;
  }

  /**
   * Stop a running version of the application
   *
   * Reads the deployment config from the version's directory to determine
   * which compose files to use for shutdown.
   *
   * @param versionTag - The version tag to stop
   * @param environment - The environment (staging/production) to read config for
   * @throws Error if the version uses legacy deploy2 format (no deployment config)
   */
  stopVersion(versionTag: string, environment: 'staging' | 'production'): void {
    const configPath = this.pathResolver.getVersionEnvironmentConfigPath(
      versionTag,
      environment
    );

    // Read the version's deployment config
    const configContent = this.fs.readFile(configPath, { silent: true });

    // If config doesn't exist or is empty, this is a legacy deploy2 installation
    if (!configContent || configContent.trim().length === 0) {
      throw new Error(
        `Target system runs old version (${versionTag}) deployed by deploy2. ` +
          `deploy3 cannot automatically stop legacy deployments. ` +
          `Manual intervention required: SSH to the server and stop the old version manually, then retry deployment.`
      );
    }

    const config = DeploymentConfigSchema.parse(JSON.parse(configContent));

    // Build compose options (workdir, files, envFile)
    const composeOptions = this.pathResolver.buildComposeOptions(
      versionTag,
      config.composeFiles
    );

    // Stop version using docker compose down with -v to remove anonymous volumes
    this.docker.composeDown(composeOptions, [], true, { silent: false });

    this.logger.info(`Stopped version ${versionTag}`);
  }

  /**
   * Start a new version of the application
   *
   * @param versionTag - The version tag to start
   * @param environment - The environment (staging/production)
   * @param deploymentConfig - The deployment config for this version
   */
  startVersion(
    versionTag: string,
    _environment: 'staging' | 'production',
    deploymentConfig: DeploymentConfig
  ): void {
    // Build compose options (workdir, files, envFile)
    const composeOptions = this.pathResolver.buildComposeOptions(
      versionTag,
      deploymentConfig.composeFiles
    );

    this.logger.info(
      `Starting new version with compose files: ${composeOptions.files?.join(
        ', '
      )}`
    );

    this.docker.composeUp(composeOptions, [], { silent: false });

    this.logger.info(`Started version ${versionTag}`);
  }

  /**
   * Write the Docker .env file with variable expansion
   *
   * @param versionTag - The version tag to write env for
   * @param dockerEnvContent - The raw DEPLOY_DOCKER_ENV content
   * @param allEnvVars - All environment variables for expansion
   * @returns The number of variables written, or undefined if skipped
   */
  writeDockerEnv(
    versionTag: string,
    dockerEnvContent: string | undefined,
    allEnvVars: Record<string, string>
  ): number | undefined {
    if (!dockerEnvContent || dockerEnvContent.trim() === '') {
      this.logger.info(
        'DEPLOY_DOCKER_ENV is empty or not set, skipping .env file creation'
      );
      return undefined;
    }

    const backendAssetsPath =
      this.pathResolver.getVersionBackendAssetsPath(versionTag);
    const envFilePath = `${backendAssetsPath}/.env`;

    // Expand ${VAR_NAME} references using CI environment variables
    const expandedContent = expandEnvVariables(dockerEnvContent, allEnvVars);

    // Write the expanded content to .env file on the target server
    this.fs.writeFile(envFilePath, expandedContent, { silent: false });
    this.logger.info(`Docker .env file written to: ${envFilePath}`);

    // Count non-empty lines
    const variableCount = expandedContent
      .split('\n')
      .filter((l) => l.trim()).length;
    return variableCount;
  }
}
