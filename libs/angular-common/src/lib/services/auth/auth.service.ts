import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private keycloakService: KeycloakService) {}

  private getUserId(): string | null {
    try {
      const tokenParsed =
        this.keycloakService.getKeycloakInstance()?.tokenParsed;
      return tokenParsed?.sub || null;
    } catch (error) {
      console.error('Error retrieving user ID from token:', error);
      return null;
    }
  }

  getUserIdSafely(): string | null {
    if (this.keycloakService.isLoggedIn()) {
      return this.getUserId();
    }
    return null;
  }
}
