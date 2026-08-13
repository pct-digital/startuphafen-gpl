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
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt184Component } from './kapg-st184.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('KapgSt184Component', () => {
  let spectator: Spectator<KapgSt184Component>;
  const createComponent = createComponentFactory({
    component: KapgSt184Component,
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

      const result = KapgSt184Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St183a is equal to 25000 and St185 is st185Ans-2', () => {
      const answers = { St183a: 25000, St185: 'st185Ans-2' };

      const result = KapgSt184Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St183a is equal to 25000 and St185 is not st185Ans-2', () => {
      const answers = { St183a: 25000, St185: 'st185Ans-1' };

      const result = KapgSt184Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });

  describe('monthly advance return option', () => {
    it('should stay hidden when the refund claim is exactly 9000 Euro', () => {
      spectator = createComponent();

      const field = spectator.component.fields.find(
        (field) => field.key === 'St184c'
      );
      const hide = field?.expressions?.hide as (field: {
        model: Record<string, unknown>;
      }) => boolean;

      expect(
        hide({ model: { St184a: 'st184aAns-2', St184b: 9000 } })
      ).toBe(true);
    });

    it('should show when the refund claim is greater than 9000 Euro', () => {
      spectator = createComponent();

      const field = spectator.component.fields.find(
        (field) => field.key === 'St184c'
      );
      const hide = field?.expressions?.hide as (field: {
        model: Record<string, unknown>;
      }) => boolean;

      expect(
        hide({ model: { St184a: 'st184aAns-2', St184b: 9000.01 } })
      ).toBe(false);
    });
  });
});
