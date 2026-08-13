import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { FeatureFlagsService } from '../services/feature-flags.service';
import { NavService } from '../services/path.service';

export const EUNGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot
) => {
  const catalogueId = route.paramMap.get('catalogueId') ?? 'none';

  if (catalogueId !== 'eun' && catalogueId !== 'none') {
    return true;
  }

  const keycloak = inject(KeycloakService);
  const featureFlags = inject(FeatureFlagsService);
  const hasLogin = keycloak.isLoggedIn() ?? false;
  const isEunEnabled = featureFlags.isEnabled('eu_questionflow');

  if (hasLogin && isEunEnabled) {
    return true;
  }

  const nav = inject(NavService);
  const router = inject(Router);
  return router.parseUrl(nav.login());
};
