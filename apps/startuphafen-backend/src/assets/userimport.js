const fs = require('fs');
const path = require('path');

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

const user_directory = getArgumentPath('user_directory');
const admin_username = getArgumentPath('admin_username');
const admin_password = getArgumentPath('admin_password');
const realm_name = getArgumentPath('realm_name');
const host = getArgumentPath('host');
const tokenRequest = host + '/realms/master/protocol/openid-connect/token';
const importRequest = host + '/admin/realms/' + realm_name + '/partialImport';

console.log(`user directory: ${user_directory}`);
console.log(`admin username: ${admin_username}`);
console.log(`admin password: ${admin_password}`);
console.log(`host: ${host}`);
console.log(`token request: ${tokenRequest}`);
console.log(`import request: ${importRequest}`);

async function listFilesInDirectory(directoryPath) {
  const filesWithPaths = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.includes('users') || entry.name.includes('realm')) continue;
    const fullPath = path.join(directoryPath, entry.name);
    filesWithPaths.push(fullPath);
  }
  return filesWithPaths;
}

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('client_id', 'admin-cli');
  params.append('grant_type', 'password');
  params.append('username', admin_username);
  params.append('password', admin_password);

  const response = await fetch(tokenRequest, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params,
  });

  const resp = await response.json();

  console.log('GOT access token response', resp);

  return resp['access_token'];
}

function sendRequest(request, data, access_token) {
  return new Promise((resolve, reject) => {
    fetch(request, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: data,
      method: 'POST',
    }).then((response) => {
      if (response.status >= 400) {
        console.log('BAD response', response);
        reject(response);
      } else {
        resolve(response);
      }
    });
  });
}

// Main-Funktion
async function main() {
  await (async () => {
    const files = await listFilesInDirectory(user_directory);

    console.log('There are ' + files.length + ' files to import');

    // loop one by one for easier debugging
    for (let i = 0; i < files.length; i++) {
      const access_token = await getAccessToken();
      console.log('Got access token', access_token);
      const file = files[i];
      const data = fs.readFileSync(file, 'utf8');
      await sendRequest(importRequest, data, access_token);
      console.log('Imported file ' + (i + 1) + '/' + files.length);
    }
  })();
}

main();
