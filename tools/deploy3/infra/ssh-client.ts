/**
 * SSH Client - Handles SSH command execution.
 *
 * This module provides a clean abstraction over SSH operations including:
 * - Remote command execution (with base64 encoding to avoid quoting issues)
 * - SSH key-based authentication
 * - Streaming commands for piping between hosts
 *
 * File system operations are delegated to RemoteFileSystem.
 *
 * NOTE: All operations are synchronous (blocking) using execSync. This is by design
 * for CLI deployment tools. For parallel operations, refactor to use async exec().
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logger } from '../lib/utils/logger';
import { quotePath } from '../lib/utils/shell';

export interface SshConfig {
  host: string;
  user: string;
  port?: number;
  keyFile?: string; // Path to SSH private key file (absolute path or ~-relative path like ~/.ssh/id_rsa)
  keyData?: string; // Private key data as text (alternative to keyFile)
}

export interface ExecOptions {
  silent?: boolean;
  verbose?: boolean;
  useSudo?: boolean;
}

/**
 * Global registry of SSH clients for cleanup on process exit
 */
const activeSshClients = new Set<SshClient>();

/**
 * Register cleanup on process exit
 */
if (activeSshClients.size === 0) {
  process.on('exit', () => {
    for (const client of activeSshClients) {
      client.cleanup();
    }
  });
}

/**
 * SSH Client for remote command execution and file operations.
 *
 * Uses base64 encoding for commands to avoid shell quoting issues.
 *
 * Supports two key authentication methods:
 * 1. keyFile: Path to a pre-existing SSH private key file
 * 2. keyData: Private key data as text (temporary file created on demand)
 *
 * If both are provided, keyData takes precedence.
 */
export class SshClient {
  private readonly host: string;
  private readonly user: string;
  private readonly port: number;
  private readonly keyFile?: string;
  private readonly keyData?: string;
  private tempKeyFile?: string;

  constructor(config: SshConfig) {
    this.host = config.host;
    this.user = config.user;
    this.port = config.port ?? 22;
    this.keyFile = config.keyFile;
    this.keyData = config.keyData;

    logger.debug(
      `[SSH] Initializing SshClient for ${config.user}@${config.host}:${this.port}`
    );
    if (config.keyFile) {
      logger.debug(`[SSH] SSH key file provided: ${config.keyFile}`);
    }
    if (config.keyData) {
      logger.debug(
        '[SSH] SSH key data provided as text, ' +
          config.keyData.length +
          ' chars, ' +
          config.keyData.split('\n').length +
          ' lines'
      );
    }
    if (!config.keyFile && !config.keyData) {
      logger.warn('No SSH key provided (neither keyFile nor keyData)');
    }

    // Register for cleanup on process exit
    activeSshClients.add(this);
  }

  /**
   * Get the user@host string for SSH commands
   */
  get userAtHost(): string {
    return `${this.user}@${this.host}`;
  }

  /**
   * Get the effective key file path (either provided or temporary)
   * Creates a temporary file from keyData if needed.
   */
  private getKeyFilePath(): string | undefined {
    // If keyData is provided, create a temporary key file
    if (this.keyData) {
      if (!this.tempKeyFile) {
        let keyData = this.keyData;
        this.tempKeyFile = join(
          tmpdir(),
          `ssh_key_${Date.now()}_${Math.random().toString(36).substring(7)}`
        );
        if (!keyData.endsWith('\n')) {
          keyData += '\n'; // a common error I make with ssh keys is to cut off that newline. SSH hates it.
        }
        writeFileSync(this.tempKeyFile, keyData, { mode: 0o600 });
        logger.debug(
          '[SSH] Created temporary key file for authentication: ' +
            this.tempKeyFile
        );
      }
      return this.tempKeyFile;
    }

    return this.keyFile;
  }

  /**
   * Clean up temporary key file if one was created
   */
  cleanup(): void {
    if (this.tempKeyFile) {
      try {
        unlinkSync(this.tempKeyFile);
        this.tempKeyFile = undefined;
      } catch (e) {
        logger.warn(`Failed to clean up temporary key file: ${e}`);
      }
    }
  }

  /**
   * Get the key file path (for use by RemoteFileSystem)
   */
  get keyFilePath(): string | undefined {
    return this.getKeyFilePath();
  }

  /**
   * Get the port (for use by RemoteFileSystem)
   */
  get portNumber(): number {
    return this.port;
  }

  /**
   * Validate the SSH key file.
   *
   * Checks that:
   * 1. A key is configured (either keyFile or keyData)
   * 2. The key file exists (or temp file was created from keyData)
   * 3. The key is a valid SSH private key (via ssh-keygen -yf)
   *
   * @throws Error if the key is missing, file doesn't exist, or key is invalid
   */
  validateKey(): void {
    const keyPath = this.getKeyFilePath();

    if (!keyPath) {
      throw new Error(
        'No SSH key configured. Provide either keyFile (path) or keyData (key content).'
      );
    }

    if (!existsSync(keyPath)) {
      throw new Error(`SSH key file does not exist: ${keyPath}`);
    }

    // Validate the key using ssh-keygen
    try {
      execSync(`ssh-keygen -yf ${quotePath(keyPath)}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (e: unknown) {
      const newError = new Error(`Invalid SSH key at ${keyPath}`) as Error & {
        keyPath: string;
        cause: unknown;
      };
      newError.keyPath = keyPath;
      newError.cause = e;
      throw newError;
    }
  }

  /**
   * Execute a command locally
   */
  execLocal(command: string, silent = false): string {
    if (!silent) {
      logger.debug(`local> ${command}`);
    }

    try {
      const result = execSync(command, {
        shell: '/bin/bash', // so stuff like pipefail works
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      }).trim();

      if (!silent) {
        const output = result || '(no output)';
        if (result.includes('\n')) {
          logger.debug(`local< (${result.split('\n').length} lines)`);
        } else {
          logger.debug(`local< ${output}`);
        }
      }

      return result;
    } catch (e: unknown) {
      // Create enriched error - preserve whatever the original error has via cause
      const newError = new Error(
        `Local command failed: ${command}`
      ) as Error & {
        command: string;
        cause: unknown;
      };
      newError.command = command;
      newError.cause = e;
      throw newError;
    }
  }

  /**
   * Execute a command on the remote host.
   *
   * Uses base64 encoding to avoid shell escaping issues.
   */
  exec(command: string, options: ExecOptions = {}): string {
    const { silent = false, verbose = false, useSudo = false } = options;

    const actualCommand = useSudo ? `sudo ${command}` : command;
    const sshCommand = this.buildSshCommand(actualCommand);

    if (!silent) {
      logger.debug(`ssh> ${actualCommand}`);
    }

    try {
      const result = this.execLocal(sshCommand, !verbose).trim();

      if (!silent) {
        const output = result || '(no output)';
        if (result.includes('\n')) {
          logger.debug(`ssh< (${result.split('\n').length} lines)`);
        } else {
          logger.debug(`ssh< ${output}`);
        }
      }

      return result;
    } catch (e: unknown) {
      // Create enriched error with structured properties for higher-level logging
      // The cause chain contains the inner error with its own properties (stdout, stderr, etc.)
      const newError = new Error(
        `SSH command failed on ${this.userAtHost}`
      ) as Error & {
        host: string;
        remoteCommand: string;
        cause: unknown;
      };
      newError.host = this.userAtHost;
      newError.remoteCommand = actualCommand;
      newError.cause = e;
      throw newError;
    }
  }

  /**
   * Build an SSH command that uses base64 encoding to avoid quoting issues.
   *
   * The command is base64-encoded and then decoded and executed on the remote host.
   * Uses process substitution (bash <(...)) so that stdin can be piped through to the
   * executed command, which is crucial for operations like pg_dump | psql.
   *
   * Includes standard automation options to prevent hanging on host key prompts
   * or password prompts:
   * - BatchMode=yes: Prevents hanging on interactive prompts
   * - StrictHostKeyChecking=accept-new: Accepts new host keys but rejects changed keys
   * - ConnectTimeout=10: Prevents indefinite hangs if host is unreachable
   *
   * @param command - The command to execute on the remote host
   * @param mergeStderr - If true, merges stderr into stdout (2>&1). Default true.
   *                      Set to false for streaming/piping where stdout should be clean.
   * @throws Error if the base64-encoded command exceeds 50KB (ARG_MAX safety limit)
   */
  buildSshCommand(command: string, mergeStderr = true): string {
    const encodedCmd = Buffer.from(command).toString('base64');

    // Check for ARG_MAX overflow
    const MAX_ENCODED_SIZE = 50 * 1024; // 50KB safety margin
    if (encodedCmd.length > MAX_ENCODED_SIZE) {
      const sizeKb = Math.round(encodedCmd.length / 1024);
      throw new Error(
        `Command too large for SSH transmission: ${sizeKb}KB base64 (max 50KB).\n` +
          `This typically means a very large command was passed to exec().\n` +
          `For large file writes, use RemoteFileSystem.writeFile() which automatically\n` +
          `uses SCP for files larger than 50KB to avoid ARG_MAX overflow.\n` +
          `Original command length: ${command.length} bytes.`
      );
    }

    const keyFilePath = this.getKeyFilePath();
    const keyArg = keyFilePath ? `-i ${quotePath(keyFilePath)} ` : '';
    const sshOptions = [
      '-o BatchMode=yes',
      '-o StrictHostKeyChecking=accept-new',
      '-o ConnectTimeout=10',
    ].join(' ');
    const stderrRedirect = mergeStderr ? ' 2>&1' : '';
    return `ssh ${sshOptions} ${keyArg}${this.userAtHost} -p ${this.port} "bash <(echo '${encodedCmd}' | base64 -d)${stderrRedirect}"`;
  }
}

/**
 * Pipe output from a source SSH host to a target SSH host.
 *
 * This is used for streaming data between two remote hosts, for example:
 * - pg_dump on source -> psql on target
 *
 * The piping happens through the local machine.
 *
 * When DEBUG_DATA_PIPE environment variable is set, the piped data is saved to a temp file
 * for inspection instead of being directly piped to the target. The temp file is not deleted.
 *
 * @param sourceClient - SSH client for the source host
 * @param sourceCommand - Command to run on the source host
 * @param targetClient - SSH client for the target host
 * @param targetCommand - Command to run on the target host
 * @param silent - Whether to suppress logging
 */
export function pipeRemoteToRemote(
  sourceClient: SshClient,
  sourceCommand: string,
  targetClient: SshClient,
  targetCommand: string,
  silent = false
): void {
  const sourceSSH = sourceClient.buildSshCommand(sourceCommand, false);
  const targetSSH = targetClient.buildSshCommand(targetCommand, false);

  if (!silent) {
    logger.info(
      `Piping data: ${sourceClient.userAtHost} -> ${targetClient.userAtHost}`
    );
    logger.debug(`Source cmd: ${sourceCommand}`);
    logger.debug(`Target cmd: ${targetCommand}`);
  }

  // If DEBUG_DATA_PIPE is set, save data to temp file instead of piping directly
  if (process.env.DEBUG_DATA_PIPE) {
    const debugFile = join(
      tmpdir(),
      `DEBUG_DATA_PIPE_${Date.now()}_${Math.random().toString(36).substring(7)}`
    );
    logger.info(`[DEBUG_DATA_PIPE] Saving piped data to: ${debugFile}`);

    // Pipe source to temp file
    const sourceToFile = `${sourceSSH} > ${quotePath(debugFile)}`;
    execSync(`set -o pipefail; ${sourceToFile}`, {
      shell: '/bin/bash',
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024,
    });

    logger.info(
      `[DEBUG_DATA_PIPE] Data saved. Now piping from file to target...`
    );

    // Pipe temp file to target
    const fileToTarget = `cat ${quotePath(debugFile)} | ${targetSSH}`;
    execSync(`set -o pipefail; ${fileToTarget}`, {
      shell: '/bin/bash',
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024,
    });

    logger.info(
      `[DEBUG_DATA_PIPE] Transfer complete. Debug file retained at: ${debugFile}`
    );
    return;
  }

  // Normal mode: direct pipe
  const pipeline = `${sourceSSH} | ${targetSSH}`;

  execSync(`set -o pipefail; ${pipeline}`, {
    shell: '/bin/bash',
    stdio: 'inherit',
    maxBuffer: 50 * 1024 * 1024,
  });
}
