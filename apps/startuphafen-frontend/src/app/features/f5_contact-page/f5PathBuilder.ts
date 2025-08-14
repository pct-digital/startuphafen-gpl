import { Routes } from '@angular/router';
import { LoginGuard, PathService } from '@startuphafen/angular-common';
import { ContactPageContainerComponent } from './container/contact-page-container/contact-page-container.component';

export const buildf5Routes = (paths: PathService): Routes => {
  return [
    {
      path: paths.contact.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: ContactPageContainerComponent,
      title: 'Netzwerk',
      canActivate: [LoginGuard],
    },
  ];
};
