import { Injectable } from '@angular/core';
import { printLog } from '@startuphafen/utility';
import { KeycloakEventType, KeycloakService } from 'keycloak-angular';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable({
  providedIn: 'root',
})
export class InitService {
  constructor(
    private keycloak: KeycloakService,
    private featureFlags: FeatureFlagsService
  ) {}

  async initApp() {
    await this.keycloakInit();
    await this.featureFlags.initialize();
  }

  private async keycloakInit() {
    await this.keycloak.init({
      config: {
        url: '/kc',
        realm: 'startuphafen',
        clientId: 'startuphafen_app',
      },
      initOptions: {
        onLoad: 'check-sso',
        checkLoginIframe: false,
      },
    });

    // Proactively refresh the token on a fixed interval in addition to the
    // OnTokenExpired event, which does not fire reliably in all situations.
    setInterval(() => {
      this.keycloak.updateToken().catch(printLog);
    }, 7 * 60 * 1000);

    // no unsubscribe, as this subscription is added once at app-startup and never goes away until the browser tab is closed
    this.keycloak.keycloakEvents$.subscribe((event) => {
      if (event.type === KeycloakEventType.OnTokenExpired) {
        this.keycloak.updateToken().catch(printLog);
      }
    });
  }
}
