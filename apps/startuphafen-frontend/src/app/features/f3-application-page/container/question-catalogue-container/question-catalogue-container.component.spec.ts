import { Spectator, createComponentFactory } from '@ngneat/spectator';

import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { mockProvider } from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import { PctLoaderService, TrpcService } from '@startuphafen/angular-common';
import { CatalogueQuestion } from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { QuestionCatalogueHandler } from '../../../common/question-catalogue-handler';
import { ApplicationPageService } from '../../application-page.service';
import { QuestionCatalogueContainerComponent } from './question-catalogue-container.component';

const mockTrpcService = {
  client: {
    CMS: {
      getQuestionCatalogue: {
        query: jest.fn().mockResolvedValue({
          catalogueId: 'test-catalogue',
          questions: [],
        }),
      },
      compareToNewest: {
        mutate: jest.fn().mockResolvedValue(true),
      },
    },
    ShQuestionTracking: {
      readFiltered: {
        query: jest.fn().mockResolvedValue([]),
      },
    },
  },
};

const mockActivatedRoute = {
  snapshot: {
    paramMap: {
      get: jest.fn(),
    },
  },
};

const mockApplicationPageService = {
  getProject: jest.fn().mockResolvedValue({
    id: 1,
    locked: false,
    name: 'test',
    progress: 0,
    userId: 'dies-ist-eine-user-id',
  }),
  updateProgress: jest.fn(),
  callEricXML: jest.fn().mockReturnValue({ msg: 'ERIC_OK' }),
  callOZG: jest.fn().mockImplementation(),
  updateProjectSendStatus: jest.fn(),
  isGewADisabled: jest.fn().mockReturnValue(false),
  getAnswers: jest.fn().mockReturnValue([]),
  buildAnswerRec: jest.fn().mockReturnValue({
    key: 'test-answer',
    value: 'test-value',
  }),
};

const mockLoadService = {
  doWhileLoading: jest
    .fn()
    .mockImplementation(async (_key: string, fn: () => Promise<void>) => {
      await fn();
    }),
};

describe('QuestionCatalogueContainerComponent', () => {
  let spectator: Spectator<QuestionCatalogueContainerComponent>;
  const createComponent = createComponentFactory({
    component: QuestionCatalogueContainerComponent,
    providers: [
      { provide: TrpcService, useValue: mockTrpcService },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: ApplicationPageService, useValue: mockApplicationPageService },
      { provide: PctLoaderService, useValue: mockLoadService },
      mockProvider(KeycloakService),
    ],
    imports: [FormlyModule.forRoot(), ReactiveFormsModule, CommonModule],
  });

  let mockQuestionCatalogue: jest.Mocked<QuestionCatalogueHandler>;

  beforeEach(() => {
    spectator = createComponent();

    // Mock QuestionCatalogueHandler
    mockQuestionCatalogue = {
      next: jest.fn(),
      currentQuestion: {
        id: '1',
        questionId: 'q1',
        createdAt: '',
        documentId: '',
        publishedAt: '',
        updatedAt: '',
        type: 'string',
        questionText: 'Was ist Ihr Tätigkeitsfeld?',
        tooltip: 'tooltip',
        validations: [],
        answerOptions: [
          {
            id: 11,
            answerId: 'a1',
            xmlKey: '/',
            answerText: 'Hello',
          },
        ],
      } as CatalogueQuestion,
      catalogue: [
        { questionId: 'test-question-1' },
        { questionId: 'test-question-2' },
      ] as CatalogueQuestion[],
      questionIndex: 0,
    } as any;

    spectator.component.questionCatalogue = mockQuestionCatalogue;
    spectator.component.projectId = 123;
    spectator.component.currentStep = 0;

    // Mock questionFormTemplate
    spectator.component.questionFormTemplate = {
      updateForm: jest.fn(),
      updateCurrentStep: jest.fn(),
      patchForm: jest.fn(),
    } as any;

    // Mock component methods
    spectator.component.patchForm = jest.fn();
    spectator.component.endReachedCheck = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  describe('getRouteParams', () => {
    it('should return param value when param exists', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('123');
      const result = spectator.component.getRouteParams('projectId');
      expect(result).toBe('123');
    });

    it('should return null when param does not exist', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue(null);
      const result = spectator.component.getRouteParams('nonExistentParam');
      expect(result).toBeNull();
    });
  });

  describe('sendData', () => {
    it('should call eric XML service', async () => {
      await spectator.component.sendData();
      expect(mockApplicationPageService.callEricXML).toHaveBeenCalledWith(
        spectator.component.questionCatalogue
      );
    });

    it('should call OZG service', async () => {
      await spectator.component.sendOZGData();
      expect(mockApplicationPageService.callOZG).toHaveBeenCalledWith(
        spectator.component.questionCatalogue
      );
    });
  });

  describe('onNextClicked', () => {
    let mockQuestionCatalogue: jest.Mocked<QuestionCatalogueHandler>;

    beforeEach(() => {
      // Mock QuestionCatalogueHandler
      mockQuestionCatalogue = {
        next: jest.fn(),
        currentQuestion: {
          id: '1',
          questionId: 'q1',
          type: 'string',
          createdAt: '',
          documentId: '',
          publishedAt: '',
          updatedAt: '',
          questionText: 'Was ist Ihr Tätigkeitsfeld?',
          tooltip: 'tooltip',
          validations: [],
          answerOptions: [
            {
              id: 11,
              answerId: 'a1',
              xmlKey: '/',
              answerText: 'Hello',
            },
          ],
        } as CatalogueQuestion,
        catalogue: [
          { questionId: 'test-question-1' },
          { questionId: 'test-question-2' },
        ] as CatalogueQuestion[],
        questionIndex: 0,
      } as any;

      spectator.component.questionCatalogue = mockQuestionCatalogue;
      spectator.component.projectId = 123;
      spectator.component.currentStep = 0;

      // Mock questionFormTemplate
      spectator.component.questionFormTemplate = {
        updateForm: jest.fn(),
        updateCurrentStep: jest.fn(),
        patchForm: jest.fn(),
      } as any;

      // Mock component methods
      spectator.component.patchForm = jest.fn();
      spectator.component.endReachedCheck = jest
        .fn()
        .mockResolvedValue(undefined);
    });

    it('should handle next step correctly when questionCatalogue exists', async () => {
      // Arrange
      const formAnswers = { 'test-question-1': 'test-answer' };
      const mockAnswerRec = { key: 'test-answer', value: 'test-value' };

      mockApplicationPageService.buildAnswerRec.mockReturnValue(mockAnswerRec);
      mockQuestionCatalogue.next.mockResolvedValue(undefined);

      // Act
      await spectator.component.onNextClicked(formAnswers);

      expect(mockApplicationPageService.buildAnswerRec).toHaveBeenCalledWith(
        formAnswers,
        mockQuestionCatalogue.currentQuestion
      );
      expect(mockQuestionCatalogue.next).toHaveBeenCalledWith(mockAnswerRec);
      expect(
        spectator.component.questionFormTemplate?.updateForm
      ).toHaveBeenCalledWith(mockQuestionCatalogue.currentQuestion);
      expect(spectator.component.currentStep).toBe(1);
      expect(spectator.component.endReachedCheck).toHaveBeenCalledWith(
        mockAnswerRec
      );
    });

    it('should return early when questionCatalogue is null', async () => {
      // Arrange
      spectator.component.questionCatalogue = null;
      const formAnswers = { 'test-question-1': 'test-answer' };

      // Act
      await spectator.component.onNextClicked(formAnswers);

      // Assert
      expect(mockApplicationPageService.buildAnswerRec).not.toHaveBeenCalled();
    });
  });

  describe('onPreviousClicked', () => {
    let mockQuestionCatalogue: jest.Mocked<QuestionCatalogueHandler>;

    beforeEach(() => {
      // Mock QuestionCatalogueHandler
      mockQuestionCatalogue = {
        previous: jest.fn(),
        currentQuestion: {
          id: '1',
          questionId: 'q1',
          type: 'string',
          createdAt: '',
          documentId: '',
          publishedAt: '',
          updatedAt: '',
          questionText: 'Was ist Ihr Tätigkeitsfeld?',
          tooltip: 'tooltip',
          validations: [],
          answerOptions: [
            {
              id: 11,
              answerId: 'a1',
              xmlKey: '/',
              answerText: 'Hello',
            },
          ],
        } as CatalogueQuestion,
      } as any;

      spectator.component.questionCatalogue = mockQuestionCatalogue;

      // Mock questionFormTemplate
      spectator.component.questionFormTemplate = {
        updateForm: jest.fn(),
        updateCurrentStep: jest.fn(),
        patchForm: jest.fn(),
      } as any;
    });

    it('should handle previous step correctly when currentStep > 0', async () => {
      // Arrange
      spectator.component.currentStep = 2;
      mockQuestionCatalogue.previous.mockResolvedValue(undefined);

      // Act
      await spectator.component.onPreviousClicked();

      // Assert
      expect(mockLoadService.doWhileLoading).toHaveBeenCalledWith(
        'question-catalogue.previous',
        expect.any(Function)
      );
      expect(mockQuestionCatalogue.previous).toHaveBeenCalled();
      expect(spectator.component.currentStep).toBe(1);
      expect(
        spectator.component.questionFormTemplate?.updateForm
      ).toHaveBeenCalledWith(mockQuestionCatalogue.currentQuestion);
    });

    it('should not go to previous step when currentStep is 0', async () => {
      // Arrange
      spectator.component.currentStep = 0;

      // Act
      await spectator.component.onPreviousClicked();

      // Assert
      expect(mockLoadService.doWhileLoading).toHaveBeenCalledWith(
        'question-catalogue.previous',
        expect.any(Function)
      );
      expect(mockQuestionCatalogue.previous).not.toHaveBeenCalled();
      expect(spectator.component.currentStep).toBe(0);
      expect(
        spectator.component.questionFormTemplate?.updateForm
      ).not.toHaveBeenCalled();
    });
  });
});
