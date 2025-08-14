// This is a script meant to be run to initially setup a build with secrets that it may need to be used
// Basically it puts together the two parts that must not be combined until on the production server:
// 1. The "general" build package
// 2. Any secret configurations that the server needs to connect to protected data sources (db passwords and such)

// This way the build package can be created completely from the git repository without
// the git repo containing any secret values itself.

// There are two reasons this script exists:

// 1. The knowledge about "how to configure the build package with the secrets" should be part of the build package itself through this file. Before it was separate in some deploy script.
// 2. The keycloak configuration requires a slightly more complex merging step, for which other abstractions were not powerful enough

// Required inputs are:
// 1. "backend":    Path to the backend secrets file
// 2. "docker":     Path to the docker environment secret variables file
// 3. "keycloak":   Path to the keycloak realm secrets json file
// 4. "config":     Path to the config secrets json file

// After this script is run the input files can be deleted

// Input syntax is as follows:
// backend=<path> sync=<path> gesa=<path> ....
// The order is not important

const fs = require('fs');
const path = require('path');
const mergeDeep = require('./mergedeep');

if (fs.existsSync(path.join(__dirname, 'init-marker'))) {
  throw new Error(
    'The initsecrets.js script must not be used more than once! If a previous call was unsuccessful you may clean up the mess it made and delete the init-marker file to try again. Easiest way to cleanup: Delete everything and unzip the clean package again.'
  );
}

fs.writeFileSync(path.join(__dirname, 'init-marker'), '');

function getArgumentPath(argName, optional = false) {
  const result = process.argv.find((arg) => arg.split('=')[0] === argName);
  if (result == null && !optional)
    throw new Error('Missing required argument: ' + argName);
  if (result == null && optional) {
    return '';
  }
  const [, path] = result.split('=');
  return path;
}

const copyFiles = {
  backend: '../../backend_secrets.json',
  docker: '.env',
  config: './config-secrets.json',
};

for (const [key, p] of Object.entries(copyFiles)) {
  fs.copyFileSync(getArgumentPath(key), path.join(__dirname, p));
}

// Keycloak file merging

function loadJsonFileOrEmpty(fpath) {
  if (fpath.length > 0 && fs.existsSync(fpath)) {
    return JSON.parse(fs.readFileSync(fpath).toString());
  } else {
    return {};
  }
}

function loadEnvFileOrEmpty(fpath) {
  if (fpath.length > 0 && fs.existsSync(fpath)) {
    const content = fs.readFileSync(fpath).toString();
    const keyValuePair = [];
    const contentSplit = content.split('\n').filter((x) => x.length > 0);
    for (const c of contentSplit) {
      const i = c.indexOf('=');
      if (i !== -1)
        keyValuePair.push({
          k: c.slice(0, i),
          v: c.slice(i + 1).replace(/\r/g, ''),
        });
    }
    return keyValuePair;
  } else {
    return [];
  }
}

const isProduction = process.argv.includes('production');
const isStaging = process.argv.includes('staging');

if (isStaging && isProduction)
  throw new Error(
    'You cant have both staging & production enabled at the same time!'
  );

const baseFile = loadJsonFileOrEmpty(
  path.join(__dirname, 'keycloak/templates/realm.json')
);
const stagingFile =
  isStaging || isProduction
    ? loadJsonFileOrEmpty(
        path.join(__dirname, 'keycloak/templates/staging.json')
      )
    : {};
const prodFile = isProduction
  ? loadJsonFileOrEmpty(
      path.join(__dirname, 'keycloak/templates/production.json')
    )
  : {};
const secretFile = loadJsonFileOrEmpty(getArgumentPath('keycloak'));

let merged = JSON.stringify(
  mergeDeep(baseFile, stagingFile, prodFile, secretFile),
  undefined,
  2
);

const dockerEnvFile = loadEnvFileOrEmpty(path.join(__dirname, '.env'));

for (const entry of dockerEnvFile) {
  const k = entry.k;
  const v = entry.v;
  const kstr = '${{' + k + '}}';
  if (merged.includes(kstr)) {
    console.log('KEYCLOAK cfg replace based on DOCKER_ENV', kstr, v);
    merged = merged.replaceAll(kstr, v);
  }
}

fs.writeFileSync(path.join(__dirname, 'keycloak/import/realm.json'), merged);

// .
module.exports = { loadEnvFileOrEmpty };
