import { promises as fs } from 'fs';

export async function loadAppId() {
  const fc = await fs.readFile('native-environments/active/appId.txt');
  return fc.toString().trim();
}

export async function loadAppName() {
  const fc = await fs.readFile('native-environments/active/appName.txt');
  return fc.toString().trim();
}

export async function loadGoogleMapsApiKey() {
  const fc = await fs.readFile('native-environments/active/googleMapsApiKey.txt');
  return fc.toString().trim();
}

export async function loadDeepLinkURI() {
  const fc = await fs.readFile('native-environments/active/deepLinkURI.txt');
  return fc.toString().trim();
}

export const BASE_VERSION = 300000;

export function getVersionCode(pipelineId: number) {
  const baseVersion = BASE_VERSION;
  const versionCode = baseVersion + pipelineId;
  return versionCode;
}

export async function getLatestUserVersion() {
  const logs = await fs.readdir('changelogs');

  const versions = logs.map((l) => l.replace('.txt', '')).filter((x) => x.split('.').length === 3);

  if (versions.length === 0) {
    throw new Error(
      'Missconfiguration of changelogs. The directory changelogs should include text files named after the versions of which the changelog is, such as 3.0.0.txt. They must be exactly three numbers separated by dots with ending .txt'
    );
  }

  versions.sort((a, b) => {
    const avs = a.split('.').map(Number);
    const bvs = b.split('.').map(Number);

    for (let i = 0; i < avs.length; i++) {
      const an = avs[i];
      const bn = bvs[i];
      if (an != bn) {
        return bn - an;
      }
    }

    return 0;
  });

  return versions[0];
}

export async function getLatestChangelog() {
  const lastVersion = getLatestUserVersion();

  const result = await fs.readFile('changelogs/' + lastVersion + '.txt');

  return result.toString();
}
