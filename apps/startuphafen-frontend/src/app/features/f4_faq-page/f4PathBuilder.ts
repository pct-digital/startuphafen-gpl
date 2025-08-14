import { Routes } from '@angular/router';
import { LoginGuard, PathService } from '@startuphafen/angular-common';
import { FaqArticlePageContainerComponent } from './container/faq-article-page-container/faq-article-page-container.component';
import { FaqPageContainerComponent } from './container/faq-page-container/faq-page-container.component';

export const buildf4Routes = (paths: PathService): Routes => {
  return [
    {
      path: paths.faq.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: FaqPageContainerComponent,
      title: 'FAQ',
      canActivate: [LoginGuard],
    },
    {
      path: paths.faqArticle.root,
      data: {
        requiredRolesAny: ['login'],
      },
      component: FaqArticlePageContainerComponent,
      title: 'Artikel',
      canActivate: [LoginGuard],
    },
  ];
};
