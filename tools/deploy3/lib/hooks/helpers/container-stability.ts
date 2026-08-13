/**
 * Container Stability Helper
 *
 * Waits for compose services to be running and stay running for a minimum duration.
 * Used in post-up hooks to verify deployment stability before considering it successful.
 */

import { DockerClient, ComposeOptions } from '../../../infra/docker-client';
import { SshClient } from '../../../infra/ssh-client';
import { logger } from '../../utils/logger';

/**
 * Options for waiting for container stability.
 */
export interface StabilityOptions {
  /**
   * Services to check. If not provided, auto-detects from compose config.
   */
  services?: string[];
  /**
   * How long each container must be running without restart (seconds).
   * @default 20
   */
  stableForSeconds?: number;
  /**
   * Maximum time to wait for stability (seconds).
   * @default 30
   */
  timeoutSeconds?: number;
  /**
   * Interval between status checks (milliseconds).
   * @default 1000
   */
  pollIntervalMs?: number;
}

/**
 * Configuration for ContainerStabilityHelper
 */
export interface ContainerStabilityHelperConfig {
  docker: DockerClient;
  ssh: SshClient;
  composeOptions: ComposeOptions;
}

/**
 * Helper to verify that containers are running and stable after deployment.
 */
export class ContainerStabilityHelper {
  private readonly docker: DockerClient;
  private readonly ssh: SshClient;
  private readonly composeOptions: ComposeOptions;

  constructor(config: ContainerStabilityHelperConfig) {
    this.docker = config.docker;
    this.ssh = config.ssh;
    this.composeOptions = config.composeOptions;
  }

  /**
   * Wait for all specified services to be running and remain running for the stability period.
   *
   * @param options - Stability check options
   * @throws Error if timeout is exceeded or a container stops/restarts during stability period
   */
  waitForStability(options: StabilityOptions = {}): void {
    const stableForSeconds = options.stableForSeconds ?? 20;
    const timeoutSeconds = options.timeoutSeconds ?? 30;
    const pollIntervalMs = options.pollIntervalMs ?? 1000;

    // Auto-detect services if not specified
    const services =
      options.services ?? this.docker.getComposeServices(this.composeOptions);

    if (services.length === 0) {
      logger.warn('No services to check for stability');
      return;
    }

    logger.info(
      `Checking stability for ${services.length} services: ${services.join(
        ', '
      )}`
    );
    logger.info(
      `Waiting for services to be running for at least ${stableForSeconds}s (timeout: ${timeoutSeconds}s)`
    );

    // Track when each service was first seen as running (without interruption)
    const runningStartTimes: Map<string, number> = new Map();
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    const stableForMs = stableForSeconds * 1000;

    while (true) {
      const now = Date.now();
      const elapsed = now - startTime;

      // Check timeout
      if (elapsed > timeoutMs) {
        const notStable = services.filter((s) => {
          const startedAt = runningStartTimes.get(s);
          if (!startedAt) return true;
          return now - startedAt < stableForMs;
        });
        throw new Error(
          `Timeout waiting for container stability after ${timeoutSeconds}s. ` +
            `Services not stable: ${notStable.join(', ')}`
        );
      }

      // Get currently running services
      const running = new Set(
        this.docker.getRunningComposeServices(this.composeOptions)
      );

      // Update tracking for each service
      for (const service of services) {
        if (running.has(service)) {
          // Service is running
          if (!runningStartTimes.has(service)) {
            logger.debug(`Service '${service}' is now running`);
            runningStartTimes.set(service, now);
          }
        } else {
          // Service is NOT running - reset its timer if it was previously running
          if (runningStartTimes.has(service)) {
            logger.warn(
              `Service '${service}' stopped running - deployment unstable`
            );
            throw new Error(
              `Service '${service}' stopped running during stability check. ` +
                `This indicates the container crashed or was restarted.`
            );
          }
          // Service hasn't started yet - that's okay, we're still within timeout
          logger.debug(`Service '${service}' not yet running...`);
        }
      }

      // Check if all services have been stable long enough
      const allStable = services.every((service) => {
        const startedAt = runningStartTimes.get(service);
        if (!startedAt) return false;
        return now - startedAt >= stableForMs;
      });

      if (allStable) {
        logger.info(
          `All ${services.length} services have been stable for ${stableForSeconds}s`
        );
        return;
      }

      // Sleep before next poll
      this.ssh.execLocal(`sleep ${Math.ceil(pollIntervalMs / 1000)}`, true);
    }
  }
}
