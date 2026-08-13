import * as path from 'path';
import { RemoteFileSystem } from '../../../../infra/file-system';
import { logger } from '../../../utils/logger';
import { getAccessToken } from './api-client';

export interface KeycloakUserImportConfig {
  /** Directory containing user JSON files to import */
  userDirectory: string;
  /** Keycloak admin username */
  adminUsername: string;
  /** Keycloak admin password */
  adminPassword: string;
  /** Keycloak realm name to import users into */
  realmName: string;
  /**
   * Keycloak host URL (e.g., http://localhost:8080)
   *
   * IMPORTANT: This URL must be reachable from where this code runs (the CI runner),
   * NOT from the target server. If Keycloak only listens on localhost on the target
   * server, you must use the SSH tunnel helper to make it accessible:
   *
   * @example
   * await context.helpers.sshTunnel.withTunnel(
   *   { remotePort: 8080 },
   *   async (tunnel) => {
   *     await context.helpers.keycloak.userImport.importUsers({
   *       host: `http://localhost:${tunnel.localPort}`,
   *       // ... other config
   *     });
   *   }
   * );
   */
  host: string;
}

/**
 * Helper for importing users into Keycloak via the partial import API.
 * Provided to hooks via context.helpers.keycloak.userImport
 */
export class KeycloakUserImportHelper {
  constructor(private readonly remoteFs: RemoteFileSystem) {}

  private listFilesInDirectory(directoryPath: string): string[] {
    const entries = this.remoteFs.listDir(directoryPath);
    const filesWithPaths: string[] = [];

    for (const entry of entries) {
      if (!entry.includes('users') || entry.includes('realm')) continue;
      const fullPath = path.join(directoryPath, entry);
      filesWithPaths.push(fullPath);
    }

    return filesWithPaths;
  }

  private async sendImportRequest(
    importUrl: string,
    data: string,
    accessToken: string
  ): Promise<void> {
    const response = await fetch(importUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: data,
      method: 'POST',
    });

    if (response.status >= 400) {
      const text = await response.text().catch(() => 'unknown');
      throw new Error(
        `Import request failed: ${response.status} ${response.statusText} - ${text}`
      );
    }
  }

  /**
   * Import users from JSON files in a directory into a Keycloak realm.
   * Files must contain "users" in their name and not contain "realm".
   *
   * @param config - Import configuration
   */
  async importUsers(
    config: KeycloakUserImportConfig
  ): Promise<{ importedCount: number; totalFiles: number }> {
    const { userDirectory, adminUsername, adminPassword, realmName, host } =
      config;
    const importRequest = `${host}/admin/realms/${realmName}/partialImport`;

    logger.debug(`User directory: ${userDirectory}`);
    logger.debug(`Host: ${host}`);
    logger.debug(`Import endpoint: ${importRequest}`);

    const files = this.listFilesInDirectory(userDirectory);
    logger.debug(`Found ${files.length} user files to import`);

    for (let i = 0; i < files.length; i++) {
      const accessToken = await getAccessToken(
        host,
        adminUsername,
        adminPassword
      );
      const file = files[i];
      const data = this.remoteFs.readFile(file);
      await this.sendImportRequest(importRequest, data, accessToken);
      logger.debug(
        `Imported file ${i + 1}/${files.length}: ${path.basename(file)}`
      );
    }

    return {
      importedCount: files.length,
      totalFiles: files.length,
    };
  }
}
