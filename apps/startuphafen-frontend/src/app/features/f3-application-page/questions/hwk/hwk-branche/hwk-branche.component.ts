import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FeatureFlagsService,
  FormlyWrapperHeading,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { KiPruefungContainerComponent } from '../../common/ki-pruefung/ki-pruefung.component';
import {
  buildHwkAnswerObject,
  HWK_AI_AUTOFILLED_NOTICE,
  HWK_BRANCH_OPTIONS,
  HWK_BRANCH_QUESTION_LABEL,
  isHwkAiAutofilledValue,
  isHwkBrancheAllowed,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../hwk-utils';

@Component({
  selector: 'sh-hwk-branche',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, KiPruefungContainerComponent],
  templateUrl: './hwk-branche.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class HwkBrancheComponent implements OnInit {
  private featureFlagsService = inject(FeatureFlagsService);
  static readonly componentId = 'HwkBranche';

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Input() isLastStep = false;
  @Output() stepComplete = new EventEmitter<AnswerObject>();
  @Output() answersUpdated = new EventEmitter<AnswerObject>();
  @Output() answersRemoved = new EventEmitter<string[]>();

  form = new FormGroup({});
  model: Record<string, AnswerObject[string]['value']> = {};
  fields: FormlyFieldConfig[] = [];
  readonly aiAutofillNotice = HWK_AI_AUTOFILLED_NOTICE;
  // True while the embedded KI evaluation runs; locks the Branche selection
  // (template) and the "Weiter" button (read by the questionnaire presenter).
  aiLoading = false;

  static isAllowed(_answers: QuestionAnswerValues): boolean {
    return isHwkBrancheAllowed(_answers);
  }

  onAiLoadingChange(loading: boolean): void {
    this.aiLoading = loading;
  }

  get showHwkAiSection(): boolean {
    return this.featureFlagsService.isEnabled('hwk');
  }

  get showAiAutofillNotice(): boolean {
    // Only show the notice when the AI actually auto-filled this field — not
    // when the user manually picked a value that happens to match the AI
    // suggestion (otherwise the AI notice would appear despite a manual selection).
    return isHwkAiAutofilledValue(this.model, 'HwkBranche');
  }

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'HwkBranche',
        type: 'multi-single',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: HWK_BRANCH_QUESTION_LABEL,
          required: true,
          tooltip: 'Wähle eine für Dein Startup passende Kategorie aus.',
          options: [...HWK_BRANCH_OPTIONS],
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = buildHwkAnswerObject(
        this.model,
        this.fields,
        HwkBrancheComponent.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }

  onHwkAiAnswersUpdated(answers: AnswerObject): void {
    this.model = {
      ...this.model,
      ...toQuestionAnswerValues(answers),
    };
    this.answersUpdated.emit(answers);
  }

  onHwkAiAnswersRemoved(keys: string[]): void {
    const nextModel = { ...this.model };
    for (const key of keys) {
      delete nextModel[key];
    }
    this.model = nextModel;
    this.answersRemoved.emit(keys);
  }
}
