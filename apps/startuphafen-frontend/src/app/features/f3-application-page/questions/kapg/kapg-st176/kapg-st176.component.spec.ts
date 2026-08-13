import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyFieldEmptyComponent,
  FormlyFieldInputComponent,
  FormlyFieldNumberComponent,
  FormlyFieldNumberEuroComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt176Component } from './kapg-st176.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('KapgSt176Component', () => {
  let spectator: Spectator<KapgSt176Component>;
  const createComponent = createComponentFactory({
    component: KapgSt176Component,
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
          {
            name: 'number-euro',
            component: FormlyFieldNumberEuroComponent,
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
    providers: [{ provide: ApplicationPageService, useValue: mockApService }],
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
