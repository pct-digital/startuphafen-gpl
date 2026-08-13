/**
 * Deployment Lock Service
 *
 * Manages deployment lock to ensure only one deployment process runs at a time.
 * Uses the same atomic lock file mechanism as deploy2, with deploy tag comparison
 * to prevent older deployments from overwriting newer ones.
 *
 * Lock mechanism:
 * - Uses shell noclobber (set -C) to atomically create the lock file
 * - Stores the current deployment tag in the lock file
 * - Compares deploy tags to prevent older versions from overwriting newer ones
 * - Includes retry logic with exponential backoff
 */

import { SshClient } from '../../infra/ssh-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { logger } from '../utils/logger';

/**
 * Parsed deploy tag with comparable timestamp
 *
 * Format: YY.MMDD.HHMM.SS (e.g., 25.0617.1430.15)
 * Legacy format: YY.MMDD.HHMM_name (e.g., 25.0617.1430_aidia)
 */
interface ParsedDeployTag {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  name?: string;
  timestamp: number;
}

/**
 * Options for lock acquisition
 */
export interface LockAcquireOptions {
  /**
   * Skip version comparison checks.
   *
   * When true, the lock will simply wait and retry until the lock is released,
   * without comparing deploy tags. Use this for non-deployment operations like
   * database copy that need to coordinate with deployments but don't have
   * comparable version tags.
   *
   * When false (default), the lock will:
   * - Throw if the same tag is already in progress
   * - Throw if a newer deployment tag already holds the lock
   */
  skipVersionCheck?: boolean;
}

/**
 * Deployment Lock Service
 *
 * Provides atomic lock acquisition and release for deployment operations.
 */
export class DeploymentLockService {
  private readonly ssh: SshClient;
  private readonly fs: RemoteFileSystem;
  private readonly lockFilePath: string;
  private acquiredTag: string | null = null;

  constructor(ssh: SshClient, lockFilePath: string) {
    this.ssh = ssh;
    this.fs = new RemoteFileSystem(ssh);
    this.lockFilePath = lockFilePath;
  }

  /**
   * Acquire the deployment lock
   *
   * Uses atomic noclobber to prevent race conditions. Retries with exponential
   * backoff if the lock is already held by another deployment.
   *
   * By default, compares deploy tags to ensure older deployments don't overwrite
   * newer ones. Set `skipVersionCheck: true` for operations like database copy
   * that just need mutual exclusion without version semantics.
   *
   * @param deployTag - The deployment tag for this deployment (e.g., "25.0617.1430.15") or operation identifier (e.g., "db-copy")
   * @param options - Lock acquisition options
   * @throws Error if lock cannot be acquired or if a newer deployment is in progress
   */
  acquire(deployTag: string, options: LockAcquireOptions = {}): void {
    const { skipVersionCheck = false } = options;

    if (this.acquiredTag) {
      throw new Error('Lock already acquired. Call release() first.');
    }

    logger.info(`Acquiring deployment lock with tag: ${deployTag}`);

    let retryCount = 0;
    const maxRetries = 999999; // Essentially unlimited retries

    while (retryCount < maxRetries) {
      try {
        // Try to atomically create the lock file with our deploy tag
        const lockCmd = `set -C; echo '${deployTag}' > ${this._quotePath(
          this.lockFilePath
        )}`;
        this.ssh.exec(`bash -c "${lockCmd}"`, { silent: true });

        logger.info(
          `Deployment lock acquired successfully with tag: ${deployTag}`
        );
        this.acquiredTag = deployTag;
        return;
      } catch (e) {
        // Lock file already exists, check what version holds it
        try {
          const lockingTag = this.fs
            .readFile(this.lockFilePath, { silent: true })
            .trim();

          if (!skipVersionCheck) {
            // Check if the exact same tag is already being deployed
            if (lockingTag === deployTag) {
              throw new Error(
                `Deployment with tag ${deployTag} is already in progress. ` +
                  `Cannot start concurrent deployment with the same tag.`
              );
            }

            // Check if the locking deployment is newer
            if (this._isDeployTagNewer(lockingTag, deployTag)) {
              throw new Error(
                `A newer version (${lockingTag}) has been deployed in the meantime. ` +
                  `Current deployment (${deployTag}) is older and will be aborted.`
              );
            }
          }

          // Another operation is in progress, wait and retry
          logger.info(
            `Lock is held by: ${lockingTag}. Waiting before retry...`
          );

          // backoff: 3000 + random up to 3000 ms
          const waitMs = 3000 + Math.random() * 3000;
          this._sleep(waitMs);
          retryCount++;
        } catch (innerError) {
          const innerErr = innerError as Error;

          // Re-throw fatal errors (newer version or same tag already in progress)
          if (
            !skipVersionCheck &&
            (innerErr.message.includes('newer version') ||
              innerErr.message.includes('already in progress'))
          ) {
            throw innerErr;
          }

          // Other errors might just be transient (cat failed), retry a few more times
          if (retryCount < 3) {
            retryCount++;
            continue;
          }

          // Give up after 3 retries of getting lock info
          throw new Error(
            `Failed to acquire deployment lock: ${(e as Error).message}. ` +
              `Additional error reading lock: ${innerErr.message}`
          );
        }
      }
    }

    throw new Error('Deployment lock acquisition timeout');
  }

  /**
   * Release the deployment lock
   *
   * Only releases the lock if the deploy tag matches what we acquired it with.
   * This prevents accidentally releasing a lock held by another process.
   *
   * @throws Error if lock cannot be released (non-fatal, logged as warning)
   */
  release(): void {
    if (!this.acquiredTag) {
      logger.warn('Cannot release lock: lock was not acquired by this service');
      return;
    }

    try {
      const currentTag = this.fs
        .readFile(this.lockFilePath, { silent: true })
        .trim();

      if (currentTag === this.acquiredTag) {
        this.fs.rm(this.lockFilePath, false, { silent: true });
        logger.info(`Deployment lock released successfully`);
        this.acquiredTag = null;
      } else {
        logger.warn(
          `Lock deploy tag mismatch. Expected: ${this.acquiredTag}, Found: ${currentTag}. ` +
            `Lock not released.`
        );
        this.acquiredTag = null;
      }
    } catch (e) {
      logger.warn('Could not release deployment lock:', e);
      this.acquiredTag = null;
    }
  }

  /**
   * Check if a deploy tag is newer than another
   *
   * Parses both tags and compares their timestamps.
   * If parsing fails, returns false and logs a warning.
   *
   * @param tag1 - First deploy tag to compare
   * @param tag2 - Second deploy tag to compare
   * @returns true if tag1 is newer than tag2
   */
  private _isDeployTagNewer(tag1: string, tag2: string): boolean {
    try {
      const date1 = this._parseDeployTag(tag1);
      const date2 = this._parseDeployTag(tag2);
      return date1.timestamp > date2.timestamp;
    } catch (e) {
      const error = e as Error;
      logger.warn(
        `Could not parse deploy tags for comparison (${tag1}, ${tag2}): ${error.message}`
      );
      return false;
    }
  }

  /**
   * Parse a deploy tag into a comparable structure
   *
   * Supports formats:
   * - YY.MMDD.HHMM.SS (e.g., 25.0617.1430.15)
   * - YY.MMDD.HHMM.SSFFF (legacy with milliseconds, ignored)
   * - YY.MMDD.HHMM_name (legacy with name suffix)
   * - YY.MMDD.HHMM.SS_suffix1_suffix2_... (any amount of garbage after timestamp)
   *
   * Everything after the timestamp (including underscores and all suffixes) is ignored.
   * Only the core timestamp (YY.MMDD.HHMM.SS) is used for comparison.
   *
   * @param deployTag - The deploy tag to parse
   * @returns Parsed tag structure with timestamp
   * @throws Error if tag format is invalid
   */
  private _parseDeployTag(deployTag: string): ParsedDeployTag {
    // Match the timestamp part: YY.MMDD.HHMM.SS[FFF]
    // Everything after (including _suffix1_suffix2) is ignored
    const match = deployTag.match(
      /^(\d{2})\.(\d{2})(\d{2})\.(\d{2})(\d{2})(?:\.(\d{2})(?:\d{0,3})?)?/
    );

    if (!match) {
      throw new Error(`Invalid deploy tag format: ${deployTag}`);
    }

    const [, year, month, day, hour, minute, second = '00'] = match;

    const parsed: ParsedDeployTag = {
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10),
      hour: parseInt(hour, 10),
      minute: parseInt(minute, 10),
      second: parseInt(second, 10),
      timestamp: 0, // Will be calculated
    };

    // Convert to a comparable timestamp
    // Use year (2000 + YY), month, day, hour, minute, second
    // This creates a sortable integer for comparison
    const fullYear = 2000 + parsed.year;
    parsed.timestamp =
      fullYear * 100000000 +
      parsed.month * 1000000 +
      parsed.day * 10000 +
      parsed.hour * 100 +
      parsed.minute;

    // Add seconds as a fractional part for sub-minute precision
    parsed.timestamp = parsed.timestamp * 100 + parsed.second;

    return parsed;
  }

  /**
   * Quote a path for safe use in shell commands
   */
  private _quotePath(path: string): string {
    return `'${path.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Sleep for the specified number of milliseconds
   *
   * Uses bash sleep command for portability
   */
  private _sleep(ms: number): void {
    const seconds = Math.round(ms / 1000);
    this.ssh.execLocal(`sleep ${seconds}`, true);
  }
}
