import { Routes } from '@angular/router';
import { LoginGuard, PathService } from '@startuphafen/angular-common';
import { ProfilePageComponent } from './container/profile-page/profile-page.component';

export const buildf2Routes = (paths: PathService): Routes => {
  return [
    {
      path: paths.profile.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: ProfilePageComponent,
      title: 'Profil Seite',
      canActivate: [LoginGuard],
    },
  ];
};
