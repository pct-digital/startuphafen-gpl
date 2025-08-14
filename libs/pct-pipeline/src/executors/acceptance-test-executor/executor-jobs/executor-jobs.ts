import * as fs from 'fs';
import * as os from 'os';
import { Transform, TransformCallback } from 'stream';
import {
  ProcessContext,
  waitForProcessExit,
} from '../../../lib/ProcessContext';
import { AcceptanceTesterSchema } from '../schema';
import { CypressProcess, PortConfig } from './cypress-process';

const DOCKERCOMPOSE = 'docker';

// authored by chatgpt
class TimestampTransform extends Transform {
  private _lastLine: string;

  constructor(options?: any) {
    super(options);
    this._lastLine = ''; // Buffer for incomplete lines
  }

  override _transform(
    chunk: any,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    // Convert the chunk to a string and split into lines
    const data = this._lastLine + chunk.toString();
    const lines = data.split('\n');

    // The last line may be incomplete, so we buffer it
    this._lastLine = lines.pop() || '';

    // Add timestamp to each line
    const timestampedLines = lines.map((line) => {
      if (line.trim().length > 0) {
        return `[${Date.now()}] ${line}`;
      }
      return line;
    });

    // Join the lines back together and push to the next stream
    this.push(timestampedLines.join('\n') + '\n');
    callback();
  }

  override _flush(callback: TransformCallback): void {
    // Ensure any remaining data in the buffer is processed
    if (this._lastLine.trim().length > 0) {
      this.push(`[${Date.now()}] ${this._lastLine}\n`);
    }
    this._lastLine = ''; // Clear the buffer
    callback();
  }
}

export class ExecutorJobs {
  processes = new ProcessContext();

  environmentUp = false;

  constructor(
    public options: AcceptanceTesterSchema,
    public port: PortConfig
  ) {}

  get backendAppPathInsideDistFolder() {
    return `dist/apps/` + this.options.backendAppName;
  }

  get logsPath() {
    return `apps/${this.options.e2eAppName}/logs`;
  }

  get dockerLogPath() {
    return this.logsPath + '/docker.log';
  }

  ensureEmptyLogsExists() {
    fs.rmSync(this.logsPath, {
      force: true,
      recursive: true,
    });
    fs.mkdirSync(this.logsPath, {
      recursive: true,
    });
  }

  async startEnvironment() {
    if (!this.options.skipBuild) {
      await this.buildApp();
    } else {
      if (!fs.existsSync(this.backendAppPathInsideDistFolder)) {
        throw new Error(
          `The app was not build so far and --skipBuild is specified. When setting --skipBuild the app build for the test must be already prepared`
        );
      }
    }

    if (!this.options.headed && os.platform() !== 'darwin') {
      await this.xvfbUp();
    }

    this.ensureEmptyLogsExists();

    await this.dockerUp();

    this.trackDockerLog();
  }

  private async buildApp() {
    await waitForProcessExit(
      this.processes.startProcess(
        'npm',
        ['run', this.options.buildScriptName],
        {},
        true
      )
    );
  }

  private getProjectParam() {
    return ['-p', 'w_' + this.port.webPort + '_a_' + this.port.apiPort];
  }

  private async xvfbUp() {
    this.processes.startProcess('Xvfb', [
      `:${this.port.webPort}`,
      '-screen',
      '0',
      '1280x1024x24',
    ]);
  }

  private async dockerUp() {
    this.processes.spawnReaperForCommand(this.buildDockerDownCommand());

    const extraFileParam: string[] = [];
    if (
      this.options.extraDockerFilePath != null &&
      this.options.extraDockerFilePath.length > 0
    ) {
      extraFileParam.push('-f');
      extraFileParam.push(this.options.extraDockerFilePath);
    }

    const denv = {
      ...process.env,
      WEB_PORT: this.port.webPort + '',
      API_PORT: this.port.apiPort + '',
      MAIL_DEV_PORT: this.port.mailDevPort + '',
      SYNC_PORT: this.port.syncPort + '',
      APP_PORT: this.port.appPort + '',
    };

    const args = [
      'compose',
      '-f',
      this.options.baseDockerFilePath ?? 'assets/docker-compose.yml',
      '-f',
      this.options.extendDockerFilePath ?? 'assets/docker-compose-e2e.yml',
      ...extraFileParam,
      ...this.getProjectParam(),
      'up',
      '-d',
    ];
    const upProc = this.processes.startProcess(
      DOCKERCOMPOSE,
      args,
      {
        env: denv,
        cwd: this.backendAppPathInsideDistFolder,
      },
      false,
      true
    );

    const dlogStream = fs.createWriteStream(this.dockerLogPath);
    if (upProc.stdout != null && upProc.stderr != null) {
      upProc.stdout.pipe(new TimestampTransform()).pipe(dlogStream);
      upProc.stderr.pipe(new TimestampTransform()).pipe(dlogStream);
    }

    const upCode = await waitForProcessExit(upProc);

    this.environmentUp = upCode === 0;
    if (this.environmentUp) {
      console.log('docker compose up completed!');
    } else {
      console.log('docker compose up failed!');
    }

    try {
      dlogStream.end();
    } catch (e) {
      console.log('Failed to close write stream to docker.log', e);
    }
  }

  private trackDockerLog() {
    if (this.environmentUp) {
      const logProc = this.processes.startProcess(
        DOCKERCOMPOSE,
        ['compose', ...this.getProjectParam(), 'logs', '-f', '--no-color'],
        {
          cwd: this.backendAppPathInsideDistFolder,
        },
        false,
        this.options.noDockerLog
      );

      if (this.options.noDockerLog) {
        const dlogStream = fs.createWriteStream(this.dockerLogPath, {
          flags: 'a',
        });

        if (logProc.stdout != null && logProc.stderr != null) {
          logProc.stdout.pipe(new TimestampTransform()).pipe(dlogStream);
          logProc.stderr.pipe(new TimestampTransform()).pipe(dlogStream);
        }
      }
    }
  }

  async test() {
    if (!this.environmentUp) {
      console.log(
        'Not starting test, test environment was not created successfully!'
      );
      return;
    }
    const cypress = new CypressProcess(this.processes, this.options, this.port);
    const code = await cypress.runCypress();
    return code === 0;
  }

  private buildDockerDownCommand() {
    return `${DOCKERCOMPOSE} compose ${this.getProjectParam().join(
      ' '
    )} down -v`;
  }
}
