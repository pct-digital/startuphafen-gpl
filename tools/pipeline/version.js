// A 2nd call to this script will use the temporary version.json file, so it will produce the exact same output

const { execSync } = require('child_process');
const { writeFileSync, mkdirSync, existsSync, readFileSync } = require('fs');

function getSha() {
  return execSync('git rev-parse HEAD').toString().trim();
}

function isClean() {
  const gitStatus = execSync('git status').toString().trim();
  const isClean =
    !gitStatus.includes('Your branch is ahead') &&
    !gitStatus.includes('Changes not staged') &&
    !gitStatus.includes('Untracked files');
  return isClean;
}

function getLastCommitTime() {
  const lastTimeStamp = execSync('git log -1 --format=%cd').toString().trim();
  return new Date(lastTimeStamp);
}

function getTimeVersion() {
  let now = new Date();

  const clean = isClean();
  if (clean) {
    now = getLastCommitTime();
  } else {
    // Get detailed git status to show what files are changed
    const gitStatus = execSync('git status --porcelain').toString().trim();
    const changedFiles = gitStatus
      .split('\n')
      .filter((line) => line.trim() !== '');

    console.log('Cannot create a versioned release from an unclean checkout!');
    console.log('Changed files:');
    for (const cf of changedFiles) {
      console.log(cf);
    }

    throw new Error(
      'cannot created a versioned release from an unclean checkout!'
    );
  }

  function pad0(x, n) {
    let xs = x + '';
    while (xs.length < n) {
      xs = '0' + xs;
    }
    return xs;
  }

  const timeVersion = [
    pad0(now.getFullYear() - 2000, 2),
    '.',
    pad0(now.getMonth() + 1, 2),
    pad0(now.getDate(), 2),
    '.',
    pad0(now.getHours(), 2),
    pad0(now.getMinutes(), 2),
    '.',
    pad0(now.getSeconds(), 2),
  ];

  let result = timeVersion.join('');
  if (!clean) {
    result += 'M';
  }
  return result;
}

if (!existsSync('version.json')) {
  const versionInfo = {
    time: getTimeVersion(),
    sha: getSha(),
  };
  console.log(
    'version.json is written for this build with content',
    versionInfo
  );

  writeFileSync(`version.json`, JSON.stringify(versionInfo));
} else {
  console.log('version.json exists already!');
}

const versionInfo = JSON.parse(readFileSync('version.json').toString());

console.log('loaded version.json', versionInfo);

mkdirSync('dist/apps/startuphafen-version', { recursive: true });
writeFileSync(
  `dist/apps/startuphafen-version/version.json`,
  JSON.stringify(versionInfo)
);

execSync(
  `node tools/pipeline/replace.js libs/startuphafen-common/src/buildinfo.ts CI_BUILD_TIME ` +
    versionInfo.time
);
execSync(
  `node tools/pipeline/replace.js libs/startuphafen-common/src/buildinfo.ts CI_BUILD_VERSION ` +
    versionInfo.sha
);
