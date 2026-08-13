import '@startuphafen/cypress-help';
import {
  disableServiceWorker,
  getScenarioName,
  patchCypressForVideoRecording,
} from '@startuphafen/cypress-help';
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
