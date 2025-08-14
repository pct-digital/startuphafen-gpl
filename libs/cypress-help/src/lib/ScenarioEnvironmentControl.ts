// eslint-disable-next-line @nx/enforce-module-boundaries
import type { E2eRoutes } from '../../../../apps/startuphafen-backend/src/e2e-utilites/e2e-routes';

import { createTRPCProxyClient } from '@trpc/client';
import { waitForKeycloak } from './restarts/keycloak';
import { waitForCheckPass } from './restarts/waiter';
import {
  buildBaseTrpcConfig,
  createTinyRPCClient,
  TrpcClientFor,
} from './trpc/cypress-trpc';

export interface CypressEnvironmentConfiguration {
  /**
   * always: The startuphafen e2e tests
   * conditional: the app tests, check scenario name identifier "S1" wont use startuphafen, "S1P" will, as it ends in P
   * never: no startuphafen environment
   */
  useStartuphafen: 'always' | 'conditional' | 'never';

  testserverUrl: string;

  startuphafenBackendUrl?: string;
  syncUrl?: string;

  mailServerUrl?: string;

  keycloakUrl?: string;
  startuphafenFrontendHost?: string;
}

export interface EnvironmentControls {
  startuphafenBackend: TrpcClientFor<E2eRoutes>;
}

export function getScenarioName(x: any) {
  return x[1].title;
}

export class ScenarioEnvironmentControl {
  fetch: EnvironmentControls;
  cypress: EnvironmentControls;

  constructor(public options: CypressEnvironmentConfiguration) {
    this.fetch = this.initFetchControls();
    this.cypress = this.initCypressControls();
  }

  private initFetchControls(): EnvironmentControls {
    return {
      startuphafenBackend: createTRPCProxyClient<E2eRoutes>(
        buildBaseTrpcConfig(`${this.options.startuphafenBackendUrl ?? ''}/e2e`)
      ),
    };
  }

  private initCypressControls(): EnvironmentControls {
    return {
      startuphafenBackend: createTinyRPCClient<E2eRoutes>(
        this.fetch.startuphafenBackend
      ),
    };
  }

  private shouldUseStartuphafen(scenarioName: string) {
    if (this.options.useStartuphafen === 'always') {
      return true;
    }
    if (this.options.useStartuphafen === 'never') {
      return false;
    }
    const sIdentifier = scenarioName.split(' ')[0] ?? '';
    return sIdentifier.toLowerCase().endsWith('p');
  }

  syncAndApplyChangeInCypress() {
    // warning disabled: Not a real promise in the context of Cypress
  }

  async resetEnvironmentAsync(scenarioName: string) {
    console.log('Begin to reset the environment for scenario ' + scenarioName);

    if (this.shouldUseStartuphafen(scenarioName)) {
      console.log('Startuphafen is used');
      await this.waitForStartuphafenBackendToBeReady();
      await this.resetStartuphafenBackend();
      await this.waitForStartuphafenBackendToBeReady();

      await this.waitForKeycloakReady();
    } else {
      console.log('Startuphafen is not used for scenario ' + scenarioName);
    }

    await this.deleteAllTestMails();
  }

  private async waitForKeycloakReady() {
    const kcHost = this.options.keycloakUrl;
    if (kcHost != null) {
      await waitForKeycloak(kcHost);
    } else {
      throw new Error(
        'startuphafen is enabled, but no keycloak url is configured?'
      );
    }
  }

  private async deleteAllTestMails() {
    if (this.options.mailServerUrl != null) {
      return;
    }
  }

  clearLocalStorage() {
    // index-db deletion by cypress itself is chronically unreliable
    // -> do it ourself!
    cy.window().then((win) => {
      win.eval(`
    if (window.indexedDB.databases) {
      window.indexedDB.databases().then(dbs => {
        dbs.forEach(db => { window.indexedDB.deleteDatabase(db.name) });
      });
    }`);
    });
  }

  deleteDownloadsFolder() {
    cy.task('rmdir', Cypress.config('downloadsFolder'));
  }

  private async resetStartuphafenBackend() {
    try {
      const resetApiResponse =
        await this.fetch.startuphafenBackend.resetDatabaseAndStopServer.mutate();
      if (!resetApiResponse) {
        throw new Error(
          'server reset failed, check server log in your docker.log!'
        );
      }
    } catch (e: any) {
      if (
        !(
          typeof e.message === 'string' &&
          e.message.includes('is not valid JSON')
        )
      ) {
        throw e;
      }
    }
  }

  private async checkStartuphafenBackendIsOnline() {
    try {
      const resp = await this.fetch.startuphafenBackend.ping.query();
      return resp === 'pong';
    } catch (e) {
      return false;
    }
  }

  private async waitForStartuphafenBackendToBeReady() {
    await waitForCheckPass(
      async () => {
        return await this.checkStartuphafenBackendIsOnline();
      },
      3,
      60
    );
  }
}
