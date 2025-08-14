// this file has to be in the same dir as the assets folder to work

import path from 'path';

export function getAssetPath(assetName: string) {
  return path.join(__dirname, 'assets', assetName);
}
