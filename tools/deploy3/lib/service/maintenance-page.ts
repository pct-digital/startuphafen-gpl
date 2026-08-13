/**
 * Maintenance Page Service
 *
 * Provides an independent maintenance page with automatic HTTPS via Caddy.
 * Uses Caddy's built-in Let's Encrypt/ACME support to obtain SSL certificates.
 *
 * Key features:
 * - Runs as a standalone Docker container (caddy:2.11-alpine)
 * - Automatic HTTPS certificate provisioning via Let's Encrypt
 * - Certificate caching for reuse across deployments
 * - Professional minimal HTML maintenance page with customizable message
 *
 * IMPORTANT: The main application MUST be stopped BEFORE starting the maintenance
 * page to free up ports 80/443 for the ACME challenge.
 */

import { SshClient } from '../../infra/ssh-client';
import { DockerClient } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { PortChecker } from '../../infra/port-checker';
import { logger } from '../utils/logger';

/** Caddy Docker image version */
export const CADDY_IMAGE = 'caddy:2.11-alpine';

/** Container name for the maintenance page */
export const CONTAINER_NAME = 'deploy3-maintenance';

/**
 * Configuration for MaintenancePageService
 */
export interface MaintenancePageConfig {
  /** Path to store Caddy's data (certificates) on the remote host */
  certCachePath: string;
}

/**
 * MaintenancePageService - Independent maintenance page with Let's Encrypt SSL
 */
export class MaintenancePageService {
  private readonly docker: DockerClient;
  private readonly fs: RemoteFileSystem;
  private readonly portChecker: PortChecker;
  private readonly certCachePath: string;

  constructor(ssh: SshClient, config: MaintenancePageConfig) {
    this.docker = new DockerClient(ssh);
    this.fs = new RemoteFileSystem(ssh);
    this.portChecker = new PortChecker(ssh);
    this.certCachePath = config.certCachePath;
  }

  /**
   * Start the maintenance page
   *
   * Spins up a Caddy container that serves a maintenance page with automatic HTTPS.
   * Certificates are cached in certCachePath for reuse.
   *
   * @param domain - Domain name for the maintenance page (e.g., "example.com")
   * @param message - Custom message to display on the maintenance page
   */
  start(domain: string, message: string): void {
    logger.info(`Starting maintenance page for ${domain}...`);

    // Check if required ports are available
    this.portChecker.checkPortsAvailable([80, 443]);

    // Ensure cert cache directory exists
    this.fs.mkdir(this.certCachePath, { silent: true });

    // Stop any existing maintenance container
    if (this.isRunning()) {
      logger.info('Stopping existing maintenance page container...');
      this.stop();
    }

    // Generate Caddyfile content
    const caddyfile = this.generateCaddyfile(domain, message);

    // Write Caddyfile to remote host
    const caddyfilePath = `${this.certCachePath}/Caddyfile`;
    this.fs.writeFile(caddyfilePath, caddyfile, { silent: true });
    logger.info('Caddyfile written to remote host');

    // Run Caddy container
    this.docker.run(
      CADDY_IMAGE,
      'caddy run --config /etc/caddy/Caddyfile --adapter caddyfile',
      {
        rm: true,
        detach: true,
        name: CONTAINER_NAME,
        ports: ['80:80', '443:443', '443:443/udp'],
        volumes: [
          `${this.certCachePath}/Caddyfile:/etc/caddy/Caddyfile:ro`,
          `${this.certCachePath}/data:/data`,
          `${this.certCachePath}/config:/config`,
        ],
      },
      { silent: true }
    );

    logger.info(`Maintenance page container started: ${CONTAINER_NAME}`);
    logger.info(`Maintenance page will be available at https://${domain}`);
  }

  /**
   * Stop the maintenance page
   */
  stop(): void {
    logger.info('Stopping maintenance page...');

    const status = this.docker.getContainerStatus(CONTAINER_NAME);

    if (status.exists) {
      this.docker.forceRemoveContainer(CONTAINER_NAME, { silent: true });
    }

    logger.info('Maintenance page stopped');
  }

  /**
   * Check if the maintenance page container is running
   */
  isRunning(): boolean {
    return this.docker.isContainerRunning(CONTAINER_NAME);
  }

  /**
   * Generate the Caddyfile content for the maintenance page
   */
  private generateCaddyfile(domain: string, message: string): string {
    const escapedMessage = this.escapeHtml(message);

    return `${domain} {
	header Content-Type text/html
  respond <<HTML
  <!DOCTYPE html>
  <html lang="de">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⏳</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        color: #333;
        padding: 2rem;
      }
      .container {
        text-align: center;
        max-width: 600px;
      }
      .icons {
        font-size: 3rem;
        margin-bottom: 1.5rem;
        letter-spacing: 0.5rem;
      }
      p {
        font-size: 1.125rem;
        line-height: 1.6;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icons">🔧 ⏳ 🚀</div>
      <p>${escapedMessage}</p>
    </div>
  </body>
  </html>
  HTML 200
}
`;
  }

  /**
   * Escape HTML special characters in a string
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
