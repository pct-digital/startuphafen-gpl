import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import {
  buildHwkAnswerObject,
  isHwkFlowAllowed,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../hwk-utils';

@Component({
  selector: 'sh-hwk-prior-business',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './hwk-prior-business.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class HwkPriorBusinessComponent implements OnInit {
  static readonly componentId = 'HwkPriorBusiness';

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, AnswerObject[string]['value']> = {};
  fields: FormlyFieldConfig[] = [];

  static isAllowed(_answers: QuestionAnswerValues): boolean {
    return isHwkFlowAllowed(_answers);
  }

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'HwkPriorBusiness',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label:
            'Hattest Du in der Vergangenheit bereits ein Gewerbe angemeldet?',
          required: true,
          tooltip: null,
          options: [
            {
              value: 'hwkPrior-1',
              label: 'Ja',
              stringValue: 'true',
              xmlKey: '/',
            },
            {
              value: 'hwkPrior-2',
              label: 'Nein',
              stringValue: 'false',
              xmlKey: '/',
            },
          ],
        },
      },
      {
        key: 'HwkPriorBusinessDetails',
        type: 'textarea',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Wenn ja, was, wann, wo?',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: null,
          rows: 4,
          xmlKey: '/',
        },
        expressions: {
          hide: (field) => field.model.HwkPriorBusiness !== 'hwkPrior-1',
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = buildHwkAnswerObject(
        this.model,
        this.fields,
        HwkPriorBusinessComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
