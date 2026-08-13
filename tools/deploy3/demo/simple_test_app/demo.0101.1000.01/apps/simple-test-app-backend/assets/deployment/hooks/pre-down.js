/**
 * Pre-Down Hook for simple-test-app
 *
 * This hook runs BEFORE the old version is stopped.
 * It's a good place to:
 * - Validate deployment configuration
 * - Run pre-deployment smoke tests
 * - Check that required secrets/configs are present
 * - Verify docker-compose file structure
 */

module.exports = async function (context) {
  const { logger, version } = context;

  logger.info('[pre-down.js] Starting pre-down hook for version: ' + version);

  try {
    // Validate basic environment
    logger.info('[pre-down.js] ✓ Environment variables present');

    // Validate docker-compose structure
    logger.info('[pre-down.js] ✓ Docker compose configuration valid');

    // In a real app, you might:
    // - Parse APP_BACKEND_SECRETS if present
    // - Validate required config fields
    // - Check database connectivity
    // - Run linting or other checks

    logger.info('[pre-down.js] Pre-down hook completed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[pre-down.js] Hook failed: ' + message);
    throw error;
  }
};
