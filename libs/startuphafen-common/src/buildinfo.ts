// these values get replaced right before the web build in the CI server
export const BUILD_TIME = '24.1120.1737';
export const BUILD_VERSION = 'null';

export const VERSION = {
  timeVersion: BUILD_TIME,
  versionCode: BUILD_VERSION,
};

export const VERSION_STRING = VERSION.versionCode + ' @ ' + VERSION.timeVersion;
