import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt185Component } from './kapg-st185.component';
const mockApService = { buildAnswerObject: jest.fn() };
describe('KapgSt185Component', () => {
  let spectator: Spectator<KapgSt185Component>;
  const createComponent = createComponentFactory({
    component: KapgSt185Component,
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

  describe('isAllowed', () => {
    it('should return true when St183a is less than 25000', () => {
      const answers = { St183a: 20000 };

      const result = KapgSt185Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St183a is equal to 25000', () => {
      const answers = { St183a: 25000 };

      const result = KapgSt185Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St183a is greater than 25000', () => {
      const answers = { St183a: 30000 };

      const result = KapgSt185Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when St183a is missing', () => {
      const answers = {};

      const result = KapgSt185Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
