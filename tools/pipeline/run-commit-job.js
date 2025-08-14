const execSync = require('child_process').execSync;

const works = process.argv[2]?.split('/') ?? [];

const DEVELOP_FAST = false;

const summary = {};
let fail = false;

for (const work of works) {
  const cmd = `npx nx run ${work} --verbose`;
  try {
    if (!DEVELOP_FAST) {
      execSync(cmd, {
        stdio: 'inherit',
        env: {
          ...process.env,
          TZ: 'Europe/Berlin',
        },
      });
    }

    summary[work] = true;
  } catch (e) {
    console.log(e);
    fail = true;

    summary[work] = false;
  }
}

console.log('===============================');
console.log('===============================');
console.log('===============================');

for (const work of works) {
  console.log(summary[work] ? 'PASS' : '!!! FAIL !!!', work);
}

console.log('===============================');
console.log('===============================');
console.log('===============================');

process.exitCode = fail ? 1 : 0;
