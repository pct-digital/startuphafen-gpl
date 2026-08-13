/**
 * Deployment Environment Schema
 *
 * Validates deployment-related environment variables from CI/CD pipelines.
 * Uses Zod for runtime validation.
 *
 * Environment variables:
 * - DEPLOY_TAG: Deployment tag/version (e.g., "25.0617.1430.15") (required)
 * - DEPLOY_DOMAIN: Domain for the application and maintenance page (required)
 * - DEPLOY_ENVIRONMENT: "staging" or "production" (required)
 * - DEPLOY_DOCKER_ENV: Env-file format passed to docker-compose (optional)
 */

import { z } from 'zod';

/**
 * Zod schema for deployment environment variables (beyond SSH config)
 */
export const DeployEnvSchema = z.object({
  DEPLOY_TAG: z
    .string({ required_error: 'DEPLOY_TAG is required' })
    .trim()
    .min(1, 'DEPLOY_TAG cannot be empty'),

  DEPLOY_DOMAIN: z
    .string({ required_error: 'DEPLOY_DOMAIN is required' })
    .min(1, 'DEPLOY_DOMAIN cannot be empty'),

  DEPLOY_ENVIRONMENT: z.enum(['staging', 'production'], {
    required_error: 'DEPLOY_ENVIRONMENT must be "staging" or "production"',
  }),

  DEPLOY_DOCKER_ENV: z.string().optional(),
});

export type DeployEnvConfig = z.infer<typeof DeployEnvSchema>;
