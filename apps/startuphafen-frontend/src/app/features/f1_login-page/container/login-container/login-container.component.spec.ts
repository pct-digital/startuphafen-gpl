import {
  createComponentFactory,
  Spectator,
  SpyObject,
} from '@ngneat/spectator/jest';
import { LoginPageTexts } from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { LoginDisplayComponent } from '../../display/login-display/login-display.component';
import { LoginService } from '../../services/login.service';
import { LoginContainerComponent } from './login-container.component';

describe('LoginContainerComponent', () => {
  let spectator: Spectator<LoginContainerComponent>;
  let loginServiceMock: SpyObject<LoginService>;
  let keycloakServiceMock: SpyObject<KeycloakService>;
  let originalWindowOpen: typeof window.open;

  const mockLoginPageTexts: LoginPageTexts = {
    title: 'Test Title',
    subtitle: 'Test Subtitle',
    content: 'Test Content',
    loginButton: 'Login Test',
    registerButton: 'Register Test',
  };

  const createComponent = createComponentFactory({
    component: LoginContainerComponent,
    imports: [LoginDisplayComponent],
    mocks: [LoginService, KeycloakService],
  });

  beforeEach(() => {
    // Save original implementation
    originalWindowOpen = window.open;
    // Replace with jest mock
    window.open = jest.fn();

    // Setup mock implementations before component creation
    loginServiceMock = createComponent().inject(LoginService);
    loginServiceMock.getText.mockResolvedValue(mockLoginPageTexts);
    loginServiceMock.getRedirectHost.mockResolvedValue('http://localhost:4000');

    // Now create the component after setting up mocks
    spectator = createComponent();
    keycloakServiceMock = spectator.inject(KeycloakService);
  });

  afterEach(() => {
    // Restore original implementation
    window.open = originalWindowOpen;
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should load login texts on initialization', async () => {
    await spectator.fixture.whenStable();
    spectator.detectChanges();

    expect(loginServiceMock.getText).toHaveBeenCalled();
    expect(spectator.component.loginPageTexts).toEqual(mockLoginPageTexts);
  });

  it('should pass correct text properties to login display component', async () => {
    await spectator.fixture.whenStable();
    spectator.detectChanges();

    const loginDisplayComponent = spectator.query('sh-login-display');
    expect(loginDisplayComponent).toBeTruthy();
    expect(loginDisplayComponent?.getAttribute('ng-reflect-title')).toEqual(
      mockLoginPageTexts.title
    );
    expect(loginDisplayComponent?.getAttribute('ng-reflect-subtitle')).toEqual(
      mockLoginPageTexts.subtitle
    );
    expect(loginDisplayComponent?.getAttribute('ng-reflect-content')).toEqual(
      mockLoginPageTexts.content
    );
    expect(
      loginDisplayComponent?.getAttribute('ng-reflect-login-button')
    ).toEqual(mockLoginPageTexts.loginButton);
    expect(
      loginDisplayComponent?.getAttribute('ng-reflect-register-button')
    ).toEqual(mockLoginPageTexts.registerButton);
  });

  it('should call keycloak login when onLogin is triggered', async () => {
    await spectator.component.onLogin();

    expect(keycloakServiceMock.login).toHaveBeenCalledWith({
      redirectUri: 'http://localhost:4000/start',
    });
  });

  it('should handle login event from display component', async () => {
    // Arrange
    const loginSpy = jest.spyOn(spectator.component, 'onLogin');
    await spectator.fixture.whenStable();
    spectator.detectChanges();

    spectator.triggerEventHandler('sh-login-display', 'login', null);

    expect(loginSpy).toHaveBeenCalled();
  });

  it('should open registration page in new window when onRegister is called', async () => {
    await spectator.component.onRegister();

    expect(window.open).toHaveBeenCalledWith(
      'https://id.bund.de/de/registration/Benutzername',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('should handle register event from display component', async () => {
    const registerSpy = jest.spyOn(spectator.component, 'onRegister');
    await spectator.fixture.whenStable();
    spectator.detectChanges();

    spectator.triggerEventHandler('sh-login-display', 'register', null);

    expect(registerSpy).toHaveBeenCalled();
  });
});
