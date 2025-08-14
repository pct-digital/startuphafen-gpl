import slugify from 'slugify';
import { resetTestserverForApp } from './restarts/app';

function getScenarioName(x: any) {
  return slugify(x[1].title);
}

export function notifyServerBeforeSpecs(Cypress: Cypress.Cypress, testServerUrl?: string) {
  Cypress.on('test:before:run:async', async function () {
    await resetTestserverForApp(testServerUrl ?? '', getScenarioName(arguments));
  });
}

export function disableServiceWorker(Cypress: any) {
  Cypress.on('window:before:load', (win: any) => {
    delete win.navigator.__proto__.serviceWorker;
    // some old blog post mentioned it using a capital S, but it is a small s in all my tests?!!!
    delete win.navigator.__proto__.ServiceWorker;
  });
}
