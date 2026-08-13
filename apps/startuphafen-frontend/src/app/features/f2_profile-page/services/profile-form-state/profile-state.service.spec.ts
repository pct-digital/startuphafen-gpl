import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { ProfileStateService } from './profile-state.service';

const FIXED_CREATED_AT = new Date('2026-07-01T12:00:00.000Z');

describe('ProfileStateService', () => {
  let spectator: SpectatorService<ProfileStateService>;
  const createService = createServiceFactory({
    service: ProfileStateService,
    mocks: [TrpcService],
  });

  beforeEach(() => (spectator = createService()));

  it('should...', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('should fetch the current user', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      User: {
        getUser: {
          query: async (_args) => {
            const res = {
              academicTitle: 'Dr.',
              cellPhoneNumber: '123456789',
              city: 'TestCity',
              country: 'TestCountry',
              dateOfBirth: '1990-01-01',
              email: 'test',
              firstName: 'TestFirstName',
              lastName: 'TestLastName',
              name: 'TestName',
              phoneNumber: '987654321',
              postalCode: '12345',
              street: 'TestStreet',
              title: 'Mr.',
            };
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getUser();
    expect(response).toEqual({
      academicTitle: 'Dr.',
      cellPhoneNumber: '123456789',
      city: 'TestCity',
      country: 'TestCountry',
      dateOfBirth: '1990-01-01',
      email: 'test',
      firstName: 'TestFirstName',
      lastName: 'TestLastName',
      name: 'TestName',
      phoneNumber: '987654321',
      postalCode: '12345',
      street: 'TestStreet',
      title: 'Mr.',
    });
  });
  it('should fetch Projects', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Project: {
        readAndAppendDocs: {
          query: async () => {
            const res = [
              {
                id: 1,
                name: 'test',
                progress: 100,
                stSent: true,
                catalogueId: 'eun',
                gwSent: false,
                lastPosition: 1,
                userId: 'testUserId',
                stEr: null,
                gewA: null,
                hwkDocuments: [],
                createdAt: FIXED_CREATED_AT,
              },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getProjects();
    expect(response).toEqual([
      {
        id: 1,
        name: 'test',
        progress: 100,
        stSent: true,
        gwSent: false,
        catalogueId: 'eun',
        lastPosition: 1,
        userId: 'testUserId',
        stEr: null,
        gewA: null,
        hwkDocuments: [],
        createdAt: FIXED_CREATED_AT,
      },
    ]);
  });

  it('should fetch document data for a project document', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Project: {
        readDocumentData: {
          query: async (args) => {
            expect(args).toEqual({
              projectId: 1,
              docId: 11,
            });

            return {
              data: new Uint8Array([1, 2, 3]),
            };
          },
        },
      },
    });

    const response = await spectator.service.getProjectDocumentData(1, 11);

    expect(response).toEqual({
      data: new Uint8Array([1, 2, 3]),
    });
  });

  it('should fetch the generated hwk application pdf', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      HwkForm: {
        getFilledPdf: {
          query: async (projectId) => {
            expect(projectId).toBe(1);

            return {
              data: new Uint8Array([4, 5, 6]),
              filename: 'HWK-Antrag-1.pdf',
              mimeType: 'application/pdf',
            };
          },
        },
      },
    });

    const response = await spectator.service.getHwkApplicationPdf(1);

    expect(response).toEqual({
      data: new Uint8Array([4, 5, 6]),
      filename: 'HWK-Antrag-1.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('should return hwk application ids only for eligible finished projects', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'eun hwk',
        progress: 100,
        stSent: false,
        gwSent: false,
        catalogueId: 'eun',
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
      {
        id: 2,
        name: 'kapg hwk',
        progress: 100,
        stSent: false,
        gwSent: false,
        catalogueId: 'kapg',
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
      {
        id: 3,
        name: 'unfinished hwk',
        progress: 50,
        stSent: false,
        gwSent: false,
        catalogueId: 'eun',
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
      {
        id: 4,
        name: 'flow without hwk answers',
        progress: 100,
        stSent: false,
        gwSent: false,
        catalogueId: 'eun',
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
    ];

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        pickFiltered: {
          query: async (args) => {
            if (args.filters.projectId === 1) {
              return [
                { key: 'Us1', value: 'us1Ans-2' },
                { key: 'HwkEntryType', value: 'hwkEntryAns-1' },
              ];
            }

            if (args.filters.projectId === 2) {
              return [
                { key: 'HwkBranche', value: 'us1Ans-2' },
                { key: 'HwkEntryType', value: 'hwkEntryAns-1' },
              ];
            }

            return [{ key: 'Us1', value: 'us1Ans-2' }];
          },
        },
      },
      HwkForm: {
        getHwkMailStatus: {
          query: async (args) => {
            if (args == 1) {
              return {
                status: 'pending',
                attemptCount: 0,
                lastError: null,
                nextAttemptAt: null,
                sentAt: null,
              };
            }
            return {
              status: 'sent',
              attemptCount: 0,
              lastError: null,
              nextAttemptAt: null,
              sentAt: null,
            };
          },
        },
      },
    });

    const response = await spectator.service.getHwkApplicationProjectsStatus(
      mockProjects
    );

    expect(response).toEqual([
      {
        id: 1,
        mailStatus: 'pending',
      },
      {
        id: 2,
        mailStatus: 'sent',
      },
    ]);
  });

  it('should not load hwk application ids when no projects are given', async () => {
    const pickFilteredQuery = jest.fn();
    const getHwkMailStatusQuery = jest.fn();

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        pickFiltered: {
          query: pickFilteredQuery,
        },
      },
      HwkForm: {
        getHwkMailStatus: {
          query: getHwkMailStatusQuery,
        },
      },
    });

    const response = await spectator.service.getHwkApplicationProjectsStatus(
      []
    );

    expect(response).toEqual([]);
    expect(pickFilteredQuery).not.toHaveBeenCalled();
    expect(getHwkMailStatusQuery).not.toHaveBeenCalled();
  });

  it('should ignore failed hwk lookups for one project and keep eligible ids from others', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'eligible hwk',
        progress: 100,
        stSent: false,
        gwSent: false,
        catalogueId: 'eun',
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
      {
        id: 2,
        name: 'failing hwk lookup',
        progress: 100,
        stSent: false,
        gwSent: false,
        catalogueId: 'eun',
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
    ];

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        pickFiltered: {
          query: async (args) => {
            if (args.filters.projectId === 1) {
              return [
                { key: 'Us1', value: 'us1Ans-2' },
                { key: 'HwkEntryType', value: 'hwkEntryAns-1' },
              ];
            }

            throw new Error('transient tRPC failure');
          },
        },
      },
      HwkForm: {
        getHwkMailStatus: {
          query: async () => {
            return {
              status: 'sent',
              attemptCount: 0,
              lastError: null,
              nextAttemptAt: null,
              sentAt: null,
            };
          },
        },
      },
    });

    const response = await spectator.service.getHwkApplicationProjectsStatus(
      mockProjects
    );

    expect(response).toEqual([
      {
        id: 1,
        mailStatus: 'sent',
      },
    ]);
  });

  it('should get the Project for a specific project ID', async () => {
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        readFiltered: {
          query: async (_args) => {
            const res = [
              {
                key: 'St25',
                value: 'Test Description',
                id: 1,
                type: 'text',
                catalogueId: 'eun',
                componentId: '',
                projectId: 1,
                stringValue: '',
                xmlKey: '/',
                questionText: '',
                answerText: '',
                headerText: null,
              },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getProjectDescription(1, 'eun');
    expect(response).toEqual('Test Description');
  });

  it('should get ids fro prjects with gewa needed', async () => {
    const mockProjects = [
      {
        id: 1,
        name: 'test',
        progress: 100,
        stSent: true,
        catalogueId: 'eun',
        description: 'tets',
        gwSent: true,
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
      {
        id: 2,
        name: 'test2',
        progress: 100,
        stSent: true,
        catalogueId: 'eun',
        description: 'tets',
        gwSent: false,
        lastPosition: 1,
        userId: 'testUserId',
        createdAt: FIXED_CREATED_AT,
      },
    ];

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        pickFiltered: {
          query: async (args) => {
            const res = [
              {
                id: 1,
                value: 'us1Ans-2',
                componentId: 'Us1',
                projectId: 1,
              },
              {
                id: 2,
                value: 'us1Ans-1',
                componentId: 'Us1',
                projectId: 2,
              },
            ];
            return res.filter(
              (answer) => answer.projectId === args.filters.projectId
            );
          },
        },
      },
    });
    const response = await spectator.service.updateGewaProjects(mockProjects);
    expect(response).toEqual([1]);
  });
});
