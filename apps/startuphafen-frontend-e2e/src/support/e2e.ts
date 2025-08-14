// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import '@startuphafen/cypress-help';
import {
  disableServiceWorker,
  getScenarioName,
  patchCypressForVideoRecording,
} from '@startuphafen/cypress-help';
import 'cypress-ag-grid';
import './commands';
import { controller } from './controller';

// This file must not be imported from directly or it will end up getting loaded twice, which is bad!
console.log('Run e2e.ts!');

Cypress.on('test:before:run:async', async function () {
  await controller.resetEnvironmentAsync(getScenarioName(arguments));
});

beforeEach(() => {
  controller.clearLocalStorage();
  controller.deleteDownloadsFolder();
});

disableServiceWorker(Cypress);

const wantsToCutVideos = patchCypressForVideoRecording(cy, Cypress);

if (!wantsToCutVideos) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('cypress-terminal-report/src/installLogsCollector')({
    commandTimings: 'timestamp',
  });
}
