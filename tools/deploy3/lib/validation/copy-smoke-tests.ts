/**
 * Copy Smoke Tests
 *
 * Validation tests that run before database copy operations.
 * These tests verify both source and target servers meet requirements.
 *
 * Target tests (run first - deploy3 required):
 * - SSH Key Valid, SSH Connectivity, Docker Available
 * - Active Version Exists, App Is Running (requires deployment config)
 * - Target Not Production, Database Connectivity
 *
 * Source tests:
 * - SSH Key Valid, SSH Connectivity, Docker Available
 * - Active Version Exists
 * - Deployment Config (requires either deploy3 config file or sourceConfigOverride)
 * - Database Connectivity
 */

import { RemoteFileSystem } from '../../infra/file-system';
import { SshClient } from '../../infra/ssh-client';
import { DockerClient } from '../../infra/docker-client';
import { PathResolver } from '../service/path-resolver';
import { TestRunner, TestResult } from '../utils/test-runner';
import { CopyConfig } from '../../config/copy-config';
import {
  DeploymentConfigSchema,
  DeploymentConfig,
} from '../../config/deployment-config';
import { logger } from '../utils/logger';

/**
 * Configuration for CopySmokeTests
 */
export interface CopySmokeTestsConfig {
  /** Copy configuration with source/target details and databases */
  copyConfig: CopyConfig;
  /** SSH client for source server communication */
  sourceSsh: SshClient;
  /** SSH client for target server communication */
  targetSsh: SshClient;
}

/**
 * Result of running copy smoke tests - contains discovered server state
 */
export interface CopySmokeTestsResult {
  sourceActiveVersion: string;
  targetActiveVersion: string;
  sourceDeploymentConfig: DeploymentConfig;
  targetDeploymentConfig: DeploymentConfig;
  /** Environment of the target server, detected from its marker files */
  targetEnvironment: 'staging' | 'production';
}

/**
 * Copy Smoke Tests - Validates source and target server requirements
 */
export class CopySmokeTests {
  private readonly copyConfig: CopyConfig;
  private readonly sourceSsh: SshClient;
  private readonly targetSsh: SshClient;
  private readonly pathResolver: PathResolver;

  // Discovered data from servers
  private sourceActiveVersion: string | undefined;
  private targetActiveVersion: string | undefined;
  private sourceDeploymentConfig: DeploymentConfig | undefined;
  private targetDeploymentConfig: DeploymentConfig | undefined;

  constructor(config: CopySmokeTestsConfig) {
    this.copyConfig = config.copyConfig;
    this.sourceSsh = config.sourceSsh;
    this.targetSsh = config.targetSsh;
    this.pathResolver = new PathResolver({
      appName: config.copyConfig.appName,
    });
  }

  /**
   * Run all copy smoke tests for both source and target
   * @returns Discovered server state (active versions and deployment configs)
   * @throws Error if any test fails
   */
  run(): CopySmokeTestsResult {
    const runner = new TestRunner({ suiteName: 'Copy smoke tests' });

    runner.run([
      // Target tests FIRST - deploy3 required
      () => this.testSshKeyValid(this.targetSsh, 'Target'),
      () => this.testSshConnectivity(this.targetSsh, 'Target'),
      () => this.testDockerAvailable(this.targetSsh, 'Target'),
      () =>
        this.testActiveVersionExists(this.targetSsh, 'Target', (version) => {
          this.targetActiveVersion = version;
        }),
      () =>
        this.testAppIsRunning(
          this.targetSsh,
          'Target',
          this.targetActiveVersion,
          (config) => {
            this.targetDeploymentConfig = config;
          }
        ),
      () => this.testNotProduction(this.targetSsh),
      () =>
        this.testDatabaseConnectivity(
          this.targetSsh,
          'Target',
          this.targetDeploymentConfig,
          'targetConfig'
        ),

      // Source tests - deploy2 compatible
      () => this.testSshKeyValid(this.sourceSsh, 'Source'),
      () => this.testSshConnectivity(this.sourceSsh, 'Source'),
      () => this.testDockerAvailable(this.sourceSsh, 'Source'),
      () =>
        this.testActiveVersionExists(this.sourceSsh, 'Source', (version) => {
          this.sourceActiveVersion = version;
        }),
      () => this.testSourceDeploymentConfig(),
      () => this.testSourceDatabaseConnectivity(),
    ]);

    // Return discovered data
    if (!this.sourceActiveVersion || !this.targetActiveVersion) {
      throw new Error(
        'Active versions not discovered - smoke tests did not run correctly'
      );
    }
    if (!this.targetDeploymentConfig) {
      throw new Error(
        'Target deployment config not discovered - smoke tests did not run correctly'
      );
    }
    if (!this.sourceDeploymentConfig) {
      throw new Error(
        'Source deployment config not discovered - smoke tests did not run correctly!'
      );
    }

    const targetEnvironment = this.detectEnvironment(
      new RemoteFileSystem(this.targetSsh),
      this.pathResolver
    );

    return {
      sourceActiveVersion: this.sourceActiveVersion,
      targetActiveVersion: this.targetActiveVersion,
      sourceDeploymentConfig: this.sourceDeploymentConfig,
      targetDeploymentConfig: this.targetDeploymentConfig,
      targetEnvironment,
    };
  }

  // ===========================================================================
  // Generic Test Methods
  // ===========================================================================

  private testSshKeyValid(ssh: SshClient, label: string): TestResult {
    const name = `${label}: SSH Key Valid`;
    try {
      ssh.validateKey();
      return { name, passed: true, message: 'SSH key is valid' };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: msg };
    }
  }

  private testSshConnectivity(ssh: SshClient, label: string): TestResult {
    const name = `${label}: SSH Connectivity`;
    try {
      const result = ssh.exec('echo "connected"', { silent: true });
      if (result.trim() === 'connected') {
        return {
          name,
          passed: true,
          message: `Successfully connected to ${label.toLowerCase()} server`,
        };
      }
      return { name, passed: false, message: `Unexpected response: ${result}` };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: `Connection failed: ${msg}` };
    }
  }

  private testDockerAvailable(ssh: SshClient, label: string): TestResult {
    const name = `${label}: Docker Available`;
    try {
      const versionResult = ssh.exec(
        'docker version --format "{{.Server.Version}}"',
        {
          silent: true,
        }
      );

      if (versionResult.trim()) {
        return {
          name,
          passed: true,
          message: `Docker ${versionResult.trim()} running`,
        };
      }

      return { name, passed: false, message: 'Docker daemon is not running' };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: `Docker check failed: ${msg}` };
    }
  }

  private testActiveVersionExists(
    ssh: SshClient,
    label: string,
    onVersionFound: (version: string) => void
  ): TestResult {
    const name = `${label}: Active Version Exists`;
    try {
      const fs = new RemoteFileSystem(ssh);
      const activeLinkPath = this.pathResolver.getActiveLinkPath();

      if (!fs.pathExists(activeLinkPath)) {
        return {
          name,
          passed: false,
          message: 'No active version found (no active symlink)',
        };
      }

      const resolvedPath = fs.readlink(activeLinkPath);
      if (!resolvedPath) {
        return {
          name,
          passed: false,
          message: 'Active symlink exists but could not be resolved',
        };
      }

      // Extract version tag from path
      const versionTag = resolvedPath.split('/').pop();
      if (!versionTag) {
        return {
          name,
          passed: false,
          message: `Could not extract version tag from: ${resolvedPath}`,
        };
      }

      onVersionFound(versionTag);
      return { name, passed: true, message: `Active version: ${versionTag}` };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name,
        passed: false,
        message: `Failed to check active version: ${msg}`,
      };
    }
  }

  private testAppIsRunning(
    ssh: SshClient,
    label: 'Target' | 'Source',
    activeVersion: string | undefined,
    onConfigLoaded: (config: DeploymentConfig) => void
  ): TestResult {
    const name = `${label}: App Is Running`;
    try {
      if (!activeVersion) {
        return {
          name,
          passed: false,
          message: 'Cannot check - no active version found',
        };
      }

      // Read deployment config to get compose files
      const fs = new RemoteFileSystem(ssh);

      // Try to detect environment from marker files
      const environment = this.detectEnvironment(fs, this.pathResolver);
      const configPath = this.pathResolver.getVersionEnvironmentConfigPath(
        activeVersion,
        environment
      );

      if (!fs.pathExists(configPath)) {
        return {
          name,
          passed: false,
          message: `Deployment config not found: ${configPath}`,
        };
      }

      const configContent = fs.readFile(configPath, { silent: true });
      let jsonData = JSON.parse(configContent);

      // Apply target config override if this is the target and override is present
      if (label === 'Target' && this.copyConfig.targetConfigOverride) {
        jsonData = { ...jsonData, ...this.copyConfig.targetConfigOverride };
      }

      const deploymentConfig = DeploymentConfigSchema.parse(jsonData);
      onConfigLoaded(deploymentConfig);

      // Build compose options and check running services
      const composeOptions = this.pathResolver.buildComposeOptions(
        activeVersion,
        deploymentConfig.composeFiles
      );

      const docker = new DockerClient(ssh);
      const runningServices = docker.getRunningComposeServices(composeOptions);

      if (runningServices.length === 0) {
        return {
          name,
          passed: false,
          message: 'No compose services are running',
        };
      }

      return {
        name,
        passed: true,
        message: `${
          runningServices.length
        } service(s) running: ${runningServices.join(', ')}`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name,
        passed: false,
        message: `Failed to check running services: ${msg}`,
      };
    }
  }

  private testDatabaseConnectivity(
    ssh: SshClient,
    label: string,
    deploymentConfig: DeploymentConfig | undefined,
    configKey: 'sourceConfig' | 'targetConfig'
  ): TestResult {
    const name = `${label}: Database Connectivity`;
    let currentDatabase = '';
    try {
      if (!deploymentConfig) {
        return {
          name,
          passed: false,
          message: 'Cannot test - deployment config not loaded',
        };
      }

      const postgresImage = deploymentConfig.postgresImage;
      if (!postgresImage) {
        return {
          name,
          passed: false,
          message: 'postgresImage not configured in deployment config',
        };
      }

      const docker = new DockerClient(ssh);
      const dockerNetwork = deploymentConfig.dockerNetwork;

      // Test each database
      for (const dbConfig of this.copyConfig.databases) {
        if (dbConfig.type !== 'postgres') {
          continue; // Skip non-postgres databases
        }

        const conn = dbConfig[configKey];
        currentDatabase = conn.database;
        const port = conn.port ?? 5432;
        const connectionString = `postgresql://${conn.user}:${conn.password}@${conn.host}:${port}/${conn.database}`;

        // Use docker network if it's a local database service
        const network =
          deploymentConfig.localDatabaseComposeServiceNames?.includes(conn.host)
            ? dockerNetwork
            : undefined;

        docker.run(
          postgresImage,
          `psql "${connectionString}" -c "SELECT 1"`,
          { rm: true, network },
          { silent: true }
        );
      }

      return {
        name,
        passed: true,
        message: `All ${this.copyConfig.databases.length} database(s) accessible`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const dbNote = currentDatabase ? ` [database: ${currentDatabase}]` : '';
      return {
        name,
        passed: false,
        message: `Database connectivity failed${dbNote}`,
      };
    }
  }

  private testNotProduction(ssh: SshClient): TestResult {
    const name = 'Target: Not Production';
    try {
      const fs = new RemoteFileSystem(ssh);
      const productionMarkerPath =
        this.pathResolver.getEnvironmentMarkerPath('production');

      if (fs.pathExists(productionMarkerPath)) {
        if (this.copyConfig.allowProductionTarget) {
          logger.warn(
            '⚠️  Target server is marked as production - proceeding because the operator explicitly confirmed overwriting it.'
          );
          return {
            name,
            passed: true,
            message:
              'Server is marked as production, but overwrite was explicitly confirmed (allowProductionTarget)',
          };
        }
        return {
          name,
          passed: false,
          message:
            'This server is marked as production. Copying to production is not allowed without explicit confirmation (confirm_prod input).',
        };
      }

      return {
        name,
        passed: true,
        message: 'Server is not marked as production',
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name,
        passed: false,
        message: `Failed to check environment marker: ${msg}`,
      };
    }
  }

  /**
   * Test source deployment config.
   * Requires either a deploy3 config file OR a sourceConfigOverride from CI.
   * If both exist, override is merged over the file config.
   * If neither exists, fails - we can't proceed without knowing docker network, postgres image, etc.
   */
  private testSourceDeploymentConfig(): TestResult {
    const name = 'Source: Deployment Config';
    try {
      if (!this.sourceActiveVersion) {
        return {
          name,
          passed: false,
          message: 'Cannot check - no active version found',
        };
      }

      const fs = new RemoteFileSystem(this.sourceSsh);
      const environment = this.detectEnvironment(fs, this.pathResolver);
      const configPath = this.pathResolver.getVersionEnvironmentConfigPath(
        this.sourceActiveVersion,
        environment
      );

      const hasConfigFile = fs.pathExists(configPath);
      const hasOverride = !!this.copyConfig.sourceConfigOverride;

      // Case 1: No config file and no override - fail
      if (!hasConfigFile && !hasOverride) {
        return {
          name,
          passed: false,
          message:
            `No deploy3 config found at ${configPath} and no DEPLOY_OVERWRITE_CONFIG provided. ` +
            `Source must have either a deployment config file or CI override with required fields ` +
            `(postgresImage, dockerNetwork, etc.)`,
        };
      }

      // Case 2: Only override (no file) - use override as full config
      if (!hasConfigFile && hasOverride) {
        const deploymentConfig = DeploymentConfigSchema.parse(
          this.copyConfig.sourceConfigOverride
        );
        this.sourceDeploymentConfig = deploymentConfig;
        return {
          name,
          passed: true,
          message:
            'Using DEPLOY_OVERWRITE_CONFIG as deployment config (no config file on source)',
        };
      }

      // Case 3: Config file exists - load it and optionally merge override
      const configContent = fs.readFile(configPath, { silent: true });
      let jsonData = JSON.parse(configContent);

      if (hasOverride) {
        jsonData = { ...jsonData, ...this.copyConfig.sourceConfigOverride };
      }

      const deploymentConfig = DeploymentConfigSchema.parse(jsonData);
      this.sourceDeploymentConfig = deploymentConfig;

      const overrideNote = hasOverride ? ' (with CI overrides)' : '';
      return {
        name,
        passed: true,
        message: `Deploy3 deployment config found${overrideNote}`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name,
        passed: false,
        message: `Failed to load deployment config: ${msg}`,
      };
    }
  }

  /**
   * Test source database connectivity.
   * Requires sourceDeploymentConfig to be set (from testSourceDeploymentConfig).
   */
  private testSourceDatabaseConnectivity(): TestResult {
    const name = 'Source: Database Connectivity';
    let currentDatabase = '';
    try {
      if (!this.sourceDeploymentConfig) {
        return {
          name,
          passed: false,
          message: 'Cannot test - source deployment config not loaded',
        };
      }

      const postgresImage = this.sourceDeploymentConfig.postgresImage;
      if (!postgresImage) {
        return {
          name,
          passed: false,
          message: 'postgresImage not configured in source deployment config',
        };
      }

      const docker = new DockerClient(this.sourceSsh);
      const dockerNetwork = this.sourceDeploymentConfig.dockerNetwork;

      // Test each database
      for (const dbConfig of this.copyConfig.databases) {
        if (dbConfig.type !== 'postgres') {
          continue;
        }

        const conn = dbConfig.sourceConfig;
        currentDatabase = conn.database;
        const port = conn.port ?? 5432;
        const connectionString = `postgresql://${conn.user}:${conn.password}@${conn.host}:${port}/${conn.database}`;

        // Use docker network if it's a local database service
        const network =
          this.sourceDeploymentConfig.localDatabaseComposeServiceNames?.includes(
            conn.host
          )
            ? dockerNetwork
            : undefined;

        docker.run(
          postgresImage,
          `psql "${connectionString}" -c "SELECT 1"`,
          { rm: true, network },
          { silent: true }
        );
      }

      return {
        name,
        passed: true,
        message: `All ${this.copyConfig.databases.length} database(s) accessible`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const dbNote = currentDatabase ? ` [database: ${currentDatabase}]` : '';
      return {
        name,
        passed: false,
        message: `Database connectivity failed${dbNote}`,
      };
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Detect the environment (staging or production) from marker files.
   * Defaults to 'staging' if no marker is found.
   */
  private detectEnvironment(
    fs: RemoteFileSystem,
    pathResolver: PathResolver
  ): 'staging' | 'production' {
    const productionMarker =
      pathResolver.getEnvironmentMarkerPath('production');
    const stagingMarker = pathResolver.getEnvironmentMarkerPath('staging');

    if (fs.pathExists(productionMarker)) {
      return 'production';
    }
    if (fs.pathExists(stagingMarker)) {
      return 'staging';
    }

    // Default to staging if no marker (e.g., first deployment)
    return 'staging';
  }
}
