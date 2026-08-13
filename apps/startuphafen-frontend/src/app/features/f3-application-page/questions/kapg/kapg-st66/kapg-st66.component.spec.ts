import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyFieldEmptyComponent,
  FormlyFieldInputComponent,
  FormlyFieldNumberComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  PctLoaderService,
  TrpcService,
} from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt66Component } from './kapg-st66.component';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { KeycloakService } from 'keycloak-angular';

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';

const mockApService = { buildAnswerObject: jest.fn() };
registerLocaleData(localeDe);
describe('KapgSt66Component', () => {
  let spectator: Spectator<KapgSt66Component>;
  const createComponent = createComponentFactory({
    component: KapgSt66Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'empty',
            component: FormlyFieldEmptyComponent,
          },
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
          },
          {
            name: 'number',
            component: FormlyFieldNumberComponent,
          },
          {
            name: 'date',
            component: FormlyFieldDateComponent,
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
      { provide: ApplicationPageService, useValue: mockApService },
      {
        provide: LOCALE_ID,
        useValue: 'de-DE',
      },
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
});
