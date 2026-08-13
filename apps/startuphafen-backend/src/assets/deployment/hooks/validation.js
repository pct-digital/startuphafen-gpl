// @ts-check

/**
 * @typedef {import('../../../../../../tools/deploy3/lib/hooks/hook-types').PreDownHookContext} PreDownHookContext
 */

/**
 * Startuphafen-specific validation helpers for pre-down smoke tests.
 * These are app-specific validations that don't belong in deploy3 core.
 */

/**
 * Validate that DEPLOY_DOMAIN and APP_HOST in DEPLOY_DOCKER_ENV match.
 * This ensures consistent hostname configuration across the deployment.
 *
 * @param {Record<string, string>} env - Environment variables
 * @throws {Error} if hostnames don't match
 */
function validateDomainConsistency(env) {
  const deployDomain = env['DEPLOY_DOMAIN'];
  const dockerEnv = env['DEPLOY_DOCKER_ENV'];

  if (!deployDomain) {
    throw new Error('DEPLOY_DOMAIN is not set');
  }

  if (!dockerEnv) {
    throw new Error('DEPLOY_DOCKER_ENV is not set');
  }

  // Extract APP_HOST from DEPLOY_DOCKER_ENV
  const appHostMatch = dockerEnv.match(/^APP_HOST=(.*)$/m);
  if (!appHostMatch) {
    throw new Error('DEPLOY_DOCKER_ENV does not contain APP_HOST');
  }

  const appHost = appHostMatch[1].trim();

  // Handle ${DEPLOY_DOMAIN} reference in APP_HOST
  if (appHost === '${DEPLOY_DOMAIN}') {
    // This is fine - it will be expanded to DEPLOY_DOMAIN
    return;
  }

  // Direct value - must match DEPLOY_DOMAIN
  if (appHost !== deployDomain) {
    throw new Error(
      `APP_HOST (${appHost}) does not match DEPLOY_DOMAIN (${deployDomain}). ` +
        `Either set APP_HOST=\${DEPLOY_DOMAIN} or ensure they have the same value.`
    );
  }
}

module.exports = {
  validateDomainConsistency,
};
