import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { NavService } from '../services/path.service';

export const LoginGuard: CanActivateFn = async () => {
  const keycloak = inject(KeycloakService);
  const hasLogin = keycloak.isLoggedIn() ?? false;

  if (hasLogin) {
    return true;
  }

  const nav = inject(NavService);
  const router = inject(Router);
  return router.parseUrl(nav.login());
};
