import { ProcessContext, waitForProcessSuccess } from '../../lib/ProcessContext';
import { DocBuilderExecutorSchema } from './schema';
import * as path from 'path';
import * as fs from 'fs';
import { VideosCutConfig, cutVideos } from '../../lib/ffmpeg';
import { buildEleventyDoc } from '../../lib/doc';

interface DocBuilderDirectories {
  videoInDirectory: string;
  videoOutDirectory: string;
  docDirectory: string;
  specDirectory: string;
}

function setupDirectories(options: DocBuilderExecutorSchema): DocBuilderDirectories {
  const docDirectory = path.resolve(path.join('dist', 'doc'));
  const videoOutDirectory = path.join(docDirectory, 'video');
  const videoInDirectory = path.resolve(path.join('apps', options.app + '-e2e', 'video'));
  const specDirectory = path.resolve(path.join('apps', options.app + '-e2e', 'spec'));
  fs.rmSync(docDirectory, { recursive: true, force: true });
  fs.mkdirSync(videoOutDirectory, { recursive: true });
  return {
    docDirectory,
    videoOutDirectory,
    videoInDirectory,
    specDirectory,
  };
}

function loadVersionInfo(options: DocBuilderExecutorSchema) {
  const versionFilePath = path.join('dist', 'apps', options.app, 'version.json');
  if (!fs.existsSync(versionFilePath)) {
    return 'UNKNOWN_VERSION';
  }

  const vjson = JSON.parse(fs.readFileSync(versionFilePath).toString());
  return `${vjson.build} / ${vjson.time} / ${vjson.sha}`;
}

export async function buildVideos(context: ProcessContext, options: DocBuilderExecutorSchema) {
  console.log('Build documentation Videos');
  await waitForProcessSuccess(
    context.startProcess('npx', ['nx', 'run', `${options.app}-e2e:test-accept`, '--documentationVideos', '--noDockerLog', '--skipBuild'])
  );
}

async function processVideo(dirs: DocBuilderDirectories) {
  console.log('Process videos');
  const cutsJson: VideosCutConfig = JSON.parse(fs.readFileSync(path.join(dirs.videoInDirectory, 'cuts.json')).toString());
  await cutVideos(dirs.videoInDirectory, dirs.videoOutDirectory, cutsJson);
}

export default async function runExecutor(options: DocBuilderExecutorSchema) {
  console.log('Executor ran for DocBuilder', options);

  const dirs = setupDirectories(options);

  console.log('Building documentation, relevant directories are', dirs);

  const context = new ProcessContext();

  if (!options.skipBuild) {
    await buildVideos(context, options);
  }

  await processVideo(dirs);

  await buildEleventyDoc(dirs.specDirectory, dirs.docDirectory, loadVersionInfo(options));

  return {
    success: true,
  };
}
