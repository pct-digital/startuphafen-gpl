import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { ProjectWithDocs } from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { ProfileContentDisplayComponent } from './profile-content-display.component';

describe('ProfileContentDisplayComponent', () => {
  let spectator: Spectator<ProfileContentDisplayComponent>;

  const createComponent = createComponentFactory({
    component: ProfileContentDisplayComponent,
    mocks: [KeycloakService],
    providers: [{ provide: TrpcService, useValue: {} }],
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('should display projects when provided', () => {
    const mockProjects: ProjectWithDocs[] = [
      {
        id: 1,
        name: 'Project 1',
        gwSent: true,
        lastPosition: 1,
        catalogueId: 'eun',
        progress: 100,
        stSent: true,
        userId: 'testUserId',
        stEr: null,
        gewA: null,
        hwkDocuments: [],
        createdAt: new Date(),
      },
      {
        id: 2,
        name: 'Project 2',
        gwSent: false,
        lastPosition: 0,
        catalogueId: 'eun',
        progress: 50,
        stSent: false,
        userId: 'testUserId',
        stEr: null,
        gewA: null,
        hwkDocuments: [],
        createdAt: new Date(),
      },
    ];

    spectator = createComponent({
      props: {
        projects: mockProjects,
        documentEditing: {
          documents: new Map(),
          show: new Map(),
          error: new Map(),
        },
      },
    });

    expect(spectator.component.projects).toEqual(mockProjects);
    expect(spectator.query('[data-testid="profile-projects"]')).toBeTruthy();
  });

  it('should handle empty projects array', () => {
    spectator = createComponent();
    expect(spectator.component.projects).toEqual([]);
  });

  it('should display correct project status badges', () => {
    const mockProjects: ProjectWithDocs[] = [
      {
        id: 1,
        name: 'Completed Project',
        gwSent: true,
        lastPosition: 1,
        catalogueId: 'eun',
        progress: 100,
        stSent: true,
        userId: 'testUserId',
        stEr: null,
        gewA: null,
        hwkDocuments: [],
        createdAt: new Date(),
      },
      {
        id: 2,
        name: 'Pending Project',
        gwSent: false,
        lastPosition: 0,
        catalogueId: 'eun',
        progress: 0,
        stSent: false,
        userId: 'testUserId',
        stEr: null,
        gewA: null,
        hwkDocuments: [],
        createdAt: new Date(),
      },
    ];

    spectator = createComponent({
      props: {
        projects: mockProjects,
        documentEditing: {
          documents: new Map(),
          show: new Map(),
          error: new Map(),
        },
      },
    });

    spectator.detectChanges();
    const projectCards = spectator.queryAll('.border.rounded-lg');
    expect(projectCards.length).toBe(mockProjects.length);
  });

  it('shows and emits the generated hwk application for eligible projects', () => {
    const mockProjects: ProjectWithDocs[] = [
      {
        id: 1,
        name: 'HWK Project',
        gwSent: false,
        lastPosition: 0,
        catalogueId: 'eun',
        progress: 100,
        stSent: false,
        userId: 'testUserId',
        stEr: null,
        gewA: null,
        hwkDocuments: [],
        createdAt: new Date(),
      },
    ];

    spectator = createComponent({
      props: {
        projects: mockProjects,
        hwkApplicationProjectsStatus: [{ id: 1, mailStatus: 'sent' }],
        documentEditing: {
          documents: new Map(),
          show: new Map(),
          error: new Map(),
        },
      },
    });

    const hwkApplicationBadge = spectator.query(
      '[data-testid="profile-hwk-application"]'
    );

    expect(hwkApplicationBadge).toBeTruthy();
    expect(hwkApplicationBadge?.textContent).toContain('Handwerkskammer');
    expect(hwkApplicationBadge).toHaveClass('rounded-full');
    const emitSpy = jest.spyOn(
      spectator.component.hwkApplicationRequested,
      'emit'
    );

    spectator.click('[data-testid="profile-hwk-application-button"]');

    expect(emitSpy).toHaveBeenCalledWith(1);
  });
});
