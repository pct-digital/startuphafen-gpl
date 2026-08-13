import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt150to152Component } from './eun-st150to152.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt150to152Component', () => {
  let spectator: Spectator<EunSt150to152Component>;
  const createComponent = createComponentFactory({
    component: EunSt150to152Component,
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
    it('should return true when St132-1 is greater than 25000 and St149 is st149Ans-2', () => {
      const answers = { 'St132-1': 30000, St149: 'st149Ans-2' };

      const result = EunSt150to152Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St132-1 is less than 25000, St134 is st134Ans-2, and St149 is st149Ans-2', () => {
      const answers = {
        'St132-1': 20000,
        St134: 'st134Ans-2',
        St149: 'st149Ans-2',
      };

      const result = EunSt150to152Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St132-1 is equal to 25000, St134 is st134Ans-2, and St149 is st149Ans-2', () => {
      const answers = {
        'St132-1': 25000,
        St134: 'st134Ans-2',
        St149: 'st149Ans-2',
      };

      const result = EunSt150to152Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St132-1 is greater than 25000 but St149 is not st149Ans-2', () => {
      const answers = { 'St132-1': 30000, St149: 'st149Ans-1' };

      const result = EunSt150to152Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when St132-1 is less than 25000, St134 is st134Ans-2, but St149 is not st149Ans-2', () => {
      const answers = {
        'St132-1': 20000,
        St134: 'st134Ans-2',
        St149: 'st149Ans-1',
      };

      const result = EunSt150to152Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when answers are missing', () => {
      const answers = {};

      const result = EunSt150to152Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
