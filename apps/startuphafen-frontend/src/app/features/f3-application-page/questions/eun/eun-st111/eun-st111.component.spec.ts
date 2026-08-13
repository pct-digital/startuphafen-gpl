import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldEmptyComponent,
  FormlyFieldNumberEuroComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt111Component } from './eun-st111.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt111Component', () => {
  let spectator: Spectator<EunSt111Component>;
  const createComponent = createComponentFactory({
    component: EunSt111Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'empty',
            component: FormlyFieldEmptyComponent,
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
});
