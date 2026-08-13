/**
 * Production Deploy Entry Point for deploy3
 *
 * CLI tool for running deployments in CI/CD pipelines.
 * Uses the DeploymentOrchestrator to execute the full deployment workflow.
 *
 * Usage: tsx bin/deploy.ts
 *
 * Environment Variables (required):
 * - DEPLOY_SERVER: Target server hostname/IP
 * - DEPLOY_SSH_PRIVATE_KEY: SSH private key (PEM format)
 * - DEPLOY_TAG: Deployment tag/version (e.g., "25.0617.1430.15")
 * - DEPLOY_DOMAIN: Domain for the application and maintenance page
 * - DEPLOY_ENVIRONMENT: "staging" or "production"
 *
 * Environment Variables (optional):
 * - DEPLOY_SSH_PORT: SSH port (default: 22)
 * - DEPLOY_SSH_USER: SSH user (default: root)
 * - DEPLOY_DOCKER_ENV: Env-file format passed to docker-compose (supports ${VAR} expansion)
 *
 * The ZIP file is expected at `./${DEPLOY_TAG}.zip` (downloaded by CI release-downloader).
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger, logReport } from '../lib/utils/logger';
import { SshEnvSchema, toSshClientConfig } from '../config/ssh';
import { DeployEnvSchema } from '../config/deploy-env';
import { SshClient } from '../infra/ssh-client';
import { DockerClient } from '../infra/docker-client';
import {
  DeploymentOrchestrator,
  DeploymentOrchestratorConfig,
} from '../lib/orchestrators/deployment';

async function main(): Promise<void> {
  logger.info('🚀 deploy3 Deployment');
  logger.info('');

  // Parse and validate environment variables
  const sshParseResult = SshEnvSchema.safeParse(process.env);
  if (!sshParseResult.success) {
    logger.error('❌ SSH configuration validation failed');
    for (const issue of sshParseResult.error.issues) {
      logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const deployParseResult = DeployEnvSchema.safeParse(process.env);
  if (!deployParseResult.success) {
    logger.error('❌ Deployment configuration validation failed');
    for (const issue of deployParseResult.error.issues) {
      logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const sshConfig = sshParseResult.data;
  const deployConfig = deployParseResult.data;

  // Resolve ZIP path: ${DEPLOY_TAG}.zip in current working directory
  const zipFilename = `${deployConfig.DEPLOY_TAG}.zip`;
  const zipPath = path.resolve(process.cwd(), zipFilename);

  // Verify ZIP exists
  if (!fs.existsSync(zipPath)) {
    logger.error(`❌ ZIP file not found: ${zipPath}`);
    logger.error(`   Expected file: ${zipFilename} in current directory`);
    logger.error(`   Current directory: ${process.cwd()}`);
    process.exit(1);
  }

  logger.info('Configuration:');
  logger.info(`  ZIP: ${zipPath}`);
  logger.info(`  Deploy Tag: ${deployConfig.DEPLOY_TAG}`);
  logger.info(`  Environment: ${deployConfig.DEPLOY_ENVIRONMENT}`);
  logger.info(
    `  Server: ${sshConfig.DEPLOY_SSH_USER}@${sshConfig.DEPLOY_SERVER}:${sshConfig.DEPLOY_SSH_PORT}`
  );
  logger.info(`  Domain: ${deployConfig.DEPLOY_DOMAIN}`);
  logger.info('');

  let ssh: SshClient | null = null;

  try {
    // Initialize SSH and Docker clients
    ssh = new SshClient(toSshClientConfig(sshConfig));
    const docker = new DockerClient(ssh);

    // Build env object with all DEPLOY_* and APP_* variables
    // This passes through everything the hooks might need
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Prepare orchestrator configuration
    const orchestratorConfig: DeploymentOrchestratorConfig = {
      zipPath,
      deployTag: deployConfig.DEPLOY_TAG,
      environment: deployConfig.DEPLOY_ENVIRONMENT,
      domain: deployConfig.DEPLOY_DOMAIN,
      env,
    };

    // Create and run orchestrator
    const orchestrator = new DeploymentOrchestrator(orchestratorConfig, {
      ssh,
      docker,
      logger,
    });

    logger.info('Starting deployment...');
    logger.info('');

    const report = await orchestrator.run();

    // Print report
    logReport(logger, report, 'Deployment');

    process.exit(report.success ? 0 : 1);
  } catch (error) {
    logger.error('❌ Deployment failed');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (ssh) {
      ssh.cleanup();
    }
  }
}

main().catch((error) => {
  logger.error('❌ Unhandled error in main');
  logger.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    logger.error(error.stack);
  }
  process.exit(1);
});
