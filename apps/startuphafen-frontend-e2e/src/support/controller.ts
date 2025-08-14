import { ScenarioEnvironmentControl } from '@startuphafen/cypress-help';

export const controller = new ScenarioEnvironmentControl({
  testserverUrl: Cypress.env('TEST_SERVER_BASEURL'),
  useStartuphafen: 'always',
  keycloakUrl: '/kc',
  mailServerUrl: 'http://localhost:' + Cypress.env('MAIL_DEV_PORT'),
  startuphafenBackendUrl: '',
  syncUrl: Cypress.env('SYNC_URL'),
  startuphafenFrontendHost: Cypress.env('CYPRESS_WEB_HOST'),
});
