// @ts-check
const path = require('path');

/**
 * @typedef {import('../../../../../../tools/deploy3/lib/hooks/hook-types').MaintenanceHookContext} MaintenanceHookContext
 */

/**
 * Keycloak realm migration.
 *
 * This function handles the complete Keycloak realm migration:
 * 1. Check if realm already exists in the database
 * 2. If exists: export users to temp directory
 * 3. Build merged realm.json from templates, overlays, and secrets
 * 4. Import the realm (overwrites existing realm config)
 * 5. If users were exported: re-import them via Keycloak REST API
 *
 * @param {MaintenanceHookContext} context
 */
async function migrateKeycloak(context) {
  const { logger, env, helpers, pathResolver, version, deploymentConfig } =
    context;

  // =========================================================================
  // Step 1: Parse configuration from environment
  // =========================================================================

  const dockerEnv = env.DEPLOY_DOCKER_ENV;
  if (!dockerEnv) {
    logger.warn('DEPLOY_DOCKER_ENV not set, skipping Keycloak migration');
    return;
  }

  const kcDbConfig =
    helpers.postgres.helper.parseKeycloakDbFromDockerEnv(dockerEnv);
  const adminUsername = helpers.env.getValueRequired(
    'KC_BOOTSTRAP_ADMIN_USERNAME'
  );
  const adminPassword = helpers.env.getValueRequired(
    'KC_BOOTSTRAP_ADMIN_PASSWORD'
  );

  const realmName = deploymentConfig.appName;
  const assetsPath = pathResolver.getVersionBackendAssetsPath(version);
  const appPath = pathResolver.getAppPath();
  const usersExportDir = path.join(appPath, 'keycloak-exported-users');

  logger.info(`Keycloak migration for realm '${realmName}'`);
  logger.info(
    `Keycloak DB: ${kcDbConfig.host}:${kcDbConfig.port}/${kcDbConfig.database}`
  );

  // =========================================================================
  // Step 2-5: Perform migration within single database connection
  // =========================================================================

  const realmFile = path.join(assetsPath, 'keycloak/import/realm.json');

  await helpers.postgres.helper.withDatabase(kcDbConfig, async (db) => {
    // Check if realm exists
    const hasExistingRealm = helpers.keycloak.cli.realmExists(db, realmName);
    logger.info(`Realm '${realmName}' exists: ${hasExistingRealm}`);

    // Export users if realm exists
    let usersExported = false;
    if (hasExistingRealm) {
      logger.info('Exporting existing users before realm import...');
      context.remoteFs.rm(usersExportDir, true); // Clean up stale exports
      helpers.keycloak.cli.exportUsers(usersExportDir, {
        realmName,
        dbConfig: kcDbConfig,
      });
      usersExported = true;
      logger.info(`Users exported to ${usersExportDir}`);
    }

    // Build merged realm.json
    logger.info('Building merged realm.json from templates and secrets...');
    helpers.keycloak.realmMerge.merge(env, assetsPath);
    logger.info('Realm configuration merged successfully');

    // Import realm
    logger.info(`Importing realm from ${realmFile}...`);
    helpers.keycloak.cli.importRealm(realmFile, {
      realmName,
      dbConfig: kcDbConfig,
    });
    logger.info('Realm imported successfully');

    // Bootstrap admin user via REST API (ensures non-temporary credentials)
    // This must happen after realm import since the import creates the DB schema.
    // withServer() creates a temporary admin user that works regardless of DB state.
    logger.info('Bootstrapping Keycloak admin user...');
    await helpers.keycloak.server.withServer(
      {
        dbConfig: kcDbConfig,
        realmName,
      },
      async (serverUrl, tempAdminCredentials) => {
        // Ensure the real admin is properly set up with non-temporary password and admin role
        // We authenticate with the temporary admin credentials provided by withServer
        await helpers.keycloak.adminUser.ensureAdminUser({
          host: serverUrl,
          username: adminUsername,
          password: adminPassword,
          authUsername: tempAdminCredentials.username,
          authPassword: tempAdminCredentials.password,
        });

        // Re-import users if they were exported
        if (usersExported) {
          logger.info('Re-importing users via Keycloak REST API...');
          const result = await helpers.keycloak.userImport.importUsers({
            userDirectory: usersExportDir,
            adminUsername: tempAdminCredentials.username,
            adminPassword: tempAdminCredentials.password,
            realmName,
            host: serverUrl,
          });
          logger.info(`Imported ${result.importedCount} user files`);
        }
      }
    );

    // Clean up exported users directory
    if (usersExported) {
      context.remoteFs.rm(usersExportDir, true);
      logger.info('Cleaned up user export directory');
    }
  });

  logger.info('Keycloak migration completed successfully');
}

module.exports = { migrateKeycloak };
