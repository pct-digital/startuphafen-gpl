import { ScenarioEnvironmentControl } from '@startuphafen/cypress-help';

export const controller = new ScenarioEnvironmentControl({
  useStartuphafen: 'always',
  keycloakUrl: '/kc',
  startuphafenBackendUrl: '',
});
