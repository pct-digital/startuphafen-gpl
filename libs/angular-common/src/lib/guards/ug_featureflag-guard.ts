import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { FeatureFlagsService } from '../services/feature-flags.service';
import { NavService } from '../services/path.service';

export const UGGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const catalogueId = route.paramMap.get('catalogueId') ?? 'none';

  // Only apply guard logic when catalogueId is 'kapg'
  if (catalogueId !== 'kapg' && catalogueId !== 'none') {
    return true;
  }

  const keycloak = inject(KeycloakService);
  const featureFlags = inject(FeatureFlagsService);
  const hasLogin = keycloak.isLoggedIn() ?? false;
  const isUgEnabled = featureFlags.isEnabled('ug_questionflow');

  if (hasLogin && isUgEnabled) {
    return true;
  }

  const nav = inject(NavService);
  const router = inject(Router);
  return router.parseUrl(nav.login());
};
