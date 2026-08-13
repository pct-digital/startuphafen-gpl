import { formatDate } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import {
  AnswerObject,
  HwkDocumentCase,
} from '@startuphafen/startuphafen-common';
import { HwkDocumentUploadContainerComponent } from '../hwk-document-upload/hwk-document-upload-container.component';
import {
  buildHwkAnswerObject,
  isHwkFlowAllowed,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../hwk-utils';

@Component({
  selector: 'sh-hwk-qualification',
  standalone: true,
  imports: [
    FormlyModule,
    ReactiveFormsModule,
    HwkDocumentUploadContainerComponent,
  ],
  templateUrl: './hwk-qualification.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class HwkQualificationComponent implements OnInit {
  static readonly componentId = 'HwkQualification';
  private static readonly qualificationUploadRequiredHint =
    'Bitte lade Deinen Qualifikationsnachweis als PDF hoch, bevor Du fortfährst.';

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Input() isLastStep = false;
  @Input() projectId = -1;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  private hasResolvedQualificationDocuments = false;

  readonly qualificationUploadRequiredHint =
    HwkQualificationComponent.qualificationUploadRequiredHint;
  readonly qualificationDocumentUploadedControl = new FormControl<
    number | null
  >(null);
  form: FormGroup = new FormGroup({
    qualificationDocumentUploaded: this.qualificationDocumentUploadedControl,
  });
  model: Record<string, AnswerObject[string]['value']> = {};
  fields: FormlyFieldConfig[] = [];
  readonly qualificationDocumentCase: HwkDocumentCase =
    'hwk_qualification_proof';

  static isAllowed(_answers: QuestionAnswerValues): boolean {
    return (
      isHwkFlowAllowed(_answers) && _answers['HwkEntryType'] === 'hwkEntryAns-1'
    );
  }

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'HwkQualification_0',
        type: 'empty',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Berufliche Qualifikation',
        },
      },
      {
        key: 'HwkQualificationDate',
        type: 'date',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Prüfungsdatum',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
          maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
          xmlKey: '/',
        },
      },
      {
        key: 'HwkQualificationPlace',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Prüfungsort',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
          xmlKey: '/',
        },
      },
      {
        key: 'HwkQualificationTrade',
        type: 'string',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Handwerk bzw. Fachrichtung der Prüfung',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
          xmlKey: '/',
        },
      },
      {
        key: 'HwkQualificationTrainingPermit',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Darfst Du ausbilden?',
          required: true,
          tooltip: null,
          options: [
            {
              value: 'hwkQualTrain-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'hwkQualTrain-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey: '/',
            },
          ],
        },
      },
    ];
    this.syncQualificationDocumentValidation();
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = buildHwkAnswerObject(
        this.model,
        this.fields,
        HwkQualificationComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  shouldShowQualificationUpload(): boolean {
    const answersValue =
      this.model != null && Object.keys(this.model).length > 0
        ? this.model
        : toQuestionAnswerValues(this.answers);

    return answersValue['HwkEntryType'] === 'hwkEntryAns-1' && this.projectId > 0;
  }

  onQualificationDocumentsChanged(documentCount: number | null) {
    this.hasResolvedQualificationDocuments = true;
    this.qualificationDocumentUploadedControl.setValue(documentCount);
    this.syncQualificationDocumentValidation();
  }

  private syncQualificationDocumentValidation() {
    if (!this.shouldShowQualificationUpload()) {
      this.qualificationDocumentUploadedControl.setErrors(null);
      return;
    }

    if (!this.hasResolvedQualificationDocuments) {
      this.qualificationDocumentUploadedControl.setErrors({
        qualificationDocumentRequired: true,
        qualificationDocumentPending: true,
      });
      return;
    }

    const documentCount = this.qualificationDocumentUploadedControl.value;
    if (documentCount == null || documentCount <= 0) {
      this.qualificationDocumentUploadedControl.setErrors({
        qualificationDocumentRequired: true,
      });
      return;
    }

    this.qualificationDocumentUploadedControl.setErrors(null);
  }
}
