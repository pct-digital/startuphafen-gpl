import { resolve } from 'path';

const stepDefinitionsPath = resolve(process.cwd(), './src/e2e/*.cy.ts');
const outputFolder = resolve(process.cwd(), '../../cyreport/cucumber-json');

export const nonGlobalStepDefinitions = true;
export const stepDefinitions = stepDefinitionsPath;
export const cucumberJson = {
  generate: false,
  outputFolder: outputFolder,
  filePrefix: '',
  fileSuffix: '.cucumber',
};
