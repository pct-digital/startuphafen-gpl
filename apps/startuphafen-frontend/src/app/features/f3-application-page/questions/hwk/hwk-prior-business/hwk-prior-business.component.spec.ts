import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { HwkPriorBusinessComponent } from './hwk-prior-business.component';

describe('HwkPriorBusinessComponent', () => {
  let spectator: Spectator<HwkPriorBusinessComponent>;

  const createComponent = createComponentFactory({
    component: HwkPriorBusinessComponent,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
          },
          {
            name: 'textarea',
            component: FormlyFieldTextareaComponent,
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

  it('uses updated wording for prior business question', () => {
    spectator = createComponent();

    const field = spectator.component.fields.find(
      (item) => item.key === 'HwkPriorBusiness'
    );
    expect(field?.props?.['label']).toBe(
      'Hattest Du in der Vergangenheit bereits ein Gewerbe angemeldet?'
    );
  });

  it('isAllowed returns true for kapg hwk branch', () => {
    expect(
      HwkPriorBusinessComponent.isAllowed({
        __catalogueId: 'kapg',
        HwkBranche: 'us1Ans-2',
      })
    ).toBe(true);
  });

  it('isAllowed returns false for non-hwk flow', () => {
    expect(
      HwkPriorBusinessComponent.isAllowed({
        __catalogueId: 'kapg',
        HwkBranche: 'us1Ans-1',
      })
    ).toBe(false);
  });
});
