import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
import { FAQItem } from '@startuphafen/startuphafen-common';
import { FaqPageService } from './faq-page.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';

describe('FaqPageService', () => {
  let spectator: SpectatorService<FaqPageService>;
  const createService = createServiceFactory({
    service: FaqPageService,
    mocks: [TrpcService],
  });

  beforeEach(() => (spectator = createService()));

  it('should have created', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('getContentList should call valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        getArtikelList: {
          query: async (_args: any) => {
            const res = [
              { id: 1, documentId: '', title: 'test' },
              { id: 2, documentId: '', title: 'test' },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getArtikelList('test');
    expect(response).toEqual([
      { id: 1, documentId: '', title: 'test' },
      { id: 2, documentId: '', title: 'test' },
    ]);
  });

  it('getArtikel should call valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        getArtikel: {
          query: async (_args) => {
            const res = {
              title: 'Test',
              documentId: '',
              subtitle: 'subtest',
              id: 1,
            };
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getArtikel('testId');
    expect(response).toEqual({
      title: 'Test',
      documentId: '',
      id: 1,
      subtitle: 'subtest',
    });
  });

  it('getFAQItemList should call a valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        getFAQItemList: {
          query: async (_args: any) => {
            const res: FAQItem[] = [
              { id: 1, question: '?', answer: '!', documentId: '' },
              { id: 2, question: '?', answer: '!', documentId: '' },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getFAQItemList('test');
    expect(response).toEqual([
      { id: 1, question: '?', answer: '!', documentId: '' },
      { id: 2, question: '?', answer: '!', documentId: '' },
    ]);
  });

  it('getFAQITem should call a valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        getFAQItem: {
          query: async (_args) => {
            const res: FAQItem = {
              documentId: '',
              id: 1,
              question: '?',
              answer: '!',
            };
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getFAQItem('testId');
    expect(response).toEqual({
      documentId: '',
      id: 1,
      question: '?',
      answer: '!',
    });
  });
  it('searchArticles should call valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        searchArticles: {
          query: async (_args) => {
            const res = [
              {
                title: 'Test',
                documentId: '',
                subtitle: 'subtest',
                id: 1,
              },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.searchArticles('testId');
    expect(response).toEqual([
      {
        title: 'Test',
        documentId: '',
        id: 1,
        subtitle: 'subtest',
      },
    ]);
  });

  it('getCategories should call a valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        getCategories: {
          query: async (_args) => {
            const res = [
              {
                categoryName: 'TestCategory',
                documentId: '101',
                id: 1,
              },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getCategories();
    expect(response).toEqual([
      {
        categoryName: 'TestCategory',
        documentId: '101',
        id: 1,
      },
    ]);
  });
});
