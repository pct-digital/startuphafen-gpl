import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt149Component } from './eun-st149.component';

const mockApService = { buildAnswerObject: jest.fn() };
describe('EunSt149Component', () => {
  let spectator: Spectator<EunSt149Component>;
  const createComponent = createComponentFactory({
    component: EunSt149Component,
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

  it('should serialize soll/ist options with schema-compliant values', () => {
    spectator = createComponent();

    const options = spectator.component.fields[0].props?.options as {
      value: string;
      stringValue: string;
    }[];

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'st149Ans-1',
          stringValue: '1',
        }),
        expect.objectContaining({
          value: 'st149Ans-2',
          stringValue: '2',
        }),
      ])
    );
  });

  describe('isAllowed', () => {
    it('should return true when St132-1 is greater than 25000', () => {
      const answers = { 'St132-1': 30000 };

      const result = EunSt149Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return true when St132-1 is less than 25000 and St134 is st134Ans-2', () => {
      const answers = { 'St132-1': 20000, St134: 'st134Ans-2' };

      const result = EunSt149Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when St132-1 is less than 25000 and St134 is not st134Ans-2', () => {
      const answers = { 'St132-1': 20000, St134: 'st134Ans-1' };

      const result = EunSt149Component.isAllowed(answers);

      expect(result).toBe(false);
    });

    it('should return true when St132-1 is equal to 25000 and St134 is st134Ans-2', () => {
      const answers = { 'St132-1': 25000, St134: 'st134Ans-2' };

      const result = EunSt149Component.isAllowed(answers);

      expect(result).toBe(true);
    });

    it('should return false when answers are missing', () => {
      const answers = {};

      const result = EunSt149Component.isAllowed(answers);

      expect(result).toBe(false);
    });
  });
});
