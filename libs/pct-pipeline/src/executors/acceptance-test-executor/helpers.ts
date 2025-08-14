import path from 'path';

export function getE2eAppPath(e2eAppName: string) {
  const e2eLocation = path.join('apps', e2eAppName);
  return e2eLocation;
}
