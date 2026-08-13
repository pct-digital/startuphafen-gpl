/**
 * Deployment Package Tests
 *
 * Validates the deployment package (ZIP file) structure and contents.
 * Also runs disk space and memory tests using configuration from the package.
 *
 * Tests included:
 * - ZIP Exists: Deployment ZIP file exists on runner
 * - ZIP Structure: ZIP contains single directory named after tag
 * - Deployment Directory: deployment/ directory exists in expected location
 * - Environment Config: staging.json or production.json exists
 * - Hooks Directory: hooks/ directory exists
 * - Required Hooks: maintenance.js, pre-down.js, and post-up.js hooks exist
 * - Compose Files Exist: All compose files referenced in config exist in ZIP
 * - Docker Env Expansion: All ${VAR} refs in DEPLOY_DOCKER_ENV can be resolved
 * - Compose Env Variables: All ${VAR} refs in compose files exist in DEPLOY_DOCKER_ENV
 * - Disk Space: Sufficient disk space (using minDiskSpaceGB from config)
 * - Memory: Sufficient free physical memory (using minFreeMemoryMB from config)
 */

import { existsSync } from 'fs';
import * as path from 'path';
import { SshClient } from '../../infra/ssh-client';
import { runDiskSpaceTest } from './disk-space-test';
import { runMemoryTest } from './memory-test';
import {
  DeploymentConfig,
  parseConfigOverride,
} from '../../config/deployment-config';
import { PathResolver } from '../service/path-resolver';
import { TestRunner, TestResult } from '../utils/test-runner';
import { ZipInspector } from '../utils/zip-inspector';
import { logger } from '../utils/logger';

export interface DeploymentPackageTestsConfig {
  ssh: SshClient;
  /** Path to the deployment ZIP file */
  zipPath: string;
  /** Path resolver for determining paths within the ZIP */
  pathResolver: PathResolver;
  /** Environment: "staging" or "production" */
  environment: 'staging' | 'production';
  /** CI environment variables (needed for DEPLOY_DOCKER_ENV expansion validation) */
  env: Record<string, string>;
}

/**
 * Deployment Package Tests - Validates ZIP structure and contents
 */
export class DeploymentPackageTests {
  private readonly ssh: SshClient;
  private readonly zipPath: string;
  private readonly pathResolver: PathResolver;
  private readonly environment: 'staging' | 'production';
  private readonly env: Record<string, string>;
  private readonly zipInspector: ZipInspector;
  private deployTag: string | null = null;
  private deploymentConfig: DeploymentConfig | null = null;

  constructor(config: DeploymentPackageTestsConfig) {
    this.ssh = config.ssh;
    this.zipPath = config.zipPath;
    this.pathResolver = config.pathResolver;
    this.environment = config.environment;
    this.env = config.env;
    this.zipInspector = new ZipInspector(config.zipPath);
  }

  /**
   * Run all deployment package tests
   * @throws Error if any test fails
   */
  run(): void {
    const runner = new TestRunner({ suiteName: 'Deployment package tests' });

    // First run local ZIP tests (don't need SSH)
    runner.run([
      () => this.testZipExists(),
      () => this.testZipStructure(),
      () => this.testDeploymentDirectory(),
      () => this.testEnvironmentConfig(),
      () => this.testHooksDirectory(),
      () => this.testRequiredHooks(),
      () => this.testServerSetupDirectory(),
      () => this.testServerSetupPlaybook(),
      () => this.testComposeFilesExist(),
      () => this.testDockerEnvExpansion(),
      () => this.testComposeEnvVariables(),
    ]);

    // Now run disk space test using config from package
    if (!this.deploymentConfig) {
      throw new Error(
        'Deployment configuration not loaded. Environment config test may have failed.'
      );
    }

    const minDiskSpaceGB = this.deploymentConfig.minDiskSpaceGB;
    runDiskSpaceTest({
      ssh: this.ssh,
      minDiskSpaceGB,
      checkPath: this.pathResolver.getDeployRoot(),
    });

    // Run memory test using config from package
    const minFreeMemoryMB = this.deploymentConfig.minFreeMemoryMB;
    runMemoryTest({
      ssh: this.ssh,
      pathResolver: this.pathResolver,
      minFreeMemoryMB,
      environment: this.environment,
    });
  }

  /**
   * Get the parsed deployment configuration
   */
  getDeploymentConfig(): DeploymentConfig | null {
    return this.deploymentConfig;
  }

  /**
   * Test that ZIP file exists
   */
  private testZipExists(): TestResult {
    const name = 'ZIP Exists';

    if (!existsSync(this.zipPath)) {
      return {
        name,
        passed: false,
        message: `ZIP file not found: ${this.zipPath}`,
      };
    }

    return { name, passed: true, message: `Found ${this.zipPath}` };
  }

  /**
   * Test ZIP structure - should contain single directory named after deploy tag
   */
  private testZipStructure(): TestResult {
    const name = 'ZIP Structure';

    try {
      this.deployTag = this.zipInspector.getDeployTag();
      return {
        name,
        passed: true,
        message: `Root directory: ${this.deployTag}`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: msg };
    }
  }

  /**
   * Test that deployment directory exists in ZIP
   * Expected: <tag>/apps/<app>-backend/assets/deployment/
   */
  private testDeploymentDirectory(): TestResult {
    const name = 'Deployment Directory';

    if (!this.deployTag) {
      return {
        name,
        passed: false,
        message: 'Deploy tag not detected (ZIP structure test failed)',
      };
    }

    const expectedPath = this.pathResolver.getZipDeploymentPath(this.deployTag);

    if (this.zipInspector.pathExists(`${expectedPath}*`)) {
      return { name, passed: true, message: `Found ${expectedPath}` };
    }

    return {
      name,
      passed: false,
      message: `Directory not found: ${expectedPath}`,
    };
  }

  /**
   * Test that environment config file exists and is valid
   */
  private testEnvironmentConfig(): TestResult {
    const name = 'Environment Config';

    if (!this.deployTag) {
      return { name, passed: false, message: 'Deploy tag not detected' };
    }

    try {
      // Parse config override from DEPLOY_OVERWRITE_CONFIG env var if present
      let configOverride: Record<string, unknown> | undefined;
      try {
        configOverride = parseConfigOverride(this.env);
      } catch (e) {
        return { name, passed: false, message: (e as Error).message };
      }

      this.deploymentConfig = this.zipInspector.extractDeploymentConfig(
        this.deployTag,
        this.environment,
        configOverride
      );

      const overrideNote = configOverride ? ' (with CI overrides)' : '';
      return {
        name,
        passed: true,
        message: `${this.environment}.json valid${overrideNote} (appName: ${this.deploymentConfig.appName}, minDiskSpaceGB: ${this.deploymentConfig.minDiskSpaceGB})`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: msg };
    }
  }

  /**
   * Test that hooks directory exists
   */
  private testHooksDirectory(): TestResult {
    const name = 'Hooks Directory';

    if (!this.deployTag) {
      return { name, passed: false, message: 'Deploy tag not detected' };
    }

    const hooksPath = this.pathResolver.getZipHooksPath(this.deployTag);

    if (this.zipInspector.pathExists(`${hooksPath}*`)) {
      return { name, passed: true, message: 'hooks/ directory exists' };
    }

    return {
      name,
      passed: false,
      message: `Hooks directory not found: ${hooksPath}`,
    };
  }

  /**
   * Test that required hooks exist (at minimum maintenance.js)
   */
  private testRequiredHooks(): TestResult {
    const name = 'Required Hooks';

    if (!this.deployTag) {
      return { name, passed: false, message: 'Deploy tag not detected' };
    }

    const requiredHooks = ['maintenance.js', 'pre-down.js', 'post-up.js'];
    const missingRequired: string[] = [];
    const foundHooks: string[] = [];

    for (const hook of requiredHooks) {
      const hookPath = this.pathResolver.getZipHookPath(this.deployTag, hook);
      if (this.zipInspector.pathExists(hookPath)) {
        foundHooks.push(hook);
      } else {
        missingRequired.push(hook);
      }
    }

    if (missingRequired.length > 0) {
      return {
        name,
        passed: false,
        message: `Missing required hooks: ${missingRequired.join(', ')}`,
      };
    }

    return {
      name,
      passed: true,
      message: `Found all required hooks: ${foundHooks.join(', ')}`,
    };
  }

  /**
   * Test that server-setup directory exists
   */
  private testServerSetupDirectory(): TestResult {
    const name = 'Server Setup Directory';

    if (!this.deployTag) {
      return { name, passed: false, message: 'Deploy tag not detected' };
    }

    const serverSetupPath = this.pathResolver.getZipServerSetupPath(
      this.deployTag
    );

    if (this.zipInspector.pathExists(`${serverSetupPath}*`)) {
      return { name, passed: true, message: 'server-setup/ directory exists' };
    }

    return {
      name,
      passed: false,
      message: `Server setup directory not found: ${serverSetupPath}`,
    };
  }

  /**
   * Test that the server-setup playbook exists
   */
  private testServerSetupPlaybook(): TestResult {
    const name = 'Server Setup Playbook';

    if (!this.deployTag) {
      return { name, passed: false, message: 'Deploy tag not detected' };
    }

    const playbookPath = this.pathResolver.getZipServerSetupPlaybookPath(
      this.deployTag
    );

    if (this.zipInspector.pathExists(playbookPath)) {
      return {
        name,
        passed: true,
        message: this.pathResolver.getServerSetupPlaybookFileName() + ' exists',
      };
    }

    return {
      name,
      passed: false,
      message: `Playbook not found: ${playbookPath}`,
    };
  }

  /**
   * Test that all compose files referenced in deployment config exist in the ZIP.
   */
  private testComposeFilesExist(): TestResult {
    const name = 'Compose Files Exist';

    if (!this.deployTag || !this.deploymentConfig) {
      return {
        name,
        passed: false,
        message: 'Deploy tag or config not detected',
      };
    }

    const configPath = this.pathResolver.getZipEnvironmentConfigPath(
      this.deployTag,
      this.environment
    );
    const configDir = path.dirname(configPath);

    const missingFiles: string[] = [];

    for (const composeFile of this.deploymentConfig.composeFiles) {
      const composePathInZip = path.join(configDir, composeFile);
      if (!this.zipInspector.pathExists(composePathInZip)) {
        missingFiles.push(composeFile);
      }
    }

    if (missingFiles.length > 0) {
      return {
        name,
        passed: false,
        message: `Missing compose files: ${missingFiles.join(', ')}`,
      };
    }

    return {
      name,
      passed: true,
      message: `All ${this.deploymentConfig.composeFiles.length} compose file(s) found`,
    };
  }

  /**
   * Test that all ${VAR} references in DEPLOY_DOCKER_ENV can be resolved from CI env.
   * This validates early that env expansion won't fail during deployment.
   */
  private testDockerEnvExpansion(): TestResult {
    const name = 'Docker Env Expansion';

    const dockerEnv = this.env['DEPLOY_DOCKER_ENV'];
    if (!dockerEnv) {
      return { name, passed: false, message: 'DEPLOY_DOCKER_ENV is not set' };
    }

    // Find all ${VAR} references in DEPLOY_DOCKER_ENV
    const refPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
    const missingRefs: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = refPattern.exec(dockerEnv)) !== null) {
      const varName = match[1];
      if (this.env[varName] === undefined) {
        missingRefs.push(varName);
      }
    }

    if (missingRefs.length > 0) {
      return {
        name,
        passed: false,
        message: `DEPLOY_DOCKER_ENV references undefined variables: ${missingRefs.join(
          ', '
        )}`,
      };
    }

    return {
      name,
      passed: true,
      message: 'All variable references can be resolved',
    };
  }

  /**
   * Test that all ${VAR} references in docker-compose files exist in DEPLOY_DOCKER_ENV.
   * This ensures docker-compose won't fail due to missing environment variables.
   */
  private testComposeEnvVariables(): TestResult {
    const name = 'Compose Env Variables';

    if (!this.deployTag || !this.deploymentConfig) {
      return {
        name,
        passed: false,
        message: 'Deploy tag or config not detected',
      };
    }

    const dockerEnv = this.env['DEPLOY_DOCKER_ENV'];
    if (!dockerEnv) {
      return { name, passed: false, message: 'DEPLOY_DOCKER_ENV is not set' };
    }

    // Parse keys defined in DEPLOY_DOCKER_ENV (left side of =)
    const definedKeys = new Set<string>();
    for (const line of dockerEnv.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        definedKeys.add(trimmed.substring(0, eqIndex));
      }
    }

    // Compute the base path for compose files (relative to deployment config)
    const configPath = this.pathResolver.getZipEnvironmentConfigPath(
      this.deployTag,
      this.environment
    );
    const configDir = path.dirname(configPath);

    // Read each compose file and extract ${VAR} references
    const allMissingVars: { file: string; vars: string[] }[] = [];

    for (const composeFile of this.deploymentConfig.composeFiles) {
      // Resolve compose file path relative to config directory
      const composePathInZip = path.join(configDir, composeFile);

      let composeContent: string;
      try {
        composeContent = this.zipInspector.readFile(composePathInZip);
      } catch {
        // File doesn't exist in ZIP - caught by testComposeFilesExist
        continue;
      }

      // Find all $VAR and ${VAR} references (docker-compose supports both)
      // Pattern matches: ${VAR_NAME} or $VAR_NAME (not followed by more word chars)
      const varPattern =
        /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)\b/g;
      const referencedVars = new Set<string>();
      let varMatch: RegExpExecArray | null;

      while ((varMatch = varPattern.exec(composeContent)) !== null) {
        // Group 1 is ${VAR}, Group 2 is $VAR
        const varName = varMatch[1] ?? varMatch[2];
        referencedVars.add(varName);
      }

      // Check which referenced vars are not defined in DEPLOY_DOCKER_ENV
      const missingVars = [...referencedVars].filter(
        (v) => !definedKeys.has(v)
      );

      if (missingVars.length > 0) {
        allMissingVars.push({ file: composeFile, vars: missingVars });
      }
    }

    if (allMissingVars.length > 0) {
      const details = allMissingVars
        .map((m) => `${m.file}: ${m.vars.join(', ')}`)
        .join('; ');
      return {
        name,
        passed: false,
        message: `Compose files reference undefined env vars: ${details}`,
      };
    }

    return {
      name,
      passed: true,
      message: 'All compose env vars are defined in DEPLOY_DOCKER_ENV',
    };
  }
}
