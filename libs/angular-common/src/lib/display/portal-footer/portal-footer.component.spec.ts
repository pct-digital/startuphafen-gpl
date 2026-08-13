import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { KeycloakService } from 'keycloak-angular';
import { AdminLoginService } from '../../services/admin-login.service';

import { PortalFooterComponent } from './portal-footer.component';

describe('PortalFooterComponent', () => {
  let spectator: Spectator<PortalFooterComponent>;
  const createComponent = createComponentFactory({
    component: PortalFooterComponent,
    providers: [
      {
        provide: KeycloakService,
        useValue: {
          isLoggedIn: jest.fn().mockReturnValue(false),
          isUserInRole: jest.fn().mockReturnValue(false),
        },
      },
      {
        provide: AdminLoginService,
        useValue: {
          loginThroughKeycloak: jest.fn(),
        },
      },
    ],
  });

  it('should create', () => {
    spectator = createComponent({});

    expect(spectator.component).toBeTruthy();
  });
});
