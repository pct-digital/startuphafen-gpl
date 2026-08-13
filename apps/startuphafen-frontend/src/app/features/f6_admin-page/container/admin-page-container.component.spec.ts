import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { PctLoaderService, TrpcService } from '@startuphafen/angular-common';
import { KeycloakService } from 'keycloak-angular';

import { ActivatedRoute } from '@angular/router';
import { AdminPageContainerComponent } from './admin-page-container.component';

describe('AdminPageContainerComponent', () => {
  let spectator: Spectator<AdminPageContainerComponent>;

  const mockKeycloakService = {
    getUserRoles: jest.fn(),
  };

  const mockActivatedRoute = {
    snapshot: {
      routeConfig: { path: 'admin' },
    },
  };

  const mockLoaderService = {
    doWhileLoading: jest.fn(
      async (_key: string, callback: () => Promise<void>) => {
        return await callback();
      }
    ),
    isLoading: jest.fn(() => false),
  };

  const mockTrpcService = {
    client: {
      User: {
        getUserCount: {
          query: jest.fn(),
        },
        getUserCreatedRatio: {
          query: jest.fn(),
        },
      },
      Project: {
        getProjectCount: {
          query: jest.fn(),
        },
      },
    },
  };

  const createComponent = createComponentFactory({
    component: AdminPageContainerComponent,
    providers: [
      { provide: KeycloakService, useValue: mockKeycloakService },
      { provide: TrpcService, useValue: mockTrpcService },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: PctLoaderService, useValue: mockLoaderService },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Set default return values to prevent undefined errors
    mockKeycloakService.getUserRoles.mockReturnValue(['startuphafen-admin']);
    mockTrpcService.client.User.getUserCount.query.mockResolvedValue(0);
    mockTrpcService.client.Project.getProjectCount.query.mockResolvedValue(0);
    mockTrpcService.client.User.getUserCreatedRatio.query.mockResolvedValue([]);
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('should get user roles on init', async () => {
    const mockRoles = ['startuphafen-admin', 'user'];
    mockKeycloakService.getUserRoles.mockReturnValue(mockRoles);

    spectator = createComponent();

    expect(mockKeycloakService.getUserRoles).toHaveBeenCalled();
    expect(spectator.component.roles).toEqual(mockRoles);
  });

  it('should create top cards with correct data', async () => {
    const userCount = 25;
    const projectCount = 5;

    mockTrpcService.client.User.getUserCount.query.mockResolvedValue(userCount);
    mockTrpcService.client.Project.getProjectCount.query.mockResolvedValue(
      projectCount
    );

    spectator = createComponent();

    // ngOnInit doesn't await doWhileLoading, so we need to get the promise and await it
    await spectator.component.ngOnInit();
    // Wait for the doWhileLoading callback to complete
    await mockLoaderService.doWhileLoading.mock.results[0].value;

    expect(spectator.component.topCards).toHaveLength(2);
    expect(spectator.component.topCards[0]).toEqual({
      title: 'Gesamte Nutzer',
      iconUrl: '/assets/icons/thin/users-sharp-thin.svg',
      value: userCount,
    });
    expect(spectator.component.topCards[1]).toEqual({
      title: 'Erstellte Projekte',
      iconUrl: '/assets/icons/thin/file-sharp-thin.svg',
      value: projectCount,
    });
  });

  it('should create user chart with correct data', async () => {
    const chartData = [
      { createdAt: '2023-01', amount: 5 },
      { createdAt: '2023-02', amount: 8 },
    ];

    mockTrpcService.client.User.getUserCreatedRatio.query.mockResolvedValue(
      chartData
    );

    spectator = createComponent();

    // ngOnInit doesn't await doWhileLoading, so we need to get the promise and await it
    await spectator.component.ngOnInit();
    // Wait for the doWhileLoading callback to complete
    await mockLoaderService.doWhileLoading.mock.results[0].value;

    expect(spectator.component.userChartOptions).not.toBeNull();
    expect(spectator.component.userChartOptions?.data).toEqual(chartData);
    expect(spectator.component.userChartOptions?.series).toEqual([
      { type: 'bar', xKey: 'createdAt', yKey: 'amount' },
    ]);
  });

  it('should handle getRoles method independently', () => {
    const mockRoles = ['startuphafen-admin'];
    mockKeycloakService.getUserRoles.mockReturnValue(mockRoles);

    spectator = createComponent();
    spectator.component.getRoles();

    expect(spectator.component.roles).toEqual(mockRoles);
  });
});
