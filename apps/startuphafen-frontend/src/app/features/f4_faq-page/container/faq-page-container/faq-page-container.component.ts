import { Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { NavService } from '@startuphafen/angular-common';
import {
  ArticleCategory,
  Artikel,
  FAQItem,
} from '@startuphafen/startuphafen-common';
import { marked } from 'marked';
import { FaqPagePresenterComponent } from '../../display/faq-page-presenter/faq-page-presenter.component';
import { FaqPageService } from '../../services/faq-page.service';

@Component({
  selector: 'sh-faq-page-container',
  standalone: true,
  imports: [FaqPagePresenterComponent],
  templateUrl: './faq-page-container.component.html',
  styles: ``,
})
export class FaqPageContainerComponent implements OnInit {
  @Input() isPopup = false;
  articleListLength = 20;
  articles: any[] = [];
  articleFilterResultList: Artikel[] = [];
  articleCategories: string[] = [];
  articleCategoriesFormControl = new FormControl([]);
  articleSearchResults: Artikel[] = [];
  //faqCategories: string[] = [];
  isArticleSearch = false;
  isArticleNotFound = false;

  faqList: FAQItem[] = [];
  faqListLength = 10;
  categories: ArticleCategory[] = [];

  constructor(
    private router: Router,
    private nav: NavService,
    private faqPageService: FaqPageService
  ) {}

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.articles = await this.loadArticles();
    this.faqList = await this.loadFAQItems();
    this.categories = await this.loadCategories();
    await this.convertFaqBodies();
  }

  onArticleClicked(urlParam: string | number) {
    this.router
      .navigateByUrl(this.nav.faqArticlePage(urlParam))
      .catch(() => console.log('error'));
  }

  async searchSubmit(form: any) {
    if (form.search !== '') {
      this.isArticleSearch = true;
      this.articleSearchResults = await this.faqPageService.searchArticles(
        form.search
      );
    } else {
      this.isArticleSearch = false;
    }

    this.isArticleNotFound =
      this.articleSearchResults.length === 0 ? true : false;
  }

  async loadArticles() {
    const articles: Artikel[] = await this.faqPageService.getArtikelList(
      'test-artikels',
      ['title', 'documentId']
    );

    return articles;
  }

  async loadFAQItems() {
    const faqItems = await this.faqPageService.getFAQItemList('test-faqs', [
      'id',
      'documentId',
      'question',
      'answer',
    ]);
    return faqItems;
  }

  async loadCategories() {
    const categories = await this.faqPageService.getCategories();
    if (categories != null) {
      categories.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }
    return categories;
  }

  async convertFaqBodies() {
    if (this.faqList != null && this.faqList.length !== 0) {
      for (const f of this.faqList)
        f.answer = (await marked.parse(f.answer ?? '')).trim();
    }
  }
}
