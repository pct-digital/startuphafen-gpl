import { exec } from 'child_process';
import { dockerCommand } from 'docker-cli-js';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import slugify from 'slugify';
import { generateUUID } from '@startuphafen/utility';

export interface VideoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type VideoTimestamps = Record<string, { start: number; end?: number }>;

export interface VideoCutConfig {
  timestamps: VideoTimestamps;
  frame?: VideoRect;
}

export interface VideosCutConfig {
  byFile: Record<string, VideoCutConfig>;
}

function extendFrame(rect?: VideoRect) {
  if (!rect) {
    return;
  }
  // hacky fix for an annoying white border on the left side
  // dunno why...
  rect.x += 1;
  rect.width -= 2;
  rect.y += 1;
  rect.height -= 2;
}

export async function cutVideos(
  inputDirectory: string,
  outputDirectory: string,
  config: VideosCutConfig
) {
  for (const video of Object.keys(config.byFile)) {
    const videoFile = path.join(inputDirectory, video + '.feature.mp4');

    const cfg = config.byFile[video];
    extendFrame(cfg.frame);

    const fileOutDirectory = path.join(
      outputDirectory,
      slugify(video + '.feature')
    );
    fs.mkdirSync(fileOutDirectory, { recursive: true });

    console.log('Cut videos for ' + video, cfg);

    for (const scenario of Object.keys(cfg.timestamps)) {
      const scenarioName = slugify(scenario);
      const outFile = path.join(fileOutDirectory, scenarioName + '.mp4');

      const startTime = cfg.timestamps[scenario].start;
      const endTime = cfg.timestamps[scenario].end ?? 9999999;
      const duration = endTime - startTime;

      console.log(
        'Cutting video for scenario ' +
          scenarioName +
          ' start at ' +
          startTime +
          ' duration ' +
          duration +
          ' and writing to ' +
          outFile
      );
      await cutSlowVideo(videoFile, outFile, startTime, duration, cfg.frame);
    }
  }
}

/**
 * time values are in milliseconds
 *  */
// since this uses docker it cannot be directly used inside normal server code
// though if we ever want to do video editing there are ways around that
// but for now this is only a helper for the e2e runner to cut the cypress videos for the scenarios
export async function cutSlowVideo(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  rect?: VideoRect
) {
  const videoDirectory = path.dirname(videoPath);

  const videoName = path.basename(videoPath);
  const tempName = generateUUID() + '.mp4';

  const tempPath = path.join(videoDirectory, tempName);

  const timeFactor = 2;

  const ffmpegTime = (ms: number) => {
    const x = ms / 1000;
    const hours = Math.floor(x / 3600);
    const minutes = Math.floor((x % 3600) / 60);
    const seconds = x % 60;
    const secondsFull = Math.floor(seconds);
    const secondsPartial = Math.round((seconds - secondsFull) * 1000);
    const p = (z: number) => (z < 10 ? '0' + z : '' + z);
    return (
      p(hours) +
      ':' +
      p(minutes) +
      ':' +
      p(secondsFull) +
      '.' +
      _.padStart(secondsPartial + '', 3, '0')
    );
  };

  const filters = [];

  if (rect != null) {
    filters.push(`crop=${rect.width}:${rect.height}:${rect.x}:${rect.y}`);
  }

  filters.push('setpts=' + timeFactor + '.0*PTS');
  // MUCH too slow
  // filters.push("minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=30'");

  const filtersParam = '-filter:v "' + filters.join(',') + '"';

  const dcmd = `run --rm -v "${videoDirectory}":"${videoDirectory}" -w "${videoDirectory}" linuxserver/ffmpeg:6.1.1 -ss ${ffmpegTime(
    startTime
  )} -i ${videoName} -t ${ffmpegTime(
    duration * timeFactor
  )} -preset fast -crf 24 -hide_banner -loglevel error -y ${filtersParam} ${tempName}`;

  //   console.log('dcmd', dcmd);

  // make sure the file exists already, such that it is only overwritten by ffmpeg, not created. This way it won't be owned by root in the end (docker issue)
  exec('touch "' + tempPath + '"');

  await dockerCommand(dcmd);

  fs.renameSync(tempPath, outputPath);
}
