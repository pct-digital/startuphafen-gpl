import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { LoginDisplayComponent } from './login-display.component';

describe('LoginDisplayComponent', () => {
  let spectator: Spectator<LoginDisplayComponent>;
  const createComponent = createComponentFactory({
    component: LoginDisplayComponent,
    shallow: true,
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        title: 'Welcome Back',
        subtitle: 'Sign in to continue',
        content: 'Access your account to view your dashboard and projects.',
        loginButton: 'Sign In',
        registerButton: 'Create Account',
      },
    });
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  describe('Input bindings', () => {
    it('should display the provided title', () => {
      const titleElement = spectator.query(byTestId('login-title'));
      expect(titleElement).toHaveText('Welcome Back');
    });

    it('should display the provided subtitle', () => {
      const subtitleElement = spectator.query('p[shCardSubtitle]');
      expect(subtitleElement).toHaveText('Sign in to continue');
    });

    it('should display the provided content', () => {
      const contentElement = spectator.query(byTestId('login-content'));
      expect(contentElement).toHaveProperty(
        'innerHTML',
        'Access your account to view your dashboard and projects.'
      );
    });

    it('should display the provided button labels', () => {
      const loginButton = spectator.query(byTestId('login-button'));
      const registerButton = spectator.query(byTestId('register-button'));

      expect(loginButton).toHaveText('Sign In');
      expect(registerButton).toHaveText('Create Account');
    });
  });

  describe('Event emissions', () => {
    it('should emit login event when login button is clicked', () => {
      const loginSpy = jest.spyOn(spectator.component.login, 'emit');
      const loginButton = spectator.query(byTestId('login-button'));

      spectator.click(loginButton as HTMLElement);

      expect(loginSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit register event when register button is clicked', () => {
      const registerSpy = jest.spyOn(spectator.component.register, 'emit');
      const registerButton = spectator.query(byTestId('register-button'));

      spectator.click(registerButton as HTMLElement);

      expect(registerSpy).toHaveBeenCalledTimes(1);
    });

    it('should call onLogin method when login button is clicked', () => {
      const onLoginSpy = jest.spyOn(spectator.component, 'onLogin');
      const loginButton = spectator.query(byTestId('login-button'));

      spectator.click(loginButton as HTMLElement);

      expect(onLoginSpy).toHaveBeenCalledTimes(1);
    });

    it('should call onRegister method when register button is clicked', () => {
      const onRegisterSpy = jest.spyOn(spectator.component, 'onRegister');
      const registerButton = spectator.query(byTestId('register-button'));

      spectator.click(registerButton as HTMLElement);

      expect(onRegisterSpy).toHaveBeenCalledTimes(1);
    });
  });
});
