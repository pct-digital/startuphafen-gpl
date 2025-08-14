import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import createEsbuildPlugin from '@badeball/cypress-cucumber-preprocessor/esbuild';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';
import { rmSync } from 'fs';
import path from 'path';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),

    specPattern: ['**/*.feature'],
    supportFile: 'src/support/e2e.ts',
    fixturesFolder: 'src/fixtures',
    viewportWidth: 1680,
    viewportHeight: 1050,

    video: false, // is enabled on demand via environment variable by the e2e executor
    videosFolder: 'video',
    videoCompression: false,
    taskTimeout: 300000,
    screenshotOnRunFailure: false,

    includeShadowDom: true,

    retries: 1,

    async setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): Promise<Cypress.PluginConfigOptions> {
      // This is required for the preprocessor to be able to generate JSON reports after each run, and more,
      await addCucumberPreprocessorPlugin(on, config);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('cypress-terminal-report/src/installLogsPrinter')(on, {
        printLogsToConsole: process.env.CI ? 'never' : 'onFail',
        printLogsToFile: 'always',
        compactLogs: 50,
        outputCompactLogs: false,
        outputRoot: config.projectRoot + '/logs/',
        specRoot: path.relative(config.projectRoot, 'spec'),
        outputTarget: {
          'cypress-logs|txt': 'txt',
        },
      });

      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config) as any],
        })
      );

      if (config.video) {
        on('before:browser:launch', (browser, launchOptions) => {
          const width = Number(process.env['VIDEO_RESOLUTION_WIDTH'] || 1680);
          const height = Number(process.env['VIDEO_RESULTION_HEIGHT'] || 1050);

          console.log(
            'setting the browser window size to %d x %d for video recording',
            width,
            height
          );

          if (browser?.name === 'chrome' && browser?.isHeadless) {
            launchOptions.args.push(`--window-size=${width},${height}`);

            // force screen to be non-retina and just use our given resolution
            launchOptions.args.push('--force-device-scale-factor=1');
          }

          if (browser?.name === 'electron' && browser?.isHeadless) {
            // might not work on CI for some reason
            launchOptions.preferences.width = width;
            launchOptions.preferences.height = height;
          }

          if (browser?.name === 'firefox' && browser?.isHeadless) {
            launchOptions.args.push(`--width=${width}`);
            launchOptions.args.push(`--height=${height}`);
          }

          return launchOptions;
        });
      }

      on('task', {
        log(message) {
          console.log(message);

          return null;
        },

        rmdir(dir: string) {
          rmSync(dir, {
            recursive: true,
            force: true,
            maxRetries: 10,
            retryDelay: 10,
          });

          return null;
        },
      });

      // Make sure to return the config object as it might have been modified by the plugin.
      return config;
    },
  },
});
