import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt79Component } from './eun-st79.component';

registerLocaleData(localeDe);
const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt79Component', () => {
  let spectator: Spectator<EunSt79Component>;
  const createComponent = createComponentFactory({
    component: EunSt79Component,
    imports: [
      FormlyModule.forRoot({
        types: [
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

  it('should use final 202401 xml key for activity start', () => {
    spectator = createComponent();

    expect(spectator.component.fields[0].props?.['xmlKey']).toBe(
      'Betrieb/BetrBeginn/Betriebsbeginn'
    );
  });
});
