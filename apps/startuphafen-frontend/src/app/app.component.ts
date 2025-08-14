import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PortalFooterComponent } from '@startuphafen/angular-common';
import { KeycloakService } from 'keycloak-angular';
import { FaqQuicklinkComponent } from './features/common/faq-quicklink/faq-quicklink.component';
import { PortalHeaderComponent } from './features/common/portal-header/portal-header.component';

@Component({
  standalone: true,
  imports: [
    RouterModule,
    PortalHeaderComponent,
    PortalFooterComponent,
    FaqQuicklinkComponent,
  ],
  selector: 'sh-root',
  templateUrl: './app.component.html',
  styles: ``,
})
export class AppComponent {
  title = 'startuphafen-frontend';

  constructor(private keycloak: KeycloakService) {}

  async login() {
    await this.keycloak.login();
  }

  checkUser() {
    return this.keycloak.isLoggedIn();
  }
}
