/**
 * Server Provisioning Service
 *
 * Handles server provisioning via Ansible:
 * - Running server setup playbooks with MD5 caching
 * - SSH key file resolution
 * - Building Ansible command with proper arguments
 *
 * MD5 Hash Caching:
 * Server-setup directory contents are hashed locally. Before running the Ansible
 * playbook, we check if the hash file exists on the target server. If the hash
 * matches exactly, the playbook is skipped (saving deployment time). Otherwise,
 * the playbook runs and the new hash is stored on the server.
 */

import { execSync } from 'child_process';
import { Logger } from '../utils/logger';
import { RemoteFileSystem } from '../../infra/file-system';
import { SshClient } from '../../infra/ssh-client';
import { PathResolver } from './path-resolver';

/**
 * SSH configuration for server provisioning
 */
export interface SshConfig {
  /** Target server hostname or IP */
  server: string;
  /** SSH port (default: 22) */
  port: string;
  /** SSH user (default: root) */
  user: string;
  /** Path to SSH private key file */
  keyFilePath: string;
}

/**
 * Configuration for running a server setup playbook
 */
export interface PlaybookConfig {
  /** Local path to the server-setup directory (contains server-setup-playbook.yaml by convention) */
  serverSetupDir: string;
  /** Domain for the server setup */
  domain: string;
  /** Application name */
  appName: string;
}

/**
 * Configuration for ServerProvisioningService
 */
export interface ServerProvisioningServiceConfig {
  logger: Logger;
}

/**
 * ServerProvisioningService - Handles server provisioning via Ansible
 */
export class ServerProvisioningService {
  private readonly logger: Logger;

  constructor(config: ServerProvisioningServiceConfig) {
    this.logger = config.logger;
  }

  /**
   * Run an Ansible playbook for server provisioning (with MD5 hash caching).
   *
   * The playbook is executed only if the server-setup directory has changed.
   * An MD5 hash of all files in the directory is computed locally and compared
   * with a hash file stored on the target server at:
   *   /opt/<appName>/server-setup-checksums.md5
   *
   * If the hash matches, the playbook is skipped, saving deployment time.
   * If the hash doesn't match or the file doesn't exist, the playbook runs
   * and the new hash is stored on the server.
   *
   * @param sshClient - SSH client for remote operations
   * @param sshConfig - SSH connection configuration
   * @param playbookConfig - Playbook and variable configuration
   */
  runPlaybook(
    sshClient: SshClient,
    sshConfig: SshConfig,
    playbookConfig: PlaybookConfig
  ): void {
    if (!sshConfig.keyFilePath) {
      throw new Error(
        'SSH key file path not available. SSH client must be configured with either keyFile or keyData.'
      );
    }

    // =========================================================================
    // Step 1: Compute local MD5 hash of server-setup directory
    // =========================================================================

    const fs = new RemoteFileSystem(sshClient);
    const localHash = fs.computeDirectoryHash(playbookConfig.serverSetupDir);
    this.logger.info(
      `[MD5] Computed local hash of server-setup directory: ${localHash}`
    );

    // =========================================================================
    // Step 2: Check if hash file exists on remote server
    // =========================================================================

    const remoteHashFilePath = `/opt/${playbookConfig.appName}/server-setup-checksums.md5`;
    const hashFileExists = fs.pathExists(remoteHashFilePath, { silent: true });

    if (!hashFileExists) {
      this.logger.info(
        `[MD5] Hash file not found on server: ${remoteHashFilePath}`
      );
      this.logger.info(
        '[MD5] Running playbook (first deployment or hash file was deleted)'
      );
      this.executePlaybook(sshConfig, playbookConfig);
      this.writeHashFile(fs, remoteHashFilePath, localHash);
      return;
    }

    // =========================================================================
    // Step 3: Compare hashes
    // =========================================================================

    let remoteHash: string;
    try {
      remoteHash = fs.readFile(remoteHashFilePath, { silent: true }).trim();
      this.logger.info(`[MD5] Read remote hash from server: ${remoteHash}`);
    } catch (error) {
      this.logger.warn(
        `[MD5] Failed to read remote hash file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.logger.info('[MD5] Running playbook (unable to read hash file)');
      this.executePlaybook(sshConfig, playbookConfig);
      this.writeHashFile(fs, remoteHashFilePath, localHash);
      return;
    }

    // =========================================================================
    // Step 4: Decide: skip or execute
    // =========================================================================

    if (localHash === remoteHash) {
      this.logger.info(
        `[MD5] ✓ Hash match! Skipping playbook execution (no changes in server-setup)`
      );
      this.logger.info(
        `[MD5] This saves approximately 10-30 seconds of deployment time`
      );
      return;
    }

    this.logger.info(`[MD5] ✗ Hash mismatch!`);
    this.logger.info(`[MD5]   Local:  ${localHash}`);
    this.logger.info(`[MD5]   Remote: ${remoteHash}`);
    this.logger.info(
      '[MD5] Running playbook (server-setup directory has changed)'
    );
    this.executePlaybook(sshConfig, playbookConfig);
    this.writeHashFile(fs, remoteHashFilePath, localHash);
  }

  /**
   * Execute the Ansible playbook
   */
  private executePlaybook(
    sshConfig: SshConfig,
    playbookConfig: PlaybookConfig
  ): void {
    const pathResolver = new PathResolver({ appName: playbookConfig.appName });
    const playbookFileName = pathResolver.getServerSetupPlaybookFileName();
    const playbookPath = `${playbookConfig.serverSetupDir}/${playbookFileName}`;
    const command = this.buildAnsibleCommand(
      sshConfig,
      playbookConfig,
      playbookPath
    );

    this.logger.info(`Executing ${command}`);

    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ANSIBLE_HOST_KEY_CHECKING: 'False',
      },
    });

    this.logger.info(`Server setup completed for ${playbookConfig.domain}`);
  }

  /**
   * Write the hash file to the remote server
   */
  private writeHashFile(
    fs: RemoteFileSystem,
    remoteHashFilePath: string,
    hash: string
  ): void {
    try {
      const directory = remoteHashFilePath.substring(
        0,
        remoteHashFilePath.lastIndexOf('/')
      );
      fs.mkdir(directory, { silent: true });
      fs.writeFile(remoteHashFilePath, hash + '\n', { silent: true });
      this.logger.info(
        `[MD5] Wrote hash file to server: ${remoteHashFilePath}`
      );
    } catch (error) {
      this.logger.warn(
        `[MD5] Failed to write hash file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Build the Ansible playbook command
   */
  private buildAnsibleCommand(
    sshConfig: SshConfig,
    playbookConfig: PlaybookConfig,
    playbookPath: string
  ): string {
    // Build command parts
    const parts = [
      'ansible-playbook',
      playbookPath,
      // Inline inventory (trailing comma makes it a list)
      '-i',
      `${sshConfig.server},`,
      // Extra variables
      '-e',
      `domain=${playbookConfig.domain}`,
      '-e',
      `app_name=${playbookConfig.appName}`,
      '-e',
      `ansible_port=${sshConfig.port}`,
      '-e',
      `ansible_user=${sshConfig.user}`,
      // SSH key
      '--private-key',
      sshConfig.keyFilePath,
    ];

    return parts.join(' ');
  }
}
