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
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import {
  AnswerObject,
  HWK_AI_ANSWER_KEY,
} from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';
import {
  getHwkAiSuggestedShortDescription,
  HWK_AI_AUTOFILLED_NOTICE,
  parseStoredHwkAiResult,
  toQuestionAnswerValues,
} from '../../hwk/hwk-utils';

const MAX_SHORT_DESCRIPTION_LENGTH = 200;

@Component({
  selector: 'sh-eun-st25',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './eun-st25.component.html',
  styles: ``,
})
export class EunSt25Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St25';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];
  readonly aiAutofillNotice = HWK_AI_AUTOFILLED_NOTICE;

  static isAllowed(_answers: Record<string, unknown>): boolean {
    return true;
  }

  get showAiAutofillNotice(): boolean {
    const storedResult = parseStoredHwkAiResult(this.model[HWK_AI_ANSWER_KEY]);
    if (!storedResult) {
      return false;
    }

    const suggestedShortDescription = getHwkAiSuggestedShortDescription(
      storedResult,
      MAX_SHORT_DESCRIPTION_LENGTH
    );
    if (!suggestedShortDescription) {
      return false;
    }

    return this.model['St25'] === suggestedShortDescription;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'St25',
        type: 'textarea',
        wrappers: [FormlyWrapperHeading],
        props: {
          label: 'Beschreibung Deiner neuen Tätigkeit',
          xmlKey: 'AllgAngaben/ArtTaet/GewerbeArt',
          required: true,
          placeholder: 'Hier eintragen',
          tooltip:
            'Bitte gib eine möglichst genaue Beschreibung an, was Du mit Deinem Startup machen willst.',
          rows: 4,
          maxLength: MAX_SHORT_DESCRIPTION_LENGTH,
        },
        validation: {
          messages: {
            maxlength: 'Bitte gib höchstens 200 Zeichen ein.',
          },
        },
      },
    ];
  }

  async onSubmit() {
    if (this.form.valid) {
      // Filter out hidden fields from the model
      const filteredModel = this.applicationService.filterHiddenFields(
        this.model,
        this.fields
      );

      const answerObject = this.applicationService.buildAnswerObject(
        filteredModel,
        this.fields,
        EunSt25Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
