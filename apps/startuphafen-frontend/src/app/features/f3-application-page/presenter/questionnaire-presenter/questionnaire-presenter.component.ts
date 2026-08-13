import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ComponentRef,
  inject,
  OnDestroy,
  OnInit,
  TemplateRef,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FormlyFieldConfig } from '@ngx-formly/core';
import {
  FeatureFlagsService,
  formatDateToGerman,
  NavService,
  PctLoaderService,
  PopupService,
  ShButtonDirective,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
  smoothScrollUnlessFirefox,
  TrpcService,
} from '@startuphafen/angular-common';
import { base64ToUint8Array } from '@startuphafen/base64';
import {
  AnswerObject,
  HwkMailStatus,
  Project,
} from '@startuphafen/startuphafen-common';
import { XMLParser } from 'fast-xml-parser';
import { KeycloakService } from 'keycloak-angular';
import { Subject, takeUntil } from 'rxjs';
import { OzgInfoService } from '../../../common/ozg-info/ozg-info.service';
import { QuestionflowAnswerOverviewComponent } from '../../../common/questionflow-answer-overview/questionflow-answer-overview.component';
import { QuestionflowTopTrackerComponent } from '../../../common/questionflow-top-tracker/questionflow-top-tracker.component';
import { SendApplicationComponent } from '../../../common/send-application/send-application.component';
import { SupportButtonContainerComponent } from '../../../common/support-button/support-button-container/support-button-container.component';
import { ApplicationPageService } from '../../application-page.service';
import { EunGw19Component } from '../../questions/eun/eun-gw19/eun-gw19.component';
import { EunGw28Component } from '../../questions/eun/eun-gw28/eun-gw28.component';
import { EunGw29Component } from '../../questions/eun/eun-gw29/eun-gw29.component';
import { EunSt11Component } from '../../questions/eun/eun-st11/eun-st11.component';
import { EunSt111Component } from '../../questions/eun/eun-st111/eun-st111.component';
import { EunSt119Component } from '../../questions/eun/eun-st119/eun-st119.component';
import { EunSt132Component } from '../../questions/eun/eun-st132/eun-st132.component';
import { EunSt134Component } from '../../questions/eun/eun-st134/eun-st134.component';
import { EunSt149Component } from '../../questions/eun/eun-st149/eun-st149.component';
import { EunSt150to152Component } from '../../questions/eun/eun-st150to152/eun-st150to152.component';
import { EunSt25Component } from '../../questions/eun/eun-st25/eun-st25.component';
import { EunSt542to544Component } from '../../questions/eun/eun-st542to544/eun-st542to544.component';
import { EunSt68to71bComponent } from '../../questions/eun/eun-st68to71b/eun-st68to71b.component';
import { EunSt79Component } from '../../questions/eun/eun-st79/eun-st79.component';
import { EunSt96Component } from '../../questions/eun/eun-st96/eun-st96.component';
import { EunUs1Component } from '../../questions/eun/eun-us1/eun-us1.component';
import { IdentificationUploadComponent } from '../../questions/common/identification-upload/identification-upload.component';
import { HwkBrancheComponent } from '../../questions/hwk/hwk-branche/hwk-branche.component';
import { HwkEntryTypeComponent } from '../../questions/hwk/hwk-entry-type/hwk-entry-type.component';
import { HwkPriorBusinessComponent } from '../../questions/hwk/hwk-prior-business/hwk-prior-business.component';
import { HwkQualificationComponent } from '../../questions/hwk/hwk-qualification/hwk-qualification.component';
import { HwkTradeComponent } from '../../questions/hwk/hwk-trade/hwk-trade.component';
import {
  isHwkFlowAllowed as isHwkFlowAllowedHelper,
  QuestionAnswerValues,
} from '../../questions/hwk/hwk-utils';
import { KapgSt12Component } from '../../questions/kapg/kapg-st12/kapg-st12.component';
import { KapgSt15Component } from '../../questions/kapg/kapg-st15/kapg-st15.component';
import { KapgSt172Component } from '../../questions/kapg/kapg-st172/kapg-st172.component';
import { KapgSt176Component } from '../../questions/kapg/kapg-st176/kapg-st176.component';
import { KapgSt183Component } from '../../questions/kapg/kapg-st183/kapg-st183.component';
import { KapgSt184Component } from '../../questions/kapg/kapg-st184/kapg-st184.component';
import { KapgSt185Component } from '../../questions/kapg/kapg-st185/kapg-st185.component';
import { KapgSt187Component } from '../../questions/kapg/kapg-st187/kapg-st187.component';
import { KapgSt190Component } from '../../questions/kapg/kapg-st190/kapg-st190.component';
import { KapgSt201Component } from '../../questions/kapg/kapg-st201/kapg-st201.component';
import { KapgSt225Component } from '../../questions/kapg/kapg-st225/kapg-st225.component';
import { KapgSt3Component } from '../../questions/kapg/kapg-st3/kapg-st3.component';
import { KapgSt66Component } from '../../questions/kapg/kapg-st66/kapg-st66.component';
import { KapgSt74Component } from '../../questions/kapg/kapg-st74/kapg-st74.component';
import { KapgSt77Component } from '../../questions/kapg/kapg-st77/kapg-st77.component';
import { KapgSt78Component } from '../../questions/kapg/kapg-st78/kapg-st78.component';
import { KapgSt81Component } from '../../questions/kapg/kapg-st81/kapg-st81.component';

interface QuestionComponentInstance {
  answers: QuestionAnswerValues;
  model: Record<string, AnswerObject[string]['value']>;
  form: FormGroup<object>;
  fields: FormlyFieldConfig[];
  isLastStep: boolean;
  projectId?: number;
  aiLoading?: boolean;

  catalogueId?: string;
  onSubmit: () => void | Promise<void>;
  stepComplete: {
    emit: (data: AnswerObject) => void;
  };
  answersUpdated?: {
    emit: (data: AnswerObject) => void;
  };
  answersRemoved?: {
    emit: (keys: string[]) => void;
  };
}

export interface QuestionComponentClass {
  new (...args: any[]): QuestionComponentInstance;
  isAllowed: (answers: QuestionAnswerValues) => boolean;
  componentId: string;
}

export interface QuestionnaireStep {
  key: string;
  label: string;
  component: QuestionComponentClass;
}

@Component({
  selector: 'sh-questionnaire-presenter',
  standalone: true,
  imports: [
    CommonModule,
    SendApplicationComponent,
    QuestionflowTopTrackerComponent,
    ShCardDirective,
    ShButtonDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
    SupportButtonContainerComponent,
    QuestionflowAnswerOverviewComponent,
  ],
  templateUrl: './questionnaire-presenter.component.html',
  styles: `
    .acrylic {
      background-color: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
    }
  `,
})
export class QuestionnairePresenterComponent implements OnInit, OnDestroy {
  @ViewChild('componentContainer', { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;
  featureFlags = inject(FeatureFlagsService);
  private router = inject(Router);
  private nav = inject(NavService);

  project: Project | null = null;
  currentStepIndex = 0;
  catalogueId = '';
  answers: AnswerObject = {};
  trackingId = -1;
  didError = false;
  private answerIdByKey: Record<string, number> = {};
  private dirtyAnswerKeys = new Set<string>();
  private pendingDeletedAnswerKeys = new Set<string>();

  //region OZG and Eric
  roles: string[] = [];
  finishedQuestionnaire = false;
  lookedAtOverview = false;
  downloadDisabled = true;
  errorMessageERiC: string[] | null = null;
  stSent = false;
  gwSent = false;
  ericPDF: { type: 'Uint8Array'; data: Uint8Array } | null = null;
  errorMessageOZG: string[] | null = null;
  ozgBlob: Blob | null = null;
  ozgDownloadDisabled = true;
  ozgSendInFlight = false;
  isGewADisabled = false;
  uniqueAmts: {
    amt: string;
    amtCode: string;
    domain: string | null;
    oeid?: string;
  }[] = [];
  selectedAmtDomain: string | null = null;
  enableAmtSelection = false;
  isOZGOverriden = false;
  //endregion

  //region HWK PDF
  hwkPdfLoading = false;
  hwkMailStatus: HwkMailStatus | null = null;
  hwkSendInFlight = false;
  private hwkMailStatusTimer?: ReturnType<typeof setInterval>;
  readonly meistergruendungspraemieUrl =
    'https://www.ib-sh.de/produkt/meistergruendungspraemie-schleswig-holstein/';
  //endregion

  private currentComponentRef: ComponentRef<QuestionComponentInstance> | null =
    null;

  steps: QuestionnaireStep[] = [];

  private buildCatalogues(): Record<string, QuestionnaireStep[]> {
    const hasHwkFeature = this.isHwkFeatureEnabled();

    const hwkSteps = hasHwkFeature
      ? [
          {
            key: 'hwk-entry-type',
            label: 'Handwerkskammer Eintrag',
            component: HwkEntryTypeComponent,
          },
          {
            key: 'hwk-trade',
            label: 'Handwerk/Gewerbe',
            component: HwkTradeComponent,
          },
          {
            key: 'hwk-qualification',
            label: 'Berufliche Qualifikation',
            component: HwkQualificationComponent,
          },
          {
            key: 'hwk-prior-business',
            label: 'Vorheriges Gewerbe',
            component: HwkPriorBusinessComponent,
          },
        ]
      : [];

    const hwkKapgSteps = hasHwkFeature ? [...hwkSteps] : [];

    return {
      eun: [
        {
          key: 'us1',
          label: 'Branche',
          component: EunUs1Component,
        },
        {
          key: 'gw29',
          label: 'Handwerkererlaubnis',
          component: EunGw29Component,
        },
        {
          key: 'st25',
          label: 'Beschreibung Deiner neuen Tätigkeit',
          component: EunSt25Component,
        },
        ...hwkSteps,
        {
          key: 'gw28',
          label: 'Erlaubnispflicht',
          component: EunGw28Component,
        },
        {
          key: 'gw19',
          label: 'Nebentätigkeit',
          component: EunGw19Component,
        },
        {
          key: 'st79',
          label: 'Vorbereitungsdatum',
          component: EunSt79Component,
        },
        {
          key: 'st96',
          label: 'Tätigkeitsbeginn',
          component: EunSt96Component,
        },
        {
          key: 'st68-71b',
          label: 'Anschrift',
          component: EunSt68to71bComponent,
        },
        {
          key: 'st119',
          label: 'Gewinnermittlung',
          component: EunSt119Component,
        },
        {
          key: 'st111',
          label: 'Gewinnschätzung',
          component: EunSt111Component,
        },
        {
          key: 'st132',
          label: 'Umsatzschätzung',
          component: EunSt132Component,
        },
        {
          key: 'st134',
          label: 'Optional: Kleinunternehmer',
          component: EunSt134Component,
        },
        {
          key: 'st149',
          label: 'Umsatzsteuerberechnung',
          component: EunSt149Component,
        },
        {
          key: 'st150-152',
          label: 'Istbesteuerung Begründung',
          component: EunSt150to152Component,
        },
        {
          key: 'st542-544',
          label: 'Angaben Erstattungsanspruch',
          component: EunSt542to544Component,
        },
        {
          key: 'st11',
          label: 'Religionszugehörigkeit',
          component: EunSt11Component,
        },
      ],
      kapg: [
        // ### Reusing EUN COMP
        {
          key: 'hwk-branche',
          label: 'Branche',
          component: HwkBrancheComponent,
        },
        {
          key: 'gw29',
          label: 'Handwerkererlaubnis',
          component: EunGw29Component,
        },
        {
          key: 'gw19',
          label: 'Nebentätigkeit',
          component: EunGw19Component,
        },
        // ###
        ...hwkKapgSteps,
        {
          key: 'gw28',
          label: 'Erlaubnispflicht',
          component: EunGw28Component,
        },
        {
          key: 'st15',
          label: 'Beschreibung Deiner neuen Tätigkeit',
          component: KapgSt15Component,
        },
        {
          key: 'st3',
          label: 'Geschäftsadresse',
          component: KapgSt3Component,
        },
        {
          key: 'st12',
          label: 'Kommunikationsangaben des Unternehmens',
          component: KapgSt12Component,
        },
        {
          key: 'st74',
          label: 'Gesellschaftsform',
          component: KapgSt74Component,
        },
        {
          key: 'st66',
          label: 'Kapitalangaben',
          component: KapgSt78Component,
        },
        {
          key: 'st81',
          label: 'Anteilseigner',
          component: KapgSt81Component,
        },
        {
          key: 'identification-upload',
          label: 'Ausweise',
          component: IdentificationUploadComponent,
        },
        {
          key: 'st66',
          label: 'Informationen zur notariellen Gründung',
          component: KapgSt66Component,
        },
        {
          key: 'st77',
          label: 'Beginn der Tätigkeit',
          component: KapgSt77Component,
        },
        {
          key: 'st172',
          label: 'Festsetzungsangaben',
          component: KapgSt172Component,
        },
        { key: 'st176', label: 'Lohnsteuer', component: KapgSt176Component },
        {
          key: 'st183',
          label: 'Geschätzter Umsatz',
          component: KapgSt183Component,
        },
        {
          key: 'st185',
          label: 'Kleinunternehmerregelung',
          component: KapgSt185Component,
        },
        {
          key: 'st187',
          label: 'Steuerbefreiungen und Steuersätze',
          component: KapgSt187Component,
        },
        {
          key: 'st190',
          label: 'Versteuerungsart',
          component: KapgSt190Component,
        },
        {
          key: 'st184',
          label: 'Zahllast',
          component: KapgSt184Component,
        },
        {
          key: 'st201',
          label: 'Steuerschuldnerschaft beim Bau',
          component: KapgSt201Component,
        },
        {
          key: 'st225',
          label: 'Steuerabzug bei Bauleistungen',
          component: KapgSt225Component,
        },
      ],
    };
  }

  constructor(
    private trpc: TrpcService,
    private route: ActivatedRoute,
    private apService: ApplicationPageService,
    private popup: PopupService,
    private keycloak: KeycloakService,
    private loaderService: PctLoaderService,
    private ozgInfoService: OzgInfoService,
    private cdr: ChangeDetectorRef
  ) {}

  getRoles() {
    const userRoles = this.keycloak.getUserRoles();
    this.roles = Array.isArray(userRoles) ? userRoles : [];
  }

  getCatalogue() {
    this.catalogueId =
      this.route.snapshot.paramMap.get('catalogueId') ?? 'none';

    const catalogues = this.buildCatalogues();
    if (
      this.catalogueId == null ||
      this.catalogueId === 'none' ||
      !catalogues[this.catalogueId]
    ) {
      this.didError = true;
      const error = new Error('Catalogue Id not present or invalid!');
      console.error(error);
      throw error;
    }
    //set steps as the indicated catalogue from the url
    this.steps = catalogues[this.catalogueId];
  }

  async ngOnInit() {
    this.getCatalogue();

    const projectId = Number(this.route.snapshot.paramMap.get('projectId'));
    if (projectId) {
      await this.loadProject(projectId);
    }
    this.getRoles();
    await this.loadAnswers();
    // Load OZG config
    try {
      const ozgConfig = await this.ozgInfoService.getConfig();
      this.enableAmtSelection = ozgConfig.enableAmtSelection;
      this.isOZGOverriden = ozgConfig.isOZGOverriden;
    } catch (error) {
      this.enableAmtSelection = false;
      this.isOZGOverriden = false;
    }

    // Find the first allowed step
    await this.initializeFirstStep();

    if (this.project != null && this.project?.progress === 100) {
      this.finishedQuestionnaire = true;
      this.isGewADisabled = (await this.checkGewADisabled()) ?? false;
      // Load sent status from project
      this.stSent = this.project.stSent;
      this.gwSent = this.project.gwSent;
      await this.backfillOzgInfoForFinishedProject();
      // Load unique amts for returning users
      await this.loadUniqueAmts();

      if (
        this.route.snapshot.queryParamMap.get('lookedAtOverview') === 'true'
      ) {
        this.lookedAtOverview = true;
      }
    }

    this.renderCurrentComponent();
    await this.loadHwkMailStatus();
    if (this.shouldPollHwkMailStatus()) {
      this.startHwkMailStatusPolling();
    }
  }

  async initializeFirstStep() {
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      const error = new Error('Project is faulty: Project Id is null');
      console.error(error);
      throw error;
    }
    const answersValue = this.getAnswersValue();
    this.stSent = this.project?.stSent ?? false;
    this.gwSent = this.project?.gwSent ?? false;

    const prevTracking = await this.trpc.client.Project.readFiltered.query({
      id: projectID,
    });
    if (prevTracking[0].lastPosition === 0) {
      for (let i = 0; i < this.steps.length; i++) {
        if (this.steps[i].component.isAllowed(answersValue)) {
          this.currentStepIndex = i;
          return;
        }
      }
    } else {
      this.currentStepIndex = prevTracking[0].lastPosition;
    }
  }

  async saveAnswers() {
    if (
      this.dirtyAnswerKeys.size === 0 &&
      this.pendingDeletedAnswerKeys.size === 0
    ) {
      return;
    }

    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      throw new Error('Project is faulty: Project Id is null');
    }

    if (this.pendingDeletedAnswerKeys.size > 0) {
      const keysToDelete = Array.from(this.pendingDeletedAnswerKeys);

      await this.trpc.client.Answers.batchDelete.mutate({
        projectId: projectID,
        keys: keysToDelete,
      });

      for (const key of keysToDelete) {
        this.pendingDeletedAnswerKeys.delete(key);
        this.dirtyAnswerKeys.delete(key);
        delete this.answerIdByKey[key];
      }
    }

    const answersClean = this.answers;
    const answersToUpsert = [];

    for (const answerKey of this.dirtyAnswerKeys) {
      const answer = answersClean[answerKey];
      if (!answer) {
        continue;
      }

      const value = this.formatAnswerValue(answer.value);

      answersToUpsert.push({
        key: answerKey,
        projectId: projectID,
        stringValue: answer.stringValue?.toString() ?? null,
        componentId: answer.componentId,
        value: value,
        type: answer.type,
        xmlKey: answer.xmlKey,
        questionText: answer.questionText,
        answerText: answer.answerText,
        headerText: answer.headerText,
      });
    }

    if (answersToUpsert.length > 0) {
      const keyToIdMap = await this.trpc.client.Answers.upsertBatch.mutate({
        projectId: projectID,
        answers: answersToUpsert,
      });

      // Update answerIdByKey with the returned IDs
      Object.assign(this.answerIdByKey, keyToIdMap);
    }

    this.dirtyAnswerKeys.clear();
  }

  async handlePlzLookupIfNeeded(completedComponentId: string) {
    if (
      (this.catalogueId !== 'eun' || completedComponentId !== 'St68-71b') &&
      (this.catalogueId !== 'kapg' || completedComponentId !== 'St3')
    ) {
      return;
    }

    const projectId = this.project?.id;
    if (projectId == null) {
      return;
    }

    try {
      const plz = await this.resolveOzgPlzForProject();

      if (plz) {
        await this.ozgInfoService.saveForProject(projectId, plz);
      }
    } catch (error) {
      this.captureOzgInfoError(error);
    }
  }

  async loadUniqueAmts() {
    const projectId = this.project?.id;
    if (projectId == null) {
      return;
    }

    try {
      this.uniqueAmts = await this.ozgInfoService.getUniqueAmts(projectId);
      if (this.uniqueAmts.length === 1) {
        this.selectedAmtDomain = this.uniqueAmts[0].domain;
      } else if (this.uniqueAmts.length > 1) {
        this.selectedAmtDomain = null;
      } else {
        this.selectedAmtDomain = null;
      }
    } catch (error) {
      this.captureOzgInfoError(error);
      this.uniqueAmts = [];
      this.selectedAmtDomain = null;
    }
  }

  async onSelectedAmtDomainChange(event: Event) {
    await this.loaderService.doWhileLoading(
      'QuestionnairePresenterComponent:onSelectedAmtDomainChange',
      async () => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) {
          this.selectedAmtDomain = null;
          return;
        }

        const selectedValue = target.value.trim();
        this.selectedAmtDomain =
          selectedValue.length > 0 ? selectedValue : null;
      }
    );
  }

  private getAnswerStringValue(key: string): string | null {
    const value = this.answers[key]?.value;
    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private async resolveOzgPlzForProject(): Promise<string | null> {
    if (this.catalogueId === 'kapg') return this.getAnswerStringValue('St6a');

    const st68Answer = this.getAnswerStringValue('St68');
    if (st68Answer === 'st68Ans-2') {
      return this.getAnswerStringValue('St71a');
    }

    if (st68Answer !== 'st68Ans-1') {
      return null;
    }

    const user = await this.trpc.client.User.getUser.query();
    if (user == null || typeof user.postalCode !== 'string') {
      return null;
    }

    const trimmedPostalCode = user.postalCode.trim();
    return trimmedPostalCode.length > 0 ? trimmedPostalCode : null;
  }

  private async backfillOzgInfoForFinishedProject() {
    if (!this.enableAmtSelection || this.catalogueId !== 'eun') {
      return;
    }

    const projectId = this.project?.id;
    if (projectId == null) {
      return;
    }

    try {
      const existingUniqueAmts = await this.ozgInfoService.getUniqueAmts(
        projectId
      );
      if (existingUniqueAmts.length > 0) {
        return;
      }

      const plz = await this.resolveOzgPlzForProject();
      if (plz == null) {
        return;
      }

      await this.ozgInfoService.saveForProject(projectId, plz);
    } catch (error) {
      this.captureOzgInfoError(error);
    }
  }

  private captureOzgInfoError(error: unknown) {
    console.error(error);
  }

  async savePosition() {
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      const error = new Error('Project is faulty: Project Id is null');
      console.error(error);
      throw error;
    }
    await this.trpc.client.Project.update.mutate({
      id: projectID,
      updates: {
        lastPosition: this.currentStepIndex,
      },
    });
  }

  async loadAnswers() {
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      const error = new Error('Project is faulty: Project Id is null');
      console.error(error);
      throw error;
    }
    const answersFromDB = await this.trpc.client.Answers.readFiltered.query({
      projectId: projectID,
    });
    const loadedAnswersRecord: AnswerObject = {};

    for (const ans of answersFromDB) {
      loadedAnswersRecord[ans.key] = {
        value: ans.value,
        xmlKey: ans.xmlKey,
        type: ans.type,
        componentId: ans.componentId,
        stringValue: ans.stringValue,
        questionText: ans.questionText,
        answerText: ans.answerText,
        headerText: ans.headerText,
      };
      this.answerIdByKey[ans.key] = ans.id;
    }

    this.answers = { ...this.answers, ...loadedAnswersRecord };
  }

  renderCurrentComponent() {
    if (this.finishedQuestionnaire) {
      return;
    }
    if (!this.componentContainer) {
      return;
    }

    const answersValue = this.getAnswersValue();
    const currentStep = this.steps[this.currentStepIndex];

    if (!currentStep || !currentStep.component.isAllowed(answersValue)) {
      this.componentContainer.clear();
      return;
    }

    this.componentContainer.clear();

    this.currentComponentRef =
      this.componentContainer.createComponent<QuestionComponentInstance>(
        currentStep.component as Type<QuestionComponentInstance>
      );

    const instance = this.currentComponentRef.instance;
    instance.answers = answersValue;
    instance.isLastStep = this.isLastStep();
    instance.catalogueId = this.catalogueId;
    if (this.project?.id) {
      instance.projectId = this.project.id;
    }
    instance.stepComplete.emit = async (data: AnswerObject) =>
      await this.onStepComplete(data);
    if (instance.answersUpdated) {
      instance.answersUpdated.emit = (data: AnswerObject) => {
        this.applyAnswersUpdated(data);
      };
    }
    if (instance.answersRemoved) {
      instance.answersRemoved.emit = (keys: string[]) => {
        this.applyAnswersRemoved(keys);
      };
    }
    smoothScrollUnlessFirefox(0, -1);
  }

  async loadProject(projectId: number) {
    try {
      const projects = await this.trpc.client.Project.readFiltered.query({
        id: projectId,
      });
      if (projects.length > 0) {
        this.project = projects[0];
      }
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  }

  async onStepComplete(stepAnswers: AnswerObject) {
    this.answers = { ...this.answers, ...stepAnswers };
    this.markAnswersDirty(stepAnswers);
    await this.nextStep();
  }

  async nextStep() {
    const answersValue = this.getAnswersValue();
    const completedComponentId =
      this.steps[this.currentStepIndex]?.component.componentId;

    let nextIndex = this.currentStepIndex + 1;
    while (nextIndex < this.steps.length) {
      if (this.steps[nextIndex].component.isAllowed(answersValue)) {
        await this.savePosition();
        await this.saveAnswers();
        await this.handlePlzLookupIfNeeded(completedComponentId);
        this.currentStepIndex = nextIndex;
        this.renderCurrentComponent();
        return;
      }
      nextIndex++;
    }
  }

  async previousStep() {
    if (this.project) {
      if (this.currentStepIndex === 0 && this.catalogueId === 'kapg') {
        await this.router.navigateByUrl(
          this.nav.checkListPage(this.project.id)
        );
      }
    }

    const answersValue = this.getAnswersValue();

    let prevIndex = this.currentStepIndex - 1;
    while (prevIndex >= 0) {
      if (this.steps[prevIndex].component.isAllowed(answersValue)) {
        this.currentStepIndex = prevIndex;
        await this.savePosition();
        this.renderCurrentComponent();
        return;
      }
      prevIndex--;
    }
  }

  canGoBack(): boolean {
    const answersValue = this.getAnswersValue();

    for (let i = this.currentStepIndex - 1; i >= 0; i--) {
      if (this.steps[i].component.isAllowed(answersValue)) {
        return true;
      }
    }

    // KapG can always go back to checklist
    if (this.catalogueId === 'kapg') return true;

    return false;
  }

  // True while the current step's embedded KI evaluation is running — used to
  // lock the "Weiter" navigation until it finishes or fails.
  isCurrentStepBusy(): boolean {
    return this.currentComponentRef?.instance?.aiLoading === true;
  }

  submitCurrentStep(): void {
    if (!this.currentComponentRef?.instance) {
      return;
    }
    const instance = this.currentComponentRef.instance;

    if (instance.aiLoading) {
      return;
    }

    if (!instance.form?.valid) {
      instance.form?.markAllAsTouched?.();
      return;
    }

    if (typeof instance.onSubmit === 'function') {
      Promise.resolve()
        .then(() => instance.onSubmit())
        .catch((error: unknown) => {
          console.error('Failed to submit current step', error);
        });
      return;
    }

    const currentStep = this.steps[this.currentStepIndex];
    const answerObject = this.apService.buildAnswerObject(
      instance.model,
      instance.fields,
      currentStep.component.componentId
    );
    instance.stepComplete.emit(answerObject);
  }

  isLastStep(): boolean {
    const answersValue = this.getAnswersValue();

    for (let i = this.currentStepIndex + 1; i < this.steps.length; i++) {
      if (this.steps[i].component.isAllowed(answersValue)) {
        return false;
      }
    }

    return true;
  }

  getAnswersValue(): QuestionAnswerValues {
    return {
      __catalogueId: this.catalogueId,
      ...Object.fromEntries(
        Object.entries(this.answers).map(([key, val]) => [key, val.value])
      ),
    };
  }

  isHwkFlowAllowed(): boolean {
    return (
      this.isHwkFeatureEnabled() &&
      isHwkFlowAllowedHelper(this.getAnswersValue())
    );
  }

  isHwkFeatureEnabled(): boolean {
    return this.featureFlags.isEnabled('hwk');
  }

  getValidAnswers(): AnswerObject {
    const allAnswers = this.answers;
    const answersValue = this.getAnswersValue();
    const validAnswers: AnswerObject = {};

    // Get all allowed component IDs
    const allowedComponentIds = new Set<string>();
    for (const step of this.steps) {
      if (step.component.isAllowed(answersValue)) {
        allowedComponentIds.add(step.component.componentId);
      }
    }

    // Filter answers based on allowed components
    for (const [key, answer] of Object.entries(allAnswers)) {
      if (allowedComponentIds.has(answer.componentId)) {
        validAnswers[key] = answer;
      }
    }

    return validAnswers;
  }

  async finishQuestionnaire() {
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      const error = new Error('Project is faulty: Project Id is null');
      console.error(error);
      throw error;
    }

    // Validate the current step's form and collect answers via onSubmit
    if (this.currentComponentRef?.instance) {
      const instance = this.currentComponentRef.instance;

      if (!instance.form?.valid) {
        instance.form?.markAllAsTouched?.();
        return;
      }

      await instance.onSubmit();
    }

    this.finishedQuestionnaire = true;
    this.isGewADisabled = (await this.checkGewADisabled()) ?? false;

    await this.saveAnswers();

    // Load unique amts for OZG submission
    await this.loadUniqueAmts();

    const answeredQuestions = Object.keys(this.getValidAnswers());
    await this.trpc.client.QuestionTracking.deleteForProject.mutate(projectID);
    await this.trpc.client.QuestionTracking.create.mutate({
      answeredQuestions: answeredQuestions,
      projectId: projectID,
    });

    await this.apService.updateProgress(projectID, 100);
  }

  private markAnswersDirty(stepAnswers: AnswerObject) {
    for (const key of Object.keys(stepAnswers)) {
      this.dirtyAnswerKeys.add(key);
    }
  }

  private applyAnswersUpdated(answers: AnswerObject): void {
    this.answers = { ...this.answers, ...answers };
    this.markAnswersDirty(answers);

    for (const key of Object.keys(answers)) {
      this.pendingDeletedAnswerKeys.delete(key);
    }
  }

  private applyAnswersRemoved(keys: string[]): void {
    const nextAnswers = { ...this.answers };

    for (const key of keys) {
      delete nextAnswers[key];
      delete this.answerIdByKey[key];
      this.dirtyAnswerKeys.delete(key);
      this.pendingDeletedAnswerKeys.add(key);
    }

    this.answers = nextAnswers;
  }

  private formatAnswerValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }
    throw new Error(
      'Value of answer when trying to save was not a string, number or boolean!'
    );
  }

  async overviewBack() {
    if (this.project == null) return;
    const projectId = this.project.id;
    await this.loaderService.doWhileLoading(
      'QuestionnairePresenterComponent.overviewBack',
      async () => await this.apService.resetProjectState(projectId)
    );
    this.project = { ...this.project, progress: 1 };
    this.finishedQuestionnaire = false;
    this.lookedAtOverview = false;
    this.cdr.detectChanges();
    this.renderCurrentComponent();
  }

  //region Eric and OZG
  async sendData(bufaNr: number | null) {
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      const error = new Error('Project is faulty: Project Id is null');
      console.error(error);
      throw error;
    }

    if (bufaNr == null) return;

    const res = await this.trpc.client.Eric.xmlPost.query({
      projectId: projectID,
      catalogueId: this.catalogueId,
      bufaNr: bufaNr,
    });
    if (res == null) return;

    if (res.msg.includes('ERIC_OK')) {
      this.downloadDisabled = false;
      this.ericPDF = res.pdf ?? null;
      this.openPopup(this.downloadNotice);
      await this.updateSentVars();
    } else {
      this.errorMessageERiC = [];
      const parser = new XMLParser();
      const parsedError = parser.parse(res.ericResponse?.returnBuffer ?? '');
      if (parsedError.EricBearbeiteVorgang.FehlerRegelpruefung.length) {
        for (const error of parsedError.EricBearbeiteVorgang
          .FehlerRegelpruefung) {
          this.errorMessageERiC.push(error.Text);
        }
      } else {
        this.errorMessageERiC.push(
          parsedError.EricBearbeiteVorgang.FehlerRegelpruefung.Text
        );
      }
    }
  }

  async updateSentVars() {
    const res = await this.apService.getSentVars(this.project?.id ?? -1);
    this.stSent = res?.stSent ?? false;
    this.gwSent = res?.gwSent ?? false;
  }

  async downloadData() {
    if (this.ericPDF) {
      const bytes = new Uint8Array(this.ericPDF.data);
      const blob = new Blob([bytes], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      const fileName =
        'ERiC-Protokoll-' + formatDateToGerman(new Date()) + '.pdf';
      link.download = fileName;
      link.click();
    }
  }

  async downloadOZGDoc() {
    if (this.ozgBlob == null) return;
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(this.ozgBlob);
    const fileName =
      'Gewerbeamt-Protokoll-' + formatDateToGerman(new Date()) + '.pdf';
    link.download = fileName;
    link.click();
  }

  async sendOZGData() {
    const projectID = this.project?.id;
    const projectName = this.project?.name;

    if (projectID == null || projectName == null) {
      this.didError = true;
      throw new Error('Project is faulty: Project Id or name is null');
    }

    if (this.ozgSendInFlight) return;

    this.ozgSendInFlight = true;
    try {
      await this.loaderService.doWhileLoading(
        'QuestionnairePresenterComponent.sendOZGData',
        async () => {
          const res = await this.trpc.client.OZG.postOZGFormData.mutate({
            projectId: projectID,
            catalogueId: this.catalogueId,
            domain: this.selectedAmtDomain ?? undefined,
          });
          if (res == null) {
            this.errorMessageOZG = [];
            this.errorMessageOZG.push('ERROR: Response is empty');
            return;
          }

          if (res.errorMessage != null) {
            this.didError = true;
            this.errorMessageOZG = [];
            this.errorMessageOZG.push(res.errorMessage);
            return;
          }
          await this.updateSentVars();

          // Convert Base64 string back to Blob
          if (res.documentBlob) {
            const byteCharacters = atob(res.documentBlob);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            this.ozgBlob = new Blob([byteArray], { type: 'application/pdf' });
          }

          this.ozgDownloadDisabled = false;
        }
      );
    } finally {
      this.ozgSendInFlight = false;
    }
  }

  async checkGewADisabled() {
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      const error = new Error('Project is faulty: Project Id is null');
      console.error(error);
      throw error;
    }
    if (this.catalogueId === 'kapg') return false;
    return await this.apService.isGewADisabled(projectID);
  }

  //endregion

  //region HWK PDF

  private captureHwkException(error: unknown): void {
    console.error(error);
  }

  hasHwkAnswers(): boolean {
    const keys = [
      'HwkEntryType',
      'HwkTrade',
      'HwkQualificationDate',
      'HwkQualificationPlace',
      'HwkQualificationTrade',
      'HwkQualificationTrainingPermit',
      'HwkPriorBusiness',
      'HwkPriorBusinessDetails',
    ];
    return keys.some((key) => this.answers[key] != null);
  }

  allRequiredApplicationsSent(): boolean {
    // The steuerliche Erfassung (ERiC) is always required.
    if (!this.stSent) {
      return false;
    }
    // The Gewerbeanmeldung (OZG) is required unless it is disabled for this
    // flow (e.g. some Einzelunternehmen branches don't need one from the start).
    if (!this.isGewADisabled && !this.gwSent) {
      return false;
    }
    // The HWK application is only required when the HWK flow applies.
    if (
      this.isHwkFlowAllowed() &&
      this.hasHwkAnswers() &&
      this.hwkMailStatus?.status !== 'sent'
    ) {
      return false;
    }
    return true;
  }

  shouldShowMeistergruendungspraemieReminder(): boolean {
    if (!this.finishedQuestionnaire || !this.lookedAtOverview) {
      return false;
    }
    if (!this.isHwkFlowAllowed()) {
      return false;
    }
    return (
      this.answers['HwkEntryType']?.value === 'hwkEntryAns-1' &&
      this.answers['Gw19']?.value === 'gw19Ans-2'
    );
  }
  private async generateHwkPdfOnDemand(): Promise<{
    data: Uint8Array;
    filename: string;
    mimeType: 'application/pdf';
  } | null> {
    if (this.hwkPdfLoading) return null;
    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      throw new Error('Project is faulty: Project Id is null');
    }

    this.hwkPdfLoading = true;
    try {
      return await this.loaderService.doWhileLoading(
        'QuestionnairePresenterComponent.generateHwkPdfOnDemand',
        async () => await this.trpc.client.HwkForm.getFilledPdf.query(projectID)
      );
    } catch (error: unknown) {
      console.error('Failed to generate HWK PDF on demand', error);
      this.captureHwkException(error);
      return null;
    } finally {
      this.hwkPdfLoading = false;
    }
  }

  async downloadHwkPdf(): Promise<void> {
    const hwkPdf = await this.generateHwkPdfOnDemand();
    if (!hwkPdf) return;

    const buffer = this.getPdfBuffer(hwkPdf.data);
    const blob = new Blob([buffer], { type: hwkPdf.mimeType });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = hwkPdf.filename || 'HWK-Antrag.pdf';
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(link.href), 10_000);
  }
  //endregion

  //region HWK Mail
  private shouldHandleHwkMail(): boolean {
    return (
      this.finishedQuestionnaire &&
      this.isHwkFlowAllowed() &&
      this.hasHwkAnswers()
    );
  }

  private shouldPollHwkMailStatus(): boolean {
    if (!this.shouldHandleHwkMail()) return false;
    const status = this.hwkMailStatus?.status;
    return status === 'pending' || status === 'sending';
  }

  async sendHwkMailManual(): Promise<void> {
    if (!this.shouldHandleHwkMail()) return;
    if (this.hwkSendInFlight) return;
    if (this.hwkMailStatus?.status === 'sent') return;

    const projectID = this.project?.id;
    if (projectID == null) {
      this.didError = true;
      throw new Error('Project is faulty: Project Id is null');
    }

    this.hwkSendInFlight = true;

    try {
      await this.loaderService.doWhileLoading(
        'QuestionnairePresenterComponent.sendHwkMailManual',
        async () => {
          this.hwkMailStatus =
            await this.trpc.client.HwkForm.sendHwkMail.mutate(projectID);
        }
      );
      if (!this.hwkMailStatus) {
        return;
      }
    } catch (error) {
      console.error('Failed to send HWK mail', error);
      this.captureHwkException(error);
    } finally {
      this.hwkSendInFlight = false;
    }

    if (this.shouldPollHwkMailStatus()) {
      this.startHwkMailStatusPolling();
    }
  }

  private async loadHwkMailStatus(): Promise<void> {
    if (!this.shouldHandleHwkMail()) return;
    const projectID = this.project?.id;
    if (projectID == null) return;
    try {
      this.hwkMailStatus = await this.loaderService.doWhileLoading(
        'QuestionnairePresenterComponent.loadHwkMailStatus',
        async () =>
          await this.trpc.client.HwkForm.getHwkMailStatus.query(projectID)
      );
    } catch (error) {
      console.error('Failed to load HWK mail status', error);
      this.captureHwkException(error);
    }
  }

  private startHwkMailStatusPolling(): void {
    if (this.hwkMailStatusTimer) return;
    const projectID = this.project?.id;
    if (projectID == null) return;
    this.hwkMailStatusTimer = setInterval(async () => {
      await this.loadHwkMailStatus();
      if (this.hwkMailStatus?.status === 'sent') {
        this.stopHwkMailStatusPolling();
      }
    }, 30_000);
  }

  private stopHwkMailStatusPolling(): void {
    if (this.hwkMailStatusTimer) {
      clearInterval(this.hwkMailStatusTimer);
      this.hwkMailStatusTimer = undefined;
    }
  }

  getHwkErrorMessage(): string[] | null {
    const lastError = this.hwkMailStatus?.lastError;
    if (!lastError) {
      return null;
    }

    return [lastError];
  }
  //endregion

  async handleContinueToSending(): Promise<void> {
    this.lookedAtOverview = true;
  }

  //region PopUp
  @ViewChild('DownloadNotice', { static: true })
  downloadNotice?: TemplateRef<any>;

  private destroy$ = new Subject<void>();

  ngOnDestroy() {
    if (this.hwkMailStatusTimer) {
      clearInterval(this.hwkMailStatusTimer);
      this.hwkMailStatusTimer = undefined;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  async close() {
    this.popup.closePopup();
  }

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popup
        .open(popupTemplate)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }
  }
  //endregion

  private getPdfBuffer(
    data: Uint8Array | ArrayBuffer | number[] | { data?: number[] } | string
  ): ArrayBuffer {
    let bytes: Uint8Array;
    if (data instanceof Uint8Array) bytes = data;
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (Array.isArray(data)) bytes = new Uint8Array(data);
    else if (data && typeof data === 'object' && Array.isArray(data.data)) {
      bytes = new Uint8Array(data.data);
    } else if (typeof data === 'string') {
      bytes = base64ToUint8Array(data);
    } else {
      bytes = new Uint8Array();
    }

    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }
}
