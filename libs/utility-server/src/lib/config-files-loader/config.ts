import * as fs from 'fs';
import * as _ from 'lodash';
import path from 'path';
import { ZodTypeAny, z } from 'zod';
import { FileAccess } from '../file-access';

export const CONFIG_TYPE_SCHEMA = z.enum([
  'dev',
  'e2e',
  'staging',
  'production',
]);
export type CONFIG_TYPE = z.infer<typeof CONFIG_TYPE_SCHEMA>;

function mergeExceptArrays(dest: any, source: any) {
  return _.mergeWith(dest, source, (_dest, source) => {
    if (_.isArray(source)) {
      return source;
    } else {
      return undefined;
    }
  });
}

export class ConfigLoader<Z extends ZodTypeAny> {
  constructor(
    private paths: string[],
    private schema: Z,
    /**
     * This option exists mainly for the unit tests to easily mock the read file function
     */
    private faccess = new FileAccess()
  ) {}

  async loadConfig(): Promise<z.infer<Z>> {
    const result: any = {};

    for (const path of this.paths) {
      const fileContent = await this.faccess.readTextFile(path);
      mergeExceptArrays(result, JSON.parse(fileContent.toString()));
    }

    await this.applySecrets(result);

    return this.schema.parse(result);
  }

  private async applySecrets(result: any) {
    let xs: string[] = [];
    try {
      xs = await this.faccess.readdir('/run/secrets');
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }

    for (const x of xs) {
      if (x.endsWith('.json')) {
        const file = `/run/secrets/${x}`;
        console.log('Found server secrets in file ' + file);
        const secretConfig = await this.faccess.readTextFile(file);
        mergeExceptArrays(result, JSON.parse(secretConfig));
      }
    }
  }

  static async loadServerConfiguration<Z extends ZodTypeAny>(
    srcMainDir: string,
    env: CONFIG_TYPE,
    schema: Z
  ) {
    const cfgPaths: string[] = [];
    cfgPaths.unshift(path.join(srcMainDir, 'assets', 'config.json'));
    // Add local configuration file for secrets (will be ignored if it doesn't exist)
    const localConfigPath = path.join(
      srcMainDir,
      'assets',
      '.localConfigs.json'
    );
    if (fs.existsSync(localConfigPath)) {
      cfgPaths.push(localConfigPath);
    }
    switch (env) {
      case 'production':
        cfgPaths.push(path.join(srcMainDir, 'assets', 'config-staging.json'));
        cfgPaths.push(
          path.join(srcMainDir, 'assets', 'config-production.json')
        );
        break;
      case 'staging':
        cfgPaths.push(path.join(srcMainDir, 'assets', 'config-staging.json'));
        break;
      case 'e2e':
        cfgPaths.push(path.join(srcMainDir, 'assets', 'config-e2e.json'));
        break;
    }

    const cloader = new ConfigLoader(cfgPaths, schema);
    const config: z.infer<Z> = await cloader.loadConfig();
    return config;
  }
}
