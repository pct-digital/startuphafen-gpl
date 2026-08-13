import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyFieldInputComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunGw28Component } from './eun-gw28.component';

registerLocaleData(localeDe);

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunGw28Component', () => {
  let spectator: Spectator<EunGw28Component>;
  const createComponent = createComponentFactory({
    component: EunGw28Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
          },
          {
            name: 'string',
            component: FormlyFieldInputComponent,
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
    ],
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
    it('should return true when Us1 answer is one of the allowed values', () => {
      const answers = { Us1: 'us1Ans-3' };

      const result = EunGw28Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when Us1 answer is not one of the allowed values', () => {
      const answers = { Us1: 'us1Ans-1' };

      const result = EunGw28Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when Us1 answer is missing', () => {
      const answers = {};

      const result = EunGw28Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return true when HwkBranche is handwerk', () => {
      const answers = { HwkBranche: 'us1Ans-2' };

      const result = EunGw28Component.isAllowed(answers);

      expect(result).toBe(true);
    });
  });

  it('should only configure the permit yes/no field', () => {
    spectator = createComponent();

    const keys = spectator.component.fields.map((field) => field.key);
    expect(keys).toEqual(['Gw28_0', 'Gw28', 'Gw28a', 'Gw28b']);
  });

  it('should not include handwerk-specific permit tooltip guidance', () => {
    spectator = createComponent();

    const tooltip = spectator.component.fields[0].props?.['tooltip'];

    expect(tooltip).not.toContain('Anlage A');
    expect(tooltip).not.toContain('Fragen zum HWK-Eintrag');
  });

  it('should normalize a prefilled permit answer into the form model', () => {
    spectator = createComponent({
      props: {
        answers: {
          Gw28_0: 'gw28_0Ans-1',
        },
      },
    });

    expect(spectator.component.model['Gw28_0']).toBe('gw28_0Ans-1');
  });
});
