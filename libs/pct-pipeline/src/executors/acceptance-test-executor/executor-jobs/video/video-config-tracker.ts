import { ChildProcess } from 'child_process';
import * as path from 'path';
import { VideosCutConfig } from '../../../../lib/ffmpeg';
import * as fs from 'fs';

export class VideoConfigTracker {
  private videosConfig: VideosCutConfig = { byFile: {} };
  constructor(cypressProcess: ChildProcess, private e2eAppPath: string) {
    if (cypressProcess.stdout != null) {
      cypressProcess.stdout.on('data', async (logLine: Buffer) => {
        this.updateVideoConfigForLog(logLine.toString());
        this.makeVideoDirectory();
        this.writeVideosConfigFile();
      });
    }
  }

  get videoPath() {
    return path.join(this.e2eAppPath, 'video');
  }
  get videoConfigFilePath() {
    return path.join(this.videoPath, 'cuts.json');
  }

  private makeVideoDirectory() {
    fs.mkdirSync(this.videoPath, {
      recursive: true, // will silently do nothing if the directory exists already
    });
  }
  private writeVideosConfigFile() {
    fs.writeFileSync(this.videoConfigFilePath, JSON.stringify(this.videosConfig, null, 2));
  }

  private updateVideoConfigForLog(logLine: string) {
    const videoTimestampRegex = /test:(before|after):run:([^:]*):([^:]*):(\d*)/gm;
    const vstamps = logLine.matchAll(videoTimestampRegex);
    for (const vstamp of vstamps) {
      const state = vstamp[1];
      const scenario = vstamp[2];
      const specFile = vstamp[3];
      const offset = Number(vstamp[4]);

      const videoConfig = this.videosConfig.byFile[specFile] ?? { timestamps: {} };

      const prev = videoConfig.timestamps[scenario];
      const isStartElseEnd = state === 'before';
      if (prev == null && !isStartElseEnd) {
        throw new Error('Video timestamping failed, was after printed before before? ' + vstamp[0]);
      } else {
        if (prev == null) {
          videoConfig.timestamps[scenario] = {
            start: offset,
          };
        } else {
          videoConfig.timestamps[scenario].end = offset;
        }
      }

      this.videosConfig.byFile[specFile] = videoConfig;
    }

    if (logLine.includes('frame:cut:')) {
      const rows = logLine.split('\n');
      for (const row of rows) {
        if (row.includes('frame:cut:')) {
          const rowPart = row.replace('frame:cut:', '');
          const nextSeparator = rowPart.indexOf(':');
          const specFile = rowPart.substring(0, nextSeparator);
          const frameJson = rowPart.substring(nextSeparator + 1);
          console.log(specFile, frameJson);
          const videoConfig = this.videosConfig.byFile[specFile] ?? { timestamps: {} };
          const frame = JSON.parse(frameJson);
          videoConfig.frame = frame;
          this.videosConfig.byFile[specFile] = videoConfig;
          break;
        }
      }
    }
  }
}
