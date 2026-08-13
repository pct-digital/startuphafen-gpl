import { ActivatedRoute } from '@angular/router';
import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldInputComponent,
  FormlyFieldTextareaComponent,
  FormlyWrapperHeading,
  PctLoaderService,
} from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
  HwkAiResult,
} from '@startuphafen/startuphafen-common';
import {
  HWK_AI_DESCRIPTION_KEY,
  HwkAiService,
} from '../../../services/hwk-ai.service';
import { KiPruefungContainerComponent } from './ki-pruefung.component';

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
        if (param === 'catalogueId') return 'eun';
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

describe('KiPruefungContainerComponent', () => {
  let spectator: Spectator<KiPruefungContainerComponent>;
  const createComponent = createComponentFactory({
    component: KiPruefungContainerComponent,
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
      { provide: HwkAiService, useValue: mockHwkAiService },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: PctLoaderService, useValue: mockLoaderService },
    ],
  });

  const createComponentWithProjectId = (projectId: string | null) =>
    createComponent({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (param: string) =>
                  param === 'projectId'
                    ? projectId
                    : param === 'catalogueId'
                    ? 'eun'
                    : null,
              },
            },
          },
        },
      ],
    });

  const createComponentWithCatalogueId = (catalogueId: string | null) =>
    createComponent({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (param: string) =>
                  param === 'projectId'
                    ? '1'
                    : param === 'catalogueId'
                    ? catalogueId
                    : null,
              },
            },
          },
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockHwkAiService.parseStoredResult.mockReturnValue(null);
    mockHwkAiService.analyze.mockResolvedValue({
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
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

  it('should load stored result on init', () => {
    const storedResult: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Stored short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    const storedValue = JSON.stringify(storedResult);
    mockHwkAiService.parseStoredResult.mockReturnValue(storedResult);

    const answers = {
      [HWK_AI_ANSWER_KEY]: buildStoredAnswer(storedValue, HWK_AI_ANSWER_KEY),
      [HWK_AI_DESCRIPTION_KEY]: buildStoredAnswer(
        'Stored description',
        HWK_AI_ANSWER_KEY
      ),
    };

    spectator = createComponent({
      props: {
        answers,
      },
    });

    expect(mockHwkAiService.parseStoredResult).toHaveBeenCalledWith(
      storedValue
    );
    expect(spectator.component.hwkAiResult).toEqual(storedResult);
    expect(spectator.component.formModel['description']).toBe(
      'Stored description'
    );
  });

  it('should load stored result from normalized value answers', () => {
    const storedResult: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Stored short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    const storedValue = JSON.stringify(storedResult);
    mockHwkAiService.parseStoredResult.mockReturnValue(storedResult);

    spectator = createComponent({
      props: {
        answers: {
          [HWK_AI_ANSWER_KEY]: storedValue,
          [HWK_AI_DESCRIPTION_KEY]: 'Stored description',
        },
      },
    });

    expect(mockHwkAiService.parseStoredResult).toHaveBeenCalledWith(
      storedValue
    );
    expect(spectator.component.hwkAiResult).toEqual(storedResult);
    expect(spectator.component.formModel['description']).toBe(
      'Stored description'
    );
  });

  it('should show error when description is missing', async () => {
    spectator = createComponent();

    await spectator.component.runHwkAi();

    expect(mockHwkAiService.analyze).not.toHaveBeenCalled();
    expect(spectator.component.hwkAiError).toBe(
      'Bitte gib eine Beschreibung ein.'
    );
  });

  it('should show error when projectId is missing', async () => {
    spectator = createComponentWithProjectId(null);
    spectator.component.formModel = { description: 'Test description' };

    await spectator.component.runHwkAi();

    expect(mockHwkAiService.analyze).not.toHaveBeenCalled();
    expect(spectator.component.hwkAiError).toBe(
      'Projekt konnte nicht geladen werden.'
    );
  });

  it('should run HWK AI and emit updated answers via loader', async () => {
    const result: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponent();
    spectator.component.formModel = { description: 'Test description' };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    expect(mockLoaderService.doWhileLoading).toHaveBeenCalledWith(
      'KiPruefungContainerComponent.runHwkAi',
      expect.any(Function)
    );
    expect(mockHwkAiService.analyze).toHaveBeenCalledWith(
      'Test description',
      1
    );
    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        [HWK_AI_DESCRIPTION_KEY]: expect.objectContaining({
          value: 'Test description',
        }),
      })
    );
    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        [HWK_AI_ANSWER_KEY]: expect.objectContaining({
          value: JSON.stringify(result),
        }),
      })
    );
    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        St25: expect.objectContaining({
          value: 'Test short description',
        }),
        Us1: expect.objectContaining({
          value: 'us1Ans-2',
        }),
        HwkEntryType: expect.objectContaining({
          value: 'hwkEntryAns-1',
        }),
        HwkTrade: expect.objectContaining({
          value: 'Elektrotechniker (Anlage A)',
        }),
      })
    );
    expect(spectator.component.hwkAiResult).toEqual(result);
    expect(spectator.component.hwkAiError).toBeNull();
    expect(spectator.component.hwkAiLoading).toBe(false);
  });

  it('should emit loadingChange true then false around a successful KI run', async () => {
    const result: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponent();
    spectator.component.formModel = { description: 'Test description' };
    const loadingSpy = jest.spyOn(spectator.component.loadingChange, 'emit');

    await spectator.component.runHwkAi();

    expect(loadingSpy).toHaveBeenNthCalledWith(1, true);
    expect(loadingSpy).toHaveBeenLastCalledWith(false);
  });

  it('should release loadingChange (emit false) even when the KI run fails', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockHwkAiService.analyze.mockRejectedValue(new Error('KI failed'));
    spectator = createComponent();
    spectator.component.formModel = { description: 'Test description' };
    const loadingSpy = jest.spyOn(spectator.component.loadingChange, 'emit');

    await spectator.component.runHwkAi();

    expect(loadingSpy).toHaveBeenNthCalledWith(1, true);
    expect(loadingSpy).toHaveBeenLastCalledWith(false);
    expect(spectator.component.hwkAiLoading).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('should not persist branch-dependent suggestions when branch is null', async () => {
    const result: HwkAiResult = {
      classification: 'kein Handwerksrolle',
      branch: null,
      requiresPermit: false,
      shortDescription: 'Keine sichere Zuordnung.',
      trades: [
        'Keine eindeutige Zuordnung gemäß Anlage A, B1 oder B2 möglich.',
      ],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponent();
    spectator.component.formModel = { description: 'Test description' };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    expect(answersUpdatedSpy).toHaveBeenCalledTimes(2);
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        St25: expect.anything(),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        Us1: expect.anything(),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        HwkBranche: expect.anything(),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        HwkEntryType: expect.anything(),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        HwkTrade: expect.objectContaining({
          value: expect.anything(),
        }),
      })
    );
  });

  it('should take over the improved description for a non-Handwerk branch (eun)', async () => {
    const result: HwkAiResult = {
      classification: 'kein Handwerksrolle',
      branch: 'Dienstleistungen',
      requiresPermit: false,
      shortDescription: 'Allgemeine Dienstleistungstätigkeit für Privatkunden.',
      trades: [
        'Keine eindeutige Zuordnung gemäß Anlage A, B1 oder B2 möglich.',
      ],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponent();
    spectator.component.formModel = { description: 'Test description' };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    // the Tätigkeitsbeschreibung is taken over even though it is not Handwerk
    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        St25: expect.objectContaining({
          value: 'Allgemeine Dienstleistungstätigkeit für Privatkunden.',
        }),
      })
    );
    // ... and the branch is still applied
    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        Us1: expect.objectContaining({
          value: 'us1Ans-9',
        }),
      })
    );
  });

  it('should persist branch suggestion to HwkBranche for kapg', async () => {
    const result: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponentWithCatalogueId('kapg');
    spectator.component.formModel = { description: 'Test description' };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        St15: expect.objectContaining({
          value: 'Test short description',
          xmlKey: 'AllgAngaben/ArtTaet/GewerbeArt',
        }),
        HwkBranche: expect.objectContaining({
          value: 'us1Ans-2',
          componentId: 'HwkBranche',
        }),
        HwkEntryType: expect.objectContaining({
          value: 'hwkEntryAns-1',
        }),
        HwkTrade: expect.objectContaining({
          value: 'Elektrotechniker (Anlage A)',
        }),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        Us1: expect.anything(),
      })
    );
  });

  it('should override a manually pre-selected Branche on an explicit KI run for kapg', async () => {
    const result: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponentWithCatalogueId('kapg');
    // the user had manually picked a different branch (Handel = us1Ans-5)
    spectator.component.answers = {
      HwkBranche: buildStoredAnswer('us1Ans-5', 'HwkBranche'),
    };
    spectator.component.formModel = { description: 'Test description' };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    // explicit KI run wins: the manual Handel selection is overwritten
    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        HwkBranche: expect.objectContaining({
          value: 'us1Ans-2',
          componentId: 'HwkBranche',
        }),
      })
    );
  });

  it('should not persist conflicting hwk detail suggestions when Gw29 indicates existing entry', async () => {
    const result: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponent({
      props: {
        answers: {
          Gw29: buildStoredAnswer('gw29Ans-1', 'Gw29'),
        },
      },
    });
    spectator.component.formModel = { description: 'Test description' };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        Gw28: expect.anything(),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        HwkEntryType: expect.anything(),
      })
    );
    expect(answersUpdatedSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        HwkTrade: expect.anything(),
      })
    );
  });

  it('should overwrite St15 when stored xmlKey is outdated for kapg', async () => {
    const result: HwkAiResult = {
      classification: 'Handwerksrolle',
      branch: 'Handwerk',
      requiresPermit: true,
      shortDescription: 'Test short description',
      trades: ['Elektrotechniker (Anlage A)'],
    };
    mockHwkAiService.analyze.mockResolvedValue(result);
    spectator = createComponentWithCatalogueId('kapg');
    spectator.component.formModel = { description: 'Test description' };
    spectator.component.answers = {
      St15: {
        ...buildStoredAnswer('Test short description', 'St15'),
        xmlKey: 'AllgAngaben/ArtTaet',
      },
      HwkBranche: buildStoredAnswer('us1Ans-2', 'HwkBranche'),
      HwkEntryType: buildStoredAnswer('hwkEntryAns-1', 'HwkEntryType'),
      HwkTrade: buildStoredAnswer('Elektrotechniker (Anlage A)', 'HwkTrade'),
    };
    const answersUpdatedSpy = jest.spyOn(
      spectator.component.answersUpdated,
      'emit'
    );

    await spectator.component.runHwkAi();

    expect(answersUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        St15: expect.objectContaining({
          value: 'Test short description',
          xmlKey: 'AllgAngaben/ArtTaet/GewerbeArt',
        }),
      })
    );
  });

});
