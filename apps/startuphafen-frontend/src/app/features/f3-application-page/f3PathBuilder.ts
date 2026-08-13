import { Routes } from '@angular/router';
import {
  EUNGuard,
  LoginGuard,
  PathService,
  UGGuard,
} from '@startuphafen/angular-common';
import { QuestionnairePresenterComponent } from './presenter/questionnaire-presenter/questionnaire-presenter.component';

export const buildf3Routes = (paths: PathService): Routes => {
  return [
    {
      path: paths.questionnaire.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: QuestionnairePresenterComponent,
      title: 'Antrag',
      canActivate: [LoginGuard, UGGuard, EUNGuard],
    },
  ];
};
