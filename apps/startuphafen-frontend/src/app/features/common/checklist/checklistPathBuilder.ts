import { Routes } from '@angular/router';
import { LoginGuard, PathService, UGGuard } from '@startuphafen/angular-common';
import { ChecklistComponent } from './checklist.component';

export const buildChecklistRoutes = (paths: PathService): Routes => {
  return [
    {
      path: paths.checklist.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: ChecklistComponent,
      title: 'Gründungs-Checkliste',
      canActivate: [LoginGuard, UGGuard],
    },
  ];
};
