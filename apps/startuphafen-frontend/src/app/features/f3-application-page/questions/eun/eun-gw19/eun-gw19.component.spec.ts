import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunGw19Component } from './eun-gw19.component';

const mockApService = { buildAnswerObject: jest.fn() };

describe('EunGw19Component', () => {
  let spectator: Spectator<EunGw19Component>;
  const createComponent = createComponentFactory({
    component: EunGw19Component,
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

  it('shows Meistergründungsprämie hint for Handwerksrolle + Haupterwerb', () => {
    spectator = createComponent();
    spectator.component.model = {
      Us1: 'us1Ans-2',
      HwkEntryType: 'hwkEntryAns-1',
      Gw19: 'gw19Ans-2',
    };
    spectator.detectChanges();

    expect(
      spectator.query(byTestId('meistergruendungspraemie-hint'))
    ).toExist();
  });

  it('hides Meistergründungsprämie hint for Nebenerwerb', () => {
    spectator = createComponent();
    spectator.component.model = {
      HwkEntryType: 'hwkEntryAns-1',
      Gw19: 'gw19Ans-1',
    };
    spectator.detectChanges();

    expect(
      spectator.query(byTestId('meistergruendungspraemie-hint'))
    ).toBeNull();
  });

  it('shows Meistergründungsprämie hint when HwkEntryType is not yet answered (KAPG flow)', () => {
    spectator = createComponent();
    spectator.component.model = {
      HwkBranche: 'us1Ans-2',
      Gw19: 'gw19Ans-2',
    };
    spectator.detectChanges();

    expect(
      spectator.query(byTestId('meistergruendungspraemie-hint'))
    ).toExist();
  });

  it('hides Meistergründungsprämie hint for non-Handwerksrolle entry type', () => {
    spectator = createComponent();
    spectator.component.model = {
      Us1: 'us1Ans-2',
      HwkEntryType: 'hwkEntryAns-2',
      Gw19: 'gw19Ans-2',
    };
    spectator.detectChanges();

    expect(
      spectator.query(byTestId('meistergruendungspraemie-hint'))
    ).toBeNull();
  });

  describe('isAllowed', () => {
    it('should return true when Us1 answer is one of the allowed values', () => {
      const answers = { Us1: 'us1Ans-2' };

      const result = EunGw19Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when Us1 answer is not one of the allowed values', () => {
      const answers = { Us1: 'us1Ans-1' };

      const result = EunGw19Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when Us1 answer is missing', () => {
      const answers = {};

      const result = EunGw19Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
