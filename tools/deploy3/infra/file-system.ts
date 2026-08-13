/**
 * Remote File System - Handles remote file system operations via SSH.
 *
 * This module provides abstractions for file system operations on remote hosts:
 * - File reading and writing with atomic updates
 * - Directory creation and removal
 * - Symlink operations
 * - JSON file updates with locking
 *
 * All operations are synchronous (blocking) using execSync. This is by design
 * for CLI deployment tools.
 */

import { SshClient, ExecOptions } from './ssh-client';
import { logger } from '../lib/utils/logger';
import { escapePath, quotePath } from '../lib/utils/shell';
import { createHash } from 'crypto';
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import path from 'path';

/**
 * Remote File System operations
 */
export class RemoteFileSystem {
  constructor(private readonly ssh: SshClient) {}

  /**
   * Compute MD5 hash of all files in a local directory (recursively, sorted alphabetically).
   *
   * This is used to detect if directory contents have changed, for example to skip
   * redundant Ansible playbook runs if server-setup files haven't changed.
   *
   * Files are hashed in lexicographic order to ensure deterministic results.
   *
   * @param dirPath - Absolute path to the local directory
   * @returns MD5 hash string (32 hex characters)
   */
  computeDirectoryHash(dirPath: string): string {
    const hash = createHash('md5');

    /**
     * Recursively hash all files in a directory
     */
    const hashDirectory = (currentPath: string) => {
      const entries = readdirSync(currentPath).sort(); // Sort for determinism

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Recursively hash subdirectories
          hashDirectory(fullPath);
        } else if (stat.isFile()) {
          // Hash the file path (relative to dirPath) and contents
          const relativePath = path.relative(dirPath, fullPath);
          hash.update(relativePath + '\n');
          const fileContent = readFileSync(fullPath);
          hash.update(new Uint8Array(fileContent.buffer));
        }
      }
    };

    hashDirectory(dirPath);
    return hash.digest('hex');
  }

  /**
   * Check if a remote path exists
   */
  pathExists(remotePath: string, options: ExecOptions = {}): boolean {
    const { silent = true } = options;
    try {
      this.ssh.exec(`test -e ${quotePath(remotePath)}`, {
        ...options,
        silent: true,
      });
      const exists = true;
      if (silent) {
        logger.debug(`Path exists: ${remotePath}`);
      }
      return exists;
    } catch {
      if (silent) {
        logger.debug(`Path does not exist: ${remotePath}`);
      }
      return false;
    }
  }

  /**
   * Read a file from the remote host.
   * Default to silent operation.
   */
  readFile(remotePath: string, options: ExecOptions = {}): string {
    const defaults: ExecOptions = {
      silent: true,
    };
    const opts: ExecOptions = {
      ...defaults,
      ...options,
    };
    const result = this.ssh.exec(`cat ${quotePath(remotePath)}`, opts);
    if (opts.silent) {
      logger.debug('Read ' + result.length + ' bytes from file ' + remotePath);
    }
    return result;
  }

  /**
   * Write content to a file on the remote host.
   * - For small files (<50KB): Uses base64 encoding via SSH
   * - For large files (>=50KB): Uses SCP to avoid ARG_MAX overflow
   * Defaults to silent operation
   */
  writeFile(
    remotePath: string,
    content: string,
    options: ExecOptions = {}
  ): void {
    const { useSudo = false, silent = true } = options;
    const LARGE_FILE_THRESHOLD = 50 * 1024; // 50KB

    // For large files, use SCP to avoid ARG_MAX overflow
    if (content.length > LARGE_FILE_THRESHOLD) {
      const tempFile = `/tmp/ssh_write_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.tmp`;
      try {
        writeFileSync(tempFile, content, 'utf-8');
        this.copyFile(tempFile, remotePath, silent, true);
        if (silent) {
          logger.debug(
            `Wrote ${content.length} bytes to ${remotePath} via SCP`
          );
        }
      } finally {
        try {
          unlinkSync(tempFile);
        } catch {
          // Ignore temp file cleanup errors
        }
      }
      return;
    }

    // For small files, use base64 encoding via SSH
    const b64 = Buffer.from(content).toString('base64');
    const remotePath_escaped = escapePath(remotePath);
    const cmd = `tmp="${remotePath_escaped}.tmp.$$"; echo "${b64}" | base64 -d > "$tmp"; mv "$tmp" "${remotePath_escaped}"`;
    this.ssh.exec(`bash -e -c ${quotePath(cmd)}`, { useSudo, silent });

    if (silent) {
      logger.debug('Wrote ' + content.length + ' bytes to ' + remotePath);
    }
  }

  /**
   * Copy a local file to the remote host using SCP
   */
  copyFile(
    localPath: string,
    remotePath: string,
    silent = true,
    quiet = false
  ): string {
    const sshOptions = [
      '-o BatchMode=yes',
      '-o StrictHostKeyChecking=accept-new',
      '-o ConnectTimeout=30',
    ].join(' ');
    const keyArg = this.ssh.keyFilePath
      ? `-i ${quotePath(this.ssh.keyFilePath)} `
      : '';
    const command = `scp ${sshOptions} ${keyArg}-P ${
      this.ssh.portNumber
    } ${quotePath(localPath)} ${quotePath(
      this.ssh.userAtHost + ':' + remotePath
    )}`;
    const result = this.ssh.execLocal(command, silent);
    if (silent && !quiet) {
      logger.debug(`Copied ${localPath} to ${remotePath}`);
    }
    return result;
  }

  /**
   * Create a directory on the remote host (like mkdir -p)
   */
  mkdir(remotePath: string, options: ExecOptions = {}): void {
    const { silent = true } = options;
    this.ssh.exec(`mkdir -p ${quotePath(remotePath)}`, {
      ...options,
      silent: true,
    });
    if (silent) {
      logger.debug(`Created directory ${remotePath}`);
    }
  }

  /**
   * Remove a file or directory on the remote host
   */
  rm(remotePath: string, recursive = false, options: ExecOptions = {}): void {
    const { silent = true } = options;
    const flags = recursive ? '-rf' : '-f';
    this.ssh.exec(`rm ${flags} ${quotePath(remotePath)}`, {
      ...options,
      silent: true,
    });
    if (silent) {
      const suffix = recursive ? ' [recursive]' : '';
      logger.debug(`Removed ${remotePath}${suffix}`);
    }
  }

  /**
   * Change file/directory permissions on the remote host
   *
   * @param remotePath - Path to the file or directory
   * @param mode - Permission mode (e.g., '755', '644', '777')
   * @param options - Execution options
   */
  chmod(remotePath: string, mode: string, options: ExecOptions = {}): void {
    const { silent = true } = options;
    this.ssh.exec(`chmod ${mode} ${quotePath(remotePath)}`, {
      ...options,
      silent: true,
    });
    if (silent) {
      logger.debug(`Changed permissions ${remotePath} to ${mode}`);
    }
  }

  /**
   * Get the octal permissions of a file/directory (e.g., '755', '644')
   * Returns null if the path doesn't exist.
   */
  getPermissions(remotePath: string, options: ExecOptions = {}): string | null {
    const { silent = true } = options;
    try {
      // stat -c '%a' gives octal permissions like '755'
      const result = this.ssh.exec(`stat -c '%a' ${quotePath(remotePath)}`, {
        ...options,
        silent: true,
      });
      const perms = result.trim();
      if (silent) {
        logger.debug(`Permissions ${remotePath}: ${perms}`);
      }
      return perms;
    } catch {
      return null;
    }
  }

  /**
   * List directory contents on the remote host.
   * Returns an array of entry names (files and directories).
   * Returns empty array if directory doesn't exist.
   *
   * @param remotePath - Path to the directory
   * @param options - Execution options
   */
  listDir(remotePath: string, options: ExecOptions = {}): string[] {
    const { silent = true } = options;
    try {
      // -1 lists one entry per line, -A excludes . and ..
      const result = this.ssh.exec(`ls -1A ${quotePath(remotePath)}`, {
        ...options,
        silent: true,
      });
      const entries = result
        .trim()
        .split('\n')
        .filter((e) => e.length > 0);
      if (silent) {
        logger.debug(`Listed ${remotePath}: ${entries.length} entries`);
      }
      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Read a symlink target on the remote host
   */
  readlink(linkPath: string, options: ExecOptions = {}): string | null {
    const { silent = true } = options;
    const result = this.ssh.exec(`readlink ${quotePath(linkPath)}`, {
      ...options,
      silent: true,
    });
    if (silent && result) {
      logger.debug(`Symlink ${linkPath} -> ${result.trim()}`);
    }
    return result;
  }

  /**
   * Create a symlink on the remote host
   */
  symlink(target: string, linkPath: string, options: ExecOptions = {}): void {
    const { silent = true } = options;
    this.ssh.exec(`ln -s ${quotePath(target)} ${quotePath(linkPath)}`, {
      ...options,
      silent: true,
    });
    if (silent) {
      logger.debug(`Created symlink ${linkPath} -> ${target}`);
    }
  }

}
