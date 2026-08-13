import { Component, inject, OnInit } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { LoginService } from '../../services/login.service';

@Component({
  selector: 'sh-login-pw',
  template: '<p>Redirecting to password login...</p>',
  standalone: true,
})
export class LoginPwComponent implements OnInit {
  private keycloak = inject(KeycloakService);
  private login = inject(LoginService);

  async ngOnInit() {
    const redirectUri = (await this.login.getRedirectHost()) + '/start';

    // keycloak-js ignores empty idpHint, so we need to manually create the login URL
    // and append kc_idp_hint= (empty value bypasses IdP redirector)
    const kc = this.keycloak.getKeycloakInstance();
    const loginUrl = kc.createLoginUrl({ redirectUri }) + '&kc_idp_hint=';
    window.location.href = loginUrl;
  }
}
