import { Routes } from '@angular/router';
import { LoginGuard, PathService } from '@startuphafen/angular-common';
import { QuestionCatalogueContainerComponent } from './container/question-catalogue-container/question-catalogue-container.component';

export const buildf3Routes = (paths: PathService): Routes => {
  return [
    {
      path: paths.application.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: QuestionCatalogueContainerComponent,
      title: 'Antrag',
      canActivate: [LoginGuard],
    },
  ];
};
