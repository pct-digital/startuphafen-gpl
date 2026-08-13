import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
} from '@startuphafen/startuphafen-common';
import {
  buildHwkAnswerObject,
  getHwkAiSuggestedEntryTypeValue,
  HWK_AI_AUTOFILLED_NOTICE,
  HWK_ENTRY_TYPE_OPTIONS,
  HWK_ENTRY_TYPE_QUESTION_LABEL,
  HWK_REFERENCE_LINKS,
  isHwkFlowAllowed,
  parseStoredHwkAiResult,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../hwk-utils';

@Component({
  selector: 'sh-hwk-entry-type',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './hwk-entry-type.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class HwkEntryTypeComponent implements OnInit {
  static readonly componentId = 'HwkEntryType';

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, AnswerObject[string]['value']> = {};
  fields: FormlyFieldConfig[] = [];
  readonly aiAutofillNotice = HWK_AI_AUTOFILLED_NOTICE;
  readonly referenceLinks = HWK_REFERENCE_LINKS;

  static isAllowed(_answers: QuestionAnswerValues): boolean {
    return isHwkFlowAllowed(_answers);
  }

  get showAiAutofillNotice(): boolean {
    const storedResult = parseStoredHwkAiResult(this.model[HWK_AI_ANSWER_KEY]);
    if (!storedResult) {
      return false;
    }

    return (
      this.model['HwkEntryType'] ===
      getHwkAiSuggestedEntryTypeValue(storedResult)
    );
  }

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'HwkEntryType',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: HWK_ENTRY_TYPE_QUESTION_LABEL,
          required: true,
          tooltip: null,
          options: HWK_ENTRY_TYPE_OPTIONS,
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = buildHwkAnswerObject(
        this.model,
        this.fields,
        HwkEntryTypeComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
