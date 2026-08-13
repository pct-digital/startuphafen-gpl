/**
 * Prep-Copy CLI Tool
 *
 * Builds a copy configuration JSON file from environment files and CLI arguments.
 * The output file is consumed by copy.ts to execute the actual database copy.
 *
 * Usage:
 *   npx tsx bin/prep-copy.ts \
 *     --source-env source-env.json \
 *     --source-ssh-key-file ~/.ssh/deploy_source_key \
 *     --target-env target-env.json \
 *     --target-ssh-key-file ~/.ssh/deploy_target_key \
 *     --db "postgres:knex:APP_BACKEND_SECRETS" \
 *     --db "postgres:keycloak:DEPLOY_DOCKER_ENV" \
 *     -o copy.json
 *
 * Arguments:
 *   --source-env <file>          JSON file with source environment variables (from gh-envs.js)
 *   --source-ssh-key-file <file> File containing source SSH private key
 *   --target-env <file>          JSON file with target environment variables (from gh-envs.js)
 *   --target-ssh-key-file <file> File containing target SSH private key
 *   --db <spec>                  Database spec: "type:parseFormat:envVar"
 *                                  - type: "postgres" (extensible for future db types)
 *                                  - parseFormat: "knex" or "keycloak"
 *                                  - envVar: Environment variable name containing connection info
 *   --allow-production           Allow a production target (requires explicit confirmation upstream)
 *   -o, --output <file>          Output file path for copy configuration JSON
 */

import * as fs from 'fs';
import {
  CopyConfig,
  CopyEndpointConfig,
  DatabaseCopyConfig,
  PostgresDatabaseCopyConfig,
} from '../config/copy-config';
import { parseConfigOverride } from '../config/deployment-config';
import {
  parseBackendSecrets,
  parseKeycloakDbFromDockerEnv,
  PostgresConnectionConfig,
} from '../lib/hooks/helpers/postgres/postgres';
import {
  isSamePhysicalDatabase,
  normalizeHost,
} from '../lib/hooks/helpers/postgres/same-database';
import { logger } from '../lib/utils/logger';

// =============================================================================
// Types
// =============================================================================

interface CliArgs {
  appName: string;
  sourceEnvFile: string;
  sourceSshKeyFile: string;
  targetEnvFile: string;
  targetSshKeyFile: string;
  databases: DatabaseSpec[];
  outputFile: string;
  allowProduction: boolean;
}

interface DatabaseSpec {
  type: 'postgres';
  parseFormat: 'knex' | 'keycloak';
  envVar: string;
}

type EnvJson = Record<string, string>;

/**
 * GitHub environment format from gh-envs.cjs output
 */
interface GhEnvJson {
  command: string;
  repo: string;
  envName: string;
  environment: unknown;
  variables: {
    variables: Array<{ name: string; value: string }>;
    total_count: number;
  };
  secrets: unknown;
}

// =============================================================================
// Argument Parsing
// =============================================================================

function printUsage(): void {
  console.log(`
Usage: npx tsx bin/prep-copy.ts [options]

Options:
  --app-name <name>            Application name (e.g., "startuphafen")
  --source-env <file>          JSON file with source environment variables
  --source-ssh-key-file <file> File containing source SSH private key
  --target-env <file>          JSON file with target environment variables
  --target-ssh-key-file <file> File containing target SSH private key
  --db <spec>                  Database spec (can be repeated):
                                 "type:parseFormat:envVar"
                                 type: "postgres"
                                 parseFormat: "knex" or "keycloak"
  --allow-production           Allow a production target (requires explicit confirmation upstream)
  -o, --output <file>          Output file path for copy configuration JSON
  -h, --help                   Show this help message

Example:
  npx tsx bin/prep-copy.ts \\
    --app-name startuphafen \\
    --source-env source-env.json \\
    --source-ssh-key-file ~/.ssh/deploy_source_key \\
    --target-env target-env.json \\
    --target-ssh-key-file ~/.ssh/deploy_target_key \\
    --db "postgres:knex:APP_BACKEND_SECRETS" \\
    --db "postgres:keycloak:DEPLOY_DOCKER_ENV" \\
    -o copy.json
`);
}

function parseArgs(args: string[]): CliArgs {
  const result: Partial<CliArgs> = {
    databases: [],
    allowProduction: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--app-name':
        result.appName = nextArg;
        i++;
        break;
      case '--source-env':
        result.sourceEnvFile = nextArg;
        i++;
        break;
      case '--source-ssh-key-file':
        result.sourceSshKeyFile = nextArg;
        i++;
        break;
      case '--target-env':
        result.targetEnvFile = nextArg;
        i++;
        break;
      case '--target-ssh-key-file':
        result.targetSshKeyFile = nextArg;
        i++;
        break;
      case '--db':
        result.databases!.push(parseDatabaseSpec(nextArg));
        i++;
        break;
      case '--allow-production':
        result.allowProduction = true;
        break;
      case '-o':
      case '--output':
        result.outputFile = nextArg;
        i++;
        break;
      case '-h':
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  // Validate required arguments
  const missing: string[] = [];
  if (!result.appName) missing.push('--app-name');
  if (!result.sourceEnvFile) missing.push('--source-env');
  if (!result.sourceSshKeyFile) missing.push('--source-ssh-key-file');
  if (!result.targetEnvFile) missing.push('--target-env');
  if (!result.targetSshKeyFile) missing.push('--target-ssh-key-file');
  if (!result.outputFile) missing.push('--output');
  if (result.databases!.length === 0) missing.push('--db');

  if (missing.length > 0) {
    throw new Error(`Missing required arguments: ${missing.join(', ')}`);
  }

  return result as CliArgs;
}

function parseDatabaseSpec(spec: string): DatabaseSpec {
  const parts = spec.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid --db spec: "${spec}". Expected format: "type:parseFormat:envVar"`
    );
  }

  const [type, parseFormat, envVar] = parts;

  if (type !== 'postgres') {
    throw new Error(
      `Unsupported database type: "${type}". Supported: postgres`
    );
  }

  if (parseFormat !== 'knex' && parseFormat !== 'keycloak') {
    throw new Error(
      `Invalid parseFormat: "${parseFormat}". Supported: knex, keycloak`
    );
  }

  return { type, parseFormat, envVar };
}

// =============================================================================
// File Reading
// =============================================================================

/**
 * Type guard to check if parsed JSON is in GitHub environment format
 */
function isGhEnvJson(obj: unknown): obj is GhEnvJson {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'variables' in obj &&
    typeof (obj as GhEnvJson).variables === 'object' &&
    Array.isArray((obj as GhEnvJson).variables?.variables)
  );
}

/**
 * Convert GitHub environment format to flat EnvJson
 */
function ghEnvToEnvJson(ghEnv: GhEnvJson): EnvJson {
  const result: EnvJson = {};
  for (const variable of ghEnv.variables.variables) {
    result[variable.name] = variable.value;
  }
  return result;
}

function readEnvJson(filePath: string): EnvJson {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(
      `Failed to parse environment JSON from ${filePath}: ${
        (e as Error).message
      }`
    );
  }

  // Support both GitHub environment format and simple flat format
  if (isGhEnvJson(parsed)) {
    logger.info(`  Detected GitHub environment format in ${filePath}`);
    return ghEnvToEnvJson(parsed);
  }

  // Assume flat format
  return parsed as EnvJson;
}

function readSshKey(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SSH key file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf-8').trim() + '\n';
}

// =============================================================================
// Config Building
// =============================================================================

function buildEndpointConfig(
  envJson: EnvJson,
  sshKeyData: string
): CopyEndpointConfig {
  const host = envJson['DEPLOY_SERVER'];
  const port = envJson['DEPLOY_SSH_PORT'] ?? envJson['SSH_PORT'] ?? '22';
  const user = envJson['DEPLOY_SSH_USER'] ?? 'root';
  const domain = envJson['DEPLOY_DOMAIN'];

  if (!host) {
    throw new Error('DEPLOY_SERVER not found in environment JSON');
  }
  if (!domain) {
    throw new Error('DEPLOY_DOMAIN not found in environment JSON');
  }

  return {
    ssh: {
      host,
      port: parseInt(port, 10),
      user,
      keyData: sshKeyData,
    },
    domain,
  };
}

function parseConnectionConfig(
  envJson: EnvJson,
  spec: DatabaseSpec,
  side: 'source' | 'target'
): PostgresConnectionConfig {
  const envValue = envJson[spec.envVar];

  if (!envValue) {
    throw new Error(`${spec.envVar} not found in ${side} environment JSON`);
  }

  switch (spec.parseFormat) {
    case 'knex':
      return parseBackendSecrets(envValue);
    case 'keycloak':
      return parseKeycloakDbFromDockerEnv(envValue);
    default:
      throw new Error(`Unknown parseFormat: ${spec.parseFormat}`);
  }
}

function buildDatabaseConfig(
  sourceEnv: EnvJson,
  targetEnv: EnvJson,
  spec: DatabaseSpec
): DatabaseCopyConfig {
  const sourceConfig = parseConnectionConfig(sourceEnv, spec, 'source');
  const targetConfig = parseConnectionConfig(targetEnv, spec, 'target');

  const config: PostgresDatabaseCopyConfig = {
    type: 'postgres',
    sourceConfig,
    targetConfig,
  };

  return config;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  logger.info('🔧 prep-copy: Building copy configuration');

  // Parse CLI arguments
  const args = parseArgs(process.argv.slice(2));

  logger.info(`  App name: ${args.appName}`);
  logger.info(`  Source env: ${args.sourceEnvFile}`);
  logger.info(`  Target env: ${args.targetEnvFile}`);
  logger.info(`  Databases: ${args.databases.length}`);
  logger.info(`  Output: ${args.outputFile}`);
  logger.info('');

  // Read input files
  const sourceEnv = readEnvJson(args.sourceEnvFile);
  const targetEnv = readEnvJson(args.targetEnvFile);
  const sourceSshKey = readSshKey(args.sourceSshKeyFile);
  const targetSshKey = readSshKey(args.targetSshKeyFile);

  // Validate target is not production (unless explicitly allowed)
  const targetEnvironment = targetEnv['DEPLOY_ENVIRONMENT'];
  if (targetEnvironment === 'production') {
    if (!args.allowProduction) {
      throw new Error(
        'Target environment is production! Copying to production is not allowed without explicit confirmation. ' +
          'Pass --allow-production (workflow: enter "prod" in the confirm_prod input) to override.'
      );
    }
    logger.warn(
      '⚠️  Target environment is PRODUCTION - proceeding because --allow-production was passed. ' +
        'All existing data in the target databases will be overwritten!'
    );
  } else {
    logger.info(
      `Target environment validated: ${
        targetEnvironment || '(not set)'
      } (not production) ✓`
    );
  }

  // Validate target is not protected from copy.
  // Any non-empty value counts as set - this is a protection flag, so its
  // mere presence signals intent ("TRUE", "yes", even "false" all block).
  const preventCopyTarget = targetEnv['PREVENT_COPY_TARGET'];
  if (preventCopyTarget !== undefined && preventCopyTarget.trim() !== '') {
    throw new Error(
      'Target environment has PREVENT_COPY_TARGET set! This environment is protected and cannot be used as a copy target. ' +
        'Remove PREVENT_COPY_TARGET from the target environment to allow copying.'
    );
  }
  logger.info(
    `Target copy protection validated: PREVENT_COPY_TARGET not set ✓`
  );
  logger.info('');

  // Build endpoint configs
  logger.info('Building source endpoint config...');
  const source = buildEndpointConfig(sourceEnv, sourceSshKey);
  logger.info(`  Host: ${source.ssh.host}:${source.ssh.port}`);
  logger.info(`  Domain: ${source.domain}`);

  logger.info('Building target endpoint config...');
  const target = buildEndpointConfig(targetEnv, targetSshKey);
  logger.info(`  Host: ${target.ssh.host}:${target.ssh.port}`);
  logger.info(`  Domain: ${target.domain}`);

  // Build database configs
  logger.info('Building database configs...');
  const databases: DatabaseCopyConfig[] = [];
  const sameServer =
    normalizeHost(source.ssh.host) === normalizeHost(target.ssh.host);

  for (const spec of args.databases) {
    logger.info(
      `  Processing ${spec.type} (${spec.parseFormat} from ${spec.envVar})`
    );
    const dbConfig = buildDatabaseConfig(sourceEnv, targetEnv, spec);

    // The copy clears the target before dumping the source - copying a
    // database onto itself would destroy the data before it can be dumped.
    if (
      isSamePhysicalDatabase(
        dbConfig.sourceConfig,
        dbConfig.targetConfig,
        sameServer
      )
    ) {
      throw new Error(
        `Source and target database are identical for ${spec.envVar}: ` +
          `${dbConfig.sourceConfig.database}@${dbConfig.sourceConfig.host}. ` +
          'Copying a database onto itself would destroy the data before it can be dumped.'
      );
    }

    databases.push(dbConfig);
    logger.info(
      `    Source DB: ${dbConfig.sourceConfig.database}@${dbConfig.sourceConfig.host}`
    );
    logger.info(
      `    Target DB: ${dbConfig.targetConfig.database}@${dbConfig.targetConfig.host}`
    );
  }

  // Extract config overrides if present
  const sourceConfigOverride = parseConfigOverride(sourceEnv);
  if (sourceConfigOverride) {
    logger.info(
      `Source config override found (DEPLOY_OVERWRITE_CONFIG): ${Object.keys(
        sourceConfigOverride
      ).join(', ')}`
    );
  }
  const targetConfigOverride = parseConfigOverride(targetEnv);
  if (targetConfigOverride) {
    logger.info(
      `Target config override found (DEPLOY_OVERWRITE_CONFIG): ${Object.keys(
        targetConfigOverride
      ).join(', ')}`
    );
  }

  // Assemble final config
  const copyConfig: CopyConfig = {
    appName: args.appName,
    source,
    target,
    databases,
    allowProductionTarget: args.allowProduction,
    ...(sourceConfigOverride && { sourceConfigOverride }),
    ...(targetConfigOverride && { targetConfigOverride }),
  };

  // Write output
  const outputJson = JSON.stringify(copyConfig, null, 2);
  fs.writeFileSync(args.outputFile, outputJson, 'utf-8');

  logger.info('');
  logger.info(`✅ Copy configuration written to: ${args.outputFile}`);
}

main().catch((err) => {
  logger.error('❌ prep-copy failed:', err.message);
  process.exit(1);
});
