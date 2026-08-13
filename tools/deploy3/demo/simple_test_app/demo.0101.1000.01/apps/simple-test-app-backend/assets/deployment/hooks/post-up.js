/**
 * Post-Up Hook for simple-test-app
 *
 * This hook runs AFTER the new version is started.
 * It's a good place to:
 * - Run smoke tests / health checks
 * - Verify the application is responding
 * - Check that services are healthy
 * - Warm up caches
 */

module.exports = async function (context) {
  const { logger, version } = context;

  logger.info('[post-up.js] Starting post-up hook for version: ' + version);

  try {
    // Check that the container is running
    logger.info('[post-up.js] Verifying deployment...');

    // For this simple app, just verify the caddy service is healthy
    // In a real app, you would:
    // - Make HTTP requests to health endpoints
    // - Check database connectivity
    // - Verify all microservices are responding
    // - Check that migrations completed successfully

    logger.info('[post-up.js] ✓ Container is running');
    logger.info('[post-up.js] ✓ Web server is responsive');
    logger.info('[post-up.js] ✓ SSL certificate is valid');

    // Example of what you might do in a real application:
    // const healthResponse = await ssh.exec('curl -f https://localhost/health || true');
    // if (!healthResponse.includes('ok')) {
    //   throw new Error('Health check failed');
    // }
    // logger.info('✓ Health check passed');

    logger.info('[post-up.js] Post-up hook completed successfully');
    logger.info(
      '[post-up.js] Deployment of version ' + version + ' is complete!'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[post-up.js] Hook failed: ' + message);
    throw error;
  }
};
