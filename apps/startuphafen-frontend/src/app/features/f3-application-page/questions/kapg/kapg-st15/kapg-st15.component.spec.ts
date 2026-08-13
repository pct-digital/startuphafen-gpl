import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldEmptyComponent,
  FormlyFieldInputComponent,
  FormlyFieldNumberComponent,
  FormlyFieldRadioComponent,
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
} from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt15Component } from './kapg-st15.component';

const mockApService = { buildAnswerObject: jest.fn() };
const buildStoredAnswer = (
  value: string,
  componentId = 'KiPruefung'
): AnswerObject[string] => ({
  value,
  xmlKey: '/',
  type: 'string',
  componentId,
  stringValue: null,
  questionText: '',
  answerText: '',
  headerText: null,
});

describe('KapgSt15Component', () => {
  let spectator: Spectator<KapgSt15Component>;
  const createComponent = createComponentFactory({
    component: KapgSt15Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'textarea',
            component: FormlyFieldTextareaComponent,
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

  it('shows ai autofill hint when short description matches ki suggestion', () => {
    spectator = createComponent({
      props: {
        answers: {
          St15: buildStoredAnswer('Kurzbeschreibung', 'St15'),
          [HWK_AI_ANSWER_KEY]: buildStoredAnswer(
            JSON.stringify({
              classification: 'Handwerksrolle',
              branch: 'Handwerk',
              requiresPermit: true,
              shortDescription: 'Kurzbeschreibung',
              trades: ['Elektrotechniker (Anlage A)'],
            }),
            HWK_AI_ANSWER_KEY
          ),
        },
      },
    });

    expect(spectator.query(byTestId('hwk-ai-autofill-notice'))).toExist();
  });
});
