/**
 * Environment Variable Expander
 *
 * Utilities for working with env-file format (KEY=value per line).
 * Used to process DEPLOY_DOCKER_ENV before writing to .env on the target server.
 */

/**
 * Parse a single value from env-file content.
 *
 * @param content - The env-file content (KEY=value per line)
 * @param key - The key to look for
 * @returns The value, or undefined if not found
 *
 * @example
 * const content = 'FOO=bar\nBAZ=qux';
 * parseEnvValue(content, 'FOO'); // 'bar'
 * parseEnvValue(content, 'MISSING'); // undefined
 */
export function parseEnvValue(
  content: string,
  key: string
): string | undefined {
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(pattern);
  return match ? match[1].trim() : undefined;
}

/**
 * Parse a single value from env-file content, throwing if not found.
 *
 * @param content - The env-file content (KEY=value per line)
 * @param key - The key to look for
 * @returns The value
 * @throws Error if the key is not found
 */
export function parseEnvValueRequired(content: string, key: string): string {
  const value = parseEnvValue(content, key);
  if (value === undefined) {
    throw new Error(`Required key '${key}' not found in env-file content`);
  }
  return value;
}

/**
 * Expand ${VAR_NAME} references in a string using values from the given context.
 *
 * @param content - The content containing ${VAR_NAME} references
 * @param env - The environment variables to use for expansion
 * @returns The expanded content
 * @throws Error if a referenced variable is not found in env
 */
export function expandEnvVariables(
  content: string,
  env: Record<string, string>
): string {
  // Match ${VAR_NAME} pattern
  const pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

  return content.replace(pattern, (_match, varName) => {
    const value = env[varName];
    if (value === undefined) {
      throw new Error(
        `Environment variable expansion failed: '${varName}' is not defined. ` +
          `Referenced in DEPLOY_DOCKER_ENV but not found in CI environment.`
      );
    }
    return value;
  });
}
