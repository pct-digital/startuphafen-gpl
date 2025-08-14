import { Routes } from '@angular/router';

import { LoginGuard, PathService } from '@startuphafen/angular-common';
import { StartPageComponent } from './features/common/start-page/start-page.component';
import { LoginContainerComponent } from './features/f1_login-page/container/login-container/login-container.component';
import { buildf2Routes } from './features/f2_profile-page/f2PathBuilder';
import { buildf3Routes } from './features/f3-application-page/f3PathBuilder';
import { buildf4Routes } from './features/f4_faq-page/f4PathBuilder';
import { buildf5Routes } from './features/f5_contact-page/f5PathBuilder';

export const buildRoutes = (paths: PathService): Routes => {
  // All routes must be build around the concept of using a root element under which all relevant other subroutes are located
  // This is used to make the marking of the navigation bar easy
  return [
    {
      path: paths.home.root,
      component: StartPageComponent,
      title: 'Startseite',
      canActivate: [LoginGuard],
    },
    ...buildf2Routes(paths),
    ...buildf3Routes(paths),
    ...buildf4Routes(paths),
    ...buildf5Routes(paths),
    {
      path: paths.login.root,
      component: LoginContainerComponent,
      title: 'Login',
    },
    {
      path: '**',
      redirectTo: paths.home.root,
      pathMatch: 'full',
    },
  ];
};
