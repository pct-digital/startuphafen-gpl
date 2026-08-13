import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldNumberEuroComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt542to544Component } from './eun-st542to544.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt542to544Component', () => {
  let spectator: Spectator<EunSt542to544Component>;
  const createComponent = createComponentFactory({
    component: EunSt542to544Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
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
    mocks: [TrpcService],
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
    it('should return true when St132-1 is greater than 25000', () => {
      const answers = { 'St132-1': 30000 };

      const result = EunSt542to544Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St132-1 is less than 25000 and St134 is st134Ans-2', () => {
      const answers = { 'St132-1': 20000, St134: 'st134Ans-2' };

      const result = EunSt542to544Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St132-1 is less than 25000 and St134 is not st134Ans-2', () => {
      const answers = { 'St132-1': 20000, St134: 'st134Ans-1' };

      const result = EunSt542to544Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return true when St132-1 is equal to 25000 and St134 is st134Ans-2', () => {
      const answers = { 'St132-1': 25000, St134: 'st134Ans-2' };

      const result = EunSt542to544Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when answers are missing', () => {
      const answers = {};

      const result = EunSt542to544Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
