export interface AcceptanceTesterSchema {
  headed: boolean;
  noexit: boolean;
  documentationVideos: boolean;
  documentationScreenshots: boolean;
  size: 'web' | 'android' | 'iphone_65' | 'iphone_55' | 'ipad_129';
  restrict?: string;
  skipBuild?: boolean;
  noDockerLog?: boolean;
  frontendAppName: string;
  backendAppName: string;
  buildScriptName: string;
  e2eAppName: string;
  baseDockerFilePath: string;
  extendDockerFilePath: string;
  extraDockerFilePath: string;
  baseUrl: string;
}
