#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArguments() {
  // Minimal parsing: only recognizes --domain <value>, --ssh-port <number>, --ssh-key <key>
  const args = process.argv.slice(2);
  let domain = null;
  let sshPort = null;
  let sshKey = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--domain') {
      domain = args[i + 1];
      i++;
    } else if (a === '--ssh-port') {
      const v = args[i + 1];
      if (v) sshPort = parseInt(v, 10) || 22;
      i++;
    } else if (a === '--ssh-key') {
      sshKey = args[i + 1];
      i++;
    }
  }
  if (domain == null) {
    throw new Error('must provide --domain');
  }
  if (sshPort == null) {
    throw new Error('must provide --ssh-port');
  }
  if (sshKey == null) {
    throw new Error('must provide --ssh-key');
  }
  return { domain, sshPort, sshKey };
}

function createTempDirectory() {
  const name = Date.now() + (Math.random() + '').replaceAll('.', '');
  const p = path.join('/tmp/', name);
  fs.mkdirSync(p, {
    recursive: true,
  });
  return p;
}

function writeJsonFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(content, null, 2));
}

function writeEnvFile(dir, name, content) {
  const envs = Object.keys(content)
    .map((k) => k + '=' + content[k])
    .join('\n');
  fs.writeFileSync(path.join(dir, name), envs);
}

function writeTextFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), content + '');
}

// Generates a cryptographically secure random password consisting only of
// alphanumeric characters (a-zA-Z0-9). Uses rejection sampling to avoid bias.
function generateAlphanumericPassword(length = 32) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const alphabetLength = alphabet.length; // 62
  const maxByte = 256 - (256 % alphabetLength); // largest multiple of 62 below 256 to remove modulo bias
  const chars = [];
  while (chars.length < length) {
    const buf = crypto.randomBytes(length * 2); // oversize to reduce iterations
    for (let i = 0; i < buf.length && chars.length < length; i++) {
      const value = buf[i];
      if (value < maxByte) {
        chars.push(alphabet[value % alphabetLength]);
      }
    }
  }
  return chars.join('');
}

const args = parseArguments();

const secretDir = createTempDirectory();
const jsonOverwriteDir = createTempDirectory();
const envOverwriteDir = createTempDirectory();
const envDir = createTempDirectory();

const dbPassword = generateAlphanumericPassword(32);
const kcdbPassword = generateAlphanumericPassword(32);

const knexConfig = {
  connection: {
    host: 'database',
    user: 'app',
    database: 'app',
    password: dbPassword,
  },
};

writeJsonFile(jsonOverwriteDir, 'APP_BACKEND_SECRETS', {
  knex: knexConfig,
  allowedOrigins: [`https://${args.domain}`],
});

writeEnvFile(envOverwriteDir, 'DEPLOY_DOCKER_ENV', {
  POSTGRES_PASSWORD: dbPassword,
  APP_HOST: '${DEPLOY_DOMAIN}',
  KC_DB_URL: `jdbc:postgresql://keycloak-database:5432/keycloak`,
  KC_DB_USERNAME: 'keycloak',
  KC_DB_PASSWORD: kcdbPassword,
});

writeTextFile(envDir, 'DEPLOY_DOMAIN', args.domain);

writeTextFile(envDir, 'DEPLOY_SERVER', args.domain);

writeTextFile(envDir, 'DEPLOY_ENVIRONMENT', 'staging');

writeTextFile(secretDir, 'DEPLOY_SSH_PRIVATE_KEY', args.sshKey);

writeTextFile(envDir, 'DEPLOY_SSH_PORT', args.sshPort);

console.log(
  JSON.stringify({
    envDir,
    secretDir,
    envOverwriteDir,
    jsonOverwriteDir,
  })
);
