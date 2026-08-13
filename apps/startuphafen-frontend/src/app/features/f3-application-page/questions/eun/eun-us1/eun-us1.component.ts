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
import { ApplicationPageService } from '../../../application-page.service';
import { KiPruefungContainerComponent } from '../../common/ki-pruefung/ki-pruefung.component';
import {
  HWK_AI_AUTOFILLED_NOTICE,
  HWK_BRANCH_OPTIONS,
  HWK_BRANCH_QUESTION_LABEL,
  isHwkAiAutofilledValue,
  QuestionAnswerValues,
  toQuestionAnswerValues,
} from '../../hwk/hwk-utils';

@Component({
  selector: 'sh-eun-us1',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, KiPruefungContainerComponent],
  templateUrl: './eun-us1.component.html',
  styles: ``,
})
export class EunUs1Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  private featureFlagsService = inject(FeatureFlagsService);
  static readonly componentId = 'Us1';

  @Input() answers: AnswerObject | QuestionAnswerValues = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
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
    return true;
  }

  onAiLoadingChange(loading: boolean): void {
    this.aiLoading = loading;
  }

  get showHwkAiSection(): boolean {
    return this.featureFlagsService.isEnabled('hwk');
  }

  get showAiAutofillNotice(): boolean {
    // Only show the notice when the KI actually auto-filled this field — not
    // when the user manually picked a value that matches the KI suggestion.
    return isHwkAiAutofilledValue(this.model, 'Us1');
  }

  ngOnInit() {
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'Us1',
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
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        EunUs1Component.componentId
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
