import { Routes } from '@angular/router';
import { AdminGuard, PathService } from '@startuphafen/angular-common';
import { AdminPageContainerComponent } from './container/admin-page-container.component';

export const buildf6Routes = (paths: PathService): Routes => {
  return [
    {
      path: paths.admin.root,
      data: {
        requiredRolesAny: ['startuphafen-admin'],
      },
      component: AdminPageContainerComponent,
      title: 'Admin Seite',
      canActivate: [AdminGuard],
    },
  ];
};
