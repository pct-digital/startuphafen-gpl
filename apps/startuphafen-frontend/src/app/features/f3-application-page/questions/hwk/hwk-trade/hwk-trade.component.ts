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
  getHwkAiSuggestedTradeValue,
  HWK_AI_AUTOFILLED_NOTICE,
  HWK_REFERENCE_LINKS,
  HWK_TRADE_QUESTION_LABEL,
  isHwkFlowAllowed,
  parseStoredHwkAiResult,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../hwk-utils';

@Component({
  selector: 'sh-hwk-trade',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './hwk-trade.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class HwkTradeComponent implements OnInit {
  static readonly componentId = 'HwkTrade';

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

    const suggestedTradeValue = getHwkAiSuggestedTradeValue(storedResult);
    if (!suggestedTradeValue) {
      return false;
    }

    const currentTradeValue = this.model['HwkTrade'];
    return (
      typeof currentTradeValue === 'string' &&
      currentTradeValue.trim() === suggestedTradeValue
    );
  }

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);

    const storedResult = parseStoredHwkAiResult(this.model[HWK_AI_ANSWER_KEY]);
    const suggestedTradeValue = storedResult
      ? getHwkAiSuggestedTradeValue(storedResult)
      : null;
    if (suggestedTradeValue && !this.model['HwkTrade']) {
      this.model['HwkTrade'] = suggestedTradeValue;
    }

    this.fields = [
      {
        key: 'HwkTrade',
        type: 'textarea',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: HWK_TRADE_QUESTION_LABEL,
          required: true,
          placeholder: 'Hier eintragen',
          tooltip: 'Bitte nenne die Handwerke/Gewerbe möglichst konkret.',
          rows: 6,
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = buildHwkAnswerObject(
        this.model,
        this.fields,
        HwkTradeComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
