/**
 * Keycloak Validation Helper
 *
 * Provides validation methods for Keycloak-related environment variables and configuration.
 * Used in pre-down hooks to fail fast before stopping the application.
 */

import { logger } from '../../../utils/logger';
import { DeploymentConfig } from '../../../../config/deployment-config';
import { parseEnvValue } from '../../../utils/env-expander';
import { LocalZipInspector } from '../../hook-types';

/**
 * Extract version tag from a Docker image reference.
 * @example "quay.io/keycloak/keycloak:26.1.2" -> "26.1.2"
 * @example "keycloak:26.1.2" -> "26.1.2"
 */
function extractVersionFromImage(imageRef: string): string {
  const colonIndex = imageRef.lastIndexOf(':');
  if (colonIndex === -1) {
    throw new Error(
      `Keycloak image "${imageRef}" does not contain a version tag`
    );
  }
  const version = imageRef.substring(colonIndex + 1);
  if (!version || version.includes('/')) {
    throw new Error(
      `Keycloak image "${imageRef}" does not contain a valid version tag`
    );
  }
  return version;
}

/**
 * Helper for validating Keycloak-related environment variables and configuration.
 * Used in pre-down hooks to fail fast if configuration is invalid.
 */
export class KeycloakValidationHelper {
  /**
   * Validate that KC_BOOTSTRAP_ADMIN_USERNAME and KC_BOOTSTRAP_ADMIN_PASSWORD
   * are present in DEPLOY_DOCKER_ENV.
   *
   * These are required for Keycloak realm migration and user import.
   *
   * @param dockerEnv - Content of DEPLOY_DOCKER_ENV (KEY=value per line)
   * @throws Error if credentials are missing
   */
  validateAdminCredentialsOrThrow(dockerEnv: string | undefined): void {
    if (!dockerEnv) {
      throw new Error('DEPLOY_DOCKER_ENV is not set');
    }

    const username = parseEnvValue(dockerEnv, 'KC_BOOTSTRAP_ADMIN_USERNAME');
    if (!username) {
      throw new Error(
        'DEPLOY_DOCKER_ENV is missing KC_BOOTSTRAP_ADMIN_USERNAME. ' +
          'This is required for Keycloak realm migration.'
      );
    }

    const password = parseEnvValue(dockerEnv, 'KC_BOOTSTRAP_ADMIN_PASSWORD');
    if (!password) {
      throw new Error(
        'DEPLOY_DOCKER_ENV is missing KC_BOOTSTRAP_ADMIN_PASSWORD. ' +
          'This is required for Keycloak realm migration.'
      );
    }

    logger.debug('Keycloak admin credentials validation passed');
  }

  /**
   * Validate that APP_KEYCLOAK_SECRETS contains valid JSON.
   *
   * This is required for realm-merge.ts to build the final realm.json.
   *
   * @param secretsJson - JSON string from APP_KEYCLOAK_SECRETS env var
   * @throws Error if JSON is invalid
   */
  validateKeycloakSecretsOrThrow(secretsJson: string | undefined): void {
    if (!secretsJson) {
      throw new Error(
        'APP_KEYCLOAK_SECRETS is not set. ' +
          'This is required for Keycloak realm configuration.'
      );
    }

    try {
      JSON.parse(secretsJson);
    } catch (e) {
      throw new Error(
        `APP_KEYCLOAK_SECRETS is not valid JSON: ${(e as Error).message}`
      );
    }

    logger.debug('APP_KEYCLOAK_SECRETS validation passed');
  }

  /**
   * Validate that keycloakImage is configured in deployment config.
   *
   * Without this, KeycloakCliHelper and KeycloakServerHelper will throw
   * cryptic proxy errors at runtime.
   *
   * @param deploymentConfig - Parsed deployment configuration
   * @throws Error if keycloakImage is not set
   */
  validateKeycloakImageConfigured(deploymentConfig: DeploymentConfig): void {
    if (!deploymentConfig.keycloakImage) {
      throw new Error(
        "Deployment config is missing 'keycloakImage'. " +
          'This is required for Keycloak CLI and server operations during maintenance.'
      );
    }

    logger.debug(
      `Keycloak image configured: ${deploymentConfig.keycloakImage}`
    );
  }

  /**
   * Validate that required Keycloak realm template files exist in the deployment package.
   *
   * Checks for:
   * - keycloak/templates/realm.json (base template)
   * - keycloak/templates/staging.json (staging overlay)
   * - keycloak/templates/production.json (production overlay)
   *
   * @param localZip - ZIP inspector for checking file existence in the deployment package
   * @throws Error if any required template is missing
   */
  validateRealmTemplatesExist(localZip: LocalZipInspector): void {
    const templates = [
      'keycloak/templates/realm.json',
      'keycloak/templates/staging.json',
      'keycloak/templates/production.json',
    ];

    const missing: string[] = [];

    for (const template of templates) {
      if (!localZip.pathExists(template)) {
        missing.push(template);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing Keycloak realm templates in deployment package: ${missing.join(
          ', '
        )}. ` + 'These are required for Keycloak realm migration.'
      );
    }

    logger.debug('Keycloak realm templates validation passed');
  }

  /**
   * Validate that the Keycloak version is consistent across all configuration files.
   *
   * Checks that:
   * 1. All FROM lines in keycloak/Dockerfile that mention "keycloak" use the expected version
   * 2. The keycloak service image tag in the specified docker-compose file uses the expected version
   *
   * This prevents deployment failures due to version mismatches between:
   * - staging.json/production.json keycloakImage
   * - Dockerfile base images
   * - docker-compose.yml image tags
   *
   * @param localZip - ZIP inspector for reading files from the deployment package
   * @param deploymentConfig - Deployment configuration containing keycloakImage
   * @param composePath - Path to the docker-compose file that defines the keycloak service (relative to backend assets)
   * @throws Error if any version mismatch is detected
   */
  validateKeycloakVersionConsistency(
    localZip: LocalZipInspector,
    deploymentConfig: DeploymentConfig,
    composePath: string
  ): void {
    const keycloakImage = deploymentConfig.keycloakImage;
    if (!keycloakImage) {
      throw new Error(
        'keycloakImage is not configured - cannot validate version consistency'
      );
    }

    // Extract version from keycloakImage (e.g., "quay.io/keycloak/keycloak:26.1.2" -> "26.1.2")
    const expectedVersion = extractVersionFromImage(keycloakImage);
    logger.debug(`Expected Keycloak version from config: ${expectedVersion}`);

    const errors: string[] = [];

    // Validate Dockerfile
    this.validateDockerfileVersions(localZip, expectedVersion, errors);

    // Validate docker-compose.yml
    this.validateDockerComposeVersion(
      localZip,
      expectedVersion,
      composePath,
      errors
    );

    if (errors.length > 0) {
      throw new Error(
        `Keycloak version inconsistency detected:\n${errors
          .map((e) => `  - ${e}`)
          .join('\n')}\n\n` +
          `Expected version: ${expectedVersion} (from keycloakImage: ${keycloakImage})`
      );
    }

    logger.debug('Keycloak version consistency validation passed');
  }

  /**
   * Validate all keycloak-related FROM lines in Dockerfile use the expected version.
   */
  private validateDockerfileVersions(
    localZip: LocalZipInspector,
    expectedVersion: string,
    errors: string[]
  ): void {
    const dockerfilePath = 'keycloak/Dockerfile';

    if (!localZip.pathExists(dockerfilePath)) {
      errors.push(`Dockerfile not found at ${dockerfilePath}`);
      return;
    }

    const dockerfile = localZip.readFile(dockerfilePath);
    const lines = dockerfile.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Only check FROM lines that mention keycloak
      if (!line.toUpperCase().startsWith('FROM ')) continue;
      if (!line.toLowerCase().includes('keycloak')) continue;

      // Extract the image reference from the FROM line
      // FROM image:tag [AS name]
      const fromMatch = line.match(/^FROM\s+(\S+)/i);
      if (!fromMatch) continue;

      const imageRef = fromMatch[1];
      const actualVersion = this.extractVersionFromImageSafe(imageRef);

      if (!actualVersion) {
        errors.push(
          `Dockerfile line ${i + 1}: Cannot extract version from "${imageRef}"`
        );
      } else if (actualVersion !== expectedVersion) {
        errors.push(
          `Dockerfile line ${
            i + 1
          }: FROM uses version ${actualVersion}, expected ${expectedVersion}`
        );
      }
    }
  }

  /**
   * Validate the keycloak service image in docker-compose.yml uses the expected version.
   */
  private validateDockerComposeVersion(
    localZip: LocalZipInspector,
    expectedVersion: string,
    composePath: string,
    errors: string[]
  ): void {
    if (!localZip.pathExists(composePath)) {
      errors.push(`docker-compose.yml not found at ${composePath}`);
      return;
    }

    const composeContent = localZip.readFile(composePath);

    // Simple regex to find the keycloak service image line
    // Looking for pattern like: image: something-keycloak:version or image: keycloak:version
    // This handles YAML indentation by looking for "image:" after a keycloak service definition

    // First, find if there's a keycloak service section
    const keycloakServiceMatch = composeContent.match(/^\s*keycloak:\s*$/m);
    if (!keycloakServiceMatch) {
      // No keycloak service defined, nothing to validate
      logger.info(
        'No keycloak service found in docker-compose.yml, skipping image validation'
      );
      return;
    }

    // Find the image line within a keycloak service context
    // We look for lines that contain keycloak in the image name
    const imageMatches = composeContent.matchAll(
      /^\s*image:\s*(\S+keycloak\S*)\s*$/gim
    );

    for (const match of imageMatches) {
      const imageRef = match[1];
      const actualVersion = this.extractVersionFromImageSafe(imageRef);

      if (!actualVersion) {
        errors.push(
          `docker-compose.yml: Cannot extract version from image "${imageRef}"`
        );
      } else if (actualVersion !== expectedVersion) {
        errors.push(
          `docker-compose.yml: keycloak image uses version ${actualVersion}, expected ${expectedVersion}`
        );
      }
    }
  }

  /**
   * Extract version from image reference, returning null if extraction fails.
   */
  private extractVersionFromImageSafe(imageRef: string): string | null {
    try {
      return extractVersionFromImage(imageRef);
    } catch {
      return null;
    }
  }
}
