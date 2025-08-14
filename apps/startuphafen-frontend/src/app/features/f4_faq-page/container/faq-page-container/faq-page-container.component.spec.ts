import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { Router } from '@angular/router';
import { NavService } from '@startuphafen/angular-common';
import { FaqPageService } from '../../services/faq-page.service';
import { FaqPageContainerComponent } from './faq-page-container.component';

describe('FaqPageContainerComponent', () => {
  let spectator: Spectator<FaqPageContainerComponent>;
  let router: Router;
  let navService: NavService;

  const createComponent = createComponentFactory({
    component: FaqPageContainerComponent,
    providers: [
      {
        provide: Router,
        useValue: {
          navigateByUrl: jest.fn().mockReturnValue(Promise.resolve(true)),
        },
      },
      {
        provide: NavService,
        useValue: {
          faqArticlePage: jest.fn().mockReturnValue('/faqArticlePage/42'),
        },
      },
    ],
    mocks: [FaqPageService],
  });

  it('should create', async () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });
  it('should have a title', async () => {
    spectator = createComponent();
    jest.spyOn(spectator.component, 'convertFaqBodies').mockImplementation();
    expect(spectator.query(byTestId('faq-page-title'))).toExist();
  });

  it('should fetch articles from strapi', async () => {
    spectator = createComponent();
    const faqService = spectator.inject<FaqPageService>(FaqPageService);
    const faqServiceSpy = jest.spyOn(faqService, 'getArtikelList');

    await spectator.component.loadArticles();
    faqServiceSpy.mockResolvedValue([
      { id: 1, documentId: '', title: 'Title' },
    ]);

    jest.spyOn(spectator.component, 'convertFaqBodies').mockImplementation();
    await spectator.component.reload();

    expect(faqService.getArtikelList).toHaveBeenCalled();
    expect(spectator.component.articles).toEqual([
      { id: 1, documentId: '', title: 'Title' },
    ]);
  });

  it('should navigate to the correct URL when onArticleClicked is called', () => {
    spectator = createComponent();
    router = spectator.inject(Router);
    navService = spectator.inject(NavService);

    const urlParam = 42;

    spectator.component.onArticleClicked(urlParam);

    expect(navService.faqArticlePage).toHaveBeenCalledWith(urlParam);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/faqArticlePage/42');
  });
  it('should fetch faqItems from strapi', async () => {
    spectator = createComponent();
    const faqService = spectator.inject<FaqPageService>(FaqPageService);
    const faqServiceSpy = jest.spyOn(faqService, 'getFAQItemList');

    await spectator.component.loadFAQItems();
    faqServiceSpy.mockResolvedValue([
      { question: '?', answer: '!', documentId: '', id: 1 },
    ]);

    await spectator.component.reload();

    expect(faqService.getFAQItemList).toHaveBeenCalled();
    expect(spectator.component.faqList).toEqual([
      //paragraphs because the answer gets parsed by marked
      { question: '?', answer: '<p>!</p>', documentId: '', id: 1 },
    ]);
  });
});
