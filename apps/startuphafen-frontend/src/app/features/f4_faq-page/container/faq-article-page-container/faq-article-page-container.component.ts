import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavService } from '@startuphafen/angular-common';
import { Artikel } from '@startuphafen/startuphafen-common';
import { marked } from 'marked';
import { FaqArticlePagePresenterComponent } from '../../display/faq-article-page-presenter/faq-article-page-presenter.component';
import { FaqPageService } from '../../services/faq-page.service';

@Component({
  selector: 'sh-faq-article-page-container',
  standalone: true,
  imports: [FaqArticlePagePresenterComponent],
  templateUrl: './faq-article-page-container.component.html',
  styles: ``,
})
export class FaqArticlePageContainerComponent implements OnInit {
  articleId = '';
  article: Artikel | null = null;
  constructor(
    private activatedRoute: ActivatedRoute,
    private nav: NavService,
    private router: Router,
    private faqPageService: FaqPageService
  ) {}

  async ngOnInit() {
    await this.reload();
    window.scrollTo({ top: -1, left: 0, behavior: 'smooth' });
  }

  async reload() {
    const paramMap = this.activatedRoute.snapshot.paramMap;

    if (paramMap.has('articleId')) {
      this.articleId = paramMap.get('articleId')!;
      this.article = await this.loadSingleArticle();
      if (this.article != null) {
        const body: string = await marked.parse(this.article.body ?? '');
        this.article.body = this.addHeadingStyling(body ?? '');
        this.article.body = this.addLinkBehaviour(this.article.body);
      }
    }
  }

  onBackButtonClicked() {
    this.router
      .navigateByUrl(this.nav.faqPage())
      .catch(() => console.log('error'));
  }

  onDownloadClicked() {
    console.log('Download');
  }

  addHeadingStyling(body: string) {
    const mappedHeadings: Record<string, string> = {
      '<h1': '<h1 class="text-[48px]"',
      '<h2': '<h2 class="text-[36px]"',
      '<h3': '<h3 class="text-[28px]"',
    };
    return body.replace(/<h1|<h2|<h3/g, (r) => mappedHeadings[r]);
  }

  addLinkBehaviour(body: string) {
    const mappedHrefs: Record<string, string> = {
      '<a href=': '<a target="_blank" rel="noopener noreferrer" href=',
    };
    return body.replace(/<a href=/g, (r) => mappedHrefs[r]);
  }

  async loadSingleArticle() {
    const res = await this.faqPageService.getArtikel(this.articleId);
    return res;
  }
}
