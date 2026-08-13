import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt134Component } from './eun-st134.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt134Component', () => {
  let spectator: Spectator<EunSt134Component>;
  const createComponent = createComponentFactory({
    component: EunSt134Component,
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
    it('should return true when St132-1 is less than 25000', () => {
      const answers = { 'St132-1': 20000 };

      const result = EunSt134Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St132-1 is equal to 25000', () => {
      const answers = { 'St132-1': 25000 };

      const result = EunSt134Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St132-1 is greater than 25000', () => {
      const answers = { 'St132-1': 30000 };

      const result = EunSt134Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when St132-1 is missing', () => {
      const answers = {};

      const result = EunSt134Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
