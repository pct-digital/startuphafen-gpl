/**
 * Port Checker - Check if ports are available on a remote host
 *
 * Provides utilities to detect if specific ports are in use and identify
 * which processes are using them.
 */

import { SshClient } from './ssh-client';
import { logger } from '../lib/utils/logger';

/**
 * Result of a port availability check
 */
export interface PortCheckResult {
  port: number;
  available: boolean;
  process?: string; // Process name/info if port is in use
}

/**
 * Port Checker - Utility for checking port availability on remote hosts
 */
export class PortChecker {
  private ssAvailable: boolean | null = null;

  constructor(private readonly ssh: SshClient) {}

  /**
   * Check if the `ss` command is available on the remote host
   */
  public isSsAvailable(silent = false): boolean {
    if (this.ssAvailable === null) {
      try {
        this.ssh.exec('which ss', { silent: true });
        this.ssAvailable = true;
      } catch {
        if (!silent) {
          logger.warn(
            '`ss` command not found on remote host, skipping port availability checks'
          );
        }
        this.ssAvailable = false;
      }
    }
    return this.ssAvailable;
  }

  /**
   * Check if specified ports are available on the remote host
   *
   * Uses `ss` command to check port availability. Throws an error
   * if any port is in use.
   *
   * @param ports - Array of port numbers to check
   * @throws Error if any port is in use
   */
  checkPortsAvailable(ports: number[]): void {
    const unavailablePorts = ports
      .map((port) => this.checkPort(port))
      .filter((result) => !result.available)
      .map(
        (result) =>
          `Port ${result.port}: ${result.process || 'unknown process'}`
      );

    if (unavailablePorts.length > 0) {
      const errorMsg =
        `Required ports are in use:\n` +
        unavailablePorts.map((p) => `  - ${p}`).join('\n') +
        `\nPlease stop the services using these ports and try again.`;
      throw new Error(errorMsg);
    }
  }

  /**
   * Check a single port
   *
   * @param port - Port number to check
   * @returns PortCheckResult with availability status and process info if in use
   */
  checkPort(port: number): PortCheckResult {
    if (!this.isSsAvailable()) {
      return { port, available: true };
    }

    try {
      // Use ss to check if port is listening
      // `|| true` ensures command succeeds even when grep finds no matches (exit code 1)
      const output = this.ssh.exec(`ss -tlnp | grep ":${port} " || true`, {
        silent: true,
      });

      if (output.trim()) {
        const match = output.match(/LISTEN\s+.*\s+([^\s]+)\s*$/);
        const processInfo = match ? match[1] : 'unknown process';
        return {
          port,
          available: false,
          process: processInfo,
        };
      }

      return {
        port,
        available: true,
      };
    } catch (error) {
      // Assume port is available if check fails
      logger.warn(
        `Failed to check port ${port} availability, assuming it is available:`,
        error
      );
      return {
        port,
        available: true,
      };
    }
  }
}
