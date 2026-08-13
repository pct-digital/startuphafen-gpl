// A 2nd call to this script will use the temporary version.json file, so it will produce the exact same output

const { execSync } = require('child_process');
const { writeFileSync, mkdirSync, existsSync, readFileSync } = require('fs');
const crypto = require('crypto');

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

function getBranch() {
  // Get current branch name
  return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
}

/**
 * Extracts and normalizes the task ID from the branch name.
 * Handles formats like:
 * - some-word/PCTI-12344_bla_blup → PCTI-12344
 * - PCT-121 → PCT-121
 * - PCTI_1211 → PCTI-1211
 * - PCT_121 → PCT-121
 * - pcti_232 → PCTI-232
 * - pct_121 → PCT-121
 *
 */
function extractTaskId(branchName) {
  // Pattern to match task IDs: PCT(I)?[-_]?\d+
  // This matches: PCTI-123, PCT_123, pcti_123, pct-123, etc.
  const taskIdPattern = /(pcti?)([-_]?)(\d+)/i;
  const match = branchName.match(taskIdPattern);

  if (match) {
    const prefix = match[1].toUpperCase(); // PCTI or PCT
    const number = match[3];
    return `${prefix}-${number}`;
  }

  return null;
}

function createShortHash(branchName) {
  const hash = crypto.createHash('md5').update(branchName).digest('hex');
  const hexStr = hash.substring(0, 3);
  // Convert hex characters to letters only (0-9,a-f → a-p)
  return hexStr
    .split('')
    .map((char) => String.fromCharCode('a'.charCodeAt(0) + parseInt(char, 16)))
    .join('');
}

// the branch part of the release name must be limited in length
function createBranchShortId(branchName) {
  const task = extractTaskId(branchName);
  return (
    (task ?? branchName.substring(0, 5)) + '_' + createShortHash(branchName)
  );
}

if (!existsSync('version.json')) {
  const versionInfo = {
    time: getTimeVersion(),
    sha: getSha(),
    branchId: createBranchShortId(getBranch()),
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
execSync(
  `node tools/pipeline/replace.js libs/startuphafen-common/src/buildinfo.ts CI_BUILD_BRANCH_ID "` +
    versionInfo.branchId +
    `"`
);
