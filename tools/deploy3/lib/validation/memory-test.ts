/**
 * Memory Test
 *
 * Standalone test to verify sufficient free physical memory on target server.
 * Can be used independently or as part of deployment package tests.
 *
 * This test accounts for memory that will be freed when the old version stops:
 * - Gets current free physical RAM (excluding swap)
 * - If an old version is running, adds the memory used by its containers
 * - Compares the effective available memory against the minimum requirement
 */

import { SshClient } from '../../infra/ssh-client';
import { ComposeOptions } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { PathResolver } from '../service/path-resolver';
import { DeploymentConfigSchema } from '../../config/deployment-config';
import { logger } from '../utils/logger';

export interface MemoryTestConfig {
  ssh: SshClient;
  pathResolver: PathResolver;
  /** Minimum required free memory in MB */
  minFreeMemoryMB: number;
  /** Environment being deployed */
  environment: 'staging' | 'production';
}

export interface MemoryTestResult {
  passed: boolean;
  message: string;
  /** Current free physical memory in MB */
  freeMemoryMB: number;
  /** Memory used by old version containers in MB (0 if no old version) */
  oldVersionMemoryMB: number;
  /** Effective available memory (free + old version) */
  effectiveAvailableMB: number;
  /** Required minimum memory in MB */
  requiredMB: number;
}

/**
 * Get free physical memory in MB (excluding swap).
 * Uses the "available" column from `free` which represents memory that can
 * be given to applications without swapping.
 */
function getFreePhysicalMemoryMB(ssh: SshClient): number {
  // free -m gives output in MB
  // The "available" column (7th field) shows memory available for starting new applications
  // This is more accurate than "free" as it includes reclaimable cache/buffers
  const cmd = `free -m | awk '/^Mem:/ {print $7}'`;
  const result = ssh.exec(cmd, { silent: true });

  const availableMB = parseInt(result.trim(), 10);
  if (isNaN(availableMB)) {
    throw new Error(`Failed to parse free memory output: ${result}`);
  }

  return availableMB;
}

/**
 * Resolve the active symlink to get the old version tag.
 * Returns undefined if no active version exists.
 */
function getOldVersionTag(
  ssh: SshClient,
  pathResolver: PathResolver
): string | undefined {
  const fs = new RemoteFileSystem(ssh);
  const activeLinkPath = pathResolver.getActiveLinkPath();

  if (!fs.pathExists(activeLinkPath)) {
    return undefined;
  }

  const resolvedPath = fs.readlink(activeLinkPath);
  if (!resolvedPath) {
    return undefined;
  }

  // Extract version tag from path (last component)
  return resolvedPath.split('/').pop();
}

/**
 * Parse docker stats memory output (e.g., "150.5MiB / 1GiB" or "1.5GiB / 4GiB").
 * Returns the used memory in MB.
 */
function parseDockerMemoryUsage(memUsage: string): number {
  // Format is "USED / LIMIT", we only care about USED
  const usedPart = memUsage.split('/')[0].trim();

  // Parse the value and unit
  const match = usedPart.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)?$/i);
  if (!match) {
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toLowerCase();

  // Convert to MB
  switch (unit) {
    case 'b':
      return value / (1024 * 1024);
    case 'kib':
    case 'kb':
      return value / 1024;
    case 'mib':
    case 'mb':
      return value;
    case 'gib':
    case 'gb':
      return value * 1024;
    default:
      return 0;
  }
}

/**
 * Get total memory used by containers from the old version.
 * Returns 0 if there are no running containers or if we can't determine usage.
 */
function getOldVersionContainerMemoryMB(
  ssh: SshClient,
  pathResolver: PathResolver,
  oldVersionTag: string,
  environment: 'staging' | 'production',
  minFreeMemoryMB: number
): number {
  try {
    // Read the old version's deployment config to get compose files
    const fs = new RemoteFileSystem(ssh);
    const configPath = pathResolver.getVersionEnvironmentConfigPath(
      oldVersionTag,
      environment
    );

    const configContent = fs.readFile(configPath, { silent: true });
    if (!configContent || configContent.trim().length === 0) {
      // Legacy deploy2 or missing config - can't determine containers
      logger.info(
        'Could not read old version config, assuming 0MB container memory'
      );
      return 0;
    }

    const config = DeploymentConfigSchema.parse(JSON.parse(configContent));
    const composeOptions = pathResolver.buildComposeOptions(
      oldVersionTag,
      config.composeFiles
    );

    // Get container names for the compose project
    const containerNames = getComposeContainerNames(ssh, composeOptions);
    if (containerNames.length === 0) {
      return 0;
    }

    // Get memory usage for all containers
    let totalMemoryMB = 0;
    for (const containerName of containerNames) {
      const memUsage = getContainerMemoryUsage(ssh, containerName);
      if (memUsage) {
        const memMB = parseDockerMemoryUsage(memUsage);

        if (memMB === 0) {
          logger.warn(
            `Container '${containerName}' reports 0 memory (likely wrong).`
          );
        }

        totalMemoryMB += memMB;
      }
    }

    if (totalMemoryMB === 0) {
      logger.warn(
        'No memory usage for old application containers could be determined. Estimating memory as 75% of configured minimum (capped at 500MB).'
      );
      totalMemoryMB = Math.min(minFreeMemoryMB * 0.75, 500);
    }

    return Math.round(totalMemoryMB);
  } catch (error) {
    logger.warn('Old Version Memory test error', error);
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not determine old version container memory: ${msg}`);
    return 0;
  }
}

/**
 * Get container names for a compose project.
 * Uses docker compose ps to list running containers.
 */
function getComposeContainerNames(
  ssh: SshClient,
  composeOptions: ComposeOptions
): string[] {
  try {
    const files = composeOptions.files ?? [];
    const fileFlags = files.map((f) => `-f '${f}'`).join(' ');
    const envFileFlag = composeOptions.envFile
      ? `--env-file '${composeOptions.envFile}'`
      : '';

    const cmd = `cd '${composeOptions.workdir}' && docker compose ${fileFlags} ${envFileFlag} ps --format '{{.Name}}'`;
    const result = ssh.exec(cmd, { silent: true });

    return result
      .trim()
      .split('\n')
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Get memory usage for a specific container.
 * Returns the raw docker stats memory string (e.g., "150MiB / 1GiB").
 */
function getContainerMemoryUsage(
  ssh: SshClient,
  containerName: string
): string | null {
  try {
    const cmd = `docker stats --no-stream --format '{{.MemUsage}}' '${containerName}'`;
    const result = ssh.exec(cmd, { silent: true });
    return result.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Test free physical memory on target server.
 *
 * Accounts for memory that will be freed when the old version stops.
 *
 * @param config - Test configuration
 * @returns Test result with details
 */
export function testMemory(config: MemoryTestConfig): MemoryTestResult {
  const { ssh, pathResolver, minFreeMemoryMB, environment } = config;

  logger.info(
    `Checking free physical memory (minimum: ${minFreeMemoryMB}MB)...`
  );

  try {
    // Get current free physical memory
    const freeMemoryMB = getFreePhysicalMemoryMB(ssh);
    logger.info(`Current free physical memory: ${freeMemoryMB}MB`);

    // Check for old version and get its container memory usage
    let oldVersionMemoryMB = 0;
    const oldVersionTag = getOldVersionTag(ssh, pathResolver);

    if (oldVersionTag) {
      logger.info(
        `Found old version: ${oldVersionTag}, checking container memory usage...`
      );
      oldVersionMemoryMB = getOldVersionContainerMemoryMB(
        ssh,
        pathResolver,
        oldVersionTag,
        environment,
        minFreeMemoryMB
      );
      logger.info(`Old version container memory: ${oldVersionMemoryMB}MB`);
    } else {
      logger.info('No old version found (fresh deployment)');
    }

    // Calculate effective available memory
    const effectiveAvailableMB = freeMemoryMB + oldVersionMemoryMB;

    if (effectiveAvailableMB >= minFreeMemoryMB) {
      return {
        passed: true,
        message: `${effectiveAvailableMB}MB available (${freeMemoryMB}MB free + ${oldVersionMemoryMB}MB from old containers, required: ${minFreeMemoryMB}MB)`,
        freeMemoryMB,
        oldVersionMemoryMB,
        effectiveAvailableMB,
        requiredMB: minFreeMemoryMB,
      };
    }

    return {
      passed: false,
      message: `Insufficient memory: ${effectiveAvailableMB}MB available (${freeMemoryMB}MB free + ${oldVersionMemoryMB}MB from old containers), ${minFreeMemoryMB}MB required`,
      freeMemoryMB,
      oldVersionMemoryMB,
      effectiveAvailableMB,
      requiredMB: minFreeMemoryMB,
    };
  } catch (error) {
    logger.warn('Memory test error', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      message: `Failed to check memory: ${msg}`,
      freeMemoryMB: 0,
      oldVersionMemoryMB: 0,
      effectiveAvailableMB: 0,
      requiredMB: minFreeMemoryMB,
    };
  }
}

/**
 * Run memory test and throw on failure
 *
 * @param config - Test configuration
 * @throws Error if memory is insufficient
 */
export function runMemoryTest(config: MemoryTestConfig): void {
  const result = testMemory(config);

  if (result.passed) {
    logger.info(`  ✓ Memory: ${result.message}`);
  } else {
    logger.error(`  ✗ Memory: ${result.message}`);
    throw new Error(`Memory test failed: ${result.message}`);
  }
}
