import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';
import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyFieldEmptyComponent,
  FormlyFieldInputComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  PctLoaderService,
  TrpcService,
} from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { KeycloakService } from 'keycloak-angular';
import { HwkQualificationComponent } from './hwk-qualification.component';

registerLocaleData(localeDe);

describe('HwkQualificationComponent', () => {
  let spectator: Spectator<HwkQualificationComponent>;

  const createComponent = createComponentFactory({
    component: HwkQualificationComponent,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'empty',
            component: FormlyFieldEmptyComponent,
          },
          {
            name: 'date',
            component: FormlyFieldDateComponent,
          },
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
          },
        ],
        wrappers: [
          {
            name: 'heading',
            component: FormlyWrapperHeading,
          },
        ],
      }),
    ],
    providers: [
      { provide: LOCALE_ID, useValue: 'de-DE' },
      {
        provide: TrpcService,
        useValue: {
          client: createMockTrpcClient<AppRouter>({
            UserDocuments: {
              listByCase: {
                query: async () => [],
              },
            },
          }),
        },
      },
      {
        provide: PctLoaderService,
        useValue: {
          doWhileLoading: async (_key: string, work: () => Promise<unknown>) =>
            await work(),
        },
      },
      {
        provide: KeycloakService,
        useValue: {
          getUserRoles: () => ['login'],
        },
      },
    ],
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('isAllowed returns true for hwk flow with Handwerksrolle', () => {
    expect(
      HwkQualificationComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-2',
        HwkEntryType: 'hwkEntryAns-1',
      })
    ).toBe(true);
  });

  it('isAllowed returns false when hwk flow is not active', () => {
    expect(
      HwkQualificationComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-3',
        HwkEntryType: 'hwkEntryAns-1',
      })
    ).toBe(false);
  });

  it('isAllowed returns false for zulassungsfreies Handwerk', () => {
    expect(
      HwkQualificationComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-2',
        HwkEntryType: 'hwkEntryAns-2',
      })
    ).toBe(false);
  });

  it('isAllowed returns false for handwerksähnliches Gewerbe', () => {
    expect(
      HwkQualificationComponent.isAllowed({
        __catalogueId: 'eun',
        Us1: 'us1Ans-2',
        HwkEntryType: 'hwkEntryAns-3',
      })
    ).toBe(false);
  });

  it('shows qualification upload block for Anlage A selection', () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        answers: {
          __catalogueId: 'eun',
          Us1: 'us1Ans-2',
          HwkEntryType: 'hwkEntryAns-1',
        },
      },
    });

    expect(spectator.query('sh-hwk-document-upload-container')).toExist();
  });

  it('keeps the document control invalid when the current session cannot verify uploads', () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        answers: {
          __catalogueId: 'eun',
          Us1: 'us1Ans-2',
          HwkEntryType: 'hwkEntryAns-1',
        },
      },
    });

    spectator.component.onQualificationDocumentsChanged(null);

    expect(spectator.component.qualificationDocumentUploadedControl.hasError(
      'qualificationDocumentRequired'
    )).toBe(true);
  });

  it('keeps the document control invalid when no qualification document exists', () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        answers: {
          __catalogueId: 'eun',
          Us1: 'us1Ans-2',
          HwkEntryType: 'hwkEntryAns-1',
        },
      },
    });

    spectator.component.onQualificationDocumentsChanged(0);

    expect(spectator.component.qualificationDocumentUploadedControl.hasError(
      'qualificationDocumentRequired'
    )).toBe(true);
  });

  it('accepts the step when at least one qualification document exists', () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        answers: {
          __catalogueId: 'eun',
          Us1: 'us1Ans-2',
          HwkEntryType: 'hwkEntryAns-1',
        },
      },
    });

    spectator.component.onQualificationDocumentsChanged(1);

    expect(spectator.component.qualificationDocumentUploadedControl.valid).toBe(
      true
    );
  });

  it('shows mandatory upload copy for Handwerksrolle', () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        answers: {
          __catalogueId: 'eun',
          Us1: 'us1Ans-2',
          HwkEntryType: 'hwkEntryAns-1',
        },
      },
    });

    expect(spectator.element.textContent).toContain(
      'Für Eintragungen in die Handwerksrolle ist ein Qualifikationsnachweis als PDF verpflichtend.'
    );
  });

  it('hides qualification upload block for non-Anlage-A selection', () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        answers: {
          __catalogueId: 'eun',
          Us1: 'us1Ans-2',
          HwkEntryType: 'hwkEntryAns-2',
        },
      },
    });

    expect(spectator.query('sh-hwk-document-upload-container')).not.toExist();
  });
});
