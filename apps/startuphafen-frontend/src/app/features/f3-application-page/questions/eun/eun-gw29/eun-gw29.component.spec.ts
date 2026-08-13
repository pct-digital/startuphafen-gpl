import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import localeDe from '@angular/common/locales/de';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunGw29Component } from './eun-gw29.component';

import { registerLocaleData } from '@angular/common';
import { LOCALE_ID } from '@angular/core';

registerLocaleData(localeDe);
const mockApService = { buildAnswerObject: jest.fn() };
describe('EunGw29Component', () => {
  let spectator: Spectator<EunGw29Component>;
  const createComponent = createComponentFactory({
    component: EunGw29Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
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

  it('provides the fixed hwk chamber options directly on Gw29a', () => {
    spectator = createComponent();

    const chamberField = spectator.component.fields.find(
      (field) => field.key === 'Gw29a'
    );

    expect(chamberField).toBeDefined();
    expect(chamberField?.props?.['label']).toBe(
      'Bei welcher Handwerkskammer bist Du eingetragen?'
    );
    expect(chamberField?.props?.['options']).toEqual([
      {
        value: 'Handwerkskammer Flensburg',
        label: 'Handwerkskammer Flensburg',
        stringValue: 'Handwerkskammer Flensburg',
        xmlKey: '/',
      },
      {
        value: 'Handwerkskammer Lübeck',
        label: 'Handwerkskammer Lübeck',
        stringValue: 'Handwerkskammer Lübeck',
        xmlKey: '/',
      },
    ]);
  });

  it('does not show chamber finder hint when entry exists is selected', () => {
    spectator = createComponent();
    spectator.component.model = { Gw29: 'gw29Ans-1' };
    spectator.detectChanges();

    expect(spectator.query(byTestId('hwk-kammerfinder-hint'))).not.toExist();
  });

  it('uses updated wording for HWK entry question', () => {
    spectator = createComponent();

    const gw29Field = spectator.component.fields.find(
      (field) => field.key === 'Gw29'
    );
    expect(gw29Field?.props?.['label']).toBe(
      'Liegt für Dich eine Handwerkskarte vor?'
    );
  });

  describe('isAllowed', () => {
    it('should return true when Us1 answer is us1Ans-2', () => {
      const answers = { Us1: 'us1Ans-2' };

      const result = EunGw29Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when Us1 answer is not us1Ans-2', () => {
      const answers = { Us1: 'us1Ans-1' };

      const result = EunGw29Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return false when Us1 answer is missing', () => {
      const answers = {};

      const result = EunGw29Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
