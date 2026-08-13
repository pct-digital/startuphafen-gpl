// @ts-check
const path = require('path');
const { migrateKeycloak } = require('./keycloak-migration');

/**
 * @typedef {import('../../../../../../tools/deploy3/lib/hooks/hook-types').MaintenanceHookContext} MaintenanceHookContext
 */

/**
 * Maintenance hook - runs during maintenance window.
 * Responsible for:
 * - Writing secret files that the application needs
 * - Ensuring databases exist (local volumes or remote databases)
 *
 * @param {MaintenanceHookContext} context
 */
module.exports = async function (context) {
  const {
    logger,
    remoteFs,
    pathResolver,
    version,
    env,
    helpers,
    deploymentConfig,
  } = context;

  logger.info('Executing maintenance hook...');

  // =========================================================================
  // Step 1: Write secret files
  // =========================================================================
  const assetsPath = pathResolver.getVersionBackendAssetsPath(version);

  const secretFiles = {
    APP_BACKEND_SECRETS: '../../backend_secrets.json'
  };

  for (const [envKey, relativePath] of Object.entries(secretFiles)) {
    const fullPath = path.join(assetsPath, relativePath);
    if (env[envKey]) {
      logger.info(`Writing ${envKey} to ${fullPath}`);
      remoteFs.writeFile(fullPath, env[envKey]);
    } else {
      logger.warn(`${envKey} not provided, skipping ${relativePath}`);
    }
  }


  // =========================================================================
  // Step 2: Initialize databases
  // =========================================================================

  const appDbConfig = helpers.postgres.helper.parseBackendSecrets(
    env.APP_BACKEND_SECRETS
  );
  const kcDbConfig = helpers.postgres.helper.parseKeycloakDbFromDockerEnv(
    env.DEPLOY_DOCKER_ENV
  );

  // Check if we're in local database mode (volumes configured in deployment config)
  // or remote database mode (no volumes, need to create remote databases)
  const localDbVolumes = deploymentConfig.localDatabaseVolumes;

  if (localDbVolumes && localDbVolumes.length > 0) {
    // Local database mode: ensure Docker volumes exist
    logger.info('Local database mode: ensuring Docker volumes exist...');
    helpers.postgres.helper.ensureLocalVolumes(localDbVolumes);
  } else {
    // Remote database mode: ensure databases exist on remote server
    logger.info('Remote database mode: ensuring databases exist...');

    // Parse database configs from environment variables
    if (env.APP_BACKEND_SECRETS) {
      logger.info(
        `Checking/creating application database: ${appDbConfig.database}`
      );
      helpers.postgres.helper.ensureDatabase(appDbConfig);
    } else {
      logger.warn(
        'APP_BACKEND_SECRETS not set, skipping application database initialization'
      );
    }
    if (env.DEPLOY_DOCKER_ENV) {
      logger.info(
        `Checking/creating Keycloak database: ${kcDbConfig.database}`
      );
      helpers.postgres.helper.ensureDatabase(kcDbConfig);
    } else {
      logger.warn(
        'DEPLOY_DOCKER_ENV not set, skipping Keycloak database initialization'
      );
    }
  }

  // =========================================================================
  // Step 3: Validate Postgres version compatibility (local databases only)
  // =========================================================================
  // Remote databases were validated in pre-down. Local databases can only be
  // checked now since the containers are started by docker compose.
  const localDbContainers =
    deploymentConfig.localDatabaseComposeServiceNames ?? [];
  const postgresImage = deploymentConfig.postgresImage;

  if (postgresImage && localDbContainers.length > 0) {
    if (localDbContainers.includes(appDbConfig.host)) {
      logger.info('Checking App database Postgres version compatibility...');
      await helpers.postgres.validation.validateVersionCompatibility({
        docker: context.docker,
        postgresHelper: helpers.postgres.helper,
        postgresImage,
        dbConfig: appDbConfig,
      });
    }

    if (localDbContainers.includes(kcDbConfig.host)) {
      logger.info(
        'Checking Keycloak database Postgres version compatibility...'
      );
      await helpers.postgres.validation.validateVersionCompatibility({
        docker: context.docker,
        postgresHelper: helpers.postgres.helper,
        postgresImage,
        dbConfig: kcDbConfig,
      });
    }
  }

  // =========================================================================
  // Step 4: Keycloak realm migration
  // =========================================================================
  await migrateKeycloak(context);

  // =========================================================================
  // Step 5: Write psql scripts for database access
  // =========================================================================
  logger.info('Writing psql.sh script for application database...');
  helpers.postgres.helper.writePsqlScript({
    scriptPath: pathResolver.getControlScriptPath('psql.sh'),
    connectionConfig: appDbConfig,
    fs: remoteFs,
  });

  logger.info('Writing psql-kc.sh script for Keycloak database...');
  helpers.postgres.helper.writePsqlScript({
    scriptPath: pathResolver.getControlScriptPath('psql-kc.sh'),
    connectionConfig: kcDbConfig,
    fs: remoteFs,
  });

  logger.info('Maintenance hook finished.');
};
