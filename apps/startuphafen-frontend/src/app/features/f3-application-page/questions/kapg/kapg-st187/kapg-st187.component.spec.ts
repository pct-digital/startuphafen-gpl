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
import { KapgSt187Component } from './kapg-st187.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('KapgSt187Component', () => {
  let spectator: Spectator<KapgSt187Component>;
  const createComponent = createComponentFactory({
    component: KapgSt187Component,
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

  it('should use final 202401 xml keys for Umsatzsteuer sections', () => {
    spectator = createComponent();

    const fieldsByKey = new Map(
      spectator.component.fields.map((field) => [field.key, field])
    );
    const st187aOptions = fieldsByKey.get('St187a')?.props?.[
      'options'
    ] as Record<string, string>[];
    const st188aOptions = fieldsByKey.get('St188a')?.props?.[
      'options'
    ] as Record<string, string>[];
    const st189aOptions = fieldsByKey.get('St189a')?.props?.[
      'options'
    ] as Record<string, string>[];

    expect(st187aOptions[0]?.['xmlKey']).toBe(
      'Umsatzsteuer/Steuerbefreiung/MerkerSteuerbefreiung'
    );
    expect(fieldsByKey.get('St188b')?.props?.['xmlKey']).toBe(
      'Umsatzsteuer/ErmSteuersatz/Abs2/UmsatzArt'
    );
    expect(st188aOptions[0]?.['xmlKey']).toBe(
      'Umsatzsteuer/ErmSteuersatz/Abs2/MerkerSteuersatz'
    );
    expect(fieldsByKey.get('St189b')?.props?.['xmlKey']).toBe(
      'Umsatzsteuer/Durchschnittssatzbesteuerung/UmsatzArt'
    );
    expect(st189aOptions[0]?.['xmlKey']).toBe(
      'Umsatzsteuer/Durchschnittssatzbesteuerung/MerkerDurchschnittssatzbesteuerung'
    );
  });

  it('should only offer allowed ELSTER values for average rate taxation UStG number', () => {
    spectator = createComponent();

    const fieldsByKey = new Map(
      spectator.component.fields.map((field) => [field.key, field])
    );
    const st189cOptions = fieldsByKey.get('St189c')?.props?.[
      'options'
    ] as Record<string, string>[];

    expect(fieldsByKey.get('St189c')?.type).toBe('multi-single');
    expect(st189cOptions.map((option) => option['stringValue'])).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(st189cOptions.map((option) => option['xmlKey'])).toEqual([
      'Umsatzsteuer/Durchschnittssatzbesteuerung/UStGNr',
      'Umsatzsteuer/Durchschnittssatzbesteuerung/UStGNr',
      'Umsatzsteuer/Durchschnittssatzbesteuerung/UStGNr',
    ]);
  });

  it('should show average rate taxation fields only for agriculture and forestry up to 600000 euro revenue', () => {
    spectator = createComponent();

    const fieldsByKey = new Map(
      spectator.component.fields.map((field) => [field.key, field])
    );
    const getHideExpression = (key: string) => {
      const hide = fieldsByKey.get(key)?.expressions?.hide;
      expect(typeof hide).toBe('function');
      return hide as (field: { model: Record<string, unknown> }) => boolean;
    };

    const eligibleModel = {
      HwkBranche: 'us1Ans-1',
      St183a: 600000,
      St189a: 'st189aAns-1',
    };
    const otherBranchModel = {
      ...eligibleModel,
      HwkBranche: 'us1Ans-5',
    };
    const tooMuchRevenueModel = {
      ...eligibleModel,
      St183a: 600001,
    };

    for (const key of ['St189a', 'St189b', 'St189c', 'St189d']) {
      expect(getHideExpression(key)({ model: eligibleModel })).toBe(false);
      expect(getHideExpression(key)({ model: otherBranchModel })).toBe(true);
      expect(getHideExpression(key)({ model: tooMuchRevenueModel })).toBe(
        true
      );
    }

    for (const key of ['St189b', 'St189c', 'St189d']) {
      expect(
        getHideExpression(key)({
          model: {
            HwkBranche: 'us1Ans-1',
            St183a: 600000,
            St189a: 'st189aAns-2',
          },
        })
      ).toBe(true);
    }
  });
});
