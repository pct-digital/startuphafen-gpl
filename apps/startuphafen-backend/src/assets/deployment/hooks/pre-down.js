// @ts-check

const {
  validateDomainConsistency,
} = require('./validation');

/**
 * @typedef {import('../../../../../../tools/deploy3/lib/hooks/hook-types').PreDownHookContext} PreDownHookContext
 */

/**
 * Pre-down hook - runs BEFORE the old version is stopped.
 *
 * This is the place for smoke tests that validate the deployment will succeed.
 * If any validation fails here, the deployment aborts WITHOUT stopping the running app.
 *
 * Validations performed:
 * - APP_BACKEND_SECRETS: Valid JSON with correct structure for postgres helper
 * - APP_KEYCLOAK_SECRETS: Valid JSON for realm merge
 * - DEPLOY_DOCKER_ENV: Contains valid Keycloak DB config and admin credentials
 * - Domain consistency: DEPLOY_DOMAIN matches APP_HOST in DEPLOY_DOCKER_ENV
 * - Helper configuration: postgresImage and keycloakImage are set
 * - Keycloak version consistency: Dockerfile FROM lines and docker-compose.yml image tags match keycloakImage version
 * - Realm templates: Required Keycloak template files exist in deployment package
 *
 * @param {PreDownHookContext} context
 */
module.exports = async function (context) {
  const { logger, env, helpers, deploymentConfig, localZip } = context;

  logger.info('Running pre-deployment smoke tests...');

  // =========================================================================
  // Validate APP_BACKEND_SECRETS (required - used by postgres helper)
  // =========================================================================
  logger.info('Validating APP_BACKEND_SECRETS...');
  helpers.postgres.validation.validateBackendSecretsOrThrow(
    env.APP_BACKEND_SECRETS
  );

  // =========================================================================
  // Validate APP_KEYCLOAK_SECRETS (required - used by realm merge)
  // =========================================================================
  logger.info('Validating APP_KEYCLOAK_SECRETS...');
  helpers.keycloak.validateKeycloakSecretsOrThrow(env.APP_KEYCLOAK_SECRETS);

  // =========================================================================
  // Validate Keycloak DB config (always required - Keycloak needs DB connection)
  // =========================================================================
  logger.info('Validating Keycloak DB configuration...');
  helpers.postgres.validation.validateKeycloakDbFromDockerEnvOrThrow(
    env.DEPLOY_DOCKER_ENV
  );

  // =========================================================================
  // Validate Keycloak admin credentials (required for realm migration)
  // =========================================================================
  logger.info('Validating Keycloak admin credentials...');
  helpers.keycloak.validateAdminCredentialsOrThrow(env.DEPLOY_DOCKER_ENV);

  // =========================================================================
  // Validate domain consistency
  // =========================================================================
  logger.info('Validating domain consistency...');
  validateDomainConsistency(env);
  logger.info('Domain consistency validation passed');

  // =========================================================================
  // Validate helper configuration (prevents cryptic proxy errors)
  // =========================================================================
  logger.info('Validating helper configuration...');
  helpers.postgres.validation.validatePostgresImageConfigured(deploymentConfig);
  helpers.keycloak.validateKeycloakImageConfigured(deploymentConfig);

  // =========================================================================
  // Validate Keycloak version consistency across config files
  // =========================================================================
  logger.info('Validating Keycloak version consistency...');
  helpers.keycloak.validateKeycloakVersionConsistency(
    localZip,
    deploymentConfig,
    'docker-compose.yml'
  );

  // =========================================================================
  // Validate Keycloak realm templates exist in deployment package
  // =========================================================================
  logger.info('Validating Keycloak realm templates...');
  helpers.keycloak.validateRealmTemplatesExist(localZip);

  // =========================================================================
  // Validate database connectivity (remote databases only)
  // =========================================================================
  // Local databases (containers) don't exist until docker compose up,
  // so we can only test connectivity for remote databases.
  const localDbContainers =
    deploymentConfig.localDatabaseComposeServiceNames ?? [];

  // The connectivity and version checks below run psql via docker ON the
  // target server. On a fresh server docker is not installed yet (the
  // run-server-setup step installs it later in this deploy), so skip them.
  const dockerAvailable =
    context.ssh
      .exec('command -v docker || true', { silent: true })
      .trim().length > 0;
  if (!dockerAvailable) {
    logger.info(
      'Skipping database connectivity and version checks (fresh server, Docker not installed yet)'
    );
    logger.info('All pre-deployment smoke tests passed!');
    return;
  }

  const appDbConfig = helpers.postgres.helper.parseBackendSecrets(
    env.APP_BACKEND_SECRETS
  );
  if (localDbContainers.includes(appDbConfig.host)) {
    logger.info(
      `Skipping App database connectivity test (local container: ${appDbConfig.host})`
    );
  } else {
    logger.info('Testing App database connectivity...');
    await helpers.postgres.validation.testConnectivity(
      helpers.postgres.helper,
      appDbConfig,
      'App database'
    );
  }

  const kcDbConfig = helpers.postgres.helper.parseKeycloakDbFromDockerEnv(
    env.DEPLOY_DOCKER_ENV
  );
  if (localDbContainers.includes(kcDbConfig.host)) {
    logger.info(
      `Skipping Keycloak database connectivity test (local container: ${kcDbConfig.host})`
    );
  } else {
    logger.info('Testing Keycloak database connectivity...');
    await helpers.postgres.validation.testConnectivity(
      helpers.postgres.helper,
      kcDbConfig,
      'Keycloak database'
    );
  }

  // =========================================================================
  // Validate Postgres version compatibility (remote databases only)
  // =========================================================================
  const postgresImage = deploymentConfig.postgresImage;
  if (!postgresImage) {
    logger.warn('postgresImage not configured, skipping version check');
  } else {
    if (localDbContainers.includes(appDbConfig.host)) {
      logger.info(
        `Skipping App database version check (local container: ${appDbConfig.host})`
      );
    } else {
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
        `Skipping Keycloak database version check (local container: ${kcDbConfig.host})`
      );
    } else {
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

  logger.info('All pre-deployment smoke tests passed!');
};
