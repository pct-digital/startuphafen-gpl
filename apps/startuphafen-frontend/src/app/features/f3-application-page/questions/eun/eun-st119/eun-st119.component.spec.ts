import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt119Component } from './eun-st119.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt119Component', () => {
  let spectator: Spectator<EunSt119Component>;
  const createComponent = createComponentFactory({
    component: EunSt119Component,
    imports: [
      FormlyModule.forRoot({
        types: [
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
