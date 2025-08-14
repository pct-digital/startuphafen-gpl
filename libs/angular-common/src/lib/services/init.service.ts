import { Injectable } from '@angular/core';
import { printLog } from '@startuphafen/utility';
import { KeycloakEventType, KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root',
})
export class InitService {
  constructor(private keycloak: KeycloakService) {}

  async initApp() {
    await this.keycloakInit();
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
        // silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        checkLoginIframe: false,
      },
    });

    // dumb, but hopefully effective, I feel the OnTokenExpired thing somehow did not always work
    setInterval(() => {
      this.keycloak.updateToken().catch(printLog);
    }, 7 * 60 * 1000);

    // no unsubscribe, as this subscription is added once at app-startup and never goes away until the browser tab is closed
    this.keycloak.keycloakEvents$.subscribe((event) => {
      if (event.type === KeycloakEventType.OnTokenExpired) {
        console.log('Token expired, update token!');
        this.keycloak.updateToken().catch(printLog);
      }
    });
  }
}
