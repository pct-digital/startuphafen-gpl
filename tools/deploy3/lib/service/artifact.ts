/**
 * Artifact Service
 *
 * Manages deployment artifacts on the remote server:
 * - Copying ZIP files to the server
 * - Unpacking and cleaning up versions
 * - Managing symlinks for version activation
 * - Checking and resolving the currently active version
 */

import { SshClient } from '../../infra/ssh-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { PathResolver } from './path-resolver';
import { Logger } from '../utils/logger';

/**
 * Result of checking for an old version
 */
export interface OldVersionResult {
  /** The version tag of the old version, or undefined if no active version */
  versionTag: string | undefined;
}

/**
 * Configuration for ArtifactService
 */
export interface ArtifactServiceConfig {
  ssh: SshClient;
  fs: RemoteFileSystem;
  pathResolver: PathResolver;
  logger: Logger;
}

/**
 * ArtifactService - Manages deployment artifacts on the remote server
 */
export class ArtifactService {
  private readonly ssh: SshClient;
  private readonly fs: RemoteFileSystem;
  private readonly pathResolver: PathResolver;
  private readonly logger: Logger;

  constructor(config: ArtifactServiceConfig) {
    this.ssh = config.ssh;
    this.fs = config.fs;
    this.pathResolver = config.pathResolver;
    this.logger = config.logger;
  }

  /**
   * Copy a local ZIP file to the remote server
   * @param localZipPath - Local path to the ZIP file
   * @param deployTag - The deployment tag for naming
   * @returns The remote path where the ZIP was copied
   */
  copyZipToServer(localZipPath: string, deployTag: string): string {
    const appPath = this.pathResolver.getAppPath();

    // Generate a random prefix to avoid collisions
    const randomPrefix = `deploy_${Math.random()
      .toString(36)
      .substring(2, 10)}_`;
    const zipFileName = `${randomPrefix}${deployTag}.zip`;
    const remoteZipPath = `${appPath}/${zipFileName}`;

    // Ensure the app directory exists
    this.fs.mkdir(appPath, { silent: true });

    this.logger.info(`Copying ZIP to server: ${remoteZipPath}`);
    this.fs.copyFile(localZipPath, remoteZipPath);

    return remoteZipPath;
  }

  /**
   * Check if there is an active version and return its tag
   * @returns The old version tag or undefined if no active version
   */
  checkOldVersion(): OldVersionResult {
    const activeLinkPath = this.pathResolver.getActiveLinkPath();

    // Check if the active symlink exists
    if (!this.fs.pathExists(activeLinkPath)) {
      this.logger.info('No active version found (fresh deployment)');
      return { versionTag: undefined };
    }

    // Resolve the symlink to get the old version path
    const resolvedPath = this.fs.readlink(activeLinkPath);
    if (!resolvedPath) {
      this.logger.info('Active symlink exists but could not be resolved');
      return { versionTag: undefined };
    }

    // Extract version tag from path (last component)
    const oldVersionTag = resolvedPath.split('/').pop();
    if (!oldVersionTag) {
      throw new Error(
        `Could not extract version tag from path: ${resolvedPath}`
      );
    }

    this.logger.info(`Found active version: ${oldVersionTag}`);
    return { versionTag: oldVersionTag };
  }

  /**
   * Remove the active symlink
   */
  unlinkOldVersion(): void {
    const activeLinkPath = this.pathResolver.getActiveLinkPath();

    if (!this.fs.pathExists(activeLinkPath)) {
      this.logger.info('No symlink to remove');
      return;
    }

    this.fs.rm(activeLinkPath, false, { silent: false });
  }

  /**
   * Delete the old version folder and ensure the target folder for the new version is clean
   * @param oldVersionTag - The old version tag to delete (if any)
   * @param newVersionTag - The new version tag (to ensure its target folder is clean)
   */
  deleteOldFolder(
    oldVersionTag: string | undefined,
    newVersionTag: string
  ): void {
    // Delete old version folder if it exists
    if (oldVersionTag) {
      const oldVersionPath = this.pathResolver.getVersionPath(oldVersionTag);
      if (this.fs.pathExists(oldVersionPath)) {
        this.logger.info(`Deleting old version folder: ${oldVersionPath}`);
        this.fs.rm(oldVersionPath, true, { silent: false });
      }
    }

    // Ensure target folder for new version is clean
    const newVersionPath = this.pathResolver.getVersionPath(newVersionTag);
    if (this.fs.pathExists(newVersionPath)) {
      this.logger.warn(
        `Target folder already exists, removing: ${newVersionPath}`
      );
      this.fs.rm(newVersionPath, true, { silent: false });
    }
  }

  /**
   * Unpack a ZIP file on the remote server
   * @param remoteZipPath - Path to the ZIP file on the remote server
   */
  unpackNewVersion(remoteZipPath: string): void {
    const appPath = this.pathResolver.getAppPath();

    // Unzip to app directory (creates <deployTag>/ folder)
    this.logger.info(`Extracting ZIP: ${remoteZipPath}`);
    this.ssh.exec(`unzip -q ${remoteZipPath} -d ${appPath}`, { silent: false });

    // Clean up ZIP file after extraction
    this.logger.info(`Deleting ZIP file: ${remoteZipPath}`);
    this.fs.rm(remoteZipPath, false, { silent: false });
    this.logger.info(`ZIP file deleted successfully: ${remoteZipPath}`);
  }

  /**
   * Create the active symlink pointing to the new version
   * @param deployTag - The deployment tag to link to
   */
  linkNewVersion(deployTag: string): void {
    const activeLinkPath = this.pathResolver.getActiveLinkPath();
    const newVersionPath = this.pathResolver.getVersionPath(deployTag);

    // Create symlink: active -> <deployTag>
    this.fs.symlink(newVersionPath, activeLinkPath, { silent: false });
    this.logger.info(`Symlink created: ${activeLinkPath} -> ${newVersionPath}`);
  }
}
