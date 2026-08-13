import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import {
  FeatureFlagsService,
  PopupService,
  TrpcService,
} from '@startuphafen/angular-common';
import { ProjectWithDocs } from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { of } from 'rxjs';
import { ProfileStateService } from '../../services/profile-form-state/profile-state.service';
import { ProfilePageComponent } from './profile-page.component';

describe('ProfilePageComponent', () => {
  let spectator: Spectator<ProfilePageComponent>;

  const mockTrpcService = {
    client: {
      UserDocuments: {
        listByProject: {
          query: jest.fn().mockResolvedValue([
            {
              createdAt: Date.now(),
              documentCase: null,
              filename: 'a.pdf',
              id: 100,
              mimeType: 'application/pdf',
              projectId: 101,
            },
          ]),
        },
      },
    },
  };

  const mockProfileStateService = {
    getProjects: jest.fn().mockResolvedValue([]),
    getHwkApplicationPdf: jest.fn(),
    getProjectDocumentData: jest.fn(),
    getUser: jest.fn(),
    getProfileInfo: jest.fn(),
    updateGewaProjects: jest.fn(),
    getHwkApplicationProjectsStatus: jest.fn(),
  };

  const createComponent = createComponentFactory({
    component: ProfilePageComponent,
    mocks: [FeatureFlagsService, PopupService, KeycloakService],
    providers: [
      { provide: TrpcService, useValue: mockTrpcService },
      { provide: ProfileStateService, useValue: mockProfileStateService },
    ],
    detectChanges: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize profile and projects on ngOnInit', async () => {
    spectator = createComponent();
    const featureFlags = spectator.inject(FeatureFlagsService);
    const profileStateService = spectator.inject(ProfileStateService);

    const mockProfile = { firstName: 'John', lastName: 'Doe' };
    const mockProfileInfo = { birthPlace: 'Berlin', birthCountry: 'Germany' };
    const mockProjects: ProjectWithDocs[] = [
      {
        id: 1,
        name: 'test',
        gwSent: true,
        lastPosition: 1,
        catalogueId: 'eun',
        progress: 100,
        stSent: true,
        gewA: null,
        stEr: null,
        hwkDocuments: [],
        userId: 'testUserId',
        createdAt: new Date(),
      },
    ];

    jest.spyOn(profileStateService, 'getUser').mockResolvedValue(mockProfile);
    jest
      .spyOn(profileStateService, 'getProfileInfo')
      .mockResolvedValue(mockProfileInfo);
    jest
      .spyOn(profileStateService, 'getProjects')
      .mockResolvedValue(mockProjects);
    jest.spyOn(profileStateService, 'updateGewaProjects').mockResolvedValue([]);
    jest.spyOn(featureFlags, 'isEnabled').mockReturnValue(true);
    jest
      .spyOn(profileStateService, 'getHwkApplicationProjectsStatus')
      .mockResolvedValue([{ id: 1, mailStatus: 'sent' }]);

    await spectator.component.ngOnInit();

    expect(spectator.component.profile).toEqual(mockProfile);
    expect(spectator.component.projects).toEqual(mockProjects);
    expect(spectator.component.hwkApplicationProjectsStatus).toEqual([
      { id: 1, mailStatus: 'sent' },
    ]);
    expect(
      profileStateService.getHwkApplicationProjectsStatus
    ).toHaveBeenCalledWith(mockProjects);
  });

  it('skips loading hwk application ids when the feature flag is disabled', async () => {
    spectator = createComponent();
    const featureFlags = spectator.inject(FeatureFlagsService);
    const profileStateService = spectator.inject(ProfileStateService);

    jest.spyOn(profileStateService, 'getUser').mockResolvedValue({});
    jest.spyOn(profileStateService, 'getProfileInfo').mockResolvedValue({});
    jest.spyOn(profileStateService, 'getProjects').mockResolvedValue([]);
    jest.spyOn(profileStateService, 'updateGewaProjects').mockResolvedValue([]);
    jest.spyOn(featureFlags, 'isEnabled').mockReturnValue(false);
    const getHwkApplicationProjectsStatusSpy = jest.spyOn(
      profileStateService,
      'getHwkApplicationProjectsStatus'
    );

    await spectator.component.ngOnInit();

    expect(spectator.component.hwkApplicationProjectsStatus).toEqual([]);
    expect(getHwkApplicationProjectsStatusSpy).not.toHaveBeenCalled();
  });

  it('loads project document data on demand', async () => {
    spectator = createComponent();
    const popupService = spectator.inject(PopupService);
    const profileStateService = spectator.inject(ProfileStateService);

    jest.spyOn(popupService, 'open').mockReturnValue(of('popup-id'));
    jest
      .spyOn(profileStateService, 'getProjectDocumentData')
      .mockResolvedValue({
        data: new Uint8Array([1, 2, 3]),
      });

    spectator.detectChanges();
    await spectator.component.openProjectDocument({
      projectId: 1,
      docId: 11,
    });

    expect(spectator.component.loadedDocument).toEqual(
      new Uint8Array([1, 2, 3])
    );
    expect(spectator.component.isDocumentLoading).toBe(false);
    expect(spectator.component.documentLoadError).toBeNull();
  });

  it('loads generated hwk application pdf on demand', async () => {
    spectator = createComponent({});
    const popupService = spectator.inject(PopupService);
    const profileStateService = spectator.inject(ProfileStateService);

    jest.spyOn(popupService, 'open').mockReturnValue(of('popup-id'));
    jest.spyOn(profileStateService, 'getHwkApplicationPdf').mockResolvedValue({
      data: new Uint8Array([4, 5, 6]),
      filename: 'HWK-Antrag-1.pdf',
      mimeType: 'application/pdf',
    });

    spectator.detectChanges();
    await spectator.component.openHwkApplication(1);

    expect(spectator.component.loadedDocument).toEqual(
      new Uint8Array([4, 5, 6])
    );
    expect(spectator.component.isDocumentLoading).toBe(false);
    expect(spectator.component.documentLoadError).toBeNull();
  });
});
