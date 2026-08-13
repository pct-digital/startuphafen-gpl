import { existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { ComposeOptions } from '../../infra/docker-client';
import { logger } from '../utils/logger';
import {
  createMaintenanceHelpers,
  createPostUpHelpers,
  createPreDownHelpers,
} from './hook-helpers';
import {
  BaseHookContext,
  HookFunction,
  HookType,
  MaintenanceHookContext,
  PostUpHookContext,
  PreDownHookContext,
} from './hook-types';

export class HookRunner {
  constructor(private baseContext: BaseHookContext) {}

  /**
   * Execute a hook script if it exists.
   *
   * @param hookPath - Absolute path to the hook script (e.g., /path/to/post-up.js)
   * @param hookType - The type of hook being run (determines which helpers are available)
   */
  async runHook(hookPath: string, hookType: HookType): Promise<void> {
    if (!existsSync(hookPath)) {
      logger.debug(`Hook not found at ${hookPath}, skipping.`);
      return;
    }

    logger.info(`Running ${hookType} hook: ${hookPath}`);

    // Build the appropriate context for this hook type
    const context = this.buildContext(hookType);

    // Dynamic import requires a file URL for absolute paths on some platforms/versions
    // and ensures we bypass some CJS/ESM interop issues if the hook is ESM.
    // If the hook is CJS (module.exports), import() returns a module with a 'default' property
    // containing the exports, or the exports themselves depending on interop.

    // Using pathToFileURL to ensure cross-platform compatibility for absolute paths
    // Appending a query param to invalidate module cache if the file changed or is re-run in same process
    const modulePath = `${pathToFileURL(hookPath).href}?t=${Date.now()}`;

    const hookModule = await import(modulePath);

    // Support both `export default function` (ESM) and `module.exports = function` (CJS)
    // In CJS via import(), `default` often holds the module.exports.
    const hookFn: HookFunction = hookModule.default || hookModule;

    if (typeof hookFn !== 'function') {
      throw new Error(
        `Hook script at ${hookPath} does not export a function. Found: ${typeof hookFn}`
      );
    }

    await hookFn(context);

    logger.info(`Hook completed successfully: ${hookPath}`);
  }

  /**
   * Build compose options for managing local database containers.
   * Delegates to PathResolver to ensure consistency with DockerLifecycleService.
   */
  private buildComposeOptions(): ComposeOptions {
    const { pathResolver, version, deploymentConfig } = this.baseContext;
    return pathResolver.buildComposeOptions(
      version,
      deploymentConfig.composeFiles
    );
  }

  private buildContext(
    hookType: HookType
  ): PreDownHookContext | MaintenanceHookContext | PostUpHookContext {
    switch (hookType) {
      case 'pre-down':
        return {
          ...this.baseContext,
          helpers: createPreDownHelpers({
            ssh: this.baseContext.ssh,
            docker: this.baseContext.docker,
            deploymentConfig: this.baseContext.deploymentConfig,
            composeOptions: this.buildComposeOptions(),
            env: this.baseContext.env,
          }),
        };
      case 'maintenance':
        return {
          ...this.baseContext,
          helpers: createMaintenanceHelpers({
            ssh: this.baseContext.ssh,
            docker: this.baseContext.docker,
            remoteFs: this.baseContext.remoteFs,
            deploymentConfig: this.baseContext.deploymentConfig,
            composeOptions: this.buildComposeOptions(),
            env: this.baseContext.env,
          }),
        };
      case 'post-up':
        return {
          ...this.baseContext,
          helpers: createPostUpHelpers({
            ssh: this.baseContext.ssh,
            docker: this.baseContext.docker,
            composeOptions: this.buildComposeOptions(),
            env: this.baseContext.env,
          }),
        };
    }
  }
}
