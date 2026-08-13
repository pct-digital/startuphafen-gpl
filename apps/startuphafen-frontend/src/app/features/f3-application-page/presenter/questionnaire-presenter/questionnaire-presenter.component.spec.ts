import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewContainerRef,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  byTestId,
  createComponentFactory,
  Spectator,
} from '@ngneat/spectator/jest';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FeatureFlagsService,
  PctLoaderService,
  TrpcService,
} from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
import { AnswerObject, Project } from '@startuphafen/startuphafen-common';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { KeycloakService } from 'keycloak-angular';
import { ApplicationPageService } from '../../application-page.service';
import { EunUs1Component } from '../../questions/eun/eun-us1/eun-us1.component';
import { QuestionnairePresenterComponent } from './questionnaire-presenter.component';
// Mock Question Component 1: Business Type
@Component({
  selector: 'sh-mock-business-type',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  template: '<form [formGroup]="form"></form>',
})
class MockBusinessTypeComponent {
  static readonly componentId = 'BusinessType';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [
    {
      key: 'st1',
      type: 'multi-single',
      props: {
        label: 'Business Type',
        required: true,
        options: [
          { value: 'retail', label: 'Retail' },
          { value: 'service', label: 'Service' },
          { value: 'manufacturing', label: 'Manufacturing' },
        ],
      },
    },
  ];

  async onSubmit(): Promise<void> {
    return Promise.resolve();
  }

  static isAllowed(_answers: AnswerObject): boolean {
    return true;
  }
}

// Mock Question Component 2: Company Name
@Component({
  selector: 'sh-mock-company-name',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  template: '<form [formGroup]="form"></form>',
})
class MockCompanyNameComponent {
  static readonly componentId = 'CompanyName';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [
    {
      key: 'st2',
      type: 'string',
      props: {
        label: 'Company Name',
        required: true,
      },
    },
  ];

  async onSubmit(): Promise<void> {
    return Promise.resolve();
  }

  static isAllowed(_answers: AnswerObject): boolean {
    return true;
  }
}

// Mock Question Component 3: Revenue Estimate (conditionally shown)
@Component({
  selector: 'sh-mock-st3',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  template: '<form [formGroup]="form"></form>',
})
class MockRevenueComponent {
  static readonly componentId = 'Revenue';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [
    {
      key: 'expectedRevenue',
      type: 'number-euro',
      props: {
        label: 'Expected Annual Revenue',
        required: true,
        type: 'number',
      },
    },
  ];

  async onSubmit(): Promise<void> {
    return Promise.resolve();
  }

  static isAllowed(answers: AnswerObject): boolean {
    // Only show for retail and manufacturing
    return (
      answers['st1']?.value === 'retail' ||
      answers['st1']?.value === 'manufacturing'
    );
  }
}

describe('QuestionnairePresenterComponent', () => {
  let spectator: Spectator<QuestionnairePresenterComponent>;

  const setRouteCatalogueId = (catalogueId: string) => {
    const route = spectator.inject(ActivatedRoute);
    route.snapshot.paramMap.get = jest.fn((key: string) => {
      if (key === 'catalogueId') return catalogueId;
      if (key === 'projectId') return '1';
      return null;
    });
  };

  // Mock window.scroll to prevent warnings in tests
  beforeAll(() => {
    window.scroll = jest.fn();
  });

  const mockProject: Project = {
    createdAt: new Date(),
    id: 1,
    name: 'Test Project',
    progress: 0,
    catalogueId: 'eun',
    lastPosition: 0,
    userId: 'test-user',
    stSent: false,
    gwSent: false,
  };

  const mockAnswers = [
    {
      id: 1,
      catalogueId: 'test-catalogue',
      key: 'Us1',
      projectId: 1,
      stringValue: null,
      componentId: 'Us1',
      value: 'us1Ans-2',
      type: 'multi-single',
      xmlKey: '/',
      questionText: '',
      answerText: '',
      headerText: null,
    },
  ];

  const mockUpsertReturn: Record<string, number> = { Us1: 1 };

  const createComponent = createComponentFactory({
    component: QuestionnairePresenterComponent,
    mocks: [
      TrpcService,
      ApplicationPageService,
      KeycloakService,
      FeatureFlagsService,
      PctLoaderService,
    ],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: jest.fn((key: string) => {
                if (key === 'projectId') return '1';
                if (key === 'catalogueId') return 'eun';
                return null;
              }),
            },
            queryParamMap: {
              get: jest.fn(() => null),
            },
          },
        },
      },
    ],
    detectChanges: false,
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    spectator = createComponent({
      detectChanges: false,
    });

    setRouteCatalogueId('eun');

    // Set catalogueId before any tests run
    spectator.component.catalogueId = 'eun';

    // Setup default mock TRPC client
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Project: {
        readFiltered: {
          query: async () => [mockProject],
        },
        update: {
          mutate: async () => undefined,
        },
        gewADisabled: {
          query: async () => false,
        },
      },
      Answers: {
        readFiltered: {
          query: async () => mockAnswers,
        },
        create: {
          mutate: async () => 1,
        },
        update: {
          mutate: async () => undefined,
        },
        batchDelete: {
          mutate: async () => undefined,
        },
        upsertBatch: {
          mutate: async () => mockUpsertReturn,
        },
      },
      QuestionTracking: {
        create: {
          mutate: async () => 1,
        },
        deleteForProject: {
          mutate: async () => undefined,
        },
      },
      CMS: {
        getContactList: {
          query: async () => [],
        },
      },
      OzgInfo: {
        getConfig: {
          query: async () => ({
            enableAmtSelection: false,
            isOZGOverriden: false,
          }),
        },
        getUniqueAmts: {
          query: async () => [],
        },
      },
      Ext: {
        getFinanzaemter: {
          query: async () => [],
        },
      },
      HwkForm: {
        sendHwkMail: {
          mutate: async () => ({
            status: 'pending',
            attemptCount: 0,
            lastError: null,
            nextAttemptAt: null,
            sentAt: null,
          }),
        },
        getHwkMailStatus: {
          query: async () => ({
            status: 'pending',
            attemptCount: 0,
            lastError: null,
            nextAttemptAt: null,
            sentAt: null,
          }),
        },
      },
      UserDocuments: {
        listByCase: {
          query: async () => [],
        },
      },
    });

    const featureFlags = spectator.inject(FeatureFlagsService);
    jest.spyOn(featureFlags, 'isEnabled').mockReturnValue(true);
    const loader = spectator.inject(PctLoaderService);
    jest
      .spyOn(loader, 'doWhileLoading')
      .mockImplementation(async (_key, work) => await work());

    // Setup ApplicationPageService mock
    const apService = spectator.inject(ApplicationPageService);
    jest
      .spyOn(apService, 'updateProgress')
      .mockImplementation(async () => Promise.resolve());
    jest
      .spyOn(apService, 'isGewADisabled')
      .mockImplementation(async () => Promise.resolve(false));
    jest.spyOn(apService, 'buildAnswerObject').mockImplementation(() => ({
      Us1: {
        value: 'us1Ans-2',
        xmlKey: '/',
        stringValue: null,
        type: 'multi-single',
        componentId: 'Us1',
        questionText: '',
        answerText: '',
        headerText: null,
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create', () => {
    spectator.detectChanges();
    expect(spectator.component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load project from route parameter', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      expect(spectator.component.project).toEqual(mockProject);
    });

    it('should load answers from database', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      expect(spectator.component.answers['Us1']).toEqual({
        value: 'us1Ans-2',
        xmlKey: '/',
        type: 'multi-single',
        componentId: 'Us1',
        stringValue: null,
        questionText: '',
        answerText: '',
        headerText: null,
      });
    });

    it('should initialize to first allowed step', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      expect(spectator.component.currentStepIndex).toBe(0);
    });

    it('should not include a standalone ki-pruefung step in eun flow', () => {
      spectator.component.getCatalogue();

      expect(spectator.component.steps.map((step) => step.key)).not.toContain(
        'ki-pruefung'
      );
    });

    it('should place gw29 directly after the branch step for eun', () => {
      spectator.component.catalogueId = 'eun';
      spectator.component.getCatalogue();

      const keys = spectator.component.steps.map((step) => step.key);
      expect(keys.indexOf('gw29')).toBe(keys.indexOf('us1') + 1);
    });

    it('should place gw29 directly after the branch step for kapg', () => {
      setRouteCatalogueId('kapg');
      spectator.component.getCatalogue();

      const keys = spectator.component.steps.map((step) => step.key);
      expect(keys.indexOf('gw29')).toBe(keys.indexOf('hwk-branche') + 1);
    });

    it('should place gw28 after the hwk steps for eun', () => {
      spectator.component.catalogueId = 'eun';
      spectator.component.getCatalogue();

      const keys = spectator.component.steps.map((step) => step.key);
      expect(keys.indexOf('gw28')).toBe(keys.indexOf('hwk-prior-business') + 1);
    });

    it('should place gw28 after the hwk steps for kapg', () => {
      const route = spectator.inject(ActivatedRoute);
      (
        route.snapshot.paramMap.get as unknown as jest.Mock<
          string | null,
          [string]
        >
      ).mockImplementationOnce(() => 'kapg');
      spectator.component.getCatalogue();

      const keys = spectator.component.steps.map((step) => step.key);
      expect(keys.indexOf('gw28')).toBe(keys.indexOf('hwk-prior-business') + 1);
    });

    it('should set finishedQuestionnaire to true when progress is 100', async () => {
      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Project: {
            readFiltered: {
              query: async () => [{ ...mockProject, progress: 100 }],
            },
            gewADisabled: {
              query: async () => false,
            },
          },
          Answers: {
            readFiltered: {
              query: async () => mockAnswers,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      spectator.detectChanges();
      await spectator.fixture.whenStable();

      expect(spectator.component.finishedQuestionnaire).toBe(true);
    });

    it('backfills OZG info for finished projects when no domain entries exist', async () => {
      const getUniqueAmts = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            amt: 'Kiel',
            amtCode: '001',
            domain: 'https://kiel.example.de',
          },
        ]);
      const saveForProject = jest.fn().mockResolvedValue(1);

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Project: {
            readFiltered: {
              query: async () => [{ ...mockProject, progress: 100 }],
            },
            gewADisabled: {
              query: async () => false,
            },
          },
          Answers: {
            readFiltered: {
              query: async () => [
                ...mockAnswers,
                {
                  id: 2,
                  key: 'St68',
                  projectId: 1,
                  stringValue: null,
                  componentId: 'St68-71b',
                  value: 'st68Ans-2',
                  type: 'multi-single',
                  xmlKey: '/',
                  questionText: '',
                  answerText: '',
                  headerText: null,
                },
                {
                  id: 3,
                  key: 'St71a',
                  projectId: 1,
                  stringValue: null,
                  componentId: 'St68-71b',
                  value: '24103',
                  type: 'string',
                  xmlKey: '/',
                  questionText: '',
                  answerText: '',
                  headerText: null,
                },
              ],
            },
          },
          OzgInfo: {
            getConfig: {
              query: async () => ({
                enableAmtSelection: true,
                isOZGOverriden: false,
              }),
            },
            getUniqueAmts: {
              query: getUniqueAmts,
            },
            saveForProject: {
              mutate: saveForProject,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      spectator.detectChanges();
      await spectator.fixture.whenStable();

      expect(saveForProject).toHaveBeenCalledWith({
        projectId: 1,
        plz: '24103',
      });
      expect(spectator.component.selectedAmtDomain).toBe(
        'https://kiel.example.de'
      );
    });
  });

  describe('HWK manual actions', () => {
    const hwkAnswers: AnswerObject = {
      Us1: {
        value: 'us1Ans-2',
        xmlKey: '/',
        stringValue: null,
        type: 'multi-single',
        componentId: 'Us1',
        questionText: '',
        answerText: '',
        headerText: null,
      },
      HwkEntryType: {
        value: 'hwkEntryAns-1',
        xmlKey: '/',
        stringValue: null,
        type: 'multi-single',
        componentId: 'HwkEntryType',
        questionText: '',
        answerText: '',
        headerText: null,
      },
    };

    it('renders HWK send card in final sending screen when HWK flow is active', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.catalogueId = 'eun';
      spectator.component.finishedQuestionnaire = true;
      spectator.component.lookedAtOverview = true;
      spectator.component.roles = ['bundID-high'];
      spectator.component.answers = hwkAnswers;

      spectator.detectChanges();

      expect(spectator.element.textContent).toContain(
        'Sende jetzt Deinen Handwerkskammer-Antrag ab!'
      );
    });

    it('renders HWK send card as sent when hwk mail status is sent', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.catalogueId = 'eun';
      spectator.component.finishedQuestionnaire = true;
      spectator.component.lookedAtOverview = true;
      spectator.component.roles = ['bundID-high'];
      spectator.component.answers = hwkAnswers;
      spectator.component.hwkMailStatus = {
        status: 'sent',
        attemptCount: 1,
        lastError: null,
        nextAttemptAt: null,
        sentAt: new Date('2026-03-03T10:00:00.000Z'),
      };

      spectator.detectChanges();

      expect(
        spectator.queryAll('img[src="/assets/icons/solid/check-solid.svg"]')
      ).toHaveLength(1);
    });

    it('shows Meistergründungsprämie reminder for Handwerksrolle in Haupterwerb', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.catalogueId = 'eun';
      spectator.component.finishedQuestionnaire = true;
      spectator.component.lookedAtOverview = true;
      spectator.component.roles = ['bundID-high'];
      spectator.component.answers = {
        ...hwkAnswers,
        Gw19: {
          value: 'gw19Ans-2',
          xmlKey: '/',
          stringValue: 'false',
          type: 'multi-single',
          componentId: 'Gw19',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      spectator.detectChanges();

      expect(
        spectator.query(byTestId('meistergruendungspraemie-reminder'))
      ).toExist();
    });

    it('hides Meistergründungsprämie reminder for Nebenerwerb', async () => {
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.catalogueId = 'eun';
      spectator.component.finishedQuestionnaire = true;
      spectator.component.lookedAtOverview = true;
      spectator.component.roles = ['bundID-high'];
      spectator.component.answers = {
        ...hwkAnswers,
        Gw19: {
          value: 'gw19Ans-1',
          xmlKey: '/',
          stringValue: 'true',
          type: 'multi-single',
          componentId: 'Gw19',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      spectator.detectChanges();

      expect(
        spectator.query(byTestId('meistergruendungspraemie-reminder'))
      ).toBeNull();
    });

    it('sends HWK mail manually on demand', async () => {
      const sendHwkMail = jest.fn(
        async (): Promise<{
          status: 'pending';
          attemptCount: number;
          lastError: string | null;
          nextAttemptAt: Date | null;
          sentAt: Date | null;
        }> => ({
          status: 'pending',
          attemptCount: 0,
          lastError: null,
          nextAttemptAt: null,
          sentAt: null,
        })
      );

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          HwkForm: {
            sendHwkMail: {
              mutate: sendHwkMail,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.catalogueId = 'eun';
      spectator.component.finishedQuestionnaire = true;
      spectator.component.answers = hwkAnswers;

      await spectator.component.sendHwkMailManual();

      expect(sendHwkMail).toHaveBeenCalledWith(1);
      expect(spectator.component.hwkMailStatus?.status).toBe('pending');
    });

    it('does not auto-send HWK mail during ngOnInit', async () => {
      const sendHwkMail = jest.fn(
        async (): Promise<{
          status: 'pending';
          attemptCount: number;
          lastError: string | null;
          nextAttemptAt: Date | null;
          sentAt: Date | null;
        }> => ({
          status: 'pending',
          attemptCount: 0,
          lastError: null,
          nextAttemptAt: null,
          sentAt: null,
        })
      );

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Project: {
            readFiltered: {
              query: async () => [
                {
                  ...mockProject,
                  progress: 100,
                  stSent: true,
                  gwSent: true,
                },
              ],
            },
          },
          Answers: {
            readFiltered: {
              query: async () => [
                mockAnswers[0],
                {
                  id: 2,
                  catalogueId: 'test-catalogue',
                  key: 'HwkEntryType',
                  projectId: 1,
                  stringValue: null,
                  componentId: 'HwkEntryType',
                  value: 'hwkEntryAns-1',
                  type: 'multi-single',
                  xmlKey: '/',
                  questionText: '',
                  answerText: '',
                  headerText: null,
                },
              ],
            },
          },
          HwkForm: {
            getFilledPdf: {
              query: (async (): Promise<{
                data: Uint8Array;
                filename: string;
                mimeType: 'application/pdf';
              }> => ({
                data: new Uint8Array([1, 2, 3]),
                filename: 'HWK-Antrag-1.pdf',
                mimeType: 'application/pdf',
              })) as any,
            },
            sendHwkMail: {
              mutate: sendHwkMail,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      Reflect.set(
        spectator.component,
        'startHwkMailStatusPolling',
        jest.fn(() => undefined)
      );

      spectator.detectChanges();
      await spectator.fixture.whenStable();

      expect(sendHwkMail).not.toHaveBeenCalled();
    });

    it('does not auto-send HWK mail after sendData', async () => {
      const sendHwkMail = jest.fn(
        async (): Promise<{
          status: 'pending';
          attemptCount: number;
          lastError: string | null;
          nextAttemptAt: Date | null;
          sentAt: Date | null;
        }> => ({
          status: 'pending',
          attemptCount: 0,
          lastError: null,
          nextAttemptAt: null,
          sentAt: null,
        })
      );

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Eric: {
            xmlPost: {
              query: async () => ({
                msg: 'ERIC_OK',
                pdf: {
                  type: 'Uint8Array',
                  data: new Uint8Array([1]),
                },
              }),
            },
          },
          HwkForm: {
            sendHwkMail: {
              mutate: sendHwkMail,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.catalogueId = 'eun';
      spectator.component.answers = hwkAnswers;

      await spectator.component.sendData(1111);

      expect(sendHwkMail).not.toHaveBeenCalled();
    });

    it('does not auto-send HWK mail after sendOZGData', async () => {
      const sendHwkMail = jest.fn(
        async (): Promise<{
          status: 'pending';
          attemptCount: number;
          lastError: string | null;
          nextAttemptAt: Date | null;
          sentAt: Date | null;
        }> => ({
          status: 'pending',
          attemptCount: 0,
          lastError: null,
          nextAttemptAt: null,
          sentAt: null,
        })
      );
      const postOZGFormData = jest.fn(async () => ({
        transactionId: 'tx-1',
        vorgang: {
          status: 'success',
          vorgangId: 'vorgang-1',
          vorgangNummer: '0001',
          statusSince: '2026-02-23T10:00:00.000Z',
        },
        documentBlob: Buffer.from('ozg').toString('base64'),
      }));

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          OZG: {
            postOZGFormData: {
              mutate: postOZGFormData,
            },
          },
          HwkForm: {
            sendHwkMail: {
              mutate: sendHwkMail,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      spectator.component.project = { ...mockProject, progress: 100 };
      spectator.component.answers = hwkAnswers;
      spectator.component.catalogueId = 'eun';

      await spectator.component.sendOZGData();

      expect(postOZGFormData).toHaveBeenCalledWith({
        projectId: 1,
        catalogueId: 'eun',
        domain: undefined,
      });
      expect(sendHwkMail).not.toHaveBeenCalled();
    });

    it('loads HWK PDF on demand before download', async () => {
      const getFilledPdf = jest.fn(
        async (): Promise<{
          data: Uint8Array;
          filename: string;
          mimeType: 'application/pdf';
        }> => ({
          data: new Uint8Array([7, 8, 9]),
          filename: 'HWK-Antrag-1.pdf',
          mimeType: 'application/pdf',
        })
      );

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          HwkForm: {
            getFilledPdf: {
              query: getFilledPdf as any,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      const originalCreateObjectUrl = window.URL.createObjectURL;
      const originalRevokeObjectUrl = window.URL.revokeObjectURL;
      const createObjectURLMock = jest.fn(() => 'blob:hwk');
      const revokeObjectURLMock = jest.fn();
      Object.defineProperty(window.URL, 'createObjectURL', {
        value: createObjectURLMock,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window.URL, 'revokeObjectURL', {
        value: revokeObjectURLMock,
        writable: true,
        configurable: true,
      });
      const clickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      spectator.component.project = { ...mockProject, progress: 100 };

      await spectator.component.downloadHwkPdf();

      expect(getFilledPdf).toHaveBeenCalledWith(1);
      expect(createObjectURLMock).toHaveBeenCalled();
      clickSpy.mockRestore();
      Object.defineProperty(window.URL, 'createObjectURL', {
        value: originalCreateObjectUrl,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window.URL, 'revokeObjectURL', {
        value: originalRevokeObjectUrl,
        writable: true,
        configurable: true,
      });
    });
  });
  describe('initializeFirstStep', () => {
    it('should set currentStepIndex to 0 when lastPosition is 0', async () => {
      spectator.component.project = mockProject;
      spectator.component.answers = {};
      spectator.component.catalogueId = 'eun';
      spectator.component.getCatalogue();

      await spectator.component.initializeFirstStep();

      expect(spectator.component.currentStepIndex).toBe(0);
    });

    it('should set currentStepIndex to lastPosition when it is not 0', async () => {
      const projectWithPosition = { ...mockProject, lastPosition: 3 };
      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Project: {
            readFiltered: {
              query: async () => [projectWithPosition],
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      spectator.component.project = projectWithPosition;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      await spectator.component.initializeFirstStep();

      expect(spectator.component.currentStepIndex).toBe(3);
    });
  });

  describe('saveAnswers', () => {
    it('should upsert new answers using upsertBatch', async () => {
      spectator.component.project = mockProject;
      spectator.component.catalogueId = 'test-catalogue';
      spectator.component.answers = {
        newAnswer: {
          value: 'test-value',
          xmlKey: '/test',
          stringValue: 'Test String',
          type: 'text',
          componentId: 'TestComponent',
          questionText: 'Test Question',
          answerText: 'Test Answer',
          headerText: null,
        },
      };

      const upsertBatchMutate = jest.fn(async () => ({ newAnswer: 1 }));

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Answers: {
            readFiltered: {
              query: async () => [],
            },
            upsertBatch: {
              mutate: upsertBatchMutate,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      (spectator.component as any).dirtyAnswerKeys = new Set(['newAnswer']);
      await spectator.component.saveAnswers();

      expect(upsertBatchMutate).toHaveBeenCalledWith({
        projectId: 1,
        answers: [
          {
            key: 'newAnswer',
            projectId: 1,
            stringValue: 'Test String',
            componentId: 'TestComponent',
            value: 'test-value',
            type: 'text',
            xmlKey: '/test',
            questionText: 'Test Question',
            answerText: 'Test Answer',
            headerText: null,
          },
        ],
      });
      expect((spectator.component as any).answerIdByKey['newAnswer']).toBe(1);
    });

    it('should upsert existing answers using upsertBatch', async () => {
      spectator.component.project = mockProject;
      spectator.component.catalogueId = 'test-catalogue';
      spectator.component.answers = {
        Us1: {
          value: 'us1Ans-3',
          xmlKey: '/updated',
          stringValue: null,
          type: 'multi-single',
          componentId: 'Us1',
          questionText: 'Question',
          answerText: 'Answer',
          headerText: null,
        },
      };

      const upsertBatchMutate = jest.fn(async () => ({ Us1: 1 }));

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Answers: {
            readFiltered: {
              query: async () => mockAnswers,
            },
            upsertBatch: {
              mutate: upsertBatchMutate,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      (spectator.component as any).answerIdByKey = { Us1: 1 };
      (spectator.component as any).dirtyAnswerKeys = new Set(['Us1']);
      await spectator.component.saveAnswers();

      expect(upsertBatchMutate).toHaveBeenCalledWith({
        projectId: 1,
        answers: [
          {
            key: 'Us1',
            projectId: 1,
            stringValue: null,
            componentId: 'Us1',
            value: 'us1Ans-3',
            type: 'multi-single',
            xmlKey: '/updated',
            questionText: 'Question',
            answerText: 'Answer',
            headerText: null,
          },
        ],
      });
      expect((spectator.component as any).answerIdByKey['Us1']).toBe(1);
    });

    it('should batch delete removed keys before upserting dirty answers', async () => {
      spectator.component.project = mockProject;
      spectator.component.catalogueId = 'test-catalogue';
      spectator.component.answers = {
        keepAnswer: {
          value: 'keep-value',
          xmlKey: '/keep',
          stringValue: null,
          type: 'text',
          componentId: 'KeepComponent',
          questionText: 'Keep Question',
          answerText: 'Keep Answer',
          headerText: null,
        },
      };

      const batchDeleteMutate = jest.fn(async () => undefined);
      const upsertBatchMutate = jest.fn(async () => ({ keepAnswer: 5 }));

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Answers: {
            batchDelete: {
              mutate: batchDeleteMutate,
            },
            upsertBatch: {
              mutate: upsertBatchMutate,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      (spectator.component as any).dirtyAnswerKeys = new Set([
        'removedAnswer',
        'keepAnswer',
      ]);
      (spectator.component as any).pendingDeletedAnswerKeys = new Set([
        'removedAnswer',
      ]);
      (spectator.component as any).answerIdByKey = { removedAnswer: 99 };

      await spectator.component.saveAnswers();

      expect(batchDeleteMutate).toHaveBeenCalledWith({
        projectId: 1,
        keys: ['removedAnswer'],
      });
      expect(upsertBatchMutate).toHaveBeenCalledWith({
        projectId: 1,
        answers: [
          {
            key: 'keepAnswer',
            projectId: 1,
            stringValue: null,
            componentId: 'KeepComponent',
            value: 'keep-value',
            type: 'text',
            xmlKey: '/keep',
            questionText: 'Keep Question',
            answerText: 'Keep Answer',
            headerText: null,
          },
        ],
      });
      expect((spectator.component as any).pendingDeletedAnswerKeys.size).toBe(
        0
      );
      expect((spectator.component as any).answerIdByKey['removedAnswer']).toBe(
        undefined
      );
    });
  });

  describe('savePosition', () => {
    it('should update project lastPosition', async () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 5;

      const updateMutate = jest.fn(async () => undefined);
      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          Project: {
            update: {
              mutate: updateMutate,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      await spectator.component.savePosition();

      expect(updateMutate).toHaveBeenCalledWith({
        id: 1,
        updates: {
          lastPosition: 5,
        },
      });
    });

    it('should throw error when project is null', async () => {
      spectator.component.project = null;

      await expect(spectator.component.savePosition()).rejects.toThrow(
        'Project is faulty: Project Id is null'
      );
    });
  });

  describe('loadAnswers', () => {
    it('should load and transform answers from database', async () => {
      spectator.component.project = mockProject;
      spectator.component.answers = {};

      await spectator.component.loadAnswers();

      expect(spectator.component.answers['Us1']).toEqual({
        value: 'us1Ans-2',
        xmlKey: '/',
        type: 'multi-single',
        componentId: 'Us1',
        stringValue: null,
        questionText: '',
        answerText: '',
        headerText: null,
      });
    });

    it('should merge loaded answers with existing answers', async () => {
      spectator.component.project = mockProject;
      spectator.component.answers = {
        existingAnswer: {
          value: 'existing',
          xmlKey: '/existing',
          stringValue: null,
          type: 'text',
          componentId: 'Test',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      await spectator.component.loadAnswers();

      expect(spectator.component.answers['existingAnswer']).toBeDefined();
      expect(spectator.component.answers['Us1']).toBeDefined();
    });
  });

  describe('renderCurrentComponent', () => {
    it('should clear container when component is not allowed', () => {
      spectator.component.componentContainer = {
        clear: jest.fn(),
        createComponent: jest.fn(),
      } as unknown as ViewContainerRef;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};

      // Mock isAllowed to return false
      jest.spyOn(EunUs1Component, 'isAllowed').mockReturnValue(false);

      spectator.component.renderCurrentComponent();

      expect(spectator.component.componentContainer.clear).toHaveBeenCalled();
    });

    it('should not render if componentContainer is not available', () => {
      spectator.component.componentContainer = null as any;

      expect(() => spectator.component.renderCurrentComponent()).not.toThrow();
    });

    it('should mark updated answers dirty and queue removed answers', () => {
      const instance = {
        answers: {},
        model: {},
        form: new FormGroup({}),
        fields: [],
        isLastStep: false,
        stepComplete: { emit: jest.fn() },
        answersUpdated: { emit: jest.fn() },
        answersRemoved: { emit: jest.fn() },
      };

      spectator.component.componentContainer = {
        clear: jest.fn(),
        createComponent: jest.fn().mockReturnValue({ instance }),
      } as unknown as ViewContainerRef;

      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      spectator.component.renderCurrentComponent();

      const updatedAnswerObject: AnswerObject = {
        HwkAi: {
          value: 'result',
          xmlKey: '/',
          stringValue: 'Handwerk',
          type: 'string',
          componentId: 'HwkAi',
          questionText: 'KI',
          answerText: 'Handwerk',
          headerText: null,
        },
      };

      instance.answersUpdated?.emit(updatedAnswerObject);
      expect((spectator.component as any).dirtyAnswerKeys.has('HwkAi')).toBe(
        true
      );
      expect(
        (spectator.component as any).pendingDeletedAnswerKeys.has('HwkAi')
      ).toBe(false);

      (spectator.component as any).answerIdByKey['HwkAi'] = 12;
      instance.answersRemoved?.emit(['HwkAi']);
      expect((spectator.component as any).dirtyAnswerKeys.has('HwkAi')).toBe(
        false
      );
      expect(
        (spectator.component as any).pendingDeletedAnswerKeys.has('HwkAi')
      ).toBe(true);
      expect(
        (spectator.component as any).answerIdByKey['HwkAi']
      ).toBeUndefined();
    });

    it('should pass normalized answer values to the current step', () => {
      const instance = {
        answers: {} as Record<string, unknown>,
        model: {},
        form: new FormGroup({}),
        fields: [],
        isLastStep: false,
        stepComplete: { emit: jest.fn() },
      };

      spectator.component.componentContainer = {
        clear: jest.fn(),
        createComponent: jest.fn().mockReturnValue({ instance }),
      } as unknown as ViewContainerRef;

      spectator.component.project = mockProject;
      spectator.component.answers = {
        Us1: {
          value: 'us1Ans-2',
          xmlKey: '/',
          stringValue: null,
          type: 'multi-single',
          componentId: 'Us1',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };
      spectator.component.getCatalogue();
      spectator.component.currentStepIndex = 0;

      spectator.component.renderCurrentComponent();

      expect(instance.answers['Us1']).toBe('us1Ans-2');
      expect(instance.answers['__catalogueId']).toBe('eun');
    });
  });

  describe('loadProject', () => {
    it('should load project by id', async () => {
      await spectator.component.loadProject(1);

      expect(spectator.component.project).toEqual(mockProject);
    });
  });

  describe('onStepComplete', () => {
    it('should merge step answers with existing answers', async () => {
      spectator.component.answers = {
        existingKey: {
          value: 'existing',
          xmlKey: '/existing',
          stringValue: null,
          type: 'text',
          componentId: 'Test',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      const stepAnswers: AnswerObject = {
        newKey: {
          value: 'new',
          xmlKey: '/new',
          stringValue: null,
          type: 'text',
          componentId: 'Test2',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      jest.spyOn(spectator.component, 'nextStep').mockImplementation();

      await spectator.component.onStepComplete(stepAnswers);

      expect(spectator.component.answers['existingKey']).toBeDefined();
      expect(spectator.component.answers['newKey']).toBeDefined();
    });

    it('should call nextStep after merging answers', async () => {
      const nextStepSpy = jest
        .spyOn(spectator.component, 'nextStep')
        .mockImplementation();

      await spectator.component.onStepComplete({});

      expect(nextStepSpy).toHaveBeenCalled();
    });
  });

  describe('submitCurrentStep', () => {
    it('keeps the next button enabled when the current form is invalid', () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      const form = new FormGroup({
        requiredField: new FormControl('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
      });

      Object.defineProperty(spectator.component, 'currentComponentRef', {
        value: {
          instance: {
            form,
          },
        },
        configurable: true,
      });

      spectator.detectChanges();

      expect(
        spectator.query(byTestId('questionnaire-next'))
      ).not.toBeDisabled();
    });

    it('should mark the current form as touched and not emit when invalid', () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      const apService = spectator.inject(ApplicationPageService);
      const buildAnswerSpy = jest.spyOn(apService, 'buildAnswerObject');

      const form = new FormGroup({
        requiredField: new FormControl('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
      });
      jest.spyOn(form, 'markAllAsTouched');

      const stepCompleteEmit = jest.fn();
      (spectator.component as any).currentComponentRef = {
        instance: {
          form,
          model: {},
          fields: [],
          stepComplete: { emit: stepCompleteEmit },
        },
      };

      spectator.component.submitCurrentStep();

      expect(form.markAllAsTouched).toHaveBeenCalled();
      expect(buildAnswerSpy).not.toHaveBeenCalled();
      expect(stepCompleteEmit).not.toHaveBeenCalled();
    });

    it('should build answers and emit when valid', () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      const apService = spectator.inject(ApplicationPageService);
      const buildAnswerSpy = jest.spyOn(apService, 'buildAnswerObject');

      const form = new FormGroup({
        requiredField: new FormControl('ok', {
          nonNullable: true,
          validators: [Validators.required],
        }),
      });

      const stepCompleteEmit = jest.fn();
      (spectator.component as any).currentComponentRef = {
        instance: {
          form,
          model: {},
          fields: [],
          stepComplete: { emit: stepCompleteEmit },
        },
      };

      spectator.component.submitCurrentStep();

      expect(buildAnswerSpy).toHaveBeenCalled();
      expect(stepCompleteEmit).toHaveBeenCalled();
    });

    it('should not submit while the step is busy with KI evaluation', () => {
      const form = new FormGroup({
        requiredField: new FormControl('ok', {
          nonNullable: true,
          validators: [Validators.required],
        }),
      });

      const stepCompleteEmit = jest.fn();
      (spectator.component as any).currentComponentRef = {
        instance: {
          form,
          model: {},
          fields: [],
          aiLoading: true,
          stepComplete: { emit: stepCompleteEmit },
        },
      };

      // the presenter reports the step as busy and refuses to advance
      expect(spectator.component.isCurrentStepBusy()).toBe(true);

      spectator.component.submitCurrentStep();

      expect(stepCompleteEmit).not.toHaveBeenCalled();
    });
  });

  describe('nextStep', () => {
    it('should move to next allowed step', async () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      jest
        .spyOn(spectator.component.steps[1].component, 'isAllowed')
        .mockReturnValue(true);

      jest
        .spyOn(spectator.component, 'savePosition')
        .mockImplementation(async () => Promise.resolve());
      jest
        .spyOn(spectator.component, 'saveAnswers')
        .mockImplementation(async () => Promise.resolve());
      jest
        .spyOn(spectator.component, 'renderCurrentComponent')
        .mockImplementation();

      await spectator.component.nextStep();

      expect(spectator.component.currentStepIndex).toBe(1);
    });

    it('should skip steps that are not allowed', async () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      // Mock second step to be not allowed
      jest
        .spyOn(spectator.component.steps[1].component, 'isAllowed')
        .mockReturnValue(false);

      jest
        .spyOn(spectator.component, 'savePosition')
        .mockImplementation(async () => Promise.resolve());
      jest
        .spyOn(spectator.component, 'saveAnswers')
        .mockImplementation(async () => Promise.resolve());
      jest
        .spyOn(spectator.component, 'renderCurrentComponent')
        .mockImplementation();

      await spectator.component.nextStep();

      expect(spectator.component.currentStepIndex).toBeGreaterThan(1);
    });
  });

  describe('previousStep', () => {
    it('should move to previous allowed step', async () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 2;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      // Mock all steps to be allowed
      for (const step of spectator.component.steps) {
        jest.spyOn(step.component, 'isAllowed').mockReturnValue(true);
      }

      jest
        .spyOn(spectator.component, 'savePosition')
        .mockImplementation(async () => Promise.resolve());
      jest
        .spyOn(spectator.component, 'renderCurrentComponent')
        .mockImplementation();

      await spectator.component.previousStep();

      expect(spectator.component.currentStepIndex).toBe(1);
    });

    it('should skip steps that are not allowed', async () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 2;
      spectator.component.answers = {};
      spectator.component.getCatalogue();

      // Mock steps: step 0 allowed, step 1 not allowed
      jest
        .spyOn(spectator.component.steps[0].component, 'isAllowed')
        .mockReturnValue(true);
      jest
        .spyOn(spectator.component.steps[1].component, 'isAllowed')
        .mockReturnValue(false);

      jest
        .spyOn(spectator.component, 'savePosition')
        .mockImplementation(async () => Promise.resolve());
      jest
        .spyOn(spectator.component, 'renderCurrentComponent')
        .mockImplementation();

      await spectator.component.previousStep();

      expect(spectator.component.currentStepIndex).toBe(0);
    });
  });

  describe('getValidAnswers', () => {
    it('should return only answers from allowed components', () => {
      spectator.component.getCatalogue();
      spectator.component.answers = {
        Us1: {
          value: 'us1Ans-2',
          xmlKey: '/',
          stringValue: null,
          type: 'multi-single',
          componentId: 'Us1',
          questionText: '',
          answerText: '',
          headerText: null,
        },
        st25: {
          value: 'test description',
          xmlKey: '/st25',
          stringValue: null,
          type: 'text',
          componentId: 'St25',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      // Mock all steps to be allowed
      for (const step of spectator.component.steps) {
        jest.spyOn(step.component, 'isAllowed').mockReturnValue(true);
      }

      const validAnswers = spectator.component.getValidAnswers();

      expect(validAnswers['Us1']).toBeDefined();
      expect(validAnswers['st25']).toBeDefined();
    });

    it('should exclude answers from non-allowed components', () => {
      spectator.component.getCatalogue();
      spectator.component.answers = {
        Us1: {
          value: 'us1Ans-2',
          xmlKey: '/',
          stringValue: null,
          type: 'multi-single',
          componentId: 'Us1',
          questionText: '',
          answerText: '',
          headerText: null,
        },
        gw28: {
          value: 'test',
          xmlKey: '/gw28',
          stringValue: null,
          type: 'text',
          componentId: 'Gw28',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      // Mock first step allowed, rest not allowed
      for (let index = 0; index < spectator.component.steps.length; index++) {
        jest
          .spyOn(spectator.component.steps[index].component, 'isAllowed')
          .mockReturnValue(
            spectator.component.steps[index].component.componentId ===
              EunUs1Component.componentId
          );
      }

      const validAnswers = spectator.component.getValidAnswers();

      expect(validAnswers['Us1']).toBeDefined();
      expect(validAnswers['gw28']).toBeUndefined();
    });
  });

  describe('finishQuestionnaire', () => {
    it('should set finishedQuestionnaire to true', async () => {
      spectator.component.project = mockProject;
      (spectator.component as any).currentComponentRef = null;

      const apService = spectator.inject(ApplicationPageService);
      jest
        .spyOn(apService, 'updateProgress')
        .mockImplementation(async () => Promise.resolve());

      await spectator.component.finishQuestionnaire();

      expect(spectator.component.finishedQuestionnaire).toBe(true);
    });

    it('should update progress to 100', async () => {
      spectator.component.project = mockProject;
      (spectator.component as any).currentComponentRef = null;

      const apService = spectator.inject(ApplicationPageService);
      const updateProgressSpy = jest
        .spyOn(apService, 'updateProgress')
        .mockImplementation(async () => Promise.resolve());

      await spectator.component.finishQuestionnaire();

      expect(updateProgressSpy).toHaveBeenCalledWith(1, 100);
    });

    it('should save answers', async () => {
      spectator.component.project = mockProject;
      (spectator.component as any).currentComponentRef = null;

      const saveAnswersSpy = jest
        .spyOn(spectator.component, 'saveAnswers')
        .mockImplementation(async () => Promise.resolve());

      await spectator.component.finishQuestionnaire();

      expect(saveAnswersSpy).toHaveBeenCalled();
    });

    it('should create question tracking record', async () => {
      spectator.component.project = mockProject;
      (spectator.component as any).currentComponentRef = null;
      spectator.component.answers = {
        Us1: {
          value: 'us1Ans-2',
          xmlKey: '/',
          stringValue: null,
          type: 'multi-single',
          componentId: 'Us1',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      const createMutate = jest.fn(async () => 1);

      spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>(
        {
          QuestionTracking: {
            create: {
              mutate: createMutate,
            },
            deleteForProject: {
              mutate: async () => undefined,
            },
          },
        },
        spectator.inject(TrpcService).client
      );

      await spectator.component.finishQuestionnaire();

      expect(createMutate).toHaveBeenCalledWith({
        answeredQuestions: expect.any(Array),
        projectId: 1,
      });
    });

    it('should collect answers from current component before finishing', async () => {
      spectator.component.project = mockProject;
      spectator.component.currentStepIndex = 0;
      spectator.component.getCatalogue();
      const onSubmit = jest.fn(async () => Promise.resolve());

      const mockComponentInstance = {
        model: { Us1: 'us1Ans-2' },
        form: { valid: true } as any,
        fields: [{ key: 'Us1', type: 'multi-single' }],
        answers: {},
        stepComplete: { emit: jest.fn() },
        onSubmit,
      };

      (spectator.component as any).currentComponentRef = {
        instance: mockComponentInstance,
      } as any;

      await spectator.component.finishQuestionnaire();

      expect(onSubmit).toHaveBeenCalled();
    });
  });
});

describe('QuestionnairePresenterComponent Integration Tests', () => {
  let spectator: Spectator<QuestionnairePresenterComponent>;
  let ericXmlPostSpy: jest.Mock;

  // Mock window.scroll to prevent warnings in tests
  beforeAll(() => {
    window.scroll = jest.fn();
  });

  const mockProject: Project = {
    createdAt: new Date(),
    id: 100,
    name: 'Integration Test Project',
    progress: 0,
    catalogueId: 'eun',
    lastPosition: 0,
    userId: 'integration-test-user',
    stSent: false,
    gwSent: false,
  };

  const createComponent = createComponentFactory({
    component: QuestionnairePresenterComponent,
    mocks: [
      TrpcService,
      ApplicationPageService,
      KeycloakService,
      PctLoaderService,
    ],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: jest.fn((key: string) => {
                if (key === 'projectId') return '100';
                if (key === 'catalogueId') return 'eun';
                return null;
              }),
            },
            queryParamMap: {
              get: jest.fn(() => null),
            },
          },
        },
      },
    ],
    detectChanges: false,
  });

  beforeEach(() => {
    spectator = createComponent({
      detectChanges: false,
    });

    spectator.component.catalogueId = 'eun';

    // Override steps with mock components BEFORE initialization
    spectator.component.steps = [
      {
        key: 'st1',
        label: 'Business Type',
        component: MockBusinessTypeComponent as any,
      },
      {
        key: 'st2',
        label: 'Company Name',
        component: MockCompanyNameComponent as any,
      },
      {
        key: 'st3',
        label: 'Revenue Estimate',
        component: MockRevenueComponent as any,
      },
    ];

    // Mock getCatalogue to prevent overriding our mock steps
    jest.spyOn(spectator.component, 'getCatalogue').mockImplementation(() => {
      // Keep the catalogueId but don't override steps
      spectator.component.catalogueId = 'eun';
    });

    // Setup Eric xmlPost spy
    ericXmlPostSpy = jest.fn(
      async (_input: { projectId: number; catalogueId: string }) => ({
        msg: 'ERIC_OK',
        pdf: {
          type: 'Uint8Array',
          data: new Uint8Array([1, 2, 3, 4, 5]),
        },
        ericResponse: null,
      })
    );

    // Setup default mock TRPC client
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Project: {
        readFiltered: {
          query: async () => [mockProject],
        },
        update: {
          mutate: async () => undefined,
        },
        gewADisabled: {
          query: async () => false,
        },
      },
      Answers: {
        readFiltered: {
          query: async () => [],
        },
        upsertBatch: {
          mutate: async (input) => {
            console.log('Upserting batch:', input);
            const keyToIdMap: Record<string, number> = {};
            for (let index = 0; index < input.answers.length; index++) {
              keyToIdMap[input.answers[index].key] = index + 1;
            }
            return keyToIdMap;
          },
        },
      },
      QuestionTracking: {
        create: {
          mutate: async (input) => {
            console.log('Creating question tracking:', input);
            return 1;
          },
        },
        deleteForProject: {
          mutate: async () => undefined,
        },
      },
      Eric: {
        xmlPost: {
          query: ericXmlPostSpy,
        },
      },
      CMS: {
        getContactList: {
          query: async () => [],
        },
      },
      OzgInfo: {
        getConfig: {
          query: async () => ({
            enableAmtSelection: false,
            isOZGOverriden: false,
          }),
        },
        getUniqueAmts: {
          query: async () => [],
        },
      },
      Ext: {
        getFinanzaemter: {
          query: async () => [],
        },
      },
      HwkForm: {
        sendHwkMail: {
          mutate: async () => ({
            status: 'pending',
            attemptCount: 0,
            lastError: null,
            nextAttemptAt: null,
            sentAt: null,
          }),
        },
        getHwkMailStatus: {
          query: async () => ({
            status: 'pending',
            attemptCount: 0,
            lastError: null,
            nextAttemptAt: null,
            sentAt: null,
          }),
        },
      },
      UserDocuments: {
        listByCase: {
          query: async () => [],
        },
      },
    });

    const featureFlags = spectator.inject(FeatureFlagsService);
    jest.spyOn(featureFlags, 'isEnabled').mockReturnValue(true);
    const loader = spectator.inject(PctLoaderService);
    jest
      .spyOn(loader, 'doWhileLoading')
      .mockImplementation(async (_key, work) => await work());

    // Setup ApplicationPageService mock
    const apService = spectator.inject(ApplicationPageService);
    jest
      .spyOn(apService, 'updateProgress')
      .mockImplementation(async () => Promise.resolve());
    jest
      .spyOn(apService, 'isGewADisabled')
      .mockImplementation(async () => Promise.resolve(false));
    jest
      .spyOn(apService, 'getSentVars')
      .mockImplementation(async () =>
        Promise.resolve({ stSent: true, gwSent: false })
      );
    jest
      .spyOn(apService, 'buildAnswerObject')
      .mockImplementation((model, fields, componentId) => {
        const answers: AnswerObject = {};
        for (const field of fields) {
          const key = Array.isArray(field.key)
            ? String(field.key[0])
            : String(field.key);
          if (key && model[key] !== undefined) {
            const fieldValue = model[key];
            answers[key] = {
              value: fieldValue as string | number,
              xmlKey: (field.props && field.props['xmlKey']) || '/',
              stringValue: null,
              type: typeof field.type === 'string' ? field.type : 'text',
              componentId: componentId,
              questionText: '',
              answerText: '',
              headerText: null,
            };
          }
        }
        return answers;
      });
  });

  describe('Full Integration Flow - All Steps Shown', () => {
    it('should complete questionnaire flow and call Eric API with correct answer object', async () => {
      // Initialize component
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      // Verify initial state
      expect(spectator.component.project).toEqual(mockProject);
      expect(spectator.component.currentStepIndex).toBe(0);
      expect(spectator.component.finishedQuestionnaire).toBe(false);

      // Step 1: Answer Business Type question
      const step1Answer: AnswerObject = {
        st1: {
          value: 'retail',
          xmlKey: '/st1',
          stringValue: null,
          type: 'multi-single',
          componentId: 'BusinessType',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      await spectator.component.onStepComplete(step1Answer);
      await spectator.fixture.whenStable();

      // Verify step 1 completion
      expect(spectator.component.answers['st1']).toEqual(step1Answer['st1']);
      expect(spectator.component.currentStepIndex).toBe(1);

      // Step 2: Answer Company Name question
      const step2Answer: AnswerObject = {
        st2: {
          value: 'Test Company GmbH',
          xmlKey: '/st2',
          stringValue: null,
          type: 'string',
          componentId: 'CompanyName',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      await spectator.component.onStepComplete(step2Answer);
      await spectator.fixture.whenStable();

      // Verify step 2 completion
      expect(spectator.component.answers['st2']).toEqual(step2Answer['st2']);
      // After the second step, if we're on step index 1, the third step (index 2) should be next
      // But nextStep() needs to find an allowed step, and Revenue (index 2) is allowed for 'retail'
      expect(spectator.component.currentStepIndex).toBeGreaterThanOrEqual(1);

      // Check if we can proceed to st3 step (it should be allowed for retail)
      const canShowRevenue = MockRevenueComponent.isAllowed(
        spectator.component.answers
      );
      expect(canShowRevenue).toBe(true);

      // If currently at step 1, manually move to step 2 to simulate the next allowed step
      if (spectator.component.currentStepIndex === 1) {
        // nextStep increments to find the next allowed step
        // Since Revenue is allowed for 'retail', it should proceed to index 2
        await spectator.component.nextStep();
        await spectator.fixture.whenStable();
      }

      // Step 3: Answer Revenue question (shown because st1 is 'retail')
      const step3Answer: AnswerObject = {
        expectedRevenue: {
          value: '250000',
          xmlKey: '/expectedRevenue',
          stringValue: null,
          type: 'number-euro',
          componentId: 'Revenue',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      // Merge the answer manually since we may already be past this step
      spectator.component.answers = {
        ...spectator.component.answers,
        ...step3Answer,
      };

      // Verify all answers are collected
      expect(spectator.component.answers['expectedRevenue']).toEqual(
        step3Answer['expectedRevenue']
      );

      // Verify all answers are collected
      expect(Object.keys(spectator.component.answers)).toHaveLength(3);

      // Finish questionnaire
      await spectator.component.finishQuestionnaire();
      await spectator.fixture.whenStable();

      // Verify questionnaire finished
      expect(spectator.component.finishedQuestionnaire).toBe(true);
      expect(
        spectator.inject(ApplicationPageService).updateProgress
      ).toHaveBeenCalledWith(100, 100);

      // Send data to Eric
      await spectator.component.sendData(1111);
      await spectator.fixture.whenStable();

      // Verify Eric API was called with correct project ID
      expect(ericXmlPostSpy).toHaveBeenCalledWith({
        projectId: 100,
        catalogueId: 'eun',
        bufaNr: 1111,
      });
      expect(ericXmlPostSpy).toHaveBeenCalledTimes(1);

      // Verify PDF was received
      expect(spectator.component.ericPDF).toBeTruthy();
      expect(spectator.component.downloadDisabled).toBe(false);
      expect(spectator.component.stSent).toBe(true);
    });
  });

  describe('Full Integration Flow - Conditional Step Hidden', () => {
    it('should skip st3 step when st1 is service and call Eric API', async () => {
      // Initialize component
      spectator.detectChanges();
      await spectator.fixture.whenStable();

      // Step 1: Answer Business Type question with 'service' (st3 step will be hidden)
      const step1Answer: AnswerObject = {
        st1: {
          value: 'service',
          xmlKey: '/st1',
          stringValue: null,
          type: 'multi-single',
          componentId: 'BusinessType',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      await spectator.component.onStepComplete(step1Answer);
      await spectator.fixture.whenStable();

      expect(spectator.component.currentStepIndex).toBe(1);

      // Step 2: Answer Company Name question
      const step2Answer: AnswerObject = {
        st2: {
          value: 'Service Company Ltd',
          xmlKey: '/st2',
          stringValue: null,
          type: 'string',
          componentId: 'CompanyName',
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      await spectator.component.onStepComplete(step2Answer);
      await spectator.fixture.whenStable();

      // Revenue step should be skipped since st1 is 'service'
      // nextStep will try to find the next allowed step, and since Revenue is not allowed,
      // it will continue searching but not find any, so currentStepIndex may remain at 1
      // or be at 2 if nextStep incremented but found no more steps

      // The important thing is that st3 was not added to answers
      expect(Object.keys(spectator.component.answers)).toHaveLength(2);
      expect(spectator.component.answers['st1']).toBeDefined();
      expect(spectator.component.answers['st2']).toBeDefined();
      expect(spectator.component.answers['st3']).toBeUndefined();

      // Get valid answers (should exclude st3 since that step wasn't allowed)
      const validAnswers = spectator.component.getValidAnswers();
      expect(Object.keys(validAnswers)).toHaveLength(2);

      // Finish questionnaire
      await spectator.component.finishQuestionnaire();
      await spectator.fixture.whenStable();

      expect(spectator.component.finishedQuestionnaire).toBe(true);

      // Send data to Eric
      await spectator.component.sendData(1111);
      await spectator.fixture.whenStable();

      // Verify Eric API was called
      expect(ericXmlPostSpy).toHaveBeenCalledWith({
        projectId: 100,
        catalogueId: 'eun',
        bufaNr: 1111,
      });
      expect(spectator.component.ericPDF).toBeTruthy();
    });
  });
});
