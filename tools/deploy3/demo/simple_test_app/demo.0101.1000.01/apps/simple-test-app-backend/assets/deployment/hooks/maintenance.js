/**
 * Maintenance Hook for simple-test-app
 *
 * This hook runs DURING the maintenance window:
 * - Old version is stopped (ports freed)
 * - New version is unpacked
 * - Maintenance page is showing
 *
 * This is where you do:
 * - Database migrations
 * - Keycloak configuration
 * - Secret file generation
 * - Any long-running initialization
 */

module.exports = async function (context) {
  const { logger, version, docker } = context;

  logger.info(
    '[maintenance.js] Starting maintenance hook for version: ' + version
  );

  try {
    // Create external volumes for persistent storage
    // These volumes will survive "docker-compose down" and persist across deployments
    logger.info('[maintenance.js] Creating persistent external volumes...');
    docker.ensureVolume('simple-test-app-caddy-data');
    docker.ensureVolume('simple-test-app-caddy-config');
    logger.info('[maintenance.js] ✓ Persistent volumes created/verified');

    // For this simple demo app, there's minimal setup needed
    // It's a stateless web application with no database

    logger.info(
      '[maintenance.js] ✓ No database setup required (stateless app)'
    );
    logger.info('[maintenance.js] ✓ No secrets to configure');
    logger.info('[maintenance.js] ✓ No migrations to run');

    // In a real application, you would:
    // 1. Parse APP_BACKEND_SECRETS and write to files
    //    const secrets = JSON.parse(env.APP_BACKEND_SECRETS || '{}');
    //    ssh.exec('cat > /opt/simple-test-app/active/backend_secrets.json << EOF\n...\nEOF');
    //
    // 2. Run database migrations
    //    docker.exec('db-migration-container', 'npm run migrate');
    //
    // 3. Initialize Keycloak realms
    //    const keycloakSecrets = JSON.parse(env.APP_KEYCLOAK_SECRETS || '{}');
    //    docker.exec('keycloak', 'cli import-realm ...');
    //
    // 4. Warm up caches
    //    docker.exec('app', 'npm run cache:warm');

    logger.info('[maintenance.js] Maintenance hook completed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[maintenance.js] Hook failed: ' + message);
    throw error;
  }
};
