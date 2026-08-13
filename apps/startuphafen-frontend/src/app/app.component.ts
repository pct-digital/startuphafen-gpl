import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  FeatureFlagsService,
  LoaderComponent,
  PortalFooterComponent,
} from '@startuphafen/angular-common';
import { WatermarkAngularModule } from '@startuphafen/watermark/angular';
import { KeycloakService } from 'keycloak-angular';
import { PortalHeaderComponent } from './features/common/portal-header/portal-header.component';
import { ChatBubbleComponent } from './features/f6_chat-page/container/chat-bubble.component';

@Component({
  standalone: true,
  imports: [
    RouterModule,
    PortalHeaderComponent,
    PortalFooterComponent,
    ChatBubbleComponent,
    WatermarkAngularModule,
    LoaderComponent,
  ],
  selector: 'sh-root',
  templateUrl: './app.component.html',
  styles: ``,
})
export class AppComponent {
  title = 'startuphafen-frontend';
  private keycloak = inject(KeycloakService);
  private featureFlags = inject(FeatureFlagsService);

  checkUser() {
    return this.keycloak.isLoggedIn();
  }

  isChatEnabled() {
    return this.featureFlags.isEnabled('chat');
  }
}
