import { Routes } from '@angular/router';
import { LoginGuard, PathService } from '@startuphafen/angular-common';
import { CorporateFormComponent } from './corporate-form.component';

export const buildCorporateFormRoutes = (paths: PathService): Routes => {
  return [
    {
      path: paths.corporateForm.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: CorporateFormComponent,
      title: 'Gesellschaftsform',
      canActivate: [LoginGuard],
    },
  ];
};
