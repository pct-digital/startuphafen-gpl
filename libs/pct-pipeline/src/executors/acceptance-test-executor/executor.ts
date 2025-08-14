import { getNFreePorts } from '@startuphafen/utility-server';
import { ExecutorJobs } from './executor-jobs/executor-jobs';
import { AcceptanceTesterSchema } from './schema';

function validateOptions(options: AcceptanceTesterSchema) {
  if (options.size == null) {
    options.size = 'android';
  }

  if (options.documentationScreenshots && options.documentationVideos) {
    throw new Error(
      'You cannot set documentation videos and screenshots to true at the same time!!!'
    );
  }
  if (
    !['android', 'iphone_65', 'iphone_55', 'ipad_129'].includes(options.size)
  ) {
    throw new Error('invalid size option: ' + options.size);
  }
}

export default async function runExecutor(options: AcceptanceTesterSchema) {
  let success: boolean | undefined = false;

  validateOptions(options);

  try {
    const [webPort, apiPort, mailDevPort, testServerPort, aport] =
      await getNFreePorts(5);
    const run = new ExecutorJobs(options, {
      webPort,
      apiPort,
      mailDevPort,
      syncPort: testServerPort,
      appPort: aport,
    });
    console.log('Docker log available at ' + run.dockerLogPath);
    await run.startEnvironment();
    success = await run.test();
    // stop environment is handled by the reaper.js model now:
    // Extra processes are spawned that watch this process and react to its end
  } catch (e) {
    console.log('test-accept fail due to ERROR CAUGHT: ', e);
    success = false;
  }
  return {
    success,
  };
}
