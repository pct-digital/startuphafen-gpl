const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function buildArgumentFromList(list) {
  return list.map((x) => "'" + x.join('=') + "'").join(' ');
}

/**
 * This class does not directly implement a single "deploy()" function.
 * Instead it provides a set of functions that can be called in order to deploy a new version of the app.
 *
 * "Convention over configuration", here are the conventions you must follow or that will decide where stuff is:
 * - The deployed package ZIPs include just one folder which is named after the version itself. There is a smoke test for this
 * - The deployement happens in DEPLOY_ROOT/APP_NAME (see config values below)
 * - Log files by the servers are created in DEPLOY_ROOT/APP_NAME/logs
 * - There must be a file called staging.sh and prodution.sh in the backend assets folder which include docker compose commands that list the files to be used in that environment
 * - There must be a file called server-setup.sh in the backend assets folder which sets up the server, e.g. installs docker, docker-compose, etc. Make sure to use exactly a copy of this one apps/rnx-backend/src/assets/server-setup.sh
 * - The server marks that it had the init completed via the file DEPLOY_ROOT/APP_NAME/server-init-marker
 * - There must be a maintenance.sh file in this location `apps/rnx-backend/src/assets/maintenance.sh`
 * - There must be the file `apps/rnx-backend/src/assets/docker-maintenance.yml`
 * - There must be the maintenance page configuration located in `apps/rnx-backend/src/assets/nginx/maintenance`
 * - There must be a file called `initsecrets.js` located in `apps/rnx-backend/src/assets/initsecrets.js`.
 * - The initsecrets.js file must be the version from this repo, which is independent of the project name, unlike previous versions you may find elsewhere
 * - initsecrets.js assumes you have a keycloak realm.json template file in `<backend assets path>/keycloak/templates/realm.json`
 * - keycloak template file means it can include ${{APP_HOST}} or similar to include environment variables specified in the github environment DEPLOY_DOCKER_ENV file
 * - There must also be two additional keycloak realm files in <backend assets path>/keycloak/templates/staging.json and <backend assets path>/keycloak/templates/production.json
 * - These can be used overwrite keycloak configs for the respective environments. Most simple case they can include just {}
 * - The project is structure around `apps/rnx-backend` and `apps/rnx-frontend` folders. "rnx" is here the APP_NAME
 * - There must be the userimport.js script in `apps/APP_NAME-backend/src/assets/userimport.js`. The version in this repository has been modified to be independent of the project name.
 * - The keycloak database user must be called "keycloak", the database must be called "keycloak"
 *
 * The github deployment environment must have the following secrets:
 * - DEPLOY_SSH_PRIVATE_KEY the SSH private key to connect to the deployment server
 *
 * The github deployment environment must have the following variables:
 * - DEPLOY_BACKEND_SECRETS the backend secrets json file content which will overwrite the backend config values. Json content.
 * - DEPLOY_DOCKER_ENV the docker secret environment variables file content. Environment file content.
 * - DEPLOY_KEYCLOAK_SECRETS the keycloak secrets config which will be merged on top of all the other keycloak config. Json content.
 * - DEPLOY_SERVER the hostname of the server on which the deploy happens. Must be reachable via SSH.
 * - ENVIRONMENT set to staging or production to select which environment to deploy
 *
 * See the file apps/rnx-backend/src/assets/docker-compose-staging.yml it includes a lot of important things:
 * - the service serverfluent for logging. Used in all "logging" configuration of the other services
 * - the service nginx
 * - the service maildev
 * - the service backend
 * - the service database
 * - the service keycloak-database
 * - the service keycloak
 */
class DeployWorker {
  // values that likely do not need any changes but could be changed, maybe

  DEPLOY_ROOT = '/opt';
  ACTIVE_LINK_NAME = 'active';
  SERVER_INIT_MARKER_NAME = 'server-init-marker';
  NODE_IMAGE = 'node:22.12.0-bookworm';
  POSTGRES_IMAGE = 'postgres:15';
  KEYCLOAK_IMAGE = 'quay.io/keycloak/keycloak:26.1.0';
  SSH_USER = 'root';
  SSH_PORT = 22;
  SERVER_INIT_MARKER_NAME = 'server-init-marker';
  DOCKER_NETWORK = 'assets_local';
  // these must match the volumes used in the the docker compose file LOCAL_DATABASE_YML_FILE
  LOCAL_DATABASE_VOLUMES = ['pgdata', 'kcpgdata'];

  LOCK_FILE = '/tmp/deploy.lock';

  /** values that need to be provided for this to work */
  config = {
    /**
     * Name of the app, such as "rnx". Must be part of the backend folder name:
     * "rnx-backend", the -backend part is by convention and fixed.
     */
    APP_NAME: null,

    /**
     * Hostname of the server on which the deploy happens.
     * Must be reachable via SSH.
     * Will also be the host on which the app then is running.
     * E.g. rnx-staging.pct-digital.de
     */
    DEPLOY_SERVER: null,

    /**
     * Tag to be deployed, e.g. "25.0211.1138_rnx"
     */
    DEPLOY_TAG: null,

    /**
     * Set to staging or production
     */
    ENVIRONMENT: null,

    /**
     * The backend secrets json file content which will overwrite the backend config values
     */
    BACKEND_SECRETS: null,

    /**
     * The statful-backend secrets json file content which will overwrite the backend config values
     */
    STATEFUL_BACKEND_SECRETS: null,

    /**
     * The docker secret environment variables file content
     */
    DOCKER_SECRETS: null,

    /**
     * The keycloak secrets config which will be merged on top of all the other keycloak config
     */
    KEYCLOAK_SECRETS: null,

    /**
     * The secrets file for keys to external services, which cant be checked in to the repo and is gitignored
     */
    CONFIG_SECRETS: null,

    /**
     * Set to true or false.
     * If true the deploy assumes the database is not part of the docker compose configuration of the app.
     * This means the database is managed & hosted somewhere else and the app & keycloak just connect to it.
     * The deploy script will detect the database configuration of the backend & the keycloak server and use the access data to guarantee the database has been setup. (create database app & create database kc typically)
     *
     * If false the deploy assumes the database is part of the docker compose configuration.
     * This means:
     * - the file defined in LOCAL_DATABASE_YML_FILE must exist
     * - that file needs to define a "database" service and a "keycloak-database" service which are used for the databases and those services must used docker volumes created during server setup for permanent data, with those docker volumes configured via LOCAL_DATABASE_VOLUMES
     * - The "keycloak-database" will be started & stopped during the deploy-process to be able to run a temporary keycloak instance for the user-reimport
     */
    USE_REMOTE_DATABASE: null,

    /**
     * File used for case USE_REMOTE_DATABASE = false
     */
    LOCAL_DATABASE_YML_FILE: 'docker-compose-db.yml',
  };

  // _ stuff is private and should not be changed from the outside
  _checkedConfigTimestamp = 0;

  /**
   * To use this class, new it up, set the values in .config. and then call this function.
   *
   * Afterwards use the helper function to deploy the app step by step.
   *
   * This performs some smoke tests
   */
  smokeTest() {
    if (!this.config.APP_NAME) {
      throw new Error('APP_NAME must be set');
    }
    if (!this.config.DEPLOY_SERVER) {
      throw new Error('DEPLOY_SERVER must be set');
    }
    if (!this.config.DEPLOY_TAG) {
      throw new Error('DEPLOY_TAG must be set');
    }
    if (
      this.config.ENVIRONMENT !== 'staging' &&
      this.config.ENVIRONMENT !== 'production'
    ) {
      throw new Error(
        'ENVIRONMENT must be set to either staging or production'
      );
    }
    if (!this.config.BACKEND_SECRETS) {
      throw new Error('BACKEND_SECRETS must be set');
    }
    if (!this.config.STATEFUL_BACKEND_SECRETS) {
      throw new Error('STATEFUL_BACKEND_SECRETS must be set');
    }
    if (!this.config.DOCKER_SECRETS) {
      throw new Error('DOCKER_SECRETS must be set');
    }
    if (!this.config.KEYCLOAK_SECRETS) {
      throw new Error('KEYCLOAK_SECRETS must be set');
    }
    if (!this.config.CONFIG_SECRETS) {
      throw new Error('CONFIG_SECRETS must be set');
    }

    // Validate USE_REMOTE_DATABASE is explicitly set to boolean
    if (typeof this.config.USE_REMOTE_DATABASE !== 'boolean') {
      throw new Error(
        'USE_REMOTE_DATABASE must be explicitly set to true or false (boolean)'
      );
    }

    // Validate APP_NAME format (used in paths and container names)
    this._validateAppName();

    // Validate DEPLOY_TAG format (used in paths and filenames)
    this._validateDeployTag();

    // Validate BACKEND_SECRETS structure
    this._validateBackendSecrets();

    // Validate STATEFUL_BACKEND_SECRETS is valid JSON
    this._validateStatefulBackendSecrets();

    // Validate KEYCLOAK_SECRETS is valid JSON
    this._validateKeycloakSecrets();

    // Validate DOCKER_SECRETS structure
    this._validateDockerSecrets();

    // Validate local database configuration if not using remote database
    if (!this.config.USE_REMOTE_DATABASE) {
      this._validateLocalDatabaseConfig();
    }

    this._validateZipStructure();

    this._uninitializedServerHasNoAppDirectory();

    // Additional smoke tests
    this._testSshConnectivity();

    this._validateUbuntuSystem();

    this._checkAndInstallSystemUtilities();

    this._testDatabaseConnectivity();

    this._checkDiskSpace();

    this._validateRequiredFilesInZip();

    // TODO there should be more here?!

    // - for app configurations: are all configured 3rd party servers reachable? etc
    // - for deployements: is the app online?
    // Use smoke test results to reject deployments or even automatically roll back to the previous version?

    // There probably should be a system for these tests to be supplied as scripts by the deployed package, so the knowleged of "what is in the app configuration" is not hardcoded here.

    this._checkedConfigTimestamp = Date.now();
  }

  /**
   * The standard deploy function
   */
  deploy() {
    this._checkConfigDone();

    const lockValue = this._aquireDeploymentLock();

    try {
      // TODO there might be merit in having a try catch around this with a plan on how to recover and start the old version again
      // need to consider what the single steps do and how they may be recovered from
      // most noteable I think all the keycloak stuff should work on a temporary database which is exported from and then imported into the real keycloak database
      // that way it won't do anything until the last moment and is easily reverted
      // two challenges prevent me from doing this now, due to time constraints:
      // - what to do if the same version is redeployed, that means the folder that contains the running app will need to be deleted...
      // - how to actually do the keycloak database backup & recover stuff

      // make sure the logs folder exists
      this._runRemote(`mkdir -p ${this._getAppPath()}/logs`);

      // noop if the server is not initialized
      this._log('Stopping server!');
      this.stopServer();

      this.unlink();

      this._log('Copy deployment file!');
      this.copyDeploymentFile();

      this._log('Check for server init');
      // This uses files copied over by copyDeploymentFile, which is why it happens after the previous steps
      this.initServer();

      this._log('Init secrets!');
      // requires some of the stuff from initServer, so it only happens after it
      this.initSecrets();

      // this is a bit late, but it needs initSecrets. Would need to complicate the earlier steps to avoid that.
      // So 30 to 40 seconds no maintenance page will be shown, but that is probably fine.
      this.showMaintenancePage();

      this._log('Init databases!');
      this.initDatabases();

      const RESET_KEYCLOAK = process.env.RESET_KEYCLOAK === 'DELETE_USERS';

      this._log('Reset keycloak: ' + RESET_KEYCLOAK);

      if (!RESET_KEYCLOAK) {
        this._log('Export keycloak users!');
        this.exportKeycloakUsers();

        this._log('Create keycloak backup!');
        this.backupKeycloakDatabase();
      }

      this._log('Import keycloak realm!');
      this.importKeycloakRealm();

      if (!RESET_KEYCLOAK) {
        try {
          this._log('Import keycloak users!');
          this.importKeycloakUsers();
        } catch (e) {
          this._log('Re-Import of keycloak users failed', e.message);

          this._log('Trying to restore keycloak via backup');
          this.restoreKeycloakViaBackup();

          this._log('Trying to restart the previously linked version');
          this.startServer();

          this._log(
            'Keycloak successfully restored & previously linked version was restarted. Double check system status!'
          );

          throw e;
        }
      }

      this.stopMaintenancePage();

      this.link();
      this.startServer();
    } finally {
      this._releaseDeploymentLock(lockValue);
    }
  }

  showMaintenancePage() {
    this._checkConfigDone();

    this._log('Show maintenance page');
    this._runRemote(
      `cd ${this._getTagBackendAssetsPath()} && bash maintenance.sh up -d`
    );
  }

  stopMaintenancePage() {
    this._checkConfigDone();

    this._log('Stop maintenance page');
    this._runRemote(
      `cd ${this._getTagBackendAssetsPath()} && bash maintenance.sh down`
    );
  }

  /**
   * Removes the old link if there is one and deletes old deployment files
   */
  unlink() {
    this._checkConfigDone();
    const target = this._findCurrentLinkTarget();
    if (target != null) {
      this._runRemote(`rm ${this._getActiveLinkPath()}`);
      this._runRemote(`rm ${path.join(this._getAppPath(), target)} -rf`);
    }
  }

  link() {
    this._checkConfigDone();
    this._runRemote(
      `cd ${this._getAppPath()} && ln -s ${this.config.DEPLOY_TAG} ${
        this.ACTIVE_LINK_NAME
      }`
    );
  }

  /**
   * Copies over the release ZIP and unpacks it, deletes the zip folder afterwards
   * If the unpacked content already exists it will be replaced, just in case it was somehow corrupted.
   */
  copyDeploymentFile() {
    this._checkConfigDone();

    const remoteZipLocation = path.join(
      this._getAppPath(),
      this.config.DEPLOY_TAG + '.zip'
    );

    this._runRemote("mkdir -p '" + this._getAppPath() + "'");
    this._copyFileToRemote(this.config.DEPLOY_TAG + '.zip', remoteZipLocation);
    this._runRemote(
      `rm -rf ${path.join(this._getAppPath(), this.config.DEPLOY_TAG)}`
    );
    this._runRemote(
      `cd ${this._getAppPath()} && unzip ${
        this.config.DEPLOY_TAG
      }.zip > /dev/null`
    );
    this._runRemote(`rm -rf ${remoteZipLocation}`);
  }

  /**
   * Modifies the deployment files by adding the secrets to them, by a call to initsecrets.js in the backend assets.
   * No dependency to the previous keycloak instance/database anymore, that is done later.
   */
  initSecrets() {
    this._checkConfigDone();

    let bsecrets = '';
    let esecrets = '';
    let ksecrets = '';
    let sbsecrets = '';
    let csecrets = '';

    try {
      bsecrets = this._createFileFromCIVar(
        'backend_secrets.json',
        this.config.BACKEND_SECRETS ?? '{}'
      );
      sbsecrets = this._createFileFromCIVar(
        'stateful-backend_secrets.json',
        this.config.STATEFUL_BACKEND_SECRETS ?? '{}'
      );
      esecrets = this._createFileFromCIVar(
        'env_secrets',
        this.config.DOCKER_SECRETS ?? ''
      );
      ksecrets = this._createFileFromCIVar(
        'keycloak_secrets.json',
        this.config.KEYCLOAK_SECRETS
      );
      csecrets = this._createFileFromCIVar(
        'config_secrets.json',
        this.config.CONFIG_SECRETS
      );

      const initArguments =
        buildArgumentFromList([
          ['backend', bsecrets],
          ['stateful-backend', sbsecrets],
          ['docker', esecrets],
          ['keycloak', ksecrets],
          ['config', csecrets],
        ]) +
        ' ' +
        this.config.ENVIRONMENT;

      const scriptPath = path.join(
        this._getTagBackendAssetsPath(),
        'initsecrets.js'
      );

      this._runRemote(
        `docker run --rm -v ${this._getAppPath()}:${this._getAppPath()} ${
          this.NODE_IMAGE
        } node ${scriptPath} ${initArguments}`
      );
    } finally {
      this._runRemote(`rm -f ${bsecrets} ${esecrets} ${ksecrets} ${csecrets}`);
    }
  }

  _keycloakUsersDir = null;

  exportKeycloakUsers() {
    this._checkConfigDone();

    this._keycloakUsersDir = path.join(
      this._getAppPath(),
      'keycloak-exported-users'
    );

    this._log('Exporting keycloak users to ' + this._keycloakUsersDir);
    this._runRemote('rm ' + this._keycloakUsersDir + ' -rf');
    this._runRemote('mkdir -p ' + this._keycloakUsersDir);
    this._runRemote(`chmod -R 777 ${this._keycloakUsersDir}`);

    this._workWithKeycloakDatabase(() => {
      this._runKeycloakCommand(
        this._getAppPath(),
        `export --realm ${this.config.APP_NAME} --dir ${this._keycloakUsersDir}`
      );
    });

    this._runRemote(`chmod -R 755 ${this._keycloakUsersDir}`);
  }

  backupKeycloakDatabase() {
    this._checkConfigDone();

    this._workWithKeycloakDatabase(() => {
      // make a backup of the keycloak database, just in case things go south we need to be able to rollback to save the data
      const backupFile = this._getKeycloakBackupFile();

      const url = this._getKeycloakDatabaseUrl();

      this._runKeycloakDatabaseCommand(`pg_dump ${url} > ${backupFile}`);

      this._log('Backup of keycloak data was completed to ' + backupFile);
    });
  }

  restoreKeycloakViaBackup() {
    this._checkConfigDone();

    this._workWithKeycloakDatabase(() => {
      const backupFile = this._getKeycloakBackupFile();
      const url = this._getKeycloakDatabaseUrl();

      this._runKeycloakDatabaseCommand(
        `psql ${url} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"`
      );
      this._runKeycloakDatabaseCommand(`psql ${url} -f ${backupFile}`);
    });
  }

  importKeycloakRealm() {
    this._checkConfigDone();

    this._workWithKeycloakDatabase(() => {
      const realmDir = path.join(
        this._getTagBackendAssetsPath(),
        'keycloak',
        'import'
      );
      this._runKeycloakCommand(
        realmDir,
        `import --file ${realmDir}/realm.json`
      );
    });
  }

  importKeycloakUsers() {
    this._checkConfigDone();

    if (this._keycloakUsersDir == null) {
      throw new Error(
        'You must first export keycloak users using exportKeycloakUsers() before you can import them. That should be done before a call to importKeycloakRealm()'
      );
    }

    this._log(
      "Importing keycloak users, the files are in '" +
        this._keycloakUsersDir +
        "'"
    );

    this._workWithKeycloakDatabase(() => {
      this._runApiKeycloakForCallback(() => {
        const admin_username = this._getDockerVarNoDefault(
          'KC_BOOTSTRAP_ADMIN_USERNAME='
        )
          .split('=')[1]
          .trim();
        const admin_password = this._getDockerVarNoDefault(
          'KC_BOOTSTRAP_ADMIN_PASSWORD='
        )
          .split('=')[1]
          .trim();

        const setRealmSslRequired = (val) => {
          this._log('Trying to set ssl required for API acccess to ' + val);

          this._runRemote(
            'docker exec keycloak-import /bin/sh -c "/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user ' +
              admin_username +
              ' --password ' +
              admin_password +
              ` && /opt/keycloak/bin/kcadm.sh update realms/${this.config.APP_NAME} -s sslRequired=${val}` +
              ` && /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=${val}` +
              '"'
          );
        };

        setRealmSslRequired('NONE');

        this._log('Begin import via userimport.js!');

        const importVariables = buildArgumentFromList([
          ['user_directory', this._keycloakUsersDir],
          ['admin_username', admin_username],
          ['admin_password', admin_password],
          ['host', 'http://127.0.0.1:8080'],
          ['realm_name', this.config.APP_NAME],
        ]);

        const userImportCommand = `docker run --network=host --rm -v ${this._getAppPath()}:${this._getAppPath()} ${
          this.NODE_IMAGE
        } node ${this._getTagBackendAssetsPath()}/userimport.js ${importVariables}`;
        this._runRemote(userImportCommand);

        setRealmSslRequired('EXTERNAL');

        this._runRemote('rm ' + this._keycloakUsersDir + ' -rf');
      });
    });
  }

  /**
   * Stops the server, if there is a server running.
   *
   * Noop if there is no active link (= no server files have been deployed so far)
   */
  stopServer() {
    this._checkConfigDone();

    const target = this._findCurrentLinkTarget();

    if (target != null) {
      this._runInBackendAssets(`bash ${this.config.ENVIRONMENT}.sh down`);
    }
  }

  /**
   * Starts the server.
   *
   * If there is no active link will throw an error.
   */
  startServer() {
    this._checkConfigDone();

    const target = this._findCurrentLinkTarget();

    if (target == null) {
      throw new Error('You cannot start the server without an active link');
    }

    this._runInBackendAssets(`bash ${this.config.ENVIRONMENT}.sh up -d`);
  }

  initServer() {
    this._checkConfigDone();

    const hasInit = this._determineHasServerInit();
    if (!hasInit) {
      console.log(
        'The server does not seem to be initialized yet, running server-setup! There must be a server-setup.sh script in the backend assets!'
      );
      this._runRemote(
        `cd ${this._getTagBackendAssetsPath()} && bash server-setup.sh ${
          this.config.DEPLOY_SERVER
        }`
      );
      this._runRemote(`touch ${this._getInitMarkerPath()}`);
      console.log('Server was initialized!');

      // Run Docker-dependent smoke tests now that Docker is available
      this._runPostInitSmokeTests();
    }

    return hasInit;
  }

  initDatabases() {
    this._checkConfigDone();

    if (this.config.USE_REMOTE_DATABASE) {
      this._log('Initializing remote databases');

      // Initialize app database from BACKEND_SECRETS
      const backendSecrets = JSON.parse(this.config.BACKEND_SECRETS);
      const appDbConfig = backendSecrets.knex.connection;
      const appDbPort = appDbConfig.port || 5432;

      if (
        !this._doesDatabaseExist(
          appDbConfig.host,
          appDbConfig.user,
          appDbConfig.password,
          appDbConfig.database,
          appDbPort
        )
      ) {
        this._log(`Creating app database: ${appDbConfig.database}`);
        this._createDatabase(
          appDbConfig.host,
          appDbConfig.user,
          appDbConfig.password,
          appDbConfig.database,
          appDbPort
        );
      } else {
        this._log(`App database already exists: ${appDbConfig.database}`);
      }

      // Initialize Keycloak database from DOCKER_SECRETS
      const kcDbUrl = this._getDockerVarNoDefault('KC_DB_URL=')
        .split('=')[1]
        .trim();
      const kcDbUser = this._getDockerVarNoDefault('KC_DB_USERNAME=')
        .split('=')[1]
        .trim();
      const kcDbPassword = this._getDockerVarNoDefault('KC_DB_PASSWORD=')
        .split('=')[1]
        .trim();

      // Parse JDBC URL: jdbc:postgresql://host:port/database
      const urlMatch = kcDbUrl.match(/jdbc:postgresql:\/\/([^:]+):(\d+)\/(.+)/);
      if (!urlMatch) {
        throw new Error(`Invalid KC_DB_URL format: ${kcDbUrl}`);
      }

      const kcHost = urlMatch[1];
      const kcPort = parseInt(urlMatch[2], 10);
      const kcDatabase = urlMatch[3];

      if (
        !this._doesDatabaseExist(
          kcHost,
          kcDbUser,
          kcDbPassword,
          kcDatabase,
          kcPort
        )
      ) {
        this._log(`Creating Keycloak database: ${kcDatabase}`);
        this._createDatabase(
          kcHost,
          kcDbUser,
          kcDbPassword,
          kcDatabase,
          kcPort
        );
      } else {
        this._log(`Keycloak database already exists: ${kcDatabase}`);
      }
    } else {
      this._log('Initializing local database volumes');

      // Create Docker volumes for local database persistence
      for (const volume of this.LOCAL_DATABASE_VOLUMES) {
        if (!this._doesDockerVolumeExist(volume)) {
          this._log(`Creating Docker volume: ${volume}`);
          this._createDockerVolume(volume);
        } else {
          this._log(`Docker volume already exists: ${volume}`);
        }
      }
    }
  }

  // private "_" stuff should not be called from the outside

  _getDockerVarNoDefault(varPrefix) {
    const val = this.config.DOCKER_SECRETS.replaceAll('\r', '')
      .split('\n')
      .find((x) => x.startsWith(varPrefix));
    if (!val) {
      throw new Error(varPrefix + ' not found in DOCKER_SECRETS');
    }
    return val;
  }

  _getDockerVarWithDefault(varPrefix, def) {
    return (
      this.config.DOCKER_SECRETS.replaceAll('\r', '')
        .split('\n')
        .find((x) => x.startsWith(varPrefix)) ?? def
    );
  }

  _log(...msgs) {
    console.log(
      '================================================================================='
    );
    console.log(
      '================================================================================='
    );
    console.log(
      '================================================================================='
    );
    const dt = Math.round((Date.now() - this._checkedConfigTimestamp) / 1000);
    console.log('[' + dt + ']', ...msgs);
    console.log(
      '================================================================================='
    );
    console.log(
      '================================================================================='
    );
    console.log(
      '================================================================================='
    );
  }

  /**
   * Check if a PostgreSQL database exists using Docker
   */
  _doesDatabaseExist(host, user, password, database, port = 5432) {
    try {
      const connectionString = `postgresql://${user}:${password}@${host}:${port}/postgres`;
      const checkCommand = `docker run --rm ${this.POSTGRES_IMAGE} psql "${connectionString}" -t -c "SELECT 1 FROM pg_database WHERE datname='${database}'"`;

      const result = this._runRemote(checkCommand);
      this._log(`Database ${database} check result: ` + result);
      return result.trim() === '1';
    } catch (e) {
      // If the command fails, assume database doesn't exist or connection failed
      this._log(`Error checking database existence: ${e.message}`, e);
      return false;
    }
  }

  /**
   * Create a PostgreSQL database using Docker
   */
  _createDatabase(host, user, password, database, port = 5432) {
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/postgres`;
    const createCommand = `docker run --rm ${this.POSTGRES_IMAGE} psql "${connectionString}" -c "CREATE DATABASE \\"${database}\\""`;

    this._runRemote(createCommand);
    this._log(`Successfully created database: ${database}`);
  }

  /**
   * Check if a Docker volume exists using Docker
   */
  _doesDockerVolumeExist(volumeName) {
    try {
      const checkCommand = `docker volume inspect ${volumeName}`;
      this._runRemote(checkCommand);
      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // If the command fails, assume volume doesn't exist
      return false;
    }
  }

  /**
   * Create a Docker volume using Docker
   */
  _createDockerVolume(volumeName) {
    const createCommand = `docker volume create ${volumeName}`;
    this._runRemote(createCommand);
    this._log(`Successfully created Docker volume: ${volumeName}`);
  }

  /**
   * Create a remote file based on the content of a local CI variable.
   */
  _createFileFromCIVar(fname, fvar) {
    if (fname == null || fname.length === 0)
      throw new Error('bad arguments for _createFileFromCIVar: ' + fname);

    fs.writeFileSync(fname, fvar);
    console.log(
      'Wrote CI var file ' + fname + ' with ' + fvar.length + ' bytes'
    );
    try {
      const remotePath = path.join(this._getAppPath(), fname);
      this._runRemote('rm -f ' + remotePath);
      this._copyFileToRemote(fname, remotePath);

      console.log(
        'Copied CI var file ' + fname + ' to remove location ' + remotePath
      );

      return remotePath;
    } finally {
      fs.unlinkSync(fname);
    }
  }

  _checkConfigDone() {
    if (this._checkedConfigTimestamp === 0) {
      throw new Error(
        'Config must be checked before usage of the deploy worker'
      );
    }
  }

  _getAppPath() {
    return path.join(this.DEPLOY_ROOT, this.config.APP_NAME);
  }

  _getActiveLinkPath() {
    return path.join(this._getAppPath(), this.ACTIVE_LINK_NAME);
  }

  _findCurrentLinkTarget() {
    try {
      return this._runRemote(`readlink ${this._getActiveLinkPath()}`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return null;
    }
  }

  _getBackendAssetsPath() {
    return path.join(
      this._getActiveLinkPath(),
      'apps',
      this.config.APP_NAME + '-backend',
      'assets'
    );
  }

  _runInBackendAssets(cmd) {
    this._runRemote(`cd ${this._getBackendAssetsPath()} && ${cmd}`);
  }

  _aquireDeploymentLock() {
    let fails = 0;

    // Use set -C (noclobber) to atomically create the lock file
    // This will fail if the file already exists, ensuring only one process can acquire the lock
    while (true) {
      try {
        this._runRemote(
          `(set -C; echo '${this.config.DEPLOY_TAG}' > ${this.LOCK_FILE}) 2>/dev/null`
        );
        this._log('Deployment lock acquired successfully');

        return this.config.DEPLOY_TAG;
      } catch (e) {
        // Check if lock file exists and get the deploy tag
        try {
          const lockDeployTag = this._runRemote(
            `cat ${this.LOCK_FILE}`,
            true
          ).trim();

          // Compare the deploy tags to see which is newer
          if (this._isDeployTagNewer(lockDeployTag, this.config.DEPLOY_TAG)) {
            throw new Error(
              `A newer version (${lockDeployTag}) has been deployed in the meantime. Current deployment (${this.config.DEPLOY_TAG}) is older and will be aborted.`
            );
          }

          this._log(
            `Deployment is already in progress with tag: ${lockDeployTag}. Waiting 5 seconds before retry...`
          );

          // Wait before retrying
          this._sleep(3000 + Math.random() * 3000);
        } catch (innerE) {
          if (innerE.message.includes('newer version')) {
            throw innerE; // Re-throw the newer version error
          }
          fails++;
          if (fails < 3) {
            continue; // try a few more times, could just be unlucky timing with cat
          }
          throw new Error(
            `Failed to acquire deployment lock: ${e.message}. Additional error: ${innerE.message}`
          );
        }
      }
    }
  }

  _releaseDeploymentLock(expectedDeployTag) {
    try {
      // Read the current deploy tag from the lock file
      const currentDeployTag = this._runRemote(`cat ${this.LOCK_FILE}`, true);

      // Only remove the lock if the deploy tag matches what we expect
      if (currentDeployTag.trim() === expectedDeployTag) {
        this._runRemote('rm ' + this.LOCK_FILE);
        this._log('Deployment lock released successfully');
      } else {
        this._log(
          `Warning: Lock deploy tag mismatch. Expected: ${expectedDeployTag}, Found: ${currentDeployTag.trim()}. Lock not released.`
        );
      }
    } catch (e) {
      this._log(`Warning: Could not release deployment lock: ${e.message}`);
    }
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  _sleep(ms) {
    execSync(`sleep ${Math.round(ms / 1000)}`, { stdio: 'pipe' });
  }

  /**
   * Parse a deploy tag and return a comparable timestamp
   * Format: YY.MMDD.HHMM.SSFFF or YY.MMDD.HHMM_name (legacy)
   * Example: 25.0617.1430.15123 or 25.0617.1430-rnx
   *
   * FFF is actually not used anymore, so the current format is YY.MMDD.HHMM.SS
   */
  _parseDeployTag(deployTag) {
    const timePart = deployTag.split('_')[0];
    const parts = timePart.split('.');

    // Handle both new format (4 parts) and legacy format (3 parts)
    const [year, mmdd, hhmm, ssfff] = parts;

    const month = mmdd.substring(0, 2);
    const day = mmdd.substring(2, 4);

    const hour = hhmm.substring(0, 2);
    const minute = hhmm.substring(2, 4);

    // Convert 2-digit year to 4-digit year (assuming 20xx)
    const fullYear = 2000 + parseInt(year, 10);

    // Handle seconds and milliseconds if present (new format)
    let seconds = 0;
    let milliseconds = 0;

    if (ssfff && ssfff.length >= 2) {
      seconds = parseInt(ssfff.substring(0, 2), 10);
      if (ssfff.length >= 5) {
        milliseconds = parseInt(ssfff.substring(2, 5), 10);
      }
    }

    // Create a Date object for comparison
    return new Date(
      fullYear,
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      seconds,
      milliseconds
    );
  }

  /**
   * Compare two deploy tags and return true if tag1 is newer than tag2
   */
  _isDeployTagNewer(tag1, tag2) {
    try {
      const date1 = this._parseDeployTag(tag1);
      const date2 = this._parseDeployTag(tag2);
      return date1 > date2;
    } catch (e) {
      this._log(
        `Warning: Could not parse deploy tags for comparison (${tag1}, ${tag2}): ${e.message}`
      );
      // If we can't parse the tags, assume tag1 is not newer to be safe
      return false;
    }
  }

  _runRemote(cmd, silent = false) {
    // Use base64 encoding to avoid all shell quoting issues
    const encodedCmd = Buffer.from(cmd).toString('base64');
    const sshCommand = `ssh ${this.SSH_USER}@${this.config.DEPLOY_SERVER} -p ${this.SSH_PORT} "echo '${encodedCmd}' | base64 -d | bash 2>&1"`;

    // Custom logging similar to _execCmd but showing the actual command
    if (!silent) console.log('>', cmd);

    try {
      const result = execSync(sshCommand).toString().trim();
      if (!silent)
        console.log(
          '<' + (result.includes('\n') ? '\n' : ''),
          result !== '' ? result : '< No output >'
        );
      return result;
    } catch (e) {
      const stdBuff = e.stdout;
      let stdMsg = '';
      let errMsg = '';
      if (stdBuff != null) {
        stdMsg = `Command ${cmd} stdout ${stdBuff.toString()}`;
      }
      const stdErr = e.stderr;
      if (stdErr != null) {
        errMsg = `Command ${cmd} stderr ${stdErr.toString()}`;
      }
      const msg =
        e.message +
        '\n' +
        stdMsg +
        '\n' +
        errMsg +
        '\n' +
        `Base64 encoded command: ${encodedCmd}`;
      if (!silent) console.log('<! ' + msg);
      throw e;
    }
  }

  _execCmd(e, silent = false) {
    if (!silent) console.log('>', e);
    try {
      const result = execSync(e).toString().trim();
      if (!silent)
        console.log(
          '<' + (result.includes('\n') ? '\n' : ''),
          result !== '' ? result : '< No output >'
        );
      return result;
    } catch (e) {
      const stdBuff = e.stdout;
      let stdMsg = '';
      let errMsg = '';
      if (stdBuff != null) {
        stdMsg = `Command ${e} stdout ${stdBuff.toString()}`;
      }
      const stdErr = e.stderr;
      if (stdErr != null) {
        errMsg = `Command ${e} stderr ${stdErr.toString()}`;
      }
      const msg = e.message + '\n' + stdMsg + '\n' + errMsg;
      if (!silent) console.log('<! ' + msg);
      throw e;
    }
  }

  _copyFileToRemote(localPath, remotePath) {
    return this._execCmd(
      `scp -P ${this.SSH_PORT} '${localPath}' '${this.SSH_USER}@${this.config.DEPLOY_SERVER}:${remotePath}'`
    );
  }

  _getInitMarkerPath() {
    return path.join(
      this.DEPLOY_ROOT,
      this.config.APP_NAME,
      this.SERVER_INIT_MARKER_NAME
    );
  }

  _remotePathExists(dpath) {
    try {
      this._runRemote(`ls ${dpath}`);
      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return false;
    }
  }

  _determineHasServerInit() {
    let hasServerInit = false;
    try {
      hasServerInit = this._remotePathExists(this._getInitMarkerPath());
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // init marker does not exist
    }

    return hasServerInit;
  }

  _checkContainerRunning(name) {
    const res = this._runRemote(
      `if [ "$(docker ps -a -q -f name=${name})" ]; then echo "running"; else echo "not running"; fi`
    );
    return res === 'running';
  }

  _waitForContainerStatus(container, upElseDown) {
    for (let i = 0; i < 50; i++) {
      if (this._checkContainerRunning(container) !== upElseDown) {
        if (i % 3 === 0) {
          this._log(
            'Waiting (' +
              i +
              ') for container status running=' +
              upElseDown +
              '...'
          );
        }
      } else {
        break;
      }
    }
  }

  _getTagBackendAssetsPath() {
    return path.join(
      this._getAppPath(),
      this.config.DEPLOY_TAG,
      'apps',
      this.config.APP_NAME + '-backend',
      'assets'
    );
  }

  _runContainer(command, container) {
    if (command !== 'up' && command !== 'down')
      throw new Error(
        "No valid docker command supplied! Valid commands are 'up' and 'down'."
      );

    let files = '-f docker-compose.yml';
    if (
      this.config.ENVIRONMENT === 'staging' ||
      this.config.ENVIRONMENT === 'production'
    )
      files += ' -f docker-compose-staging.yml';
    if (!this.config.USE_REMOTE_DATABASE) {
      files += ' -f ' + this.config.LOCAL_DATABASE_YML_FILE;
    }
    if (this.config.ENVIRONMENT === 'production')
      files += ' -f docker-compose-production.yml';

    const assetsDir = this._getTagBackendAssetsPath();

    if (command === 'up') {
      this._runRemote(
        `cd ${assetsDir} && docker compose ${files} up -d ${container}`
      );
      this._waitForContainerStatus(
        this.config.APP_NAME + '-' + container,
        true
      );

      this._log('Container started!');
    }

    if (command === 'down') {
      this._runRemote(
        `cd ${assetsDir} && docker compose ${files} down ${container}`
      );
      this._waitForContainerStatus(
        this.config.APP_NAME + '-' + container,
        false
      );

      this._log('Container stopped!');
    }
  }

  _workWithKeycloakDatabase(work) {
    if (!this.config.USE_REMOTE_DATABASE) {
      this._runContainer('up', 'keycloak-database');
    }

    try {
      work();
    } finally {
      if (!this.config.USE_REMOTE_DATABASE) {
        this._runContainer('down', 'keycloak-database ');
      }
    }
  }

  _getKeycloakDockerVars() {
    const KEYCLOAK_DOCKER_VARIABLES = [
      // these must be defined in the docker vars
      this._getDockerVarNoDefault('KC_DB_PASSWORD='),
      this._getDockerVarNoDefault('KC_BOOTSTRAP_ADMIN_USERNAME='),
      this._getDockerVarNoDefault('KC_BOOTSTRAP_ADMIN_PASSWORD='),

      // defined by convention, possible to overwrite however
      this._getDockerVarWithDefault('KC_DB=', 'KC_DB=postgres'),
      this._getDockerVarWithDefault(
        'KC_DB_USERNAME=',
        'KC_DB_USERNAME=keycloak'
      ),
      this._getDockerVarWithDefault(
        'KC_DB_URL=',
        'KC_DB_URL=jdbc:postgresql://keycloak-database:5432/keycloak'
      ),
    ]
      .map((x) => '-e ' + x)
      .join(' ');
    return KEYCLOAK_DOCKER_VARIABLES;
  }

  _getKeycloakCommandDockerNetworkArgument() {
    if (this.config.USE_REMOTE_DATABASE) {
      return ''; // for a remote database no need to be in the same docker network as the docker compose based databases
    } else {
      return '--network ' + this.DOCKER_NETWORK; // for t
    }
  }

  _runKeycloakCommand(workDir, command) {
    this._runRemote(
      `docker run --rm ${this._getKeycloakCommandDockerNetworkArgument()} -v ${workDir}:${workDir} ${this._getKeycloakDockerVars()} ${
        this.KEYCLOAK_IMAGE
      } ${command}`
    );
  }

  _runApiKeycloakForCallback(callback) {
    const checkHealth = () => {
      try {
        return (
          this._runRemote(
            `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9000/health`,
            true
          ) === '200'
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        return false;
      }
    };

    try {
      const kenvs = [
        'KC_HEALTH_ENABLED=true',
        'KC_HOSTNAME_STRICT=false',
        'KC_HTTP_ENABLED=true',
        'KC_PROXY=edge',
        'KC_PROXY_HEADERS=xforwarded',
      ];

      this._runRemote(
        `docker run -d --rm ${this._getKeycloakCommandDockerNetworkArgument()} -p 9000:9000 -p 8080:8080 ${kenvs
          .map((x) => '-e ' + x)
          .join(
            ' '
          )}  ${this._getKeycloakDockerVars()} --name keycloak-import ${
          this.KEYCLOAK_IMAGE
        } start-dev`
      );
      for (let i = 1; ; i++) {
        if (!checkHealth()) {
          if (i % 10 === 0) {
            this._log('Waiting (' + i + ') for user import keycloak...');
          }
        } else {
          break;
        }
      }

      this._log('Keycloak started!');

      callback();

      this._log('Callback done!');
    } finally {
      try {
        this._runRemote('docker logs keycloak-import');
      } catch (e) {
        console.log('no docker log', e);
      }

      this._log('Stopping keycloak...');
      try {
        this._runRemote('docker stop keycloak-import');
        this._log('Keycloak stopped!');
      } catch (e) {
        if (!(e.message ?? '').includes('No such container')) {
          this._log(
            'FAILED to stop keycloak-import docker container, you need to go to the server by hand and check what is up with it. They container needs to be stopped!',
            e
          );
          // eslint-disable-next-line no-unsafe-finally
          throw e;
        }
      }
    }
  }

  _getKeycloakBackupFile() {
    return `${this._getAppPath()}/deploy-keycloak-backup.sql`;
  }

  _runKeycloakDatabaseCommand(command) {
    const user = this._getDockerVarWithDefault(
      'KC_DB_USERNAME=',
      'KC_DB_USERNAME=keycloak'
    )
      .split('=')[1]
      .trim();
    const pw = this._getDockerVarNoDefault('KC_DB_PASSWORD=')
      .split('=')[1]
      .trim();

    this._runRemote(
      `docker run --rm ${this._getKeycloakCommandDockerNetworkArgument()} -v ${this._getAppPath()}:${this._getAppPath()} -e PGUSER="${user}" -e PGPASSWORD="${pw}" postgres:15.10-bullseye ${command}`
    );
  }

  _getKeycloakDatabaseUrl() {
    const url = this._getDockerVarWithDefault(
      'KC_DB_URL=',
      'KC_DB_URL=jdbc:postgresql://keycloak-database:5432/keycloak'
    )
      .split('=')[1]
      .replaceAll('jdbc:', '')
      .trim();
    return url;
  }

  /////////////
  // Post-initialization smoke tests (run after Docker is available)
  /////////////

  /**
   * Run smoke tests that require Docker after server initialization
   */
  _runPostInitSmokeTests() {
    this._log('Running post-initialization smoke tests (Docker-dependent)');

    try {
      // Test database connectivity now that Docker is available
      if (this.config.USE_REMOTE_DATABASE) {
        this._testRemoteDatabaseConnectivity();
      }

      this._log('Post-initialization smoke tests completed successfully');
    } catch (e) {
      throw new Error(`Post-initialization smoke tests failed: ${e.message}`);
    }
  }

  /////////////
  // Smoke test validation methods
  /////////////

  _validateAppName() {
    // APP_NAME is used in paths, docker container names, and file names
    // It should be safe for filesystem and docker naming conventions
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(
        this.config.APP_NAME
      )
    ) {
      throw new Error(
        'APP_NAME must contain only alphanumeric characters, dots, hyphens, and underscores, and cannot start or end with special characters'
      );
    }

    if (this.config.APP_NAME.length > 63) {
      throw new Error(
        'APP_NAME must be 63 characters or less (Docker container name limit)'
      );
    }
  }

  _validateDeployTag() {
    // DEPLOY_TAG is used in paths, filenames, and directory names
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(
        this.config.DEPLOY_TAG
      )
    ) {
      throw new Error(
        'DEPLOY_TAG must contain only alphanumeric characters, dots, hyphens, and underscores, and cannot start or end with special characters'
      );
    }

    if (this.config.DEPLOY_TAG.length > 100) {
      throw new Error(
        'DEPLOY_TAG should be reasonably short (under 100 characters)'
      );
    }
  }

  _validateBackendSecrets() {
    let backendSecrets;
    try {
      backendSecrets = JSON.parse(this.config.BACKEND_SECRETS);
    } catch (e) {
      throw new Error('BACKEND_SECRETS must be valid JSON: ' + e.message);
    }

    if (!backendSecrets.knex) {
      throw new Error('BACKEND_SECRETS must contain a "knex" property');
    }

    if (!backendSecrets.knex.connection) {
      throw new Error(
        'BACKEND_SECRETS must contain a "knex.connection" property'
      );
    }

    const connection = backendSecrets.knex.connection;
    const requiredConnectionFields = ['host', 'user', 'password', 'database'];

    for (const field of requiredConnectionFields) {
      if (!connection[field]) {
        throw new Error(
          `BACKEND_SECRETS must contain "knex.connection.${field}" property`
        );
      }
    }

    // Validate port if provided
    if (
      connection.port &&
      (typeof connection.port !== 'number' ||
        connection.port <= 0 ||
        connection.port > 65535)
    ) {
      throw new Error(
        'BACKEND_SECRETS knex.connection.port must be a valid port number (1-65535)'
      );
    }
  }

  _validateStatefulBackendSecrets() {
    try {
      JSON.parse(this.config.STATEFUL_BACKEND_SECRETS);
    } catch (e) {
      throw new Error(
        'STATEFUL_BACKEND_SECRETS must be valid JSON: ' + e.message
      );
    }
  }

  _validateKeycloakSecrets() {
    try {
      JSON.parse(this.config.KEYCLOAK_SECRETS);
    } catch (e) {
      throw new Error('KEYCLOAK_SECRETS must be valid JSON: ' + e.message);
    }
  }

  _validateDockerSecrets() {
    const requiredVars = [
      'KC_DB_PASSWORD=',
      'KC_BOOTSTRAP_ADMIN_USERNAME=',
      'KC_BOOTSTRAP_ADMIN_PASSWORD=',
    ];

    for (const varPrefix of requiredVars) {
      const line = this.config.DOCKER_SECRETS.replaceAll('\r', '')
        .split('\n')
        .find((x) => x.startsWith(varPrefix));

      if (!line) {
        throw new Error(
          `DOCKER_SECRETS must contain "${varPrefix.slice(0, -1)}" variable`
        );
      }

      const value = line.split('=')[1];
      if (!value || value.trim() === '') {
        throw new Error(
          `DOCKER_SECRETS variable "${varPrefix.slice(
            0,
            -1
          )}" must have a non-empty value`
        );
      }
    }

    // Validate KC_DB_URL format if provided (it has a default but might be overridden)
    const kcDbUrlLine = this.config.DOCKER_SECRETS.replaceAll('\r', '')
      .split('\n')
      .find((x) => x.startsWith('KC_DB_URL='));

    if (kcDbUrlLine) {
      const kcDbUrl = kcDbUrlLine.split('=')[1];
      if (kcDbUrl && !kcDbUrl.match(/^jdbc:postgresql:\/\/[^:]+:\d+\/.+$/)) {
        throw new Error(
          'DOCKER_SECRETS KC_DB_URL must be in format: jdbc:postgresql://host:port/database'
        );
      }
    }

    // Validate KC_DB_USERNAME format if provided
    const kcDbUserLine = this.config.DOCKER_SECRETS.replaceAll('\r', '')
      .split('\n')
      .find((x) => x.startsWith('KC_DB_USERNAME='));

    if (kcDbUserLine) {
      const kcDbUser = kcDbUserLine.split('=')[1];
      if (kcDbUser && kcDbUser.trim() === '') {
        throw new Error(
          'DOCKER_SECRETS KC_DB_USERNAME must have a non-empty value if specified'
        );
      }
    }
  }

  _validateLocalDatabaseConfig() {
    if (!this.config.LOCAL_DATABASE_YML_FILE) {
      throw new Error(
        'LOCAL_DATABASE_YML_FILE must be set when USE_REMOTE_DATABASE is false'
      );
    }

    // Validate filename format
    if (!this.config.LOCAL_DATABASE_YML_FILE.endsWith('.yml')) {
      throw new Error('LOCAL_DATABASE_YML_FILE must be a .yml file');
    }

    if (
      !Array.isArray(this.LOCAL_DATABASE_VOLUMES) ||
      this.LOCAL_DATABASE_VOLUMES.length === 0
    ) {
      throw new Error(
        'LOCAL_DATABASE_VOLUMES must be a non-empty array when USE_REMOTE_DATABASE is false'
      );
    }

    // Validate volume names
    for (const volume of this.LOCAL_DATABASE_VOLUMES) {
      if (typeof volume !== 'string' || volume.length === 0) {
        throw new Error(
          'LOCAL_DATABASE_VOLUMES must contain non-empty strings'
        );
      }

      // Docker volume names have specific format requirements
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(volume)) {
        throw new Error(
          `LOCAL_DATABASE_VOLUMES volume name "${volume}" must contain only alphanumeric characters, dots, hyphens, and underscores, and cannot start with a special character`
        );
      }
    }
  }

  /////////////
  // Smoke tests
  /////////////

  _uninitializedServerHasNoAppDirectory() {
    const hasInit = this._determineHasServerInit();
    if (!hasInit) {
      const hasAppDirectory = this._remotePathExists(this._getAppPath());
      if (hasAppDirectory) {
        throw new Error(
          "Server has no init marker but has an app directory, that's weird"
        );
      }
    }
  }

  _validateZipStructure() {
    const zip = this.config.DEPLOY_TAG + '.zip';

    try {
      this._execCmd('ls ' + zip);
    } catch (e) {
      throw new Error(
        'ZIP file ' +
          zip +
          ' appears to exist on the runner that is trying to do the deploy?!',
        e
      );
    }

    const result = this._execCmd(
      `zipinfo -1 ${zip} | grep -m 1 -v "^${this.config.DEPLOY_TAG}/" > /dev/null && echo "bad" || echo "good"`
    );
    if (result === 'bad') {
      throw new Error(
        'ZIP file ' +
          zip +
          ' contains files not in the expected directory structure. It must contain a single directory named after the tag, i.e. the name of the zip without the zip extension.'
      );
    }
  }

  /**
   * Test SSH connectivity to the deployment server
   */
  _testSshConnectivity() {
    this._log('Testing SSH connectivity to deployment server');

    try {
      // Test basic SSH connection with a simple command
      const testResult = this._execCmd(
        `ssh -o ConnectTimeout=10 -o BatchMode=yes ${this.SSH_USER}@${this.config.DEPLOY_SERVER} -p ${this.SSH_PORT} 'echo "SSH_TEST_SUCCESS"'`
      );

      if (!testResult.includes('SSH_TEST_SUCCESS')) {
        throw new Error('SSH test command did not return expected result');
      }

      this._log('SSH connectivity test passed');
    } catch (e) {
      throw new Error(
        `SSH connectivity test failed for ${this.config.DEPLOY_SERVER}: ${e.message}. Please ensure SSH key authentication is properly configured and the server is reachable.`
      );
    }
  }

  /**
   * Validate that the deployment server is running Ubuntu
   */
  _validateUbuntuSystem() {
    this._log('Validating that deployment server is running Ubuntu');

    try {
      // Check if the system is Ubuntu by examining /etc/os-release
      const osReleaseResult = this._runRemote(
        'cat /etc/os-release | grep "^ID=" | cut -d= -f2',
        true
      );

      if (osReleaseResult.trim() !== 'ubuntu') {
        throw new Error(
          `Expected Ubuntu system, but found: ${osReleaseResult.trim()}`
        );
      }

      // Also check the Ubuntu version for additional validation
      const ubuntuVersionResult = this._runRemote(
        'cat /etc/os-release | grep "^VERSION_ID=" | cut -d= -f2',
        true
      );
      const ubuntuVersion = ubuntuVersionResult.trim();

      this._log(
        `Ubuntu system validated successfully (Version: ${ubuntuVersion})`
      );
    } catch (e) {
      throw new Error(
        `Ubuntu system validation failed: ${e.message}. This deployment script is designed to work with Ubuntu systems only.`
      );
    }
  }

  /**
   * Test database connectivity based on configuration
   */
  _testDatabaseConnectivity() {
    // Skip Docker-dependent tests if server is not initialized yet
    const hasServerInit = this._determineHasServerInit();
    if (!hasServerInit) {
      this._log(
        'Skipping database connectivity test - server not initialized yet (Docker not available)'
      );
      return;
    }

    this._log('Testing database connectivity');

    if (this.config.USE_REMOTE_DATABASE) {
      this._testRemoteDatabaseConnectivity();
    }

    this._log('Database connectivity test passed');
  }

  /**
   * Test remote database connectivity
   */
  _testRemoteDatabaseConnectivity() {
    try {
      // Test app database connectivity
      const backendSecrets = JSON.parse(this.config.BACKEND_SECRETS);
      const appDbConfig = backendSecrets.knex.connection;
      const appDbPort = appDbConfig.port || 5432;

      this._log(
        `Testing app database connection to ${appDbConfig.host}:${appDbPort}`
      );
      const appConnectionString = `postgresql://${appDbConfig.user}:${appDbConfig.password}@${appDbConfig.host}:${appDbPort}/postgres`;
      const appTestCommand = `docker run --rm ${this.POSTGRES_IMAGE} psql "${appConnectionString}" -c "SELECT 1" > /dev/null`;
      this._runRemote(appTestCommand);

      // Test Keycloak database connectivity
      const kcDbUrl = this._getDockerVarNoDefault('KC_DB_URL=')
        .split('=')[1]
        .trim();
      const kcDbUser = this._getDockerVarNoDefault('KC_DB_USERNAME=')
        .split('=')[1]
        .trim();
      const kcDbPassword = this._getDockerVarNoDefault('KC_DB_PASSWORD=')
        .split('=')[1]
        .trim();

      // Parse JDBC URL: jdbc:postgresql://host:port/database
      const urlMatch = kcDbUrl.match(/jdbc:postgresql:\/\/([^:]+):(\d+)\/(.+)/);
      if (!urlMatch) {
        throw new Error(`Invalid KC_DB_URL format: ${kcDbUrl}`);
      }

      const kcHost = urlMatch[1];
      const kcPort = parseInt(urlMatch[2], 10);

      this._log(`Testing Keycloak database connection to ${kcHost}:${kcPort}`);
      const kcConnectionString = `postgresql://${kcDbUser}:${kcDbPassword}@${kcHost}:${kcPort}/postgres`;
      const kcTestCommand = `docker run --rm ${this.POSTGRES_IMAGE} psql "${kcConnectionString}" -c "SELECT 1" > /dev/null`;
      this._runRemote(kcTestCommand);
    } catch (e) {
      throw new Error(
        `Remote database connectivity test failed: ${e.message}. Please verify database server is running and credentials are correct.`
      );
    }
  }

  /**
   * Check available disk space on the deployment server
   */
  _checkDiskSpace() {
    this._log('Checking disk space on deployment server');

    try {
      // Check available space in GB where the app will be deployed
      const spaceCheckCommand = `df -BG ${this.DEPLOY_ROOT} | tail -1 | awk '{print $4}' | sed 's/G//'`;
      const availableSpaceStr = this._runRemote(spaceCheckCommand, true);
      const availableSpace = parseInt(availableSpaceStr.trim(), 10);

      // Check deployment package size
      const zip = this.config.DEPLOY_TAG + '.zip';
      const zipSizeCommand = `ls -la ${zip} | awk '{print $5}'`;
      const zipSizeBytes = parseInt(this._execCmd(zipSizeCommand).trim(), 10);
      const zipSizeGB = Math.ceil(zipSizeBytes / (1024 * 1024 * 1024));

      // Require at least 3x the zip size + 2GB minimum free space
      const requiredSpace = Math.max(zipSizeGB * 3, 2);

      this._log(
        `Available disk space: ${availableSpace}GB, Required: ${requiredSpace}GB (deployment package: ${zipSizeGB}GB)`
      );

      if (availableSpace < requiredSpace) {
        throw new Error(
          `Insufficient disk space. Available: ${availableSpace}GB, Required: ${requiredSpace}GB`
        );
      }

      this._log('Disk space check passed');
    } catch (e) {
      throw new Error(
        `Disk space check failed: ${e.message}. Please ensure sufficient disk space is available on the server.`
      );
    }
  }

  /**
   * Validate that all required files exist in the deployment ZIP
   */
  _validateRequiredFilesInZip() {
    this._log('Validating required files in deployment ZIP');

    const zip = this.config.DEPLOY_TAG + '.zip';
    const requiredFiles = [
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/initsecrets.js`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/server-setup.sh`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/maintenance.sh`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/docker-maintenance.yml`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/${this.config.ENVIRONMENT}.sh`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/keycloak/templates/realm.json`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/userimport.js`,
      `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/nginx/maintenance/`,
    ];

    // Add local database file if not using remote database
    if (!this.config.USE_REMOTE_DATABASE) {
      requiredFiles.push(
        `${this.config.DEPLOY_TAG}/apps/${this.config.APP_NAME}-backend/assets/${this.config.LOCAL_DATABASE_YML_FILE}`
      );
    }

    const missingFiles = [];

    for (const file of requiredFiles) {
      try {
        // Check if file exists in ZIP (directories end with /, files don't)
        const isDirectory = file.endsWith('/');
        const checkCommand = isDirectory
          ? `zipinfo -1 ${zip} | grep -q "^${file}"`
          : `zipinfo -1 ${zip} | grep -q "^${file}$"`;

        this._execCmd(checkCommand);
      } catch (e) {
        this._log('File missing in zip: ' + file, e);
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(
        `Missing required files in deployment ZIP:\n${missingFiles.join(
          '\n'
        )}\n\nPlease ensure all required deployment files are included in the package.`
      );
    }

    this._log(
      `All ${requiredFiles.length} required files found in deployment ZIP`
    );
  }

  /**
   * Check and install required system utilities (unzip, zipinfo) on the deployment server
   */
  _checkAndInstallSystemUtilities() {
    this._log('Checking required system utilities on deployment server');

    try {
      // Check if unzip is installed
      let unzipInstalled = true;
      try {
        this._runRemote('which unzip', true);
        this._log('unzip is already installed');
      } catch {
        unzipInstalled = false;
        this._log('unzip is not installed');
      }

      // Check if zipinfo is installed
      let zipinfoInstalled = true;
      try {
        this._runRemote('which zipinfo', true);
        this._log('zipinfo is already installed');
      } catch {
        zipinfoInstalled = false;
        this._log('zipinfo is not installed');
      }

      // Install unzip package if either utility is missing
      // Note: zipinfo is typically included with unzip package
      if (!unzipInstalled || !zipinfoInstalled) {
        this._log('Installing unzip package (includes zipinfo)...');

        // Update package lists first
        this._runRemote('apt-get update -qq');

        // Install unzip package
        this._runRemote('apt-get install -y unzip');

        // Verify installation
        this._runRemote('which unzip');
        this._runRemote('which zipinfo');

        this._log('Successfully installed unzip and zipinfo utilities');
      } else {
        this._log('All required utilities are already installed');
      }

      // Test the utilities work correctly
      this._runRemote('unzip -v | head -1', true);
      this._runRemote('zipinfo -v | head -1', true);

      this._log('System utilities check completed successfully');
    } catch (e) {
      throw new Error(
        `System utilities installation failed: ${e.message}. Please ensure the deployment server has apt package manager and appropriate permissions.`
      );
    }
  }
}

module.exports = DeployWorker;
