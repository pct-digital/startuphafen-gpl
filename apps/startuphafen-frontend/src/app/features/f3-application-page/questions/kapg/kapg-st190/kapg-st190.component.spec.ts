import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt190Component } from './kapg-st190.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('KapgSt190Component', () => {
  let spectator: Spectator<KapgSt190Component>;
  const createComponent = createComponentFactory({
    component: KapgSt190Component,
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
    it('should return true when St183a is greater than 25000', () => {
      const answers = { St183a: 30000 };

      const result = KapgSt190Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St183a is less than 25000 and St185 is st185Ans-2', () => {
      const answers = { St183a: 20000, St185: 'st185Ans-2' };

      const result = KapgSt190Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St183a is less than 25000 and St185 is not st185Ans-2', () => {
      const answers = { St183a: 20000, St185: 'st185Ans-1' };

      const result = KapgSt190Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return true when St183a is equal to 25000 and St185 is st185Ans-2', () => {
      const answers = { St183a: 25000, St185: 'st185Ans-2' };

      const result = KapgSt190Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when answers are missing', () => {
      const answers = {};

      const result = KapgSt190Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
