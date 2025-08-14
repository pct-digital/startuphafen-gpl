import { Injectable } from '@angular/core';
import { TrpcService } from '@startuphafen/angular-common';
import {
  ArticleCategory,
  Artikel,
  FAQItem,
} from '@startuphafen/startuphafen-common';

@Injectable({
  providedIn: 'root',
})
export class FaqPageService {
  constructor(private trpc: TrpcService) {}

  async getArtikelList(contentName: string, filters?: string[]) {
    const res: Artikel[] = await this.trpc.client.CMS.getArtikelList.query({
      name: contentName,
      filters: filters,
    });
    return await this.loadIconUrl(res);
  }

  async getArtikel(documentId: string) {
    const res: Artikel = await this.trpc.client.CMS.getArtikel.query({
      documentId: documentId,
    });
    return res;
  }

  async getFAQItemList(contentName: string, filters?: string[]) {
    const res: FAQItem[] = await this.trpc.client.CMS.getFAQItemList.query({
      name: contentName,
      filters: filters,
    });
    return res;
  }

  async getFAQItem(documentId: string) {
    const res: FAQItem = await this.trpc.client.CMS.getFAQItem.query({
      documentId: documentId,
    });
    return res;
  }

  async searchArticles(searchString: string) {
    const res: Artikel[] = await this.trpc.client.CMS.searchArticles.query({
      name: 'test-artikels',
      searchString: searchString,
    });

    return await this.loadIconUrl(res);
  }

  async getCategories() {
    const res: ArticleCategory[] =
      await this.trpc.client.CMS.getCategories.query({
        name: 'article-categories',
      });
    return res;
  }

  async getQuestionByQid(qId: string) {
    const res = await this.trpc.client.CMS.getQuestionFlowByFlowId.query(qId);
    return res;
  }

  private async loadIconUrl(articles: Artikel[]) {
    const filledInIcons: Artikel[] = [];

    for (const article of articles) {
      if (article.icon == null) {
        filledInIcons.push(article);
      } else {
        const icon = await this.trpc.client.CMS.getFileUrl.query(
          article.icon.url
        );
        article.icon.url = icon;
        filledInIcons.push(article);
      }
    }

    return filledInIcons;
  }
}
