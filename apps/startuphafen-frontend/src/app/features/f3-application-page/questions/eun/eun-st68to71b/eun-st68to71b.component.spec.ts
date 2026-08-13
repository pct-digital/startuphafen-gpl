import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { AbstractControl } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldInputComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { AddressValidationService } from '../../../services/address-validation.service';
import { EunSt68to71bComponent } from './eun-st68to71b.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt68to71bComponent', () => {
  let spectator: Spectator<EunSt68to71bComponent>;
  const createComponent = createComponentFactory({
    component: EunSt68to71bComponent,
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

  it('should use final 202401 xml keys for startup address fields', () => {
    spectator = createComponent();
    const options = spectator.component.fields[0].props?.['options'] as {
      xmlKey: string;
    }[];

    expect(options[0]?.xmlKey).toBe('Betrieb/Unternehmen/EntsprichtWohnanschrift');
    // fields[1] is the "Deine Anschrift" heading (type 'empty'); the address
    // input fields follow from index 2 on.
    expect(spectator.component.fields[2].props?.['xmlKey']).toBe(
      'Betrieb/Unternehmen/Adrkette/StrAdr/Str'
    );
    expect(spectator.component.fields[3].props?.['xmlKey']).toBe(
      'Betrieb/Unternehmen/Adrkette/StrAdr/HausNr'
    );
    expect(spectator.component.fields[6].props?.['xmlKey']).toBe(
      'Betrieb/Unternehmen/Adrkette/StrAdr/Plz'
    );
    expect(spectator.component.fields[7].props?.['xmlKey']).toBe(
      'Betrieb/Unternehmen/Adrkette/StrAdr/Ort'
    );
  });
});

describe('address validation', () => {
  const mockAddressValidationService = {
    getLocalities: jest.fn(),
    getStreets: jest.fn(),
    postalCodeMatchesLocality: jest.fn(),
    streetExistsInPostalCode: jest.fn(),
  };

  let spectator: Spectator<EunSt68to71bComponent>;
  const createComponent = createComponentFactory({
    component: EunSt68to71bComponent,
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
        provide: AddressValidationService,
        useValue: mockAddressValidationService,
      },
    ],
    mocks: [TrpcService],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should show error message when postal code does not match locality', async () => {
    mockAddressValidationService.getLocalities.mockResolvedValue([
      { name: 'Kiel' },
    ]);
    mockAddressValidationService.postalCodeMatchesLocality.mockResolvedValue(
      false
    );

    expect(
      await spectator.component.fields[7].asyncValidators![
        'postalCodeMatchesLocality'
      ].expression(
        { value: 'Kiel' } as AbstractControl,
        {
          model: { St68: 'st68Ans-2', St71a: '12345', St71b: 'Kiel' },
        } as FormlyFieldConfig
      )
    ).toBe(false);
    expect(spectator.component.localityErrorMessage).toBe(
      'Gültige Orte für diese Postleitzahl: Kiel'
    );
  });

  it('should show error message when street does not exist in postal code', async () => {
    mockAddressValidationService.streetExistsInPostalCode.mockResolvedValue(
      false
    );

    expect(
      await spectator.component.fields[7].asyncValidators![
        'streetExistsInPostalCode'
      ].expression(
        { value: 'Kiel' } as AbstractControl,
        {
          model: {
            St68: 'st68Ans-2',
            St69: 'Straße',
            St71a: '12345',
            St71b: 'Kiel',
          },
        } as FormlyFieldConfig
      )
    ).toBe(false);
    expect(spectator.component.addressErrorMessage).toBe(
      'Diese Straße existiert nicht in 12345, Kiel.'
    );
  });
});
