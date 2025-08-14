import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideDownload } from '@ng-icons/lucide';
import { NavService, ShButtonDirective } from '@startuphafen/angular-common';
import { Artikel } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-faq-article-page-presenter',
  standalone: true,
  imports: [ShButtonDirective],
  templateUrl: './faq-article-page-presenter.component.html',
  providers: [provideIcons({ lucideDownload })],
  styles: `
    ::ng-deep .article-content a {
      @apply text-primary;
    }

    ::ng-deep .article-content p {
      @apply mb-5;
    }

    ::ng-deep .article-content a:hover {
      @apply text-primary-shade underline;
    }
  `,
})
export class FaqArticlePagePresenterComponent {
  @Input() artilceId = '';
  @Input() articleData: Artikel | null = null;
  @Output() backButtonClicked = new EventEmitter();
  @Output() downLoadButtonClicked = new EventEmitter();

  constructor(private router: Router, private nav: NavService) {}

  async navigateNetworkRoute() {
    await this.router.navigateByUrl(this.nav.contactPage());
  }
}
