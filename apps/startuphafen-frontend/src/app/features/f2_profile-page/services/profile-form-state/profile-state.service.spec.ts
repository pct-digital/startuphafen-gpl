import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { ProfileFormData, ProfileStateService } from './profile-state.service';

describe('ProfileStateService', () => {
  let spectator: SpectatorService<ProfileStateService>;
  const createService = createServiceFactory({
    service: ProfileStateService,
    mocks: [TrpcService],
  });

  const mockProfileFormData = {
    firstName: 'TestFirstName',
    lastName: 'TestLastName',
    email: 'test@test.de',
    age: 42,
    gender: 'male',
  };

  beforeEach(() => (spectator = createService()));

  it('should...', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('should update form state', (done) => {
    const testData: ProfileFormData = mockProfileFormData;

    spectator.service.formState$.subscribe((state) => {
      if (state) {
        expect(state).toEqual(testData);
        done();
      }
    });

    spectator.service.updateFormState(testData);
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
        read: {
          query: async () => {
            const res = [
              {
                id: 1,
                name: 'test',
                gewASent: true,
                progress: 100,
                steErSent: true,
                userId: 'testUserId',
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
        gewASent: true,
        progress: 100,
        steErSent: true,
        userId: 'testUserId',
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
                key: 'SteEr25',
                value: 'Test Description',
                id: 1,
                type: 'text',
                flowId: 'eun1',
                projectId: 1,
                strapiAnswerId: 800,
                xmlKey: '/',
              },
            ];
            return res;
          },
        },
      },
    });
    const response = await spectator.service.getProjectDescription(1);
    expect(response).toEqual('Test Description');
  });
});
