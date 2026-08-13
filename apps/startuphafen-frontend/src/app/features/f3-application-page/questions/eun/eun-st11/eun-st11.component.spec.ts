import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt11Component } from './eun-st11.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt11Component', () => {
  let spectator: Spectator<EunSt11Component>;
  const createComponent = createComponentFactory({
    component: EunSt11Component,
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

  it('should use final 202401 xml key for religion answers', () => {
    spectator = createComponent();

    const options = spectator.component.fields[0].props?.options as {
      xmlKey: string;
    }[];

    expect(options.every((option) => option.xmlKey === 'AllgAngaben/Inhaber/NatPers/Religion')).toBe(true);
  });
});
