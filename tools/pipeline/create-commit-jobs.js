const execSync = require('child_process').execSync;
const fs = require('fs');

const COMMIT_WORKERS = 8;

const NX_BASE = process.argv[2];
const NX_HEAD = process.argv[3];

function printAffectedList(target) {
  const COMMAND = `npx nx show projects --affected ${target != null ? '--with-target=' + target + ' ' : ''}--base=${NX_BASE} --head=${NX_HEAD}`;
  console.log(COMMAND);
  const raw = execSync(COMMAND).toString();
  const projects = raw
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x !== '');
  projects.sort();
  return projects;
}
const affectedProjects = printAffectedList();

console.log('affected projects', affectedProjects);

fs.writeFileSync('affected.json', JSON.stringify(affectedProjects, null, 2));

const lintProjects = printAffectedList('lint');
const lintWork = lintProjects.map((p) => p + ':lint');

const testProjects = printAffectedList('test');
const testWork = testProjects.map((p) => p + ':test');

const typecheckProjects = printAffectedList('typecheck');
const typecheckWork = typecheckProjects.map((p) => p + ':typecheck');

function splitWork(work, n) {
  const result = [];
  for (let k = 0; k < n; k++) {
    const workerTasks = [];
    for (let i = k; i < work.length; i += n) {
      workerTasks.push(work[i]);
    }
    if (workerTasks.length > 0) {
      result.push(workerTasks.join('/'));
    }
  }
  return result;
}

const allWork = [...lintWork, ...testWork, ...typecheckWork];

const matrix = {
  check: splitWork(allWork, COMMIT_WORKERS),
};

if (matrix.check.length === 0) {
  delete matrix.check;
}

fs.writeFileSync('job-matrix.json', JSON.stringify(matrix));

console.log(JSON.stringify(matrix, null, 2));
