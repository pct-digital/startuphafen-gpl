import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { NavService } from '../services/path.service';

export const AdminGuard: CanActivateFn = async () => {
  const keycloak = inject(KeycloakService);
  const hasLogin = keycloak.isLoggedIn() ?? false;
  const isAdmin = keycloak.isUserInRole('startuphafen-admin');

  if (hasLogin && isAdmin) {
    return true;
  }

  const nav = inject(NavService);
  const router = inject(Router);
  return router.parseUrl(nav.login());
};
