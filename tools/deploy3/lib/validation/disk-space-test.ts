/**
 * Disk Space Test
 *
 * Standalone test to verify sufficient disk space on target server.
 * Can be used independently or as part of deployment package tests.
 */

import { SshClient } from '../../infra/ssh-client';
import { logger } from '../utils/logger';

export interface DiskSpaceTestConfig {
  ssh: SshClient;
  /** Minimum required disk space in GB */
  minDiskSpaceGB: number;
  /** Path to check disk space for */
  checkPath: string;
}

export interface DiskSpaceResult {
  passed: boolean;
  message: string;
  availableGB: number;
  requiredGB: number;
}

/**
 * Test disk space on target server
 *
 * @param config - Test configuration
 * @returns Test result with details
 */
export function testDiskSpace(config: DiskSpaceTestConfig): DiskSpaceResult {
  const { ssh, minDiskSpaceGB, checkPath } = config;

  logger.info(
    `Checking disk space on ${checkPath} (minimum: ${minDiskSpaceGB}GB)...`
  );

  try {
    // Use df to get available space in 1K blocks, then convert to GB
    // df -P for POSIX output format (consistent across systems)
    // awk to extract available space (4th column)
    const cmd = `df -P ${checkPath} | tail -1 | awk '{print $4}'`;
    const result = ssh.exec(cmd, { silent: true });

    const availableKB = parseInt(result.trim(), 10);
    if (isNaN(availableKB)) {
      return {
        passed: false,
        message: `Failed to parse disk space output: ${result}`,
        availableGB: 0,
        requiredGB: minDiskSpaceGB,
      };
    }

    const availableGB = Math.floor(availableKB / 1024 / 1024);

    if (availableGB >= minDiskSpaceGB) {
      return {
        passed: true,
        message: `${availableGB}GB available (required: ${minDiskSpaceGB}GB)`,
        availableGB,
        requiredGB: minDiskSpaceGB,
      };
    }

    return {
      passed: false,
      message: `Insufficient disk space: ${availableGB}GB available, ${minDiskSpaceGB}GB required`,
      availableGB,
      requiredGB: minDiskSpaceGB,
    };
  } catch (error) {
    logger.warn('Disk Space test error', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      message: `Failed to check disk space: ${msg}`,
      availableGB: 0,
      requiredGB: minDiskSpaceGB,
    };
  }
}

/**
 * Run disk space test and throw on failure
 *
 * @param config - Test configuration
 * @throws Error if disk space is insufficient
 */
export function runDiskSpaceTest(config: DiskSpaceTestConfig): void {
  const result = testDiskSpace(config);

  if (result.passed) {
    logger.info(`  ✓ Disk Space: ${result.message}`);
  } else {
    logger.error(`  ✗ Disk Space: ${result.message}`);
    throw new Error(`Disk space test failed: ${result.message}`);
  }
}
