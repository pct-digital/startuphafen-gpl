import {
  ProcessContext,
  waitForProcessExit,
} from '../../../lib/ProcessContext';
import { getE2eAppPath } from '../helpers';
import { AcceptanceTesterSchema } from '../schema';
import { SpecFileProcessor } from './spec-file-processor';
import { VideoConfigTracker } from './video/video-config-tracker';

export interface PortConfig {
  webPort: number;
  apiPort: number;
  mailDevPort: number;
  syncPort: number;
  appPort: number;
}

export class CypressProcess {
  specFileProcessor: SpecFileProcessor;
  constructor(
    private processes: ProcessContext,
    private options: AcceptanceTesterSchema,
    private port: PortConfig
  ) {
    this.specFileProcessor = new SpecFileProcessor(options.e2eAppName, options);
  }

  async runCypress() {
    const args = this.buildTestArgs();
    const env = await this.buildTestEnv();

    console.log('Running cypress with configuration', args, env);

    const cypress = this.processes.startProcess('npx', args, {
      env: {
        ...process.env,
        ...env,
      },
    });

    if (this.options.documentationVideos) {
      new VideoConfigTracker(cypress, getE2eAppPath(this.options.e2eAppName));
    }

    const code = await waitForProcessExit(cypress);
    return code;
  }

  private buildTestArgs() {
    const args = [
      'nx',
      'run',
      `${this.options.e2eAppName}:e2e:production`,
      `--headed=${this.options.headed}`,
      `--baseUrl=http://localhost:${
        this.options.baseUrl === 'web' ? this.port.webPort : this.port.appPort
      }`,
    ];
    if (this.options.noexit) {
      args.push('--no-exit');
    }
    return args;
  }

  private async buildTestEnv() {
    await this.specFileProcessor.checkDuplicateScenario();
    const hasOnly = await this.specFileProcessor.hasOnlyInFileList();
    const env: any = {
      CYPRESS_VIDEO: this.options.documentationScreenshots ? 'false' : 'true',
      CYPRESS_VIDEO_COMPRESSION: this.options.documentationVideos
        ? 'false'
        : '28',
      CYPRESS_SLOWMOTION: this.options.documentationVideos + '',
      CYPRESS_SPEC_PATTERN: this.specFileProcessor.getSpecFilePattern(),
      CYPRESS_TAGS: hasOnly ? '@only' : 'not @ignore',
      CYPRESS_TEST_SERVER_BASEURL: `http://localhost:${this.port.apiPort}`,
      CYPRESS_APP_HOST: `http://localhost:${this.port.appPort}`,
      CYPRESS_WEB_HOST: `http://localhost:${this.port.webPort}`,
      DISPLAY: ':' + this.port.webPort,
      CYPRESS_MAIL_DEV_PORT: this.port.mailDevPort,
      CYPRESS_SYNC_PORT: this.port.syncPort,
      CYPRESS_SYNC_URL: `http://localhost:${this.port.syncPort}`,
    };

    if (this.options.headed) {
      delete env.DISPLAY;
    }

    if (this.options.documentationVideos) {
      env.VIDEO_RESOLUTION_WIDTH = 2560;
      env.VIDEO_RESULTION_HEIGHT = 1440;
    }

    const IOS_SCALE = 3;

    if (this.options.size !== 'android') {
      env.VIDEO_RESOLUTION_WIDTH = 2560;
      env.VIDEO_RESULTION_HEIGHT = 1440;
    }

    switch (this.options.size) {
      case 'web':
        env.CYPRESS_VIEWPORT_WIDTH = 2560;
        env.CYPRESS_VIEWPORT_HEIGHT = 1440;
        break;
      case 'ipad_129':
        env.CYPRESS_VIEWPORT_WIDTH = 2048 / IOS_SCALE;
        env.CYPRESS_VIEWPORT_HEIGHT = 2732 / IOS_SCALE;
        env.RETINA_FACTOR = IOS_SCALE;
        break;
      case 'iphone_55':
        env.CYPRESS_VIEWPORT_WIDTH = 1242 / IOS_SCALE;
        env.CYPRESS_VIEWPORT_HEIGHT = 2208 / IOS_SCALE;
        env.RETINA_FACTOR = IOS_SCALE;
        break;
      case 'iphone_65':
        env.CYPRESS_VIEWPORT_WIDTH = 1242 / IOS_SCALE;
        env.CYPRESS_VIEWPORT_HEIGHT = 2688 / IOS_SCALE;
        env.RETINA_FACTOR = IOS_SCALE;
        break;
      case 'android':
        // use default settings
        break;
    }

    return env;
  }
}
