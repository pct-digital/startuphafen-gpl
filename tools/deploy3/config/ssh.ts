/**
 * SSH Configuration Schema
 *
 * Validates and parses SSH connection configuration from environment variables.
 * Uses Zod for runtime validation.
 *
 * Environment variables (DEPLOY_* prefix as per architecture):
 * - DEPLOY_SERVER: Target server hostname or IP address (required)
 * - DEPLOY_SSH_PORT: SSH port (optional, defaults to 22)
 * - DEPLOY_SSH_PRIVATE_KEY: SSH private key data (PEM format) (required)
 * - DEPLOY_SSH_USER: SSH username (optional, defaults to 'root')
 */

import { z } from 'zod';
import type { SshConfig } from '../infra/ssh-client';

/**
 * Zod schema for SSH configuration from environment variables.
 */
export const SshEnvSchema = z.object({
  DEPLOY_SERVER: z
    .string({ required_error: 'DEPLOY_SERVER is required' })
    .min(1, 'DEPLOY_SERVER cannot be empty'),

  DEPLOY_SSH_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 22))
    .pipe(z.number().int().min(1).max(65535)),

  DEPLOY_SSH_PRIVATE_KEY: z
    .string({ required_error: 'DEPLOY_SSH_PRIVATE_KEY is required' })
    .min(1, 'DEPLOY_SSH_PRIVATE_KEY cannot be empty'),

  DEPLOY_SSH_USER: z.string().optional().default('root'),
});

export type SshEnvConfig = z.infer<typeof SshEnvSchema>;

/**
 * Convert parsed SSH environment config to SshClient config.
 */
export function toSshClientConfig(envConfig: SshEnvConfig): SshConfig {
  return {
    host: envConfig.DEPLOY_SERVER,
    user: envConfig.DEPLOY_SSH_USER,
    port: envConfig.DEPLOY_SSH_PORT,
    keyData: envConfig.DEPLOY_SSH_PRIVATE_KEY,
  };
}
