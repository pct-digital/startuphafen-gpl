// These two services are the one source of truth for route paths
// No more hardcoded strings!
// It is not perfect, but better: You need to be careful to keep this file and app.routes.ts
// to match together correctly. But if you do the paths are not duplicated anymore and easy to access to navigate to

import { Injectable } from '@angular/core';
import { resolvePathWithParameters } from '@startuphafen/utility';

/**
 * Used to define the paths ground truth
 * What paths with what parameters leads where?
 *
 * Used when the routes are build (see app.routes.ts) and as a basis of the NavService
 */
@Injectable({
  providedIn: 'root',
})
export class PathService {
  home = {
    root: 'start',
  };

  login = {
    root: 'login',
  };

  faq = {
    root: 'faqPage',
  };

  faqArticle = {
    root: 'faqArticlePage/:articleId',
  };

  contact = {
    root: 'contactPage',
  };

  createProfile = {
    root: 'createProfile',
  };

  application = {
    root: 'applicationPage/:projectId',
  };

  profile = {
    root: 'profilePage',
  };
}

/**
 * Used to generate paths to navigate to, so paths that have their parameters filled in.
 * The functions it provides should produce absolute paths based on the fragments in PathService.
 */
@Injectable({
  providedIn: 'root',
})
export class NavService {
  constructor(private path: PathService) {}

  private resolvePath(
    path: string[],
    params?: Record<string, string | number>
  ) {
    return resolvePathWithParameters(path, params);
  }

  home() {
    return this.resolvePath([this.path.home.root]);
  }

  login() {
    return this.resolvePath([this.path.login.root]);
  }

  faqPage() {
    return this.resolvePath([this.path.faq.root]);
  }

  faqArticlePage(articleId: string | number) {
    return this.resolvePath([this.path.faqArticle.root], { articleId });
  }

  contactPage() {
    return this.resolvePath([this.path.contact.root]);
  }

  createProfilePage() {
    return this.resolvePath([this.path.createProfile.root]);
  }

  applicationPage(projectId: string | number) {
    return this.resolvePath([this.path.application.root], { projectId });
  }
  profilePage() {
    return this.resolvePath([this.path.profile.root]);
  }
}
