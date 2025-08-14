import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { LoginPageTexts } from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { LoginDisplayComponent } from '../../display/login-display/login-display.component';
import { LoginService } from '../../services/login.service';

@Component({
  selector: 'sh-login-container',
  templateUrl: './login-container.component.html',
  standalone: true,
  imports: [CommonModule, LoginDisplayComponent],
})
export class LoginContainerComponent implements OnInit {
  private login = inject(LoginService);
  private keycloak = inject(KeycloakService);
  private router = inject(Router);

  loginPageTexts: LoginPageTexts = {
    title: '',
    subtitle: '',
    content: '',
    loginButton: '',
    registerButton: '',
  };

  async ngOnInit() {
    this.loginPageTexts = await this.login.getText();
    //idk if this is bad practice, but calling keycloak.login with the ridirectUri in the app.component.ts
    //doesn't work, since that is where the login function is for the navbar buttons
    if (this.keycloak.isLoggedIn()) {
      await this.router.navigate(['/start']);
    }
  }

  async onLogin() {
    await this.keycloak.login({
      redirectUri: (await this.login.getRedirectHost()) + '/start',
    });
  }

  async onRegister() {
    window.open(
      'https://id.bund.de/de/registration/Benutzername',
      '_blank',
      'noopener,noreferrer'
    );
  }
}
