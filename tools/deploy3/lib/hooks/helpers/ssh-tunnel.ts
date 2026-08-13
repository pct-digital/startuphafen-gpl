/**
 * SSH Tunnel Helper
 *
 * Provides a resource-style API for creating SSH tunnels to access services
 * from the perspective of the target server. This is useful when hooks run
 * on the CI runner but need to access services that only listen on localhost
 * or are on a different network from the runner's perspective.
 *
 * Example: Keycloak listening on localhost:8080 on the target server can be
 * accessed via a tunnel that forwards local port X to target's localhost:8080.
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger';
import { getFreePort, waitForPort } from '../../utils/get-free-port';
import { SshClient } from '../../../infra/ssh-client';

/**
 * Configuration for an SSH tunnel.
 */
export interface SshTunnelConfig {
  /**
   * The host to connect to from the target server's perspective.
   * Default: 'localhost' (i.e., localhost on the target server)
   *
   * This can be any host reachable from the target server, e.g.:
   * - 'localhost' - services on the target server itself
   * - '10.0.0.5' - another host on the target's network
   * - 'db.internal' - internal DNS name resolvable from target
   */
  remoteHost?: string;

  /**
   * The port on the remote host to connect to.
   */
  remotePort: number;

  /**
   * Local port to bind on the CI runner.
   * If not specified, a free port is automatically selected.
   */
  localPort?: number;

  /**
   * Timeout in milliseconds to wait for the tunnel to be established.
   * Default: 10000 (10 seconds)
   */
  timeoutMs?: number;
}

/**
 * Information about an established tunnel.
 */
export interface TunnelInfo {
  /**
   * The local port on the CI runner that forwards to the remote service.
   * Connect to localhost:localPort to reach remoteHost:remotePort on/from the target.
   */
  localPort: number;

  /**
   * The remote host being tunneled to (from target's perspective).
   */
  remoteHost: string;

  /**
   * The remote port being tunneled to.
   */
  remotePort: number;
}

/**
 * Helper for creating SSH tunnels to access services from the target server's network.
 *
 * Provided to hooks via context.helpers.sshTunnel
 */
export class SshTunnelHelper {
  constructor(private readonly ssh: SshClient) {}

  /**
   * Execute a callback with an SSH tunnel open.
   *
   * The tunnel forwards a local port on the CI runner to a remote host:port
   * as seen from the target server. This allows hooks to access services
   * that are only reachable from the target server's network.
   *
   * The tunnel is automatically closed when the callback completes (or throws).
   *
   * @param config - Tunnel configuration
   * @param callback - Async function to execute while tunnel is open. Receives tunnel info.
   * @returns The result of the callback
   *
   * @example
   * // Access Keycloak on target's localhost:8080
   * await helpers.sshTunnel.withTunnel(
   *   { remotePort: 8080 },
   *   async (tunnel) => {
   *     // Connect to localhost:tunnel.localPort to reach target's localhost:8080
   *     await fetch(`http://localhost:${tunnel.localPort}/health`);
   *   }
   * );
   *
   * @example
   * // Access a database on the target's internal network
   * await helpers.sshTunnel.withTunnel(
   *   { remoteHost: 'db.internal', remotePort: 5432 },
   *   async (tunnel) => {
   *     // Connect to localhost:tunnel.localPort to reach db.internal:5432
   *     await connectToDb(`localhost:${tunnel.localPort}`);
   *   }
   * );
   */
  async withTunnel<T>(
    config: SshTunnelConfig,
    callback: (tunnel: TunnelInfo) => Promise<T>
  ): Promise<T> {
    const remoteHost = config.remoteHost ?? 'localhost';
    const localPort = config.localPort ?? (await getFreePort());
    const timeoutMs = config.timeoutMs ?? 10000;

    const tunnelInfo: TunnelInfo = {
      localPort,
      remoteHost,
      remotePort: config.remotePort,
    };

    logger.info(
      `Opening SSH tunnel: localhost:${localPort} -> ${this.ssh.userAtHost} -> ${remoteHost}:${config.remotePort}`
    );

    const sshProcess = this.spawnTunnel(
      localPort,
      remoteHost,
      config.remotePort
    );

    try {
      // Wait for the tunnel to be established (local port accepting connections)
      await waitForPort(localPort, timeoutMs);
      logger.info(`SSH tunnel established on local port ${localPort}`);

      // Execute the callback
      return await callback(tunnelInfo);
    } finally {
      // Clean up: kill the SSH process
      this.closeTunnel(sshProcess);
    }
  }

  /**
   * Spawn an SSH tunnel process.
   *
   * @param localPort - Local port to bind
   * @param remoteHost - Remote host (from target's perspective)
   * @param remotePort - Remote port
   * @returns The spawned child process
   */
  private spawnTunnel(
    localPort: number,
    remoteHost: string,
    remotePort: number
  ): ChildProcess {
    const args: string[] = [
      // Port forwarding: -L localPort:remoteHost:remotePort
      '-L',
      `${localPort}:${remoteHost}:${remotePort}`,
      // Don't execute a remote command, just forward
      '-N',
      // SSH options for automation
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      'ConnectTimeout=10',
      '-o',
      'AddressFamily=inet',
      // Exit if port forwarding fails
      '-o',
      'ExitOnForwardFailure=yes',
      // Port
      '-p',
      this.ssh.portNumber.toString(),
    ];

    // Add key file if available
    const keyFile = this.ssh.keyFilePath;
    if (keyFile) {
      args.push('-i', keyFile);
    }

    // Add user@host
    args.push(this.ssh.userAtHost);

    logger.debug(`Spawning SSH tunnel: ssh ${args.join(' ')}`);

    const sshProcess = spawn('ssh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // Log stderr for debugging
    sshProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        logger.error(`[SSH tunnel stderr] ${msg}`);
      }
    });

    sshProcess.on('error', (err) => {
      logger.error(`SSH tunnel process error: ${err.message}`);
    });

    sshProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        logger.warn(`SSH tunnel process exited with code ${code}`);
      } else if (signal) {
        logger.debug(`SSH tunnel process killed by signal ${signal}`);
      }
    });

    return sshProcess;
  }

  /**
   * Close an SSH tunnel by killing the process.
   */
  private closeTunnel(sshProcess: ChildProcess): void {
    if (sshProcess.killed) {
      return;
    }

    logger.debug('Closing SSH tunnel');

    // Try graceful termination first
    sshProcess.kill('SIGTERM');

    // Force kill after a short delay if still running
    setTimeout(() => {
      if (!sshProcess.killed) {
        logger.debug('Force killing SSH tunnel process');
        sshProcess.kill('SIGKILL');
      }
    }, 1000);
  }
}
