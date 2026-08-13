import { DockerClient } from '../../infra/docker-client';
import { RemoteFileSystem } from '../../infra/file-system';
import { SshClient } from '../../infra/ssh-client';
import { DeploymentConfig } from '../../config/deployment-config';
import { PathResolver } from '../service/path-resolver';
import { Logger } from '../utils/logger';
import {
  PreDownHookHelpers,
  MaintenanceHookHelpers,
  PostUpHookHelpers,
} from './hook-helpers';

// =============================================================================
// Hook Types
// =============================================================================

/**
 * The three hook types in the deployment lifecycle.
 */
export type HookType = 'pre-down' | 'maintenance' | 'post-up';

// =============================================================================
// Local ZIP Inspector (for checking files in deployment package)
// =============================================================================

/**
 * Interface for inspecting files within the local deployment ZIP.
 * Used by hooks to validate that required files exist in the package
 * BEFORE the package is unpacked on the server.
 */
export interface LocalZipInspector {
  /**
   * Check if a path exists within the deployment package.
   * Paths are relative to the backend assets directory.
   *
   * @param relativePath - Path relative to backend assets (e.g., "keycloak/templates/realm.json")
   * @returns true if the file exists in the ZIP
   */
  pathExists(relativePath: string): boolean;

  /**
   * Read a file's contents from the deployment package.
   * Paths are relative to the backend assets directory.
   *
   * @param relativePath - Path relative to backend assets (e.g., "keycloak/Dockerfile")
   * @returns File contents as string
   * @throws Error if file not found
   */
  readFile(relativePath: string): string;
}

// =============================================================================
// Base Context (shared by all hooks)
// =============================================================================

/**
 * Base context shared by all deployment hooks.
 */
export interface BaseHookContext {
  /** Initialized SSH client for the target host */
  ssh: SshClient;
  /** Initialized Docker client for the target host */
  docker: DockerClient;
  /** Remote file system operations (via SSH) */
  remoteFs: RemoteFileSystem;
  /** Path resolver for deployment directory structure */
  pathResolver: PathResolver;
  /** Logger instance */
  logger: Logger;
  /** The version tag being deployed */
  version: string;
  /**
   * Environment variables for the deployment.
   * All variables from GitHub Actions - some contain JSON, some plain strings.
   */
  env: Record<string, string>;
  /**
   * Parsed deployment configuration from the deployment package.
   * Contains app-specific settings like compose files, database volumes, etc.
   */
  deploymentConfig: DeploymentConfig;
  /**
   * Inspector for checking files in the local deployment ZIP.
   * Use this to validate required files exist BEFORE unpacking.
   * Paths are relative to backend assets directory.
   */
  localZip: LocalZipInspector;
}

// =============================================================================
// Hook-specific Contexts
// =============================================================================

/**
 * Context for pre-down hooks.
 * Runs BEFORE the old version is stopped.
 * Use for: pre-deployment smoke tests, validation.
 */
export interface PreDownHookContext extends BaseHookContext {
  helpers: PreDownHookHelpers;
}

/**
 * Context for maintenance hooks.
 * Runs DURING maintenance window (old version stopped, new version not started).
 * Use for: database migrations, secret file creation, keycloak setup.
 */
export interface MaintenanceHookContext extends BaseHookContext {
  helpers: MaintenanceHookHelpers;
}

/**
 * Context for post-up hooks.
 * Runs AFTER the new version is started.
 * Use for: health checks, post-deployment smoke tests.
 */
export interface PostUpHookContext extends BaseHookContext {
  helpers: PostUpHookHelpers;
}

/**
 * Union type for all hook contexts.
 */
export type HookContext =
  | PreDownHookContext
  | MaintenanceHookContext
  | PostUpHookContext;

// =============================================================================
// Hook Function Signatures
// =============================================================================

/**
 * Function signature for pre-down hooks.
 */
export type PreDownHookFunction = (
  context: PreDownHookContext
) => Promise<void> | void;

/**
 * Function signature for maintenance hooks.
 */
export type MaintenanceHookFunction = (
  context: MaintenanceHookContext
) => Promise<void> | void;

/**
 * Function signature for post-up hooks.
 */
export type PostUpHookFunction = (
  context: PostUpHookContext
) => Promise<void> | void;

/**
 * Generic hook function type (accepts any hook context).
 */
export type HookFunction = (context: HookContext) => Promise<void> | void;
