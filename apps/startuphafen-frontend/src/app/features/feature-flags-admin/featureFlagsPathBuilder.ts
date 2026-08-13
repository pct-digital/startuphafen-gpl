import { Routes } from '@angular/router';
import {
  AdminGuard,
  FeatureFlagAdminContainerComponent,
  PathService,
} from '@startuphafen/angular-common';

export const buildFeatureFlagRoutes = (paths: PathService): Routes => {
  return [
    {
      path: paths.featureFlags.root,
      data: {
        requiredRolesAny: ['startuphafen-admin'],
      },
      canActivate: [AdminGuard],
      component: FeatureFlagAdminContainerComponent,
      title: 'Feature Flags',
    },
  ];
};
