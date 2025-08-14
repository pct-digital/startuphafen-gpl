// A helper program meant to clean up resources by running arbitrary commands
// as soon as a specific other program is not longer active

// This script is used in the acceptance-test-executor

// call like this: nde reaper.js P X1 X2 X3 X4 ...
// where P is a pid that is watched
// as soon as P can no longer be found the comamnds X1, ... XN are executed
// then reaper.js shuts down

// additionally a timeout of some hours is used, just in case.

const { execSync } = require('child_process');

const TIMEOUT = 6 * 3600 * 1000;

const targetPid = Number(process.argv[2]);
const cleanupCommands = process.argv.slice(3);

if (Number.isNaN(targetPid)) {
  throw new Error('target pid is not a number');
}

console.log(
  'Watching process ' +
    targetPid +
    ', waiting to cleanup resources once it is gone'
);

function cleanup() {
  for (const cmd of cleanupCommands) {
    try {
      console.log('Cleanup... ' + cmd);
      execSync(cmd);
      console.log('...done');
    } catch (e) {
      console.log("Failed to run cleanup command '" + cmd + "'", e);
    }
  }
}

function isPidActive(pid) {
  try {
    /**
     * "As a special case, a signal of 0 can be used to test for the existence of a process."
     * So "kill" does not kill here
     */
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e == null) throw new Error('???');
    return false;
  }
}

setTimeout(cleanup, TIMEOUT);

(async () => {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const isActive = isPidActive(targetPid);

    if (!isActive) {
      console.log(
        'Process ' +
          targetPid +
          ' is not active anymore. Cleaning up resources!'
      );
      cleanup();
      process.exit(0);
    }
  }
})();
