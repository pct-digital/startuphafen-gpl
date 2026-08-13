import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Spectator,
  byTestId,
  createComponentFactory,
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
import { KeycloakService } from 'keycloak-angular';
import { ProfileInfoService } from '../profile-info/profile-info.service';
import { ChecklistComponent } from './checklist.component';

const mockProfileInfoService = {
  get: jest.fn(),
  create: jest.fn(),
};

const mockLoaderService = {
  doWhileLoading: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
};

const mockTrpcService = {
  client: {
    Project: {
      update: {
        mutate: jest.fn().mockResolvedValue({}),
      },
      pickFiltered: {
        query: jest.fn().mockResolvedValue([{ progress: 0 }]),
      },
    },
    UserDocuments: {
      listByProject: {
        query: jest.fn().mockResolvedValue([]),
      },
    },
  },
};

describe('ChecklistComponent', () => {
  let spectator: Spectator<ChecklistComponent>;
  const createComponent = createComponentFactory({
    component: ChecklistComponent,
    imports: [
      NoopAnimationsModule,
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
    mocks: [Router, NavService, KeycloakService],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: ProfileInfoService, useValue: mockProfileInfoService },
      { provide: PctLoaderService, useValue: mockLoaderService },
      { provide: TrpcService, useValue: mockTrpcService },
      {
        provide: FeatureFlagsService,
        useValue: { isEnabled: jest.fn().mockReturnValue(false) },
      },
    ],
  });

  jest.spyOn(window, 'open').mockImplementation(() => null);

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileInfoService.get.mockResolvedValue({
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.com',
      phoneInternational: '+49',
      phoneNational: '30',
      phoneNumber: '12345678',
      website: null,
    });

    spectator = createComponent({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (param: string) => {
                  const params: Record<string, string> = { projectId: '1' };
                  return params[param] ?? null;
                },
              },
            },
          },
        },
      ],
    });
    spectator.component.showChecklist = true;
    spectator.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(spectator.component).toBeTruthy();
    });
  });

  describe('Step Navigation', () => {
    it('should increment current step when clicking current item', async () => {
      await spectator.component.handleItemClick(0);
      expect(spectator.component.currentStepIndex).toBe(1);
    });

    it('should not increment when clicking non-current item', async () => {
      await spectator.component.handleItemClick(2);
      expect(spectator.component.currentStepIndex).toBe(0);
    });

    it('should progress through all steps', async () => {
      const totalSteps = spectator.component.checklistItems.length;
      for (let i = 0; i < totalSteps; i++) {
        await spectator.component.handleItemClick(i);
      }
      expect(spectator.component.currentStepIndex).toBe(totalSteps);
    });

    it('should not go beyond total steps', async () => {
      const totalSteps = spectator.component.checklistItems.length;
      spectator.component.currentStepIndex = totalSteps;
      await spectator.component.handleItemClick(totalSteps);
      expect(spectator.component.currentStepIndex).toBe(totalSteps);
    });
  });

  describe('Step Status', () => {
    beforeEach(() => {
      spectator.component.currentStepIndex = 2;
    });

    it('should identify completed steps', () => {
      expect(spectator.component.isStepCompleted(0)).toBe(true);
      expect(spectator.component.isStepCompleted(1)).toBe(true);
      expect(spectator.component.isStepCompleted(2)).toBe(false);
    });

    it('should identify current step', () => {
      expect(spectator.component.isStepCurrent(2)).toBe(true);
      expect(spectator.component.isStepCurrent(1)).toBe(false);
    });

    it('should identify clickable steps', () => {
      expect(spectator.component.isStepClickable(0)).toBe(true);
      expect(spectator.component.isStepClickable(1)).toBe(true);
      expect(spectator.component.isStepClickable(2)).toBe(true);
    });
  });

  describe('Progress Percentage', () => {
    it('should return 0% at start', () => {
      expect(spectator.component.getProgressPercentage()).toBe(0);
    });

    it('should return correct percentage after first step', () => {
      spectator.component.currentStepIndex = 1;
      const totalSteps = spectator.component.checklistItems.length;
      const expectedPercentage = Math.round((1 / totalSteps) * 100);
      expect(spectator.component.getProgressPercentage()).toBe(
        expectedPercentage
      );
    });

    it('should return correct percentage at middle', () => {
      const totalSteps = spectator.component.checklistItems.length;
      const middleStep = Math.floor(totalSteps / 2);
      spectator.component.currentStepIndex = middleStep;
      const expectedPercentage = Math.round((middleStep / totalSteps) * 100);
      expect(spectator.component.getProgressPercentage()).toBe(
        expectedPercentage
      );
    });

    it('should return 100% when all steps completed', () => {
      const totalSteps = spectator.component.checklistItems.length;
      spectator.component.currentStepIndex = totalSteps;
      expect(spectator.component.getProgressPercentage()).toBe(100);
    });
  });

  describe('Template Rendering', () => {
    it('should render title', () => {
      expect(spectator.query(byTestId('checklist-title'))).toExist();
    });

    it('should render description', () => {
      expect(spectator.query(byTestId('checklist-description'))).toExist();
    });

    it('should render all checklist items', () => {
      const totalItems = spectator.component.checklistItems.length;
      for (let i = 0; i < totalItems; i++) {
        expect(spectator.query(byTestId(`checklist-item-${i}`))).toExist();
      }
    });

    it('should render correct item numbers', () => {
      const totalItems = spectator.component.checklistItems.length;
      for (let i = 0; i < totalItems; i++) {
        expect(spectator.query(byTestId(`checklist-number-${i}`))).toHaveText(
          `${i + 1}`
        );
      }
    });

    it('should render buttons for each item', () => {
      const totalItems = spectator.component.checklistItems.length;
      for (let i = 0; i < totalItems; i++) {
        expect(
          spectator.query(byTestId(`checklist-item-button-${i}`))
        ).toExist();
      }
    });

    it('should render progress counter', () => {
      const totalItems = spectator.component.checklistItems.length;
      expect(spectator.query(byTestId('progress-counter'))).toHaveText(
        `0 / ${totalItems}`
      );
    });

    it('should render progress bar', () => {
      expect(spectator.query(byTestId('progress-bar'))).toExist();
    });

    it('should render progress percentage', () => {
      expect(spectator.query(byTestId('progress-percentage'))).toHaveText(
        '0% abgeschlossen'
      );
    });
  });

  describe('Button Click Interaction', () => {
    it('should increment progress when clicking current item button', () => {
      const button = spectator.query(byTestId('checklist-item-button-0'));
      const notarButton = spectator.query(byTestId('notar-button'));

      expect(notarButton).toBeTruthy();
      expect(button).toBeTruthy();

      if (notarButton) {
        spectator.click(notarButton);
      }

      spectator.detectChanges();

      if (button) {
        spectator.click(button);
      }

      expect(spectator.component.currentStepIndex).toBe(1);
    });

    it('should update progress counter after step completion', () => {
      const button = spectator.query(byTestId('checklist-item-button-0'));
      const totalItems = spectator.component.checklistItems.length;
      const notarButton = spectator.query(byTestId('notar-button'));

      if (notarButton) {
        spectator.click(notarButton);
      }
      spectator.detectChanges();

      if (button) {
        spectator.click(button);
      }

      spectator.detectChanges();

      expect(spectator.query(byTestId('progress-counter'))).toHaveText(
        `1 / ${totalItems}`
      );
    });

    it('should update progress percentage after step completion', () => {
      const button = spectator.query(byTestId('checklist-item-button-0'));
      const totalItems = spectator.component.checklistItems.length;
      const expectedPercentage = Math.round((1 / totalItems) * 100);
      const notarButton = spectator.query(byTestId('notar-button'));

      if (notarButton) {
        spectator.click(notarButton);
      }
      spectator.detectChanges();

      if (button) {
        spectator.click(button);
      }

      spectator.detectChanges();

      expect(spectator.query(byTestId('progress-percentage'))).toHaveText(
        `${expectedPercentage}% abgeschlossen`
      );
    });
  });
});
