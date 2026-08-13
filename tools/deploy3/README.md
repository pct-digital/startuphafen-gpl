# Deploy3

Rewrite of deployment and data copy tools as a proper TypeScript project.

## Pipeline

Deploy3 with the "multi-host" infrastructure on a cloud provider enables us to easily create deployment-targets
for temporary, test or demo deployments.

> **Note:** The environment-related workflows (create/destroy environment, temporary deployments, database
> copy) require a separately provisioned "multi-host" server that offers `/opt/multi-host-traefik/spawn.sh`
> and per-environment container metadata under `/opt/container/<domain>/`. This provisioning stack is not
> part of this repository — without such a server these workflows will not run.

- **Feature branches create Releases** Your feature branches now create releases which you can deploy
- **one click "test-servers"** You can create a deployment-environment via github actions
- **one click temporary deployments** You can create a temporary environment for a specific release directly via github action
- **one click database copy** You can copy the data from another system like staging or prod to test how your changes would behave "in the real world"

Automatic comments on your PR help you interact with test deployments.

## GitHub Workflows

All workflows are accessible via **GitHub Actions → Run workflow** (manual triggers) or run automatically based on events.

### Automatic Workflows

| Workflow                              | Trigger                            | What it does                                                                                                                                                  |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 - The startuphafen pipeline**     | Push to any branch (except `main`) | Runs tests, linting, builds the app, and creates a release for `dev`, `main`, `feature/*`, `fix/*`, `poc/*` branches. Pushes to `dev` auto-deploy to staging. |
| **7 - PR Events**                     | PR opened/updated/closed           | Posts a comment on your PR when a release is created for your branch.                                                                                         |
| **95 - Cleanup Expired Environments** | Hourly (automatic)                 | Destroys temporary environments that have exceeded their lifetime and notifies the PR.                                                                        |

### Manual Workflows (via "Run workflow" button)

#### Deploying

| Workflow                      | When to use                                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2 - Deploy Startuphafen**   | Deploy a specific release to an environment (staging, production, or custom). For production, type "prod" in the confirmation field.                                          |
| **2A - Temporary Deployment** | Create a throw-away test environment with a copy of data from another environment. Specify the release tag, source environment for data, and lifetime (default 48h). The environment auto-destructs after expiration. A link is posted to your PR. |

#### Managing Environments

| Workflow                               | When to use                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **4 - Create New Testing Environment** | Create a new persistent testing/demo environment. Provide a fully qualified domain (e.g., `demo.example.com`) and a source environment to copy baseline configuration from. |
| **5 - Destroy Testing Environment**    | Tear down a testing environment you no longer need. Specify the domain to destroy.                                                                                                   |

#### Data Management

| Workflow               | When to use                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **6 - Copy Databases** | Copy all databases (app + keycloak) from one environment to another. Useful for testing your changes against production-like data. Select source and target environments. |

#### Maintenance

| Workflow                     | When to use                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **3 - Cleanup old releases** | Delete GitHub releases older than X days (default 180). Keeps the release list tidy. |

### Typical Developer Scenarios

**"I want to test my feature branch with real data"**

1. Push your branch → pipeline creates a release automatically
2. Run **2A - Temporary Deployment** with your release tag, select staging/production as data source
3. Test on the temporary URL (posted to your PR)
4. Environment auto-destructs after the specified lifetime

**"I want to deploy my changes to staging"**

1. Merge to `dev` → auto-deploys to staging, OR
2. Run **2 - Deploy Startuphafen** manually with your release tag and `startuphafen-staging`

**"I need a persistent demo environment"**

1. Run **4 - Create New Testing Environment** with your desired domain
2. Run **2 - Deploy Startuphafen** to deploy a release to it
3. Optionally run **6 - Copy Databases** to populate it with data
4. When done, run **5 - Destroy Testing Environment**

## the apps/startuphafen-backend/deployment directory

Deploy3 is application agnostic, meaning: it can be used pretty much for any docker compose based application.
To handle "application specifics" like "it has a keycloak that needs a complicated realm migration process" or "what postgres version should we use for database connection smoketests" there is the "deployment" directory in the assets of the backend:

```bash
apps/startuphafen-backend/src/assets/deployment/
├── hooks
│   ├── maintenance.js              # deploy3 hook which runs while the old version is stopped and the new version has not been started yet. Use for complicated migrations or configurations necessary. Primary purpose so far: keycloak realm config
│   ├── post-up.js                  # deploy3 hook which is run after "up" on the new version: check the deployment really was a success
│   ├── pre-down.js                 # deploy3 hook which runs before "down" is run on a running system: catch problems before they cause a failed deploy
├── production.json                 # Deployment configuration for a production system
├── server-setup
│   └── server-setup-playbook.yaml  # Ansible server setup script
└── staging.json                    # Deployment configuration for a staging system
```

Examples of hooks can be found in startuphafen. These can be considered mostly the "standard" for a typical, keycloak based project.

The json file `staging.json`/`production.json` control some aspects of the deployment process.
It can be overwritten for a single deployment environment via the CI variable `DEPLOY_OVERWRITE_CONFIG`, the primary purpose of this is to for example have a staging deployment that uses a remote database, while the normal `staging.json` defines a local database.

Example

```bash
{
  # name of the app
  "appName": "startuphafen",
  # which docker compose files to use, main purpose: Do we want to use a docker container postgres? Or a managed cloud postgres?
  "composeFiles": ["../docker-compose.yml", "../docker-compose-staging.yml", "../docker-compose-db.yml"],
  # Should any "external" docker volumes be created on the target server?
  "localDatabaseVolumes": ["pgdata", "kcpgdata"],
  # Are there any local database containers?
  "localDatabaseComposeServiceNames": ["database", "keycloak-database"]
  # Message to use on the maintenance page
  "maintenanceMessage": "Wartungsarbeiten!",
  # How much disk space must be available on the target system?
  "minDiskSpaceGB": 5,
  # How much free memory must be available on the target system?
  "minFreeMemoryMB": 800,
  # What postgres image to use for database operations during deploys or database copies?
  "postgresImage": "postgres:15",
  # What keycloak image to use for database operations during deploys?
  "keycloakImage": "quay.io/keycloak/keycloak:26.1.2",
  # What is the name of the docker network used for the application. Legacy reasons why it is called this
  "dockerNetwork": "assets_local",
}
```

While deploy3 is application agnostic, complicated code for hooks, such as the keycloak migration, is generally written in deploy3 as a "utility", which can then be used during deploys in the maintenance.js hook. See `tools/deploy3/lib/hooks/helpers` The reason for this is that deploy3 has lots of "ground laying work" done to interact with servers, docker, etc and is written in typescript. The hooks should stay simple js files, keep large complexity out of them.

## Understanding a deployed system

Deploy3 produces a standard set of files & folders on a target system.

Example:

```bash
/opt/startuphafen                                     # startuphafen is the name of the app, different on other projects
|-- 26.0115.1928.38_example_startuphafen        # the unpacked release
|-- active -> /opt/startuphafen/26.0115.1928.38_example_startuphafen # symlink to the active version
|-- caddy                                              # Caddy TLS state storage for the app proxy
|-- logs                                               # log files, all logs from docker containers get streamed here via fluentd
|   |-- backend.log
|   |-- database.log
|   |-- keycloak-database.log
|   |-- keycloak.log
|   |-- maildev.log
|   `-- caddy.log
|-- maintenance-certs                                  # Caddy TLS state storage for the maintenance page
|   |-- Caddyfile                                      # also includes the html of the maintenance page
|   |-- config
|   `-- data
|-- psql-kc.sh                                         # script gives you psql on the keycloak database
|-- psql.sh                                            # script gives you psql on the backend database
|-- server-setup-checksums.md5                         # checksum used to decide if the ansible server setup must run
|-- staging                                            # marker "this is a staging system". Also possible: "production"
|-- start.sh                                           # script that allows you to start the application, stops maintenance page
`-- stop.sh                                            # script that allows you to stop the application, starts maintenance page

```

The first thing to run on a deployed system to understand the situation is typically `docker ps` to see if any containers are having troubles, here all is good:

```bash
root@demo:/opt/startuphafen docker ps
CONTAINER ID   IMAGE                                       COMMAND                  CREATED      STATUS                PORTS                                                                                NAMES
116fd46a25bc   postgres:15.10-bookworm                     "docker-entrypoint.s…"   3 days ago   Up 3 days (healthy)   5432/tcp                                                                             startuphafen-keycloak-database
0c7edeea5b87   caddy:2.11-alpine                           "caddy run --config…"   3 days ago   Up 3 days             0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp, 0.0.0.0:443->443/udp, [::]:443->443/udp   startuphafen-caddy
55a059ed6009   pgvector/pgvector:pg15                      "docker-entrypoint.s…"   3 days ago   Up 3 days (healthy)   5432/tcp                                                                             startuphafen-database
5605c10b237d   node:22.18.0-bookworm                       "docker-entrypoint.s…"   3 days ago   Up 3 days                                                                                                  startuphafen-backend
cd3ec93d4f9d   maildev/maildev:2.2.1                       "bin/maildev"            3 days ago   Up 3 days (healthy)   1025/tcp, 1080/tcp                                                                   startuphafen-maildev
939238e0d579   startuphafen-keycloak:26.1.2                "/bin/bash /entrypoi…"   3 days ago   Up 3 days (healthy)   8080/tcp, 8443/tcp, 9000/tcp                                                         startuphafen-keycloak
297bbeacf463   fluent/fluentd:v1.18-1                      "tini -- /bin/entryp…"   3 days ago   Up 3 days             5140/tcp, 127.0.0.1:24224->24224/tcp, 127.0.0.1:24224->24224/udp                     startuphafen-fluentd
```

## Quick Start

See package.json for what scripts exist

## Code Map

```
deploy3/
├── bin/                      # Entry points
│
├── config/                   # Configuration file schemas
│
├── lib/
│   ├── orchestrators/        # High-level workflows
│   │   ├── deployment.ts     # Orchestrates deployment flow
│   │   └── copy.ts           # Orchestrates copy flow
│   │
│   ├── service/              # Core services, reusable building blocks for orchestrators
│   │
│   ├── hooks/                # Pre/post hooks
│   │
│   ├── validation/           # Smoke tests & validation
│   │
│   └── utils/                # Shared utilities
│
└── infra/                    # Infrastructure abstractions, like ssh and docker helpers
```

## Running Tests

```bash
npm test
```

## Type Checking

```bash
npx tsc
```

# CI Variables Reference

This section documents all CI/CD environment variables used by deploy3 and startuphafen deployments. These are configured in GitHub Environments.

## Deployment Variables

| Variable                  | Required | Description                                                                                                                                                       |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_SERVER`           | Yes      | Target server hostname or IP address for SSH connections.                                                                                                         |
| `DEPLOY_DOMAIN`           | Yes      | The domain under which the application runs (e.g., `staging.example.com`)                                                                                     |
| `DEPLOY_ENVIRONMENT`      | Yes      | Must be either `staging` or `production`. Controls which deployment configuration file is loaded (`staging.json` or `production.json`).                           |
| `DEPLOY_TAG`              | Yes (CI) | The release tag being deployed (e.g., `25.0617.1430.15`). Set automatically by the CI workflow from the release input.                                            |
| `DEPLOY_SSH_PORT`         | No       | SSH port for the target server. Defaults to `22` if not set.                                                                                                      |
| `DEPLOY_SSH_USER`         | No       | SSH username for deployments. Defaults to `root` if not set.                                                                                                      |
| `DEPLOY_DOCKER_ENV`       | No       | Environment variables in env-file format passed to docker-compose. Used for database passwords, Keycloak configuration, and other container environment settings. |
| `DEPLOY_OVERWRITE_CONFIG` | No       | JSON string to override values in `staging.json`/`production.json`. Useful for environment-specific configuration like remote databases.                          |

## Secret Variables

| Variable                 | Required | Description                                                                            |
| ------------------------ | -------- | -------------------------------------------------------------------------------------- |
| `DEPLOY_SSH_PRIVATE_KEY` | Yes      | SSH private key (PEM format) for connecting to the deployment target server.           |
| `APP_BACKEND_SECRETS`    | Yes      | JSON object containing backend application secrets. Overwrites the backend config.json |
| `APP_KEYCLOAK_SECRETS`   | No       | JSON object for Keycloak-specific secrets. Currently typically set to `{}`.            |

## Protection Variables

| Variable              | Required | Description                                                                                                                                                                    |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PREVENT_COPY_TARGET` | No       | When set to any non-empty value, prevents this environment from being used as a target for database copies. This is a hard block that CANNOT be bypassed - not even with the production confirmation (see below). Set this on environments that must never be overwritten. |
| `PREVENT_DELETION`    | No       | When set to any non-empty value, protects this environment from deletion: the destroy-environment workflow checks this variable and refuses to delete the environment. Prevents accidental destruction of important deployments.                             |

### Copy Target Protection

Two independent mechanisms protect environments from being overwritten by the copy workflow ("6 - Copy Databases"):

1. **Production confirmation** (bypassable with explicit confirmation): If the target environment has `DEPLOY_ENVIRONMENT=production` or the target server carries a production marker file, the copy aborts. Entering `prod` in the workflow's `confirm_prod` input overrides both checks - the operator explicitly confirms overwriting the production data.
2. **`PREVENT_COPY_TARGET`** (hard block, never bypassable): If set on the target environment, the copy always aborts, regardless of the `confirm_prod` input. Use this for environments that must never be a copy target under any circumstances.

Both checks run in `prep-copy.ts` / the copy smoke tests before anything on the target is stopped or modified.

## GitHub Workflow Variables

These are used by the GitHub Actions workflows themselves:

| Variable             | Scope               | Description                                                                                       |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `GH_TOKEN_FOR_ENVS`  | Repository Secret   | GitHub token with permissions to read/create environments. Required for `gh-envs.cjs` operations. |
| `MULTI_HOST_DOMAIN`  | Repository Variable | Domain of the multi-host server for creating temporary environments.                              |
| `MULTI_HOST_USER`    | Repository Variable | SSH username for the multi-host server.                                                           |
| `MULTI_HOST_SSH_KEY` | Repository Secret   | SSH private key for connecting to the multi-host server.                                          |
| `STAGING_DOMAIN`     | Repository Variable | Name of the staging environment targeted by the automatic staging deploy in the main pipeline.    |
| `TEMP_DEPLOY_BASE_DOMAIN` | Repository Variable | Base domain under which temporary deployment domains are derived (see `derive-domain.cjs`).  |

## Example: APP_BACKEND_SECRETS Structure

```json
{
  "knex": {
    "connection": {
      "host": "database",
      "user": "app",
      "database": "app",
      "password": "your-db-password"
    }
  },
  "keycloak": {
    "user": "admin",
    "password": "keycloak-admin-password"
  },
  "allowedOrigins": ["https://your-domain.example.com"]
}
```

## Example: DEPLOY_DOCKER_ENV Contents

```env
POSTGRES_PASSWORD=your-db-password
KC_DB_PASSWORD=keycloak-db-password
KC_DB_USERNAME=keycloak
KC_DB_URL=jdbc:postgresql://keycloak-database:5432/keycloak
APP_HOST=${DEPLOY_DOMAIN}
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=admin-password
```

# Future ideas

## Ideas for More Smoke Tests (Later)

These are potential improvements to consider implementing in the future:

### Auto-detect and create external Docker volumes

Remove manual `localDatabaseVolumes` config. Use `docker compose config` to get the merged/resolved compose output, then parse it to find all external volumes and create them automatically before `docker compose up`.

### Validate external host paths (bind mounts)

Use `docker compose config` to extract all bind mounts. Validate that paths either exist in the deployment package OR are explicitly whitelisted in an `externalHostPathsConfig` map (with `"ok"` or `"warn"` values). Fail deployment for unknown external paths.
