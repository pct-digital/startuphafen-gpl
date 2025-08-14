import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { KeycloakService } from 'keycloak-angular';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let spectator: SpectatorService<AuthService>;
  let keycloakServiceMock: jest.Mocked<KeycloakService>;

  const createService = createServiceFactory({
    service: AuthService,
    providers: [
      {
        provide: KeycloakService,
        useFactory: () => ({
          getKeycloakInstance: jest.fn(),
          isLoggedIn: jest.fn(),
        }),
      },
    ],
  });

  beforeEach(() => {
    spectator = createService();
    keycloakServiceMock = spectator.inject(
      KeycloakService
    ) as jest.Mocked<KeycloakService>;
  });

  it('should...', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('should return null when user is not logged in', () => {
    keycloakServiceMock.isLoggedIn.mockReturnValue(false);

    const userId = spectator.service['getUserIdSafely']();

    expect(userId).toBeNull();
    expect(keycloakServiceMock.isLoggedIn).toHaveBeenCalled();
  });

  it('should return user ID when user is logged in', () => {
    const mockUserId = 'testUser42';
    keycloakServiceMock.isLoggedIn.mockReturnValue(true);
    keycloakServiceMock.getKeycloakInstance.mockReturnValue({
      tokenParsed: { sub: mockUserId },
    } as any);

    const userId = spectator.service['getUserIdSafely']();

    expect(userId).toBe(mockUserId);
    expect(keycloakServiceMock.isLoggedIn).toHaveBeenCalled();
    expect(keycloakServiceMock.getKeycloakInstance).toHaveBeenCalled();
  });
});
