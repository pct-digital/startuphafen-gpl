import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  formatDateToGerman,
  PctLoaderService,
  PopupService,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import {
  CatalogueAnswer,
  CatalogueQuestion,
} from '@startuphafen/startuphafen-common';
import { XMLParser } from 'fast-xml-parser';
import { KeycloakService } from 'keycloak-angular';
import _ from 'lodash';
import { Subject, takeUntil } from 'rxjs';
import { QuestionCatalogueFormTemplateComponent } from '../../../common/question-catalogue-form-template/question-catalogue-form-template.component';
import { QuestionCatalogueHandler } from '../../../common/question-catalogue-handler';
import { QuestionflowTopTrackerComponent } from '../../../common/questionflow-top-tracker/questionflow-top-tracker.component';
import { SendApplicationComponent } from '../../../common/send-application/send-application.component';
import { ApplicationPageService } from '../../application-page.service';

@Component({
  selector: 'sh-question-catalogue-container',
  standalone: true,
  imports: [
    QuestionCatalogueFormTemplateComponent,
    QuestionflowTopTrackerComponent,
    SendApplicationComponent,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
  ],
  templateUrl: './question-catalogue-container.component.html',
  styles: ``,
})
export class QuestionCatalogueContainerComponent implements OnInit {
  questionCatalogue: QuestionCatalogueHandler | null = null;
  currentStep = 0;

  projectId = -1;
  projectName = '';
  roles: string[] = [];

  fromDBObject: any = {};
  patchOnNextRecord: Record<string, boolean> = {};

  @ViewChild(QuestionCatalogueFormTemplateComponent, { static: false })
  questionFormTemplate: QuestionCatalogueFormTemplateComponent | null = null;

  steErSent = false;
  gewASent = false;
  isGewADisabled = false;
  endReached = false;

  downloadDisabled = true;
  errorMessage: string[] | null = null;
  ericPDF: { type: 'Uint8Array'; data: Uint8Array } | null = null;

  newestVersion = true;
  constructor(
    private activatedRoute: ActivatedRoute,
    private keycloak: KeycloakService,
    private loadService: PctLoaderService,
    private apService: ApplicationPageService,
    private trpc: TrpcService,
    private popup: PopupService
  ) {
    // Initialize any necessary services or variables here
  }

  async loadDBAnswers() {
    if (this.questionCatalogue == null) return;
    const answers = await this.apService.getAnswers(this.projectId);

    const sanatizeValue = (type: string, value: string | number) => {
      return type === 'checkbox'
        ? value === 'true'
        : type.includes('number')
        ? Number(value)
        : value;
    };

    const obj = {};
    for (const ans of answers) {
      if (ans.type === 'multi-single') {
        _.merge(obj, {
          [ans.key]: {
            [`${ans.key}`]: ans.strapiAnswerId,
          },
        });
      } else if (ans.key.includes('add#_#')) {
        _.merge(obj, { [ans.key]: sanatizeValue(ans.type, ans.value) });
      } else {
        _.merge(obj, {
          [ans.key]: {
            [`${ans.key}#_#${ans.strapiAnswerId}`]: sanatizeValue(
              ans.type,
              ans.value
            ),
          },
        });
      }
    }
    return obj;
  }

  getRouteParams(param: string): string | null {
    const paramMap = this.activatedRoute.snapshot.paramMap;
    return paramMap.get(param) ?? null;
  }

  getRoles() {
    this.roles = this.keycloak.getUserRoles();
  }

  async ngOnInit() {
    await this.loadService.doWhileLoading(
      'question-catalogue-container',
      async () => {
        this.projectId = Number(this.getRouteParams('projectId') ?? -1);
        this.getRoles();

        const project = await this.apService.getProject(this.projectId);
        this.gewASent = project.gewASent;
        this.steErSent = project.steErSent;
        this.projectName = project?.name;

        this.questionCatalogue =
          await QuestionCatalogueHandler.createQuestionCatalogue(
            this.projectId,
            this.trpc
          );

        if (this.questionCatalogue.completeCatalogue != null) {
          this.newestVersion =
            await this.trpc.client.CMS.compareToNewest.mutate(
              this.questionCatalogue.completeCatalogue
            );
        }

        if (this.questionCatalogue.loadedPreviousAnswers) {
          this.currentStep = this.questionCatalogue.currentStep;
          this.questionFormTemplate?.updateCurrentStep(
            this.questionCatalogue.currentStep
          );
        }

        this.questionFormTemplate?.updateForm(
          this.questionCatalogue?.currentQuestion ?? null
        );

        this.fromDBObject = await this.loadDBAnswers();
        this.patchForm();

        if (project.progress === 100) {
          this.endReached = true;
          this.isGewADisabled = (await this.checkGewADisabled()) ?? false;
        }
      }
    );
  }

  async onNextClicked(formAnswers: Record<string, any>) {
    if (this.questionCatalogue == null) return;
    await this.loadService.doWhileLoading(
      'question-catalogue.next',
      async () => {
        const answerRec = this.apService.buildAnswerRec(
          formAnswers,
          this.questionCatalogue?.currentQuestion as CatalogueQuestion
        );

        await this.questionCatalogue?.next(answerRec);
        this.questionFormTemplate?.updateForm(
          this.questionCatalogue?.currentQuestion ?? null
        );
        this.currentStep++;

        await this.apService.updateProgress(
          this.projectId,
          (100 / (this.questionCatalogue?.catalogue.length ?? 1)) *
            ((this.questionCatalogue?.questionIndex ?? 0) + 1)
        );

        this.patchForm();
        await this.endReachedCheck(answerRec);
      }
    );
  }

  async onPreviousClicked() {
    await this.loadService.doWhileLoading(
      'question-catalogue.previous',
      async () => {
        if (this.currentStep > 0) {
          await this.questionCatalogue?.previous();
          this.currentStep--;
          this.questionFormTemplate?.updateForm(
            this.questionCatalogue?.currentQuestion ?? null
          );
          this.patchForm();
        }
      }
    );
  }

  async endReachedCheck(answerRec: CatalogueAnswer) {
    if (this.questionCatalogue == null) return;
    if (
      _.isEqual(
        this.questionCatalogue.currentQuestion,
        this.questionCatalogue.catalogue[
          this.questionCatalogue.catalogue.length - 1
        ]
      )
    ) {
      this.endReached = true;
      this.isGewADisabled = (await this.checkGewADisabled()) ?? false;

      await this.apService.updateProgress(this.projectId, 100);
      //save the last question to db before entering send-view
      await this.questionCatalogue.finalize(answerRec);
    }
  }

  patchForm() {
    if (this.fromDBObject && this.questionCatalogue?.currentQuestion) {
      if (
        !this.patchOnNextRecord[
          this.questionCatalogue.currentQuestion.questionId
        ]
      ) {
        this.questionFormTemplate?.patchForm({
          [this.questionCatalogue.currentQuestion.questionId]:
            this.fromDBObject[
              this.questionCatalogue.currentQuestion.questionId
            ],
        });
        this.patchOnNextRecord[
          this.questionCatalogue.currentQuestion.questionId
        ] = true;
      } else {
        return;
      }
    }
  }

  async sendData() {
    const res = await this.apService.callEricXML(this.questionCatalogue);
    if (res == null) return;

    if (res.msg.includes('ERIC_OK')) {
      this.downloadDisabled = false;
      await this.updateProjectSendingStatus('steErSent');
      this.ericPDF = res.pdf ?? null;
      this.openPopup(this.logoutNoticeTemplate);
    } else {
      this.errorMessage = [];
      const parser = new XMLParser();
      const parsedError = parser.parse(res.ericResponse?.returnBuffer ?? '');
      if (parsedError.EricBearbeiteVorgang.FehlerRegelpruefung.length) {
        for (const error of parsedError.EricBearbeiteVorgang
          .FehlerRegelpruefung) {
          this.errorMessage.push(error.Text);
        }
      } else {
        this.errorMessage.push(
          parsedError.EricBearbeiteVorgang.FehlerRegelpruefung.Text
        );
      }
    }
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

  async sendOZGData() {
    await this.apService.callOZG(this.questionCatalogue);
    await this.updateProjectSendingStatus('gewASent');
  }

  async updateProjectSendingStatus(varName: 'gewASent' | 'steErSent') {
    if (varName === 'gewASent') {
      this.gewASent = true;
    }
    if (varName === 'steErSent') {
      this.steErSent = true;
    }
    await this.apService.updateProjectSendStatus(this.projectId, varName);
  }

  async checkGewADisabled() {
    return await this.apService.isGewADisabled(this.projectId);
  }

  //region PopUp
  @ViewChild('DownloadNotice', { static: true })
  logoutNoticeTemplate?: TemplateRef<any>;
  private destroy$ = new Subject<void>();
  async close() {
    this.popup.closePopup();
  }
  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popup
        .open(popupTemplate)
        .pipe(takeUntil(this.destroy$))
        .subscribe((action) => {
          console.log('popupAction', action);
        });
    }
  }
  //endregion
}
