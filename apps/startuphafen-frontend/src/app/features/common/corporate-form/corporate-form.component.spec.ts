import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  byTestId,
  createRoutingFactory,
  SpectatorRouting,
} from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FeatureFlagsService,
  FormlyFieldInputComponent,
  FormlyFieldProfileInputComponent,
  NavService,
  PctLoaderService,
  TrpcService,
} from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { ProfileInfoService } from '../profile-info/profile-info.service';
import { CorporateFormComponent } from './corporate-form.component';

describe('CorporateFormComponent', () => {
  const mockProfileInfoService = {
    create: jest.fn(),
    get: jest.fn(),
  };

  const mockLoaderService = {
    doWhileLoading: jest.fn((_key: string, work: () => Promise<any>) => work()),
  };

  let spectator: SpectatorRouting<CorporateFormComponent>;
  const createComponent = createRoutingFactory({
    component: CorporateFormComponent,
    mocks: [NavService, TrpcService, FeatureFlagsService],
    params: { projectId: '123' },
    imports: [
      ReactiveFormsModule,
      FormlyModule.forRoot({
        types: [
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'profile-input',
            component: FormlyFieldProfileInputComponent,
          },
        ],
      }),
    ],
    providers: [
      { provide: ProfileInfoService, useValue: mockProfileInfoService },
      { provide: PctLoaderService, useValue: mockLoaderService },
    ],
  });

  beforeEach(() => (spectator = createComponent()));

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should initialize projectId from route', () => {
    expect(spectator.component.projectId).toBe(123);
  });

  it('should navigate to application page on einzelunternehmer click', async () => {
    const nav = spectator.inject(NavService);
    const router = spectator.inject(Router);
    const featureFlags = spectator.inject(FeatureFlagsService);
    const spy = jest.spyOn(spectator.component, 'einzelunternehmer');

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Project: {
        update: {
          mutate: jest.fn(),
        },
      },
    });

    nav.questionnaire.mockReturnValue('/mock-app-page');
    jest.spyOn(featureFlags, 'isEnabled').mockReturnValue(true);

    spectator.component.profileInfoDone = true;
    spectator.detectChanges();

    const card = spectator.query(byTestId('card-einzelunternehmer'));
    expect(card).toBeTruthy();
    if (card) {
      spectator.click(card);
    }

    expect(spy).toHaveBeenCalledWith(123);
    expect(nav.questionnaire).toHaveBeenCalledWith('eun', 123);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/mock-app-page');
  });

  it('should navigate to checklist page on ugGmbh click', async () => {
    const nav = spectator.inject(NavService);
    const router = spectator.inject(Router);
    const featureFlags = spectator.inject(FeatureFlagsService);
    const spy = jest.spyOn(spectator.component, 'ugGmbh');

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Project: {
        update: {
          mutate: jest.fn(),
        },
      },
    });

    nav.checkListPage.mockReturnValue('/mock-checklist-page');
    jest.spyOn(featureFlags, 'isEnabled').mockReturnValue(true);

    spectator.component.profileInfoDone = true;
    spectator.detectChanges();

    const card = spectator.query(byTestId('card-ug-gmbh'));
    expect(card).toBeTruthy();
    if (card) {
      spectator.click(card);
    }

    expect(spy).toHaveBeenCalledWith(123);
    expect(nav.checkListPage).toHaveBeenCalledWith(123);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/mock-checklist-page');
  });
});
