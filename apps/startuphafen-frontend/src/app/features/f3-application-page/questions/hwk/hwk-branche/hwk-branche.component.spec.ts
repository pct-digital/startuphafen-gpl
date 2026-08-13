import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { ActivatedRoute } from '@angular/router';
import { FormlyModule } from '@ngx-formly/core';
import {
  FeatureFlagsService,
  FormlyFieldInputComponent,
  FormlyFieldRadioComponent,
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
  PctLoaderService,
} from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
} from '@startuphafen/startuphafen-common';
import { HwkAiService } from '../../../services/hwk-ai.service';
import { HwkBrancheComponent } from './hwk-branche.component';

const mockFeatureFlagsService = {
  isEnabled: jest.fn(),
};
const mockHwkAiService = {
  analyze: jest.fn(),
  parseStoredResult: jest.fn(),
};
const mockLoaderService = {
  doWhileLoading: jest.fn(),
};
const mockActivatedRoute = {
  snapshot: {
    paramMap: {
      get: (param: string) => {
        if (param === 'projectId') return '1';
        if (param === 'catalogueId') return 'kapg';
        return null;
      },
    },
  },
};
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

describe('HwkBrancheComponent', () => {
  let spectator: Spectator<HwkBrancheComponent>;

  const createComponent = createComponentFactory({
    component: HwkBrancheComponent,
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
    providers: [
      { provide: FeatureFlagsService, useValue: mockFeatureFlagsService },
      { provide: HwkAiService, useValue: mockHwkAiService },
      { provide: PctLoaderService, useValue: mockLoaderService },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagsService.isEnabled.mockReturnValue(true);
    mockHwkAiService.parseStoredResult.mockReturnValue(null);
    mockHwkAiService.analyze.mockResolvedValue({
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Kurzbeschreibung',
      trades: ['Elektrotechniker (Anlage A)'],
    });
    mockLoaderService.doWhileLoading.mockImplementation(
      async (_key: string, work: () => Promise<unknown>) => await work()
    );
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('shows embedded ai section when hwk feature is enabled', () => {
    mockFeatureFlagsService.isEnabled.mockReturnValue(true);
    spectator = createComponent();

    expect(spectator.query('sh-ki-pruefung-container')).toExist();
  });

  it('hides embedded ai section when hwk feature is disabled', () => {
    mockFeatureFlagsService.isEnabled.mockReturnValue(false);
    spectator = createComponent();

    expect(spectator.query('sh-ki-pruefung-container')).toBeNull();
  });

  it('isAllowed returns true for kapg', () => {
    expect(HwkBrancheComponent.isAllowed({ __catalogueId: 'kapg' })).toBe(true);
  });

  it('isAllowed returns false for non-kapg', () => {
    expect(HwkBrancheComponent.isAllowed({ __catalogueId: 'eun' })).toBe(false);
  });

  it('shows ai autofill hint when the branch was auto-filled by the ki', () => {
    spectator = createComponent({
      props: {
        answers: {
          HwkBranche: buildStoredAnswer('us1Ans-2', 'HwkBranche'),
          HwkAiAutofillSnapshot: buildStoredAnswer(
            JSON.stringify({ HwkBranche: 'us1Ans-2' })
          ),
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

  it('hides the autofill hint when the branch was selected manually (matches suggestion but not auto-filled)', () => {
    spectator = createComponent({
      props: {
        answers: {
          // user picked the same branch the ki would suggest, but there is no
          // autofill snapshot entry -> it was a manual choice, no notice.
          HwkBranche: buildStoredAnswer('us1Ans-2', 'HwkBranche'),
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

    expect(spectator.query(byTestId('hwk-ai-autofill-notice'))).not.toExist();
  });

  it('forwards embedded ai updates and syncs local model values', () => {
    spectator = createComponent();
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );
    const updatedAnswers: AnswerObject = {
      HwkBranche: buildStoredAnswer('us1Ans-2', 'HwkBranche'),
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
    };

    spectator.component.onHwkAiAnswersUpdated(updatedAnswers);

    expect(answersUpdatedSpy).toHaveBeenCalledWith(updatedAnswers);
    expect(spectator.component.model['HwkBranche']).toBe('us1Ans-2');
    expect(typeof spectator.component.model[HWK_AI_ANSWER_KEY]).toBe('string');
  });

  it('forwards embedded ai removals and removes local model values', () => {
    spectator = createComponent({
      props: {
        answers: {
          HwkBranche: buildStoredAnswer('us1Ans-2', 'HwkBranche'),
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
    const answersRemovedSpy = jest.spyOn(
      spectator.component.answersRemoved,
      'emit'
    );

    spectator.component.onHwkAiAnswersRemoved([
      'HwkBranche',
      HWK_AI_ANSWER_KEY,
    ]);

    expect(answersRemovedSpy).toHaveBeenCalledWith([
      'HwkBranche',
      HWK_AI_ANSWER_KEY,
    ]);
    expect(spectator.component.model['HwkBranche']).toBeUndefined();
    expect(spectator.component.model[HWK_AI_ANSWER_KEY]).toBeUndefined();
  });
});
