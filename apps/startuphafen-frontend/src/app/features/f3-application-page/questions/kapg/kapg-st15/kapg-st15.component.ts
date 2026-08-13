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

const MAX_SHORT_DESCRIPTION_LENGTH = 300;

@Component({
  selector: 'sh-kapg-st15',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './kapg-st15.component.html',
  styles: ``,
})
export class KapgSt15Component implements OnInit {
  private applicationService = inject(ApplicationPageService);
  static readonly componentId = 'St15';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields: FormlyFieldConfig[] = [];
  readonly aiAutofillNotice = HWK_AI_AUTOFILLED_NOTICE;

  //Overarching check that decides if this question gets skipped
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

    return this.model['St15'] === suggestedShortDescription;
  }

  ngOnInit() {
    //The answer object is created in the presenter from the entries in the DB
    this.model = toQuestionAnswerValues(this.answers);
    this.fields = [
      {
        key: 'St15',
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
        },
      },
    ];
  }

  onSubmit() {
    if (this.form.valid) {
      const answerObject = this.applicationService.buildAnswerObject(
        this.model,
        this.fields,
        KapgSt15Component.componentId
      );
      this.stepComplete.emit(answerObject);
    }
  }
}
