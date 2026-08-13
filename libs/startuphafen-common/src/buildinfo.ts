// these values get replaced right before the web build in the CI server
export const BUILD_TIME = 'CI_BUILD_TIME';
export const BUILD_VERSION = 'CI_BUILD_VERSION';
export const BUILD_BRANCH_ID = 'CI_BUILD_BRANCH_ID';

export const VERSION = {
  timeVersion: BUILD_TIME,
  versionCode: BUILD_VERSION,
  branchId: BUILD_BRANCH_ID,
};

export const VERSION_STRING =
  VERSION.branchId +
  ' (' +
  VERSION.versionCode.substring(0, 7) +
  ') @ ' +
  VERSION.timeVersion;
