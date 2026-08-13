/**
 * Copy Orchestrator
 *
 * Orchestrates database copy operations from a source environment to a target environment.
 * Designed to refresh staging/demo environments with production data.
 *
 * NO AUTOMATIC ROLLBACKS: If something fails after the target is stopped,
 * the orchestrator halts and leaves the maintenance page up. A human operator
 * must intervene because database operations cannot be automatically rolled back.
 */

import { SshClient, pipeRemoteToRemote } from '../../infra/ssh-client';
import { ComposeOptions, DockerClient } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { DeploymentLockService } from '../service/deployment-lock';
import { MaintenancePageService } from '../service/maintenance-page';
import { PathResolver } from '../service/path-resolver';
import { DockerLifecycleService } from '../service/docker-lifecycle';
import {
  CopySmokeTests,
  CopySmokeTestsResult,
} from '../validation/copy-smoke-tests';
import {
  CopyConfig,
  PostgresDatabaseCopyConfig,
} from '../../config/copy-config';
import { DeploymentConfig } from '../../config/deployment-config';
import { Logger } from '../utils/logger';
import { StepExecutor, Report } from '../utils/step-executor';
import { ContainerStabilityHelper } from '../hooks/helpers/container-stability';
import {
  PostgresHelper,
  PostgresConnectionConfig,
} from '../hooks/helpers/postgres/postgres';
import {
  getExtensionsExceptVector,
  detectPgVectorEnabled,
  clearPublicSchemaPreservingExtensions,
  enablePgVector,
} from '../hooks/helpers/postgres/pgvector';
import { escapeSedPattern, escapeSedReplacement } from '../utils/shell';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the copy orchestrator
 */
export interface CopyOrchestratorConfig {
  /** Copy configuration with source/target details and databases */
  copyConfig: CopyConfig;
}

/**
 * Dependencies injected into the orchestrator
 */
export interface CopyOrchestratorDeps {
  logger: Logger;
}

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * CopyOrchestrator - Manages the full database copy lifecycle
 */
export class CopyOrchestrator {
  private readonly config: CopyConfig;
  private readonly logger: Logger;

  // SSH clients
  private sourceSsh?: SshClient;
  private targetSsh?: SshClient;

  // Services (initialized during execution)
  private targetDocker?: DockerClient;
  private targetFs?: RemoteFileSystem;
  private pathResolver?: PathResolver;
  private sourceLockService?: DeploymentLockService;
  private targetLockService?: DeploymentLockService;
  private maintenanceService?: MaintenancePageService;
  private dockerLifecycleService?: DockerLifecycleService;

  // State discovered during copy
  private smokeTestResults?: CopySmokeTestsResult;
  private targetComposeOptions?: ComposeOptions;

  // Cleanup state tracking
  private maintenanceIsUp = false;
  private targetAppStopped = false;
  private targetAppStarted = false;

  private readonly stepExecutor: StepExecutor;

  constructor(config: CopyOrchestratorConfig, deps: CopyOrchestratorDeps) {
    this.config = config.copyConfig;
    this.logger = deps.logger;
    this.stepExecutor = new StepExecutor(deps.logger);
  }

  /**
   * Run the full copy workflow
   * @returns Copy report with step results
   */
  async run(): Promise<Report> {
    this.stepExecutor.start();

    try {
      await this.initializeClients();
      await this.acquireLocks();
      await this.runSmokeTests();
      await this.stopTargetApp();
      await this.showMaintenancePage();
      await this.copyDatabases();
      await this.hideMaintenancePage();
      await this.startTargetApp();
      await this.verifyStability();
      await this.releaseLocks();
      this.cleanup();

      return this.stepExecutor.buildReport(true, {
        databasesCopied: this.config.databases.length,
      });
    } catch (error) {
      this.cleanupOnError();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return this.stepExecutor.buildReport(false, undefined, errorMessage);
    }
  }

  // ===========================================================================
  // Step Implementations
  // ===========================================================================

  private async initializeClients(): Promise<void> {
    await this.stepExecutor.runStep('initialize-clients', () => {
      // Create SSH clients from config
      this.sourceSsh = new SshClient({
        host: this.config.source.ssh.host,
        port: this.config.source.ssh.port,
        user: this.config.source.ssh.user,
        keyData: this.config.source.ssh.keyData,
      });

      this.targetSsh = new SshClient({
        host: this.config.target.ssh.host,
        port: this.config.target.ssh.port,
        user: this.config.target.ssh.user,
        keyData: this.config.target.ssh.keyData,
      });

      // Initialize path resolver
      this.pathResolver = new PathResolver({ appName: this.config.appName });

      // Initialize target services
      this.targetDocker = new DockerClient(this.targetSsh);
      this.targetFs = new RemoteFileSystem(this.targetSsh);

      return 'SSH clients and services initialized';
    });
  }

  private async runSmokeTests(): Promise<void> {
    await this.stepExecutor.runStep('run-smoke-tests', () => {
      if (!this.sourceSsh || !this.targetSsh) {
        throw new Error('SSH clients not initialized');
      }

      const smokeTests = new CopySmokeTests({
        copyConfig: this.config,
        sourceSsh: this.sourceSsh,
        targetSsh: this.targetSsh,
      });

      this.smokeTestResults = smokeTests.run();

      return `All smoke tests passed. Source: ${this.smokeTestResults.sourceActiveVersion}, Target: ${this.smokeTestResults.targetActiveVersion}`;
    });
  }

  private async acquireLocks(): Promise<void> {
    await this.stepExecutor.runStep('acquire-locks', () => {
      if (!this.sourceSsh || !this.targetSsh || !this.pathResolver) {
        throw new Error('SSH clients or path resolver not initialized');
      }

      // Create lock services for both source and target
      this.sourceLockService = new DeploymentLockService(
        this.sourceSsh,
        this.pathResolver.getLockFilePath()
      );
      this.targetLockService = new DeploymentLockService(
        this.targetSsh,
        this.pathResolver.getLockFilePath()
      );

      // Acquire locks with skipVersionCheck since copy doesn't use deploy tags
      const lockTag = 'db-copy';
      this.sourceLockService.acquire(lockTag, { skipVersionCheck: true });
      this.targetLockService.acquire(lockTag, { skipVersionCheck: true });

      return 'Acquired deployment locks on source and target';
    });
  }

  private async stopTargetApp(): Promise<void> {
    await this.stepExecutor.runStep('stop-target-app', () => {
      if (
        !this.smokeTestResults ||
        !this.pathResolver ||
        !this.targetDocker ||
        !this.targetFs
      ) {
        throw new Error('Required services not initialized');
      }

      const { targetActiveVersion, targetDeploymentConfig } =
        this.smokeTestResults;

      // Initialize docker lifecycle service
      this.dockerLifecycleService = new DockerLifecycleService({
        docker: this.targetDocker,
        fs: this.targetFs,
        pathResolver: this.pathResolver,
        logger: this.logger,
      });

      // Build compose options for later use in stability check
      this.targetComposeOptions = this.pathResolver.buildComposeOptions(
        targetActiveVersion,
        targetDeploymentConfig.composeFiles
      );

      // Stop the target app with the environment detected from the target
      // server's marker files (production and staging use different compose files)
      this.dockerLifecycleService.stopVersion(
        targetActiveVersion,
        this.smokeTestResults.targetEnvironment
      );
      this.targetAppStopped = true;

      return `Target application stopped (version ${targetActiveVersion})`;
    });
  }

  private async showMaintenancePage(): Promise<void> {
    await this.stepExecutor.runStep('show-maintenance', () => {
      if (!this.targetSsh || !this.pathResolver || !this.smokeTestResults) {
        throw new Error('Required services not initialized');
      }

      const { targetDeploymentConfig } = this.smokeTestResults;

      // Initialize maintenance service
      this.maintenanceService = new MaintenancePageService(this.targetSsh, {
        certCachePath: this.pathResolver.getMaintenanceCertsPath(),
      });

      const message =
        targetDeploymentConfig.maintenanceMessage ?? 'Wartungsarbeiten';
      this.maintenanceService.start(this.config.target.domain, message);
      this.maintenanceIsUp = true;

      return `Maintenance page started for ${this.config.target.domain}`;
    });
  }

  private async copyDatabases(): Promise<void> {
    await this.stepExecutor.runStep('copy-databases', async () => {
      if (!this.sourceSsh || !this.targetSsh || !this.smokeTestResults) {
        throw new Error('Required services not initialized');
      }

      const { sourceDeploymentConfig, targetDeploymentConfig } =
        this.smokeTestResults;

      if (!sourceDeploymentConfig) {
        throw new Error(
          'Source deployment config not available - smoke tests should have caught this'
        );
      }

      let copiedCount = 0;

      for (const dbConfig of this.config.databases) {
        if (dbConfig.type !== 'postgres') {
          this.logger.warn(
            `Skipping unsupported database type: ${dbConfig.type}`
          );
          continue;
        }

        await this.copyPostgresDatabase(
          dbConfig,
          sourceDeploymentConfig,
          targetDeploymentConfig
        );

        copiedCount++;
      }

      return `Copied ${copiedCount} database(s)`;
    });
  }

  private async hideMaintenancePage(): Promise<void> {
    await this.stepExecutor.runStep('hide-maintenance', () => {
      if (!this.maintenanceService) {
        throw new Error('Maintenance service not initialized');
      }

      this.maintenanceService.stop();
      this.maintenanceIsUp = false;

      return 'Maintenance page stopped';
    });
  }

  private async startTargetApp(): Promise<void> {
    await this.stepExecutor.runStep('start-target-app', () => {
      if (!this.dockerLifecycleService || !this.smokeTestResults) {
        throw new Error('Required services not initialized');
      }

      const { targetActiveVersion, targetDeploymentConfig } =
        this.smokeTestResults;

      // Start the target app using docker lifecycle service
      this.dockerLifecycleService.startVersion(
        targetActiveVersion,
        this.smokeTestResults.targetEnvironment,
        targetDeploymentConfig
      );
      this.targetAppStarted = true;

      return 'Target application started';
    });
  }

  private async verifyStability(): Promise<void> {
    await this.stepExecutor.runStep('verify-stability', () => {
      if (!this.targetDocker || !this.targetSsh || !this.targetComposeOptions) {
        throw new Error('Required services not initialized');
      }

      const stabilityHelper = new ContainerStabilityHelper({
        docker: this.targetDocker,
        ssh: this.targetSsh,
        composeOptions: this.targetComposeOptions,
      });

      // Wait for containers to be stable (defaults: 20s stable, 30s timeout)
      stabilityHelper.waitForStability();

      return 'All services are running and stable';
    });
  }

  private async releaseLocks(): Promise<void> {
    await this.stepExecutor.runStep('release-locks', () => {
      this.sourceLockService?.release();
      this.targetLockService?.release();
      return 'Released deployment locks on source and target';
    });
  }

  /**
   * Copy a single Postgres database from source to target.
   *
   * For local databases (where the DB host is a Docker Compose service name),
   * this uses PostgresHelper.withDatabase() to ensure the DB container is running
   * during the copy operation.
   *
   * Handles pgvector extension gracefully:
   * - Detects if pgvector is enabled on source
   * - Clears target schema without destroying extension objects (safe for managed Postgres offerings)
   * - Re-enables pgvector on target if it was present on source
   */
  private async copyPostgresDatabase(
    dbConfig: PostgresDatabaseCopyConfig,
    sourceDeploymentConfig: DeploymentConfig,
    targetDeploymentConfig: DeploymentConfig
  ): Promise<void> {
    if (
      !this.pathResolver ||
      !this.sourceSsh ||
      !this.targetSsh ||
      !this.targetDocker ||
      !this.targetComposeOptions ||
      !this.smokeTestResults
    ) {
      throw new Error('Required services not initialized');
    }

    const { sourceConfig, targetConfig } = dbConfig;
    const sourceImage = sourceDeploymentConfig.postgresImage;
    const targetImage = targetDeploymentConfig.postgresImage;

    if (!sourceImage || !targetImage) {
      throw new Error('postgresImage not configured in deployment configs');
    }

    this.logger.info(
      `Copying database: ${sourceConfig.database} -> ${targetConfig.database}`
    );

    // Create DockerClient for source to detect pgvector
    const sourceDocker = new DockerClient(this.sourceSsh);

    // Build source compose options for PostgresHelper
    const sourceComposeOptions = this.pathResolver.buildComposeOptions(
      this.smokeTestResults.sourceActiveVersion,
      sourceDeploymentConfig.composeFiles
    );

    // Create PostgresHelper for source to detect pgvector
    const sourcePostgresHelper = new PostgresHelper({
      docker: sourceDocker,
      postgresImage: sourceImage,
      dockerNetwork: sourceDeploymentConfig.dockerNetwork,
      localDatabaseComposeServiceNames:
        sourceDeploymentConfig.localDatabaseComposeServiceNames ?? [],
      composeOptions: sourceComposeOptions,
    });

    // Create PostgresHelper for target to handle local DB container lifecycle
    const targetPostgresHelper = new PostgresHelper({
      docker: this.targetDocker,
      postgresImage: targetImage,
      dockerNetwork: targetDeploymentConfig.dockerNetwork,
      localDatabaseComposeServiceNames:
        targetDeploymentConfig.localDatabaseComposeServiceNames ?? [],
      composeOptions: this.targetComposeOptions,
    });

    // Step 1: Detect if pgvector is enabled on source and get list of other extensions
    this.logger.debug('Detecting pgvector on source database...');
    const { sourcePgVectorEnabled, extensionsToDump } =
      await sourcePostgresHelper.withDatabase(sourceConfig, (session) => {
        return {
          sourcePgVectorEnabled: detectPgVectorEnabled(session, this.logger),
          extensionsToDump: getExtensionsExceptVector(session),
        };
      });

    this.logger.debug(
      `Extensions to dump: ${extensionsToDump.join(', ') || '(none)'}`
    );

    // Step 2: Clear target schema and optionally enable pgvector, then stream data
    await targetPostgresHelper.withDatabase(targetConfig, async (session) => {
      // Step 2a: Clear target database schema (preserving extension objects)
      this.logger.debug('Clearing target database schema...');
      clearPublicSchemaPreservingExtensions(session, this.logger);

      // Step 2b: If source had pgvector, enable it on target before streaming data
      if (sourcePgVectorEnabled) {
        enablePgVector(session, this.logger);
      }

      // Step 2c: Stream data from source to target
      this.logger.debug('Streaming database content...');
      this.streamDatabaseContent(
        sourceConfig,
        targetConfig,
        sourceDeploymentConfig,
        targetDeploymentConfig,
        extensionsToDump
      );
    });

    this.logger.info(`Database ${sourceConfig.database} copied successfully`);
  }

  /**
   * Stream database content from source to target using pg_dump | psql pipe.
   * Assumes target DB container is already running (called within withDatabase).
   *
   * @param extensionsToDump - List of extensions to include in dump (excludes vector which is handled separately)
   */
  private streamDatabaseContent(
    sourceConfig: PostgresConnectionConfig,
    targetConfig: PostgresConnectionConfig,
    sourceDeploymentConfig: DeploymentConfig,
    targetDeploymentConfig: DeploymentConfig,
    extensionsToDump: string[]
  ): void {
    if (!this.sourceSsh || !this.targetSsh) {
      throw new Error('SSH clients not initialized');
    }

    const sourceImage = sourceDeploymentConfig.postgresImage!;
    const targetImage = targetDeploymentConfig.postgresImage!;

    // Build source connection string and command
    const sourcePort = sourceConfig.port ?? 5432;
    const sourceConnectionString = `postgresql://${sourceConfig.user}:${sourceConfig.password}@${sourceConfig.host}:${sourcePort}/${sourceConfig.database}`;

    const sourceDockerNetwork = sourceDeploymentConfig.dockerNetwork;
    const sourceLocalDbs =
      sourceDeploymentConfig.localDatabaseComposeServiceNames ?? [];
    const useSourceNetwork = sourceLocalDbs.includes(sourceConfig.host);

    // Build pg_dump flags
    // Use --extension=name for each extension we want to include (excluding vector)
    const pgDumpFlags = [
      '--no-owner',
      '--no-privileges',
      '--exclude-schema=pg_catalog',
      '--exclude-schema=information_schema',
      ...extensionsToDump.map((ext) => `--extension=${ext}`),
    ].join(' ');

    // Escape domains for sed (plain text replacement, not regex)
    const escapedSourceDomain = escapeSedPattern(this.config.source.domain);
    const escapedTargetDomain = escapeSedReplacement(this.config.target.domain);

    // Build docker run command for source
    const sourceDockerFlags = [
      '--rm',
      useSourceNetwork && sourceDockerNetwork
        ? `--network ${sourceDockerNetwork}`
        : '',
      `-e PGUSER=${sourceConfig.user}`,
      `-e PGPASSWORD=${sourceConfig.password}`,
    ]
      .filter(Boolean)
      .join(' ');

    const sourceCommand = `docker run ${sourceDockerFlags} ${sourceImage} bash -c 'set -o pipefail; pg_dump ${pgDumpFlags} "${sourceConnectionString}" | sed "s/${escapedSourceDomain}/${escapedTargetDomain}/g"'`;

    // Build target connection string and command
    const targetPort = targetConfig.port ?? 5432;
    const targetConnectionString = `postgresql://${targetConfig.user}:${targetConfig.password}@${targetConfig.host}:${targetPort}/${targetConfig.database}`;

    const targetDockerNetwork = targetDeploymentConfig.dockerNetwork;
    const targetLocalDbs =
      targetDeploymentConfig.localDatabaseComposeServiceNames ?? [];
    const useTargetNetwork = targetLocalDbs.includes(targetConfig.host);

    const targetDockerFlags = [
      '-i',
      '--rm',
      useTargetNetwork && targetDockerNetwork
        ? `--network ${targetDockerNetwork}`
        : '',
      `-e PGUSER=${targetConfig.user}`,
      `-e PGPASSWORD=${targetConfig.password}`,
    ]
      .filter(Boolean)
      .join(' ');

    // Use ON_ERROR_STOP=1 to fail immediately on SQL errors
    const targetCommand = `docker run ${targetDockerFlags} ${targetImage} psql -v ON_ERROR_STOP=1 -q "${targetConnectionString}"`;

    // Pipe data from source to target through CI runner
    pipeRemoteToRemote(
      this.sourceSsh,
      sourceCommand,
      this.targetSsh,
      targetCommand,
      false
    );
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clean up resources on successful completion
   */
  private cleanup(): void {
    this.safeCleanup('source SSH client', () => {
      this.sourceSsh?.cleanup();
    });

    this.safeCleanup('target SSH client', () => {
      this.targetSsh?.cleanup();
    });
  }

  /**
   * Clean up resources on error
   *
   * If the target app was stopped, we leave the maintenance page UP so there's
   * something serving traffic. A human operator must intervene to fix the issue.
   */
  private cleanupOnError(): void {
    // Release locks first so other operations can proceed
    this.safeCleanup('source deployment lock', () => {
      this.sourceLockService?.release();
    });
    this.safeCleanup('target deployment lock', () => {
      this.targetLockService?.release();
    });

    // If we started the target app but failed later (e.g., stability check), try stopping it
    this.safeCleanup('target app containers', () => {
      if (
        this.targetAppStarted &&
        this.dockerLifecycleService &&
        this.smokeTestResults
      ) {
        this.logger.info('Stopping target app containers after failed copy');
        this.dockerLifecycleService.stopVersion(
          this.smokeTestResults.targetActiveVersion,
          this.smokeTestResults.targetEnvironment
        );
      }
    });

    // If we stopped the target app, we need to keep the maintenance page UP.
    // If we didn't stop it, the old version is still running and we can stop the maintenance page.
    this.safeCleanup('maintenance page', () => {
      if (!this.targetAppStopped) {
        return;
      }

      if (!this.maintenanceIsUp && this.maintenanceService) {
        // Target was stopped but maintenance page isn't up - start it so something serves traffic
        const message =
          this.smokeTestResults?.targetDeploymentConfig.maintenanceMessage ??
          'Wartungsarbeiten';
        this.maintenanceService.start(this.config.target.domain, message);
        this.maintenanceIsUp = true;
        this.logger.warn(
          'Maintenance page started after failed copy. Manual intervention required.'
        );
      } else if (this.maintenanceIsUp) {
        // Target stopped, maintenance is already up - leave it up
        this.logger.warn(
          'Leaving maintenance page UP after failed copy. Manual intervention required.'
        );
      }
    });

    this.safeCleanup('source SSH client', () => {
      this.sourceSsh?.cleanup();
    });

    this.safeCleanup('target SSH client', () => {
      this.targetSsh?.cleanup();
    });
  }

  /**
   * Safely clean up a resource with error handling
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
}
