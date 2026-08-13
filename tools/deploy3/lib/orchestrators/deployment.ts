/**
 * Deployment Orchestrator
 *
 * Orchestrates the full deployment workflow
 *
 * NO AUTOMATIC ROLLBACKS: If something fails after the old version is stopped,
 * deployment halts and a human operator must intervene. This is intentional
 * because database migrations make automated rollbacks dangerous.
 */

import { SshClient } from '../../infra/ssh-client';
import { DockerClient } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { DeploymentLockService } from '../service/deployment-lock';
import { MaintenancePageService } from '../service/maintenance-page';
import { PathResolver } from '../service/path-resolver';
import { ArtifactService } from '../service/artifact';
import { DockerLifecycleService } from '../service/docker-lifecycle';
import { ServerProvisioningService } from '../service/server-provisioning';
import { ControlScriptsService } from '../service/control-scripts';
import { GeneralSmokeTests } from '../validation/general-smoke-tests';
import { DeploymentPackageTests } from '../validation/deployment-package-tests';
import { HookRunner } from '../hooks/hook-runner';
import { BaseHookContext, LocalZipInspector } from '../hooks/hook-types';
import { parseConfigOverride, DeploymentConfig } from '../../config/deployment-config';
import { Logger } from '../utils/logger';
import { StepExecutor, Report } from '../utils/step-executor';
import { ZipInspector } from '../utils/zip-inspector';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the deployment orchestrator
 */
export interface DeploymentOrchestratorConfig {
  /** Local path to the deployment ZIP file */
  zipPath: string;
  /** The deployment tag / version (e.g., "25.0617.1430.15") */
  deployTag: string;
  /** Environment: staging or production */
  environment: 'staging' | 'production';
  /** Domain for the maintenance page SSL certificate */
  domain: string;
  /** All environment variables (passed to hooks) */
  env: Record<string, string>;
}

/**
 * Dependencies injected into the orchestrator
 */
export interface DeploymentOrchestratorDeps {
  ssh: SshClient;
  docker: DockerClient;
  logger: Logger;
}

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * DeploymentOrchestrator - Manages the full deployment lifecycle
 */
export class DeploymentOrchestrator {
  private readonly ssh: SshClient;
  private readonly docker: DockerClient;
  private readonly fs: RemoteFileSystem;
  private readonly logger: Logger;
  private readonly config: DeploymentOrchestratorConfig;

  // Services (initialized lazily once we know appName)
  private lockService?: DeploymentLockService;
  private maintenanceService?: MaintenancePageService;
  private pathResolver?: PathResolver;
  private artifactService?: ArtifactService;
  private dockerLifecycleService?: DockerLifecycleService;
  private serverProvisioningService?: ServerProvisioningService;
  private controlScriptsService?: ControlScriptsService;

  // State discovered during deployment
  private appName?: string;
  private deploymentConfig?: DeploymentConfig;
  private oldVersionTag?: string;
  private remoteZipPath?: string;
  private localHooksDir?: string;
  private localServerSetupDir?: string;
  private backendAssetsZipInspector?: LocalZipInspector;

  // Cleanup state tracking
  private maintenanceIsUp = false;
  private oldVersionStopped = false;
  private newVersionStarted = false;

  // Step execution
  private readonly stepExecutor: StepExecutor;

  constructor(
    config: DeploymentOrchestratorConfig,
    deps: DeploymentOrchestratorDeps
  ) {
    this.config = config;
    this.ssh = deps.ssh;
    this.docker = deps.docker;
    this.fs = new RemoteFileSystem(deps.ssh);
    this.logger = deps.logger;
    this.stepExecutor = new StepExecutor(deps.logger);
  }

  /**
   * Run the full deployment workflow
   * @returns Deployment report with step results
   */
  async run(): Promise<Report> {
    this.stepExecutor.start();

    try {
      await this.extractAppName();
      await this.runGeneralSmokeTests();
      await this.runPackageSmokeTests();
      await this.extractHooksLocally();
      await this.extractServerSetupLocally();
      await this.acquireLock();
      await this.runPreDownHook();
      await this.checkOldVersion();
      await this.stopOldVersion();
      await this.runServerSetup();
      await this.showMaintenancePage();
      await this.unlinkOldVersion();
      await this.deleteOldFolder();
      await this.copyZipToServer();
      await this.unpackNewVersion();
      await this.linkNewVersion();
      await this.writeDockerEnv();
      await this.writeControlScripts();
      await this.runMaintenanceHook();
      await this.hideMaintenancePage();
      await this.ensureStandardDirectories();
      await this.startNewVersion();
      await this.runPostUpHook();
      await this.writeEnvironmentMarker();
      await this.releaseLock();
      this.cleanupLocalHooks();

      return this.stepExecutor.buildReport(true, {
        deployTag: this.config.deployTag,
        appName: this.appName,
      });
    } catch (error) {
      this.cleanup();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return this.stepExecutor.buildReport(
        false,
        {
          deployTag: this.config.deployTag,
          appName: this.appName,
        },
        errorMessage
      );
    }
  }

  // ===========================================================================
  // Step Implementations
  // ===========================================================================

  private async acquireLock(): Promise<void> {
    await this.stepExecutor.runStep('acquire-lock', () => {
      const pathResolver = this.requirePathResolver();
      this.lockService = new DeploymentLockService(
        this.ssh,
        pathResolver.getLockFilePath()
      );
      this.lockService.acquire(this.config.deployTag);
      return `Lock acquired with tag ${this.config.deployTag}`;
    });
  }

  private async runGeneralSmokeTests(): Promise<void> {
    await this.stepExecutor.runStep('general-smoke-tests', () => {
      const smokeTests = new GeneralSmokeTests({
        ssh: this.ssh,
        pathResolver: this.requirePathResolver(),
        environment: this.config.environment,
      });
      smokeTests.run();
      return 'All general smoke tests passed';
    });
  }

  private async runPackageSmokeTests(): Promise<void> {
    await this.stepExecutor.runStep('package-smoke-tests', () => {
      const pathResolver = this.requirePathResolver();
      const packageTests = new DeploymentPackageTests({
        ssh: this.ssh,
        zipPath: this.config.zipPath,
        pathResolver,
        environment: this.config.environment,
        env: this.config.env,
      });
      packageTests.run();

      const config = packageTests.getDeploymentConfig();
      if (!config) {
        throw new Error(
          'DeploymentPackageTests passed but getDeploymentConfig() returned null - this should never happen'
        );
      }
      this.deploymentConfig = config;
      return 'All package smoke tests passed';
    });
  }

  private async extractAppName(): Promise<void> {
    await this.stepExecutor.runStep('extract-app-name', () => {
      const zipInspector = new ZipInspector(this.config.zipPath);
      // Apply the same DEPLOY_OVERWRITE_CONFIG override as DeploymentPackageTests,
      // so an overridden appName is not silently ignored for path resolution.
      const configOverride = parseConfigOverride(this.config.env);
      const deploymentConfig = zipInspector.extractDeploymentConfig(
        this.config.deployTag,
        this.config.environment,
        configOverride
      );

      this.appName = deploymentConfig.appName;
      this.pathResolver = new PathResolver({ appName: this.appName });

      // Create inspector for checking files in the ZIP's backend assets directory
      this.backendAssetsZipInspector =
        zipInspector.createBackendAssetsInspector(this.config.deployTag);

      // Initialize services that depend on PathResolver
      this.artifactService = new ArtifactService({
        ssh: this.ssh,
        fs: this.fs,
        pathResolver: this.pathResolver,
        logger: this.logger,
      });
      this.dockerLifecycleService = new DockerLifecycleService({
        docker: this.docker,
        fs: this.fs,
        pathResolver: this.pathResolver,
        logger: this.logger,
      });
      this.serverProvisioningService = new ServerProvisioningService({
        logger: this.logger,
      });
      this.controlScriptsService = new ControlScriptsService({
        fs: this.fs,
        pathResolver: this.pathResolver,
        logger: this.logger,
      });

      this.logger.info(`Extracted appName: ${this.appName}`);

      return `App name: ${this.appName}`;
    });
  }

  private async copyZipToServer(): Promise<void> {
    await this.stepExecutor.runStep('copy-zip', () => {
      const artifactService = this.requireArtifactService();
      this.remoteZipPath = artifactService.copyZipToServer(
        this.config.zipPath,
        this.config.deployTag
      );
      return `ZIP copied to ${this.remoteZipPath}`;
    });
  }

  private async extractHooksLocally(): Promise<void> {
    await this.stepExecutor.runStep('extract-hooks', () => {
      // Create temp directory for hooks
      this.localHooksDir = mkdtempSync(path.join(tmpdir(), 'deploy3-hooks-'));

      const zipInspector = new ZipInspector(this.config.zipPath);
      zipInspector.extractHooksDir(this.config.deployTag, this.localHooksDir);

      this.logger.info(`Extracted hooks to: ${this.localHooksDir}`);
      return `Hooks extracted to ${this.localHooksDir}`;
    });
  }

  private async extractServerSetupLocally(): Promise<void> {
    await this.stepExecutor.runStep('extract-server-setup', () => {
      // Create temp directory for server-setup
      this.localServerSetupDir = mkdtempSync(
        path.join(tmpdir(), 'deploy3-server-setup-')
      );

      const zipInspector = new ZipInspector(this.config.zipPath);
      zipInspector.extractServerSetupDir(
        this.config.deployTag,
        this.localServerSetupDir
      );

      this.logger.info(
        `Extracted server-setup to: ${this.localServerSetupDir}`
      );
      return `Server setup extracted to ${this.localServerSetupDir}`;
    });
  }

  private async runPreDownHook(): Promise<void> {
    await this.stepExecutor.runStep('pre-down-hook', async () => {
      const hooksDir = this.requireLocalHooksDir();
      const hookPath = path.join(hooksDir, 'pre-down.js');
      const hookRunner = new HookRunner(this.buildBaseHookContext());
      await hookRunner.runHook(hookPath, 'pre-down');
      return 'Pre-down hook completed';
    });
  }

  private async checkOldVersion(): Promise<void> {
    await this.stepExecutor.runStep('check-old-version', () => {
      const artifactService = this.requireArtifactService();
      const result = artifactService.checkOldVersion();
      this.oldVersionTag = result.versionTag;

      if (!this.oldVersionTag) {
        return 'Old version: No active version';
      }
      return `Old version: ${this.oldVersionTag}`;
    });
  }

  private async stopOldVersion(): Promise<void> {
    await this.stepExecutor.runStep('stop-old-version', () => {
      if (!this.oldVersionTag) {
        this.logger.info('No old version to stop (fresh deployment)');
        return 'Skipped (no old version)';
      }

      const dockerLifecycle = this.requireDockerLifecycleService();
      dockerLifecycle.stopVersion(this.oldVersionTag, this.config.environment);
      this.oldVersionStopped = true;
      return `Stopped version ${this.oldVersionTag}`;
    });
  }

  private async runServerSetup(): Promise<void> {
    await this.stepExecutor.runStep('run-server-setup', () => {
      const serverSetupDir = this.requireLocalServerSetupDir();
      const appName = this.requireAppName();
      const provisioning = this.requireServerProvisioningService();

      const keyFilePath = this.ssh.keyFilePath;
      if (!keyFilePath) {
        throw new Error(
          'SSH key file path not available. SSH client must be configured with either keyFile or keyData.'
        );
      }

      provisioning.runPlaybook(
        this.ssh,
        {
          server: this.config.env['DEPLOY_SERVER'],
          port: this.config.env['DEPLOY_SSH_PORT'] || '22',
          user: this.config.env['DEPLOY_SSH_USER'] || 'root',
          keyFilePath,
        },
        {
          serverSetupDir,
          domain: this.config.domain,
          appName,
        }
      );

      return `Server setup completed for ${this.config.domain}`;
    });
  }

  private async showMaintenancePage(): Promise<void> {
    await this.stepExecutor.runStep('show-maintenance', () => {
      const pathResolver = this.requirePathResolver();
      const deploymentConfig = this.requireDeploymentConfig();

      this.maintenanceService = new MaintenancePageService(this.ssh, {
        certCachePath: pathResolver.getMaintenanceCertsPath(),
      });

      if (this.maintenanceService.isRunning()) {
        this.maintenanceService.stop();
      }

      const message = deploymentConfig.maintenanceMessage ?? 'Wartungsarbeiten';
      this.maintenanceService.start(this.config.domain, message);
      this.maintenanceIsUp = true;

      return `Maintenance page shown at https://${this.config.domain}`;
    });
  }

  private async unlinkOldVersion(): Promise<void> {
    await this.stepExecutor.runStep('unlink-old-version', () => {
      const artifactService = this.requireArtifactService();
      artifactService.unlinkOldVersion();
      return 'Symlink removed';
    });
  }

  private async deleteOldFolder(): Promise<void> {
    await this.stepExecutor.runStep('delete-old-folder', () => {
      const artifactService = this.requireArtifactService();
      artifactService.deleteOldFolder(
        this.oldVersionTag,
        this.config.deployTag
      );
      return this.oldVersionTag
        ? `Deleted ${this.oldVersionTag}`
        : 'No old folder to delete';
    });
  }

  private async unpackNewVersion(): Promise<void> {
    await this.stepExecutor.runStep('unpack-new-version', () => {
      const artifactService = this.requireArtifactService();
      const pathResolver = this.requirePathResolver();
      const remoteZipPath = this.requireRemoteZipPath();

      artifactService.unpackNewVersion(remoteZipPath);
      return `Unpacked to ${pathResolver.getVersionPath(
        this.config.deployTag
      )}`;
    });
  }

  private async linkNewVersion(): Promise<void> {
    await this.stepExecutor.runStep('link-new-version', () => {
      const artifactService = this.requireArtifactService();
      const pathResolver = this.requirePathResolver();

      artifactService.linkNewVersion(this.config.deployTag);
      return `Symlink created: ${pathResolver.getActiveLinkPath()} -> ${pathResolver.getVersionPath(
        this.config.deployTag
      )}`;
    });
  }

  private async writeDockerEnv(): Promise<void> {
    await this.stepExecutor.runStep('write-docker-env', () => {
      const dockerLifecycle = this.requireDockerLifecycleService();
      const dockerEnvContent = this.config.env['DEPLOY_DOCKER_ENV'];

      const varCount = dockerLifecycle.writeDockerEnv(
        this.config.deployTag,
        dockerEnvContent,
        this.config.env
      );

      if (varCount === undefined) {
        return 'Skipped (DEPLOY_DOCKER_ENV not set)';
      }
      return `Wrote .env with ${varCount} variables`;
    });
  }

  private async writeControlScripts(): Promise<void> {
    await this.stepExecutor.runStep('write-control-scripts', () => {
      const controlScripts = this.requireControlScriptsService();
      const deploymentConfig = this.requireDeploymentConfig();

      controlScripts.writeControlScripts(deploymentConfig);
      return 'Control scripts (start.sh, stop.sh) written';
    });
  }

  private async runMaintenanceHook(): Promise<void> {
    await this.stepExecutor.runStep('maintenance-hook', async () => {
      const hooksDir = this.requireLocalHooksDir();
      const hookPath = path.join(hooksDir, 'maintenance.js');
      const hookRunner = new HookRunner(this.buildBaseHookContext());
      await hookRunner.runHook(hookPath, 'maintenance');
      return 'Maintenance hook completed';
    });
  }

  private async hideMaintenancePage(): Promise<void> {
    await this.stepExecutor.runStep('hide-maintenance', () => {
      if (!this.maintenanceService) {
        this.logger.warn(
          'MaintenancePageService not initialized, nothing to stop'
        );
        return 'Skipped (not started)';
      }

      this.maintenanceService.stop();
      this.maintenanceIsUp = false;
      return 'Maintenance page stopped';
    });
  }

  /**
   * Ensure standard directories exist before docker compose up.
   * This creates infrastructure directories like logs/ that containers mount.
   */
  private async ensureStandardDirectories(): Promise<void> {
    await this.stepExecutor.runStep('ensure-directories', () => {
      const pathResolver = this.requirePathResolver();
      const logsDir = pathResolver.getLogsPath();

      this.logger.info(`Ensuring logs directory exists: ${logsDir}`);
      this.fs.mkdir(logsDir, { silent: true });

      return `Created ${logsDir}`;
    });
  }

  private async startNewVersion(): Promise<void> {
    await this.stepExecutor.runStep('start-new-version', () => {
      const dockerLifecycle = this.requireDockerLifecycleService();
      const deploymentConfig = this.requireDeploymentConfig();

      dockerLifecycle.startVersion(
        this.config.deployTag,
        this.config.environment,
        deploymentConfig
      );
      this.newVersionStarted = true;

      return `Started version ${this.config.deployTag}`;
    });
  }

  private async runPostUpHook(): Promise<void> {
    await this.stepExecutor.runStep('post-up-hook', async () => {
      const hooksDir = this.requireLocalHooksDir();
      const hookPath = path.join(hooksDir, 'post-up.js');
      const hookRunner = new HookRunner(this.buildBaseHookContext());
      await hookRunner.runHook(hookPath, 'post-up');
      return 'Post-up hook completed';
    });
  }

  private async writeEnvironmentMarker(): Promise<void> {
    await this.stepExecutor.runStep('write-environment-marker', () => {
      const pathResolver = this.requirePathResolver();
      const markerPath = pathResolver.getEnvironmentMarkerPath(
        this.config.environment
      );

      if (this.fs.pathExists(markerPath)) {
        return 'Environment file exists already';
      }

      const content = `This file marks this server as a ${this.config.environment} system. Do not deploy a different environment here.`;

      this.fs.writeFile(markerPath, content);
      this.logger.info(`Wrote environment marker: ${markerPath}`);

      return `Environment marker written: ${markerPath}`;
    });
  }

  private async releaseLock(): Promise<void> {
    await this.stepExecutor.runStep('release-lock', () => {
      if (!this.lockService) {
        this.logger.warn('LockService not initialized, nothing to release');
        return 'Skipped (not acquired)';
      }

      this.lockService.release();
      return 'Lock released';
    });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Build the base context for running hooks.
   * The HookRunner adds the appropriate helpers based on hook type.
   */
  private buildBaseHookContext(): BaseHookContext {
    const deploymentConfig = this.deploymentConfig;
    if (!deploymentConfig) {
      throw new Error(
        'Cannot build hook context: deploymentConfig not initialized'
      );
    }

    return {
      ssh: this.ssh,
      docker: this.docker,
      remoteFs: this.fs,
      pathResolver: this.requirePathResolver(),
      logger: this.logger,
      version: this.config.deployTag,
      env: this.config.env,
      deploymentConfig,
      localZip: this.requireBackendAssetsZipInspector(),
    };
  }

  /**
   * Assert that PathResolver is initialized (throws if not)
   */
  private requirePathResolver(): PathResolver {
    if (!this.pathResolver) {
      throw new Error(
        'PathResolver not initialized. extractAppName must run first.'
      );
    }
    return this.pathResolver;
  }

  /**
   * Assert that ArtifactService is initialized (throws if not)
   */
  private requireArtifactService(): ArtifactService {
    if (!this.artifactService) {
      throw new Error(
        'ArtifactService not initialized. extractAppName must run first.'
      );
    }
    return this.artifactService;
  }

  /**
   * Assert that DockerLifecycleService is initialized (throws if not)
   */
  private requireDockerLifecycleService(): DockerLifecycleService {
    if (!this.dockerLifecycleService) {
      throw new Error(
        'DockerLifecycleService not initialized. extractAppName must run first.'
      );
    }
    return this.dockerLifecycleService;
  }

  /**
   * Assert that ServerProvisioningService is initialized (throws if not)
   */
  private requireServerProvisioningService(): ServerProvisioningService {
    if (!this.serverProvisioningService) {
      throw new Error(
        'ServerProvisioningService not initialized. extractAppName must run first.'
      );
    }
    return this.serverProvisioningService;
  }

  /**
   * Assert that ControlScriptsService is initialized (throws if not)
   */
  private requireControlScriptsService(): ControlScriptsService {
    if (!this.controlScriptsService) {
      throw new Error(
        'ControlScriptsService not initialized. extractAppName must run first.'
      );
    }
    return this.controlScriptsService;
  }

  /**
   * Assert that DeploymentConfig is loaded (throws if not)
   */
  private requireDeploymentConfig(): DeploymentConfig {
    if (!this.deploymentConfig) {
      throw new Error(
        'DeploymentConfig not loaded. runPackageSmokeTests must run first.'
      );
    }
    return this.deploymentConfig;
  }

  /**
   * Assert that remoteZipPath is set (throws if not)
   */
  private requireRemoteZipPath(): string {
    if (!this.remoteZipPath) {
      throw new Error(
        'Remote ZIP path not set. copyZipToServer must run first.'
      );
    }
    return this.remoteZipPath;
  }

  /**
   * Assert that localHooksDir is set (throws if not)
   */
  private requireLocalHooksDir(): string {
    if (!this.localHooksDir) {
      throw new Error(
        'Local hooks directory not set. extractHooksLocally must run first.'
      );
    }
    return this.localHooksDir;
  }

  /**
   * Assert that localServerSetupDir is set (throws if not)
   */
  private requireLocalServerSetupDir(): string {
    if (!this.localServerSetupDir) {
      throw new Error(
        'Local server-setup directory not set. extractServerSetupLocally must run first.'
      );
    }
    return this.localServerSetupDir;
  }

  /**
   * Assert that appName is set (throws if not)
   */
  private requireAppName(): string {
    if (!this.appName) {
      throw new Error('App name not set. extractAppName must run first.');
    }
    return this.appName;
  }

  /**
   * Assert that backendAssetsZipInspector is set (throws if not)
   */
  private requireBackendAssetsZipInspector(): LocalZipInspector {
    if (!this.backendAssetsZipInspector) {
      throw new Error(
        'Backend assets ZIP inspector not set. extractAppName must run first.'
      );
    }
    return this.backendAssetsZipInspector;
  }

  /**
   * Clean up the local hooks temp directory
   */
  private cleanupLocalHooks(): void {
    if (this.localHooksDir) {
      try {
        rmSync(this.localHooksDir, { recursive: true, force: true });
        this.logger.info(
          `Cleaned up local hooks directory: ${this.localHooksDir}`
        );
      } catch (e) {
        this.logger.warn(`Failed to clean up local hooks directory: ${e}`);
      }
      this.localHooksDir = undefined;
    }
    if (this.localServerSetupDir) {
      try {
        rmSync(this.localServerSetupDir, { recursive: true, force: true });
        this.logger.info(
          `Cleaned up local server-setup directory: ${this.localServerSetupDir}`
        );
      } catch (e) {
        this.logger.warn(
          `Failed to clean up local server-setup directory: ${e}`
        );
      }
      this.localServerSetupDir = undefined;
    }
  }

  /**
   * Safely clean up a resource with error handling
   * @param name - Name of the resource being cleaned up (for logging)
   * @param fn - Function to execute for cleanup
   */
  private safeCleanup(name: string, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.logger.warn(
        `Failed to clean up ${name}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  /**
   * Clean up all resources on failure (maintenance page, local hooks, etc.)
   *
   * If the old version was stopped, we leave the maintenance page UP so there's
   * something serving traffic. A human operator must intervene to fix the deployment.
   */
  private cleanup(): void {
    // If we started the new version but failed later (e.g., post-up hook), stop it
    this.safeCleanup('new version containers', () => {
      if (
        this.newVersionStarted &&
        this.dockerLifecycleService &&
        this.deploymentConfig
      ) {
        this.logger.info(
          'Stopping new version containers after failed deployment'
        );
        this.dockerLifecycleService.stopVersion(
          this.config.deployTag,
          this.config.environment
        );
      }
    });

    // If we stopped the old version, we need to keep the maintenance page UP.
    // If we didn't stop the old version, the old version is still running and we can stop the maintenance page.
    this.safeCleanup('maintenance page', () => {
      if (
        this.oldVersionStopped &&
        !this.maintenanceIsUp &&
        this.maintenanceService &&
        this.deploymentConfig
      ) {
        // Old version was stopped but maintenance page isn't up - start it so something serves traffic
        const message =
          this.deploymentConfig.maintenanceMessage ?? 'Wartungsarbeiten';
        this.maintenanceService.start(this.config.domain, message);
        this.maintenanceIsUp = true;
        this.logger.warn(
          'Maintenance page started after failed deployment. Manual intervention required.'
        );
      } else if (this.oldVersionStopped && this.maintenanceIsUp) {
        // Old version stopped, maintenance is already up - leave it up
        this.logger.warn(
          'Leaving maintenance page UP after failed deployment. Manual intervention required.'
        );
      }
    });

    this.safeCleanup('local hooks directory', () => {
      if (this.localHooksDir) {
        rmSync(this.localHooksDir, { recursive: true, force: true });
        this.logger.info(
          `Cleaned up local hooks directory: ${this.localHooksDir}`
        );
        this.localHooksDir = undefined;
      }
    });

    this.safeCleanup('local server-setup directory', () => {
      if (this.localServerSetupDir) {
        rmSync(this.localServerSetupDir, { recursive: true, force: true });
        this.logger.info(
          `Cleaned up local server-setup directory: ${this.localServerSetupDir}`
        );
        this.localServerSetupDir = undefined;
      }
    });

    this.safeCleanup('remote deployment ZIP', () => {
      if (this.remoteZipPath) {
        this.fs.rm(this.remoteZipPath);
        this.logger.info(
          `Cleaned up remote deployment ZIP: ${this.remoteZipPath}`
        );
        this.remoteZipPath = undefined;
      }
    });

    this.safeCleanup('deploy lock', () => {
      this.lockService?.release();
    });
  }
}
