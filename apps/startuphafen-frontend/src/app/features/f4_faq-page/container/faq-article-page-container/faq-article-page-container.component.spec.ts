import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { ActivatedRoute, Router } from '@angular/router';
import { FaqPageService } from '../../services/faq-page.service';
import { FaqArticlePageContainerComponent } from './faq-article-page-container.component';

describe('FaqArticlePageContainerComponent', () => {
  let spectator: Spectator<FaqArticlePageContainerComponent>;
  let router: Router;

  const mockActivatedRoute = {
    snapshot: {
      paramMap: {
        has: (key: string) => key === 'articleId',
        get: (key: string) => (key === 'articleId' ? 42 : null),
      },
    },
  };

  const createComponent = createComponentFactory({
    component: FaqArticlePageContainerComponent,
    providers: [
      {
        provide: Router,
        useValue: {
          navigateByUrl: jest.fn().mockReturnValue(Promise.resolve(true)),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: mockActivatedRoute,
      },
    ],
    mocks: [FaqPageService],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  it('should have a title', () => {
    spectator = createComponent();

    expect(spectator.query(byTestId('faq-article-page-title'))).toExist();
  });

  it('should navigate to the correct URL when onBackButtonClicked is called', () => {
    spectator = createComponent();
    router = spectator.inject(Router);

    spectator.component.onBackButtonClicked();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/faqPage');
  });

  it('should load the article details for a documentId', async () => {
    spectator = createComponent();
    const faqService = spectator.inject<FaqPageService>(FaqPageService);
    const faqServiceSpy = jest.spyOn(faqService, 'getArtikel');

    await spectator.component.loadSingleArticle();
    faqServiceSpy.mockResolvedValue({
      body: '',
      title: 'Test',
      id: 1,
      documentId: '',
      subtitle: 'subtest',
    });

    await spectator.component.reload();

    expect(faqService.getArtikel).toHaveBeenCalled();
    expect(spectator.component.article).toEqual({
      body: '',
      title: 'Test',
      id: 1,
      documentId: '',
      subtitle: 'subtest',
    });
  });
});
