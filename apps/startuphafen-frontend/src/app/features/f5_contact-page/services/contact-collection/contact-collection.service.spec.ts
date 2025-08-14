import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
import { Contact } from '@startuphafen/startuphafen-common';
import { ContactCollectionService } from './contact-collection.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';

describe('ContactCollectionService', () => {
  let spectator: SpectatorService<ContactCollectionService>;
  const createService = createServiceFactory({
    service: ContactCollectionService,
    mocks: [TrpcService],
  });

  const mockContacts: Contact[] = [
    {
      group: 'testGroup',
      name: 'testName',
      unternehmen: 'testCompany',
      mailadresse: 'testMail',
      telefon: 'testTelefon',
      funktion: 'testFunktion',
      foto: null,
      kontaktlink: null,
    },
  ];

  beforeEach(() => (spectator = createService()));

  it('should...', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('getContentList should call valid trpc method', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      CMS: {
        getContactList: {
          query: async (_args) => {
            const res = mockContacts;
            return res;
          },
        },
      },
    });

    const response = await spectator.service.getContentList('test');
    expect(response).toEqual(mockContacts);
  });
});
