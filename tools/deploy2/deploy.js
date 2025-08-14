const DeployWorker = require('./deploy-worker.js');

const worker = new DeployWorker();

worker.config.APP_NAME = 'startuphafen';
worker.config.DEPLOY_SERVER = process.env.DEPLOY_SERVER;
worker.config.DEPLOY_TAG = process.env.DEPLOY_TAG;
worker.config.ENVIRONMENT = process.env.ENVIRONMENT;
worker.config.DOCKER_SECRETS = process.env.DEPLOY_DOCKER_ENV;
worker.config.KEYCLOAK_SECRETS = process.env.DEPLOY_KEYCLOAK_SECRETS;
worker.config.BACKEND_SECRETS = process.env.DEPLOY_BACKEND_SECRETS;
worker.config.CONFIG_SECRETS = process.env.DEPLOY_CONFIG_SECRETS;
worker.config.STATEFUL_BACKEND_SECRETS =
  process.env.DEPLOY_STATEFUL_BACKEND_SECRETS ?? '{}';
worker.config.USE_REMOTE_DATABASE = process.env.ENVIRONMENT !== 'staging';
worker.config.LOCAL_DATABASE_YML_FILE = 'docker-compose-db.yml';

worker.smokeTest();

worker.deploy();
