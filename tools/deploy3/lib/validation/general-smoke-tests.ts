/**
 * General Smoke Tests
 *
 * Server-side validation tests that run before any deployment operations.
 * These tests verify the target server meets basic requirements.
 *
 * Tests included:
 * - SSH Key Valid: SSH key exists and is valid
 * - SSH Connectivity: Can connect to target server
 * - Ubuntu System: Target is Ubuntu (via /etc/os-release)
 * - Docker Available: Docker is installed and daemon running
 * - Unzip Available: unzip and zipinfo utilities installed
 * - Environment Marker: Validates deployment environment hasn't changed (if marker exists)
 *
 * On a fresh server (no active deployment) missing docker/unzip is tolerated:
 * the run-server-setup step installs them before they are first needed.
 */

import { RemoteFileSystem } from '../../infra/file-system';
import { SshClient } from '../../infra/ssh-client';
import { PathResolver } from '../service/path-resolver';
import { TestRunner, TestResult } from '../utils/test-runner';
import { logger } from '../utils/logger';

/**
 * Configuration for GeneralSmokeTests
 */
export interface GeneralSmokeTestsConfig {
  /** SSH client for server communication */
  ssh: SshClient;
  /** Path resolver for determining file locations (optional, needed for environment check) */
  pathResolver: PathResolver;
  /** Current deployment environment (optional, needed for environment check) */
  environment: 'staging' | 'production';
}

/**
 * General Smoke Tests - Validates server-side requirements
 */
export class GeneralSmokeTests {
  private readonly ssh: SshClient;
  private readonly pathResolver: PathResolver;
  private readonly environment: 'staging' | 'production';

  constructor(config: GeneralSmokeTestsConfig) {
    this.ssh = config.ssh;
    this.pathResolver = config.pathResolver;
    this.environment = config.environment;
  }

  /**
   * Run all general smoke tests
   * @throws Error if any test fails
   */
  run(): void {
    const runner = new TestRunner({ suiteName: 'General smoke tests' });

    runner.run([
      () => this.testSshKeyValid(),
      () => this.testSshConnectivity(),
      () => this.testUbuntuSystem(),
      () => this.testDockerAvailable(),
      () => this.testUnzipAvailable(),
      () => this.testEnvironmentMarker(),
      () => this.testOldVersionCompatibility(),
    ]);
  }

  /**
   * Test that SSH key is valid
   */
  private testSshKeyValid(): TestResult {
    const name = 'SSH Key Valid';

    try {
      this.ssh.validateKey();
      return { name, passed: true, message: 'SSH key is valid' };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: msg };
    }
  }

  /**
   * Test SSH connectivity to target server
   */
  private testSshConnectivity(): TestResult {
    const name = 'SSH Connectivity';

    try {
      const result = this.ssh.exec('echo "connected"', { silent: true });
      if (result.trim() === 'connected') {
        return {
          name,
          passed: true,
          message: 'Successfully connected to server',
        };
      }
      return { name, passed: false, message: `Unexpected response: ${result}` };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: `Connection failed: ${msg}` };
    }
  }

  /**
   * Test that target system is Ubuntu
   */
  private testUbuntuSystem(): TestResult {
    const name = 'Ubuntu System';

    try {
      const result = this.ssh.exec('cat /etc/os-release', { silent: true });

      if (result.includes('ID=ubuntu')) {
        // Extract version for info
        const versionMatch = result.match(/VERSION_ID="([^"]+)"/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        return { name, passed: true, message: `Ubuntu ${version} detected` };
      }

      // Try to identify what OS it is
      const idMatch = result.match(/^ID=(.+)$/m);
      const osId = idMatch ? idMatch[1].replace(/"/g, '') : 'unknown';
      return {
        name,
        passed: false,
        message: `Expected Ubuntu, found: ${osId}`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: `Failed to detect OS: ${msg}` };
    }
  }

  /**
   * Test that Docker is installed and running
   */
  private testDockerAvailable(): TestResult {
    const name = 'Docker Available';

    try {
      // Check if docker command exists ("|| true" because a non-zero exit
      // code would make exec throw)
      const whichResult = this.ssh.exec('command -v docker || true', {
        silent: true,
      });
      if (!whichResult.trim()) {
        if (this.isFreshServer()) {
          return {
            name,
            passed: true,
            message:
              'Docker not installed yet (fresh server) — will be installed by server-setup playbook',
          };
        }
        return { name, passed: false, message: 'Docker is not installed' };
      }

      // Check if docker daemon is running; capture error output instead of
      // throwing so we can report the specific failure
      const versionResult = this.ssh.exec(
        'docker version --format "{{.Server.Version}}" 2>&1 || true',
        {
          silent: true,
        }
      );
      const output = versionResult.trim();

      if (output.includes('Cannot connect to the Docker daemon')) {
        return { name, passed: false, message: 'Docker daemon is not running' };
      }
      if (output.toLowerCase().includes('permission denied')) {
        return {
          name,
          passed: false,
          message: 'No permission to access Docker',
        };
      }

      if (output) {
        return {
          name,
          passed: true,
          message: `Docker ${output} running`,
        };
      }

      return { name, passed: false, message: 'Docker daemon is not running' };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return { name, passed: false, message: `Docker check failed: ${msg}` };
    }
  }

  /**
   * Test that unzip utilities are available
   */
  private testUnzipAvailable(): TestResult {
    const name = 'Unzip Available';

    try {
      const unzipResult = this.ssh.exec('command -v unzip || true', {
        silent: true,
      });
      const zipinfoResult = this.ssh.exec('command -v zipinfo || true', {
        silent: true,
      });

      const hasUnzip = unzipResult.trim().length > 0;
      const hasZipinfo = zipinfoResult.trim().length > 0;

      if (hasUnzip && hasZipinfo) {
        return { name, passed: true, message: 'unzip and zipinfo available' };
      }

      const missing: string[] = [];
      if (!hasUnzip) missing.push('unzip');
      if (!hasZipinfo) missing.push('zipinfo');

      if (this.isFreshServer()) {
        return {
          name,
          passed: true,
          message: `${missing.join(
            ', '
          )} not installed yet (fresh server) — will be installed by server-setup playbook`,
        };
      }

      return {
        name,
        passed: false,
        message: `Missing utilities: ${missing.join(', ')}`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name,
        passed: false,
        message: `Failed to check utilities: ${msg}`,
      };
    }
  }

  /**
   * Check whether this server has no active deployment yet. On such a fresh
   * server missing tools (docker, unzip) are acceptable: the run-server-setup
   * step installs them before anything uses them.
   */
  private isFreshServer(): boolean {
    const fs = new RemoteFileSystem(this.ssh);
    return !fs.pathExists(this.pathResolver.getActiveLinkPath());
  }

  /**
   * Test that the deployment environment matches any existing environment marker.
   * Prevents accidentally deploying staging to a production server or vice versa.
   */
  private testEnvironmentMarker(): TestResult {
    const name = 'Environment Marker';

    const pathResolver = this.pathResolver;
    const currentEnv = this.environment;
    const otherEnv = currentEnv === 'staging' ? 'production' : 'staging';

    try {
      const currentMarkerPath =
        pathResolver.getEnvironmentMarkerPath(currentEnv);
      const otherMarkerPath = pathResolver.getEnvironmentMarkerPath(otherEnv);

      const fs = new RemoteFileSystem(this.ssh);

      // Check if the wrong environment marker exists
      const otherMarkerExists = fs.pathExists(otherMarkerPath);

      if (otherMarkerExists) {
        return {
          name,
          passed: false,
          message: `This server is marked as ${otherEnv} but you are deploying ${currentEnv}. Refusing to deploy.`,
        };
      }

      // Check if the correct marker already exists (good) or no marker (first deploy)
      const currentMarkerExists = fs.pathExists(currentMarkerPath);

      if (currentMarkerExists) {
        return {
          name,
          passed: true,
          message: `Server is correctly marked as ${currentEnv}`,
        };
      }

      return {
        name,
        passed: true,
        message: `No environment marker found (first deployment to this server)`,
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
   * Test that any existing old version is compatible with deploy3.
   * Checks if an old deployment exists and whether it has proper deploy3 config.
   * Fails if an old version from deploy2 is detected (no deployment config).
   */
  private testOldVersionCompatibility(): TestResult {
    const name = 'Old Version Compatibility';

    try {
      const fs = new RemoteFileSystem(this.ssh);
      const activeLinkPath = this.pathResolver.getActiveLinkPath();

      // Check if there's an active version
      if (!fs.pathExists(activeLinkPath)) {
        return {
          name,
          passed: true,
          message: 'No active version found (fresh deployment)',
        };
      }

      // Resolve the symlink to get the old version path
      const resolvedPath = fs.readlink(activeLinkPath);
      if (!resolvedPath) {
        return {
          name,
          passed: true,
          message:
            'Active symlink exists but could not be resolved (will be replaced)',
        };
      }

      // Extract version tag from path (last component)
      const oldVersionTag = resolvedPath.split('/').pop();
      if (!oldVersionTag) {
        return {
          name,
          passed: true,
          message: 'Could not determine old version tag (will be replaced)',
        };
      }

      // Check if this old version has the deploy3 config structure
      const configPath = this.pathResolver.getVersionEnvironmentConfigPath(
        oldVersionTag,
        this.environment
      );
      const configExists = fs.pathExists(configPath);

      if (!configExists) {
        return {
          name,
          passed: false,
          message:
            `Old deployment (${oldVersionTag}) appears to be from deploy2 (no deployment config found). ` +
            `deploy3 cannot automatically stop legacy deployments. ` +
            `Please SSH to the server and manually: ` +
            `(1) stop the old version (e.g., using the old staging/production.sh scripts with down), ` +
            `(2) remove the active symlink ('rm /opt/<app>/active'), ` +
            `then retry the deployment.`,
        };
      }

      return {
        name,
        passed: true,
        message: `Old version (${oldVersionTag}) is compatible with deploy3`,
      };
    } catch (error) {
      logger.warn(`${name} test error`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name,
        passed: false,
        message: `Failed to check old version compatibility: ${msg}`,
      };
    }
  }
}
