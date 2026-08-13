import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldCheckboxSmall,
  FormlyFieldInputComponent,
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
} from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';
import { EunSt25Component } from './eun-st25.component';

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

describe('EunSt25Component', () => {
  let spectator: Spectator<EunSt25Component>;
  const createComponent = createComponentFactory({
    component: EunSt25Component,
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
            name: 'checkbox',
            component: FormlyFieldCheckboxSmall,
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

  it('should use final 202401 xml key for the activity description', () => {
    spectator = createComponent();

    expect(spectator.component.fields[0].props?.['xmlKey']).toBe(
      'AllgAngaben/ArtTaet/GewerbeArt'
    );
  });

  it('shows ai autofill hint when short description matches ki suggestion', () => {
    spectator = createComponent({
      props: {
        answers: {
          St25: buildStoredAnswer('Kurzbeschreibung', 'St25'),
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
