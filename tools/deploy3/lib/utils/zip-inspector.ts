/**
 * ZIP Inspector Utility
 *
 * Provides methods for inspecting and extracting data from deployment ZIP files.
 * Used by both the orchestrator (to extract appName early) and DeploymentPackageTests.
 */

import { execSync } from 'child_process';
import {
  DeploymentConfig,
  DeploymentConfigSchema,
} from '../../config/deployment-config';
import { LocalZipInspector } from '../hooks/hook-types';

/**
 * ZipInspector - Utility for reading deployment ZIP contents
 */
export class ZipInspector {
  constructor(private readonly zipPath: string) {}

  /**
   * Get the deploy tag (root directory name) from the ZIP
   *
   * ZIP files should contain exactly one root directory named after the deploy tag.
   *
   * @returns The deploy tag (e.g., "25.0617.1430.15")
   * @throws Error if ZIP is empty or contains multiple root directories
   */
  getDeployTag(): string {
    const output = execSync(
      `zipinfo -1 "${this.zipPath}" | head -20 | cut -d'/' -f1 | sort -u`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    const topLevelEntries = output
      .trim()
      .split('\n')
      .filter((e) => e.length > 0);

    if (topLevelEntries.length === 0) {
      throw new Error('ZIP file is empty');
    }

    if (topLevelEntries.length > 1) {
      throw new Error(
        `ZIP should contain single root directory, found: ${topLevelEntries.join(
          ', '
        )}`
      );
    }

    return topLevelEntries[0];
  }

  /**
   * Check if a path exists within the ZIP
   *
   * @param pathInZip - Path to check (can include wildcards for zipinfo)
   * @returns true if at least one entry matches
   */
  pathExists(pathInZip: string): boolean {
    try {
      const output = execSync(
        `zipinfo -1 "${this.zipPath}" "${pathInZip}" 2>/dev/null`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * List entries matching a pattern in the ZIP
   *
   * @param pattern - Pattern to match (supports wildcards)
   * @returns Array of matching paths
   */
  listEntries(pattern: string): string[] {
    try {
      const output = execSync(
        `zipinfo -1 "${this.zipPath}" "${pattern}" 2>/dev/null || true`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      return output
        .trim()
        .split('\n')
        .filter((e) => e.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Extract and read a file from the ZIP
   *
   * @param pathInZip - Exact path to the file within the ZIP
   * @returns File contents as string
   * @throws Error if file not found or extraction fails
   */
  readFile(pathInZip: string): string {
    try {
      return execSync(`unzip -p "${this.zipPath}" "${pathInZip}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract ${pathInZip} from ZIP: ${msg}`);
    }
  }

  /**
   * Extract and parse the deployment config from the ZIP
   *
   * Finds the deployment config using a glob pattern (since we may not know appName yet).
   *
   * @param deployTag - The deploy tag (root directory in ZIP)
   * @param environment - The environment (staging or production)
   * @param configOverride - Optional JSON object to merge over the ZIP config (e.g., from DEPLOY_OVERWRITE_CONFIG)
   * @returns Parsed DeploymentConfig
   * @throws Error if config not found, multiple configs found, or parse fails
   */
  extractDeploymentConfig(
    deployTag: string,
    environment: 'staging' | 'production',
    configOverride?: Record<string, unknown>
  ): DeploymentConfig {
    const configFileName = `${environment}.json`;
    const configPattern = `${deployTag}/apps/*-backend/assets/deployment/${configFileName}`;

    const configPaths = this.listEntries(configPattern);

    if (configPaths.length === 0) {
      throw new Error(
        `No deployment config found in ZIP matching pattern: ${configPattern}`
      );
    }

    if (configPaths.length > 1) {
      throw new Error(
        `Expected exactly one deployment config, found ${
          configPaths.length
        }: ${configPaths.join(', ')}`
      );
    }

    const configContent = this.readFile(configPaths[0]);

    try {
      let jsonData = JSON.parse(configContent);

      // Apply config override if provided (shallow merge is sufficient for deployment config)
      if (configOverride && Object.keys(configOverride).length > 0) {
        jsonData = { ...jsonData, ...configOverride };
      }

      return DeploymentConfigSchema.parse(jsonData);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse ${configFileName}: ${msg}`);
    }
  }

  /**
   * Extract a specific file from the ZIP to a local destination
   *
   * @param pathInZip - Path to the file within the ZIP
   * @param destPath - Local destination path
   * @throws Error if extraction fails
   */
  extractFile(pathInZip: string, destPath: string): void {
    // Use unzip to extract a single file, redirecting to destination
    // -p outputs to stdout, we redirect to file
    execSync(`unzip -p "${this.zipPath}" "${pathInZip}" > "${destPath}"`, {
      stdio: 'pipe',
    });
  }

  /**
   * Extract the hooks directory to a local temp directory
   *
   * @param deployTag - The deploy tag (root directory in ZIP)
   * @param destDir - Local directory to extract hooks to
   * @returns Path to the extracted hooks directory
   * @throws Error if hooks directory not found or extraction fails
   */
  extractHooksDir(deployTag: string, destDir: string): string {
    const hooksPattern = `${deployTag}/apps/*-backend/assets/deployment/hooks/`;

    // Find the hooks directory
    const hooksDirs = this.listEntries(hooksPattern);
    if (hooksDirs.length === 0) {
      throw new Error(
        `No hooks directory found matching pattern: ${hooksPattern}`
      );
    }

    // Get the first match (strip trailing entries to get the directory)
    const hooksBasePath = hooksDirs[0].split('/').slice(0, -1).join('/') + '/';

    // Find all hook files
    const hookFiles = this.listEntries(`${hooksBasePath}*.js`);

    // Extract each hook file to the destination directory
    for (const hookFile of hookFiles) {
      const fileName = hookFile.split('/').pop();
      if (fileName) {
        const destPath = `${destDir}/${fileName}`;
        this.extractFile(hookFile, destPath);
      }
    }

    return destDir;
  }

  /**
   * Extract the server-setup directory to a local temp directory
   *
   * @param deployTag - The deploy tag (root directory in ZIP)
   * @param destDir - Local directory to extract server-setup to
   * @returns Path to the extracted server-setup directory
   * @throws Error if server-setup directory not found or extraction fails
   */
  extractServerSetupDir(deployTag: string, destDir: string): string {
    const serverSetupPattern = `${deployTag}/apps/*-backend/assets/deployment/server-setup/`;

    // Find the server-setup directory
    const serverSetupDirs = this.listEntries(serverSetupPattern);
    if (serverSetupDirs.length === 0) {
      throw new Error(
        `No server-setup directory found matching pattern: ${serverSetupPattern}`
      );
    }

    // Get the first match (strip trailing entries to get the directory)
    const serverSetupBasePath =
      serverSetupDirs[0].split('/').slice(0, -1).join('/') + '/';

    // Find all files in server-setup directory
    const serverSetupFiles = this.listEntries(`${serverSetupBasePath}*`);

    // Extract each file to the destination directory
    for (const file of serverSetupFiles) {
      // Skip directories (they end with /)
      if (file.endsWith('/')) continue;

      const fileName = file.split('/').pop();
      if (fileName) {
        const destPath = `${destDir}/${fileName}`;
        this.extractFile(file, destPath);
      }
    }

    return destDir;
  }

  /**
   * Create a LocalZipInspector scoped to the backend assets directory.
   *
   * The returned inspector accepts paths relative to backend assets
   * (e.g., "keycloak/templates/realm.json") and checks if they exist in the ZIP.
   *
   * @param deployTag - The deploy tag (root directory in ZIP)
   * @returns LocalZipInspector for checking files in backend assets
   */
  createBackendAssetsInspector(deployTag: string): LocalZipInspector {
    // Find the backend assets path pattern (e.g., "25.0617/apps/myapp-backend/assets/")
    const assetsPattern = `${deployTag}/apps/*-backend/assets/`;
    const assetsDirs = this.listEntries(assetsPattern);

    if (assetsDirs.length === 0) {
      throw new Error(
        `No backend assets directory found matching pattern: ${assetsPattern}`
      );
    }

    // Extract the base path (without trailing files, just the directory)
    // listEntries returns paths like "tag/apps/app-backend/assets/" or files within
    const basePath = assetsDirs[0].endsWith('/')
      ? assetsDirs[0]
      : assetsDirs[0].substring(0, assetsDirs[0].lastIndexOf('/') + 1);

    const zipInspector = this;

    return {
      pathExists(relativePath: string): boolean {
        const fullPath = `${basePath}${relativePath}`;
        return zipInspector.pathExists(fullPath);
      },
      readFile(relativePath: string): string {
        const fullPath = `${basePath}${relativePath}`;
        return zipInspector.readFile(fullPath);
      },
    };
  }
}
