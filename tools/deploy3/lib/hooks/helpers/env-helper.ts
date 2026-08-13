/**
 * Environment Helper
 *
 * Provides convenient access to environment variables in hook context.
 * Defaults to parsing from DEPLOY_DOCKER_ENV when no content is provided.
 */

import { parseEnvValue, parseEnvValueRequired } from '../../utils/env-expander';

/**
 * Helper for parsing values from env-file content.
 * Provided to hooks via context.helpers.env
 */
export class EnvHelper {
  constructor(private readonly env: Record<string, string>) {}

  /**
   * Get the raw DEPLOY_DOCKER_ENV content.
   * @returns The content, or undefined if not set
   */
  getDockerEnv(): string | undefined {
    return this.env['DEPLOY_DOCKER_ENV'];
  }

  /**
   * Parse a single value from env-file content.
   *
   * @param key - The key to look for
   * @param content - The env-file content (defaults to DEPLOY_DOCKER_ENV)
   * @returns The value, or undefined if not found
   *
   * @example
   * // From DEPLOY_DOCKER_ENV (default)
   * helpers.env.getValue('SOME_VALUE');
   *
   * // From custom content
   * helpers.env.getValue('FOO', customEnvContent);
   */
  getValue(key: string, content?: string): string | undefined {
    const source = content ?? this.env['DEPLOY_DOCKER_ENV'] ?? '';
    return parseEnvValue(source, key);
  }

  /**
   * Parse a required value from env-file content, throwing if not found.
   *
   * @param key - The key to look for
   * @param content - The env-file content (defaults to DEPLOY_DOCKER_ENV)
   * @returns The value
   * @throws Error if the key is not found
   *
   * @example
   * const adminUser = helpers.env.getValueRequired('SOME_VALUE');
   */
  getValueRequired(key: string, content?: string): string {
    const source = content ?? this.env['DEPLOY_DOCKER_ENV'];
    if (!source) {
      throw new Error(
        `Cannot get required key '${key}': DEPLOY_DOCKER_ENV is not set and no content provided`
      );
    }
    return parseEnvValueRequired(source, key);
  }
}
