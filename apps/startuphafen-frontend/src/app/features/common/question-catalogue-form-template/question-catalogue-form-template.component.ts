import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule, formatDate } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyWrapperHeading } from '@startuphafen/angular-common';
import {
  CatalogueQuestion,
  fieldsNotRequired,
  fieldsWithInputLimit,
} from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-question-catalogue-form-template',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  templateUrl: './question-catalogue-form-template.component.html',
  styleUrl: './form-template.scss',
  animations: [
    trigger('fadeSlide', [
      transition('* => right', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate(
          '150ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: 0.3 })
        ),
        animate(
          '300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ transform: 'translateX(-50%)', opacity: 0 })
        ),
      ]),
      transition('* => left', [
        style({ transform: 'translateX(0)', opacity: 1 }),
        animate(
          '150ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: 0.3 })
        ),
        animate(
          '300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ transform: 'translateX(50%)', opacity: 0 })
        ),
      ]),
      transition(
        'void => *',
        [
          style({ transform: 'translateX({{ startX }})', opacity: 0 }),
          animate(
            '150ms cubic-bezier(0.4, 0.0, 0.2, 1)',
            style({ opacity: 0.3 })
          ),
          animate(
            '350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
            style({ transform: 'translateX(0)', opacity: 1 })
          ),
        ],
        { params: { startX: '50%' } }
      ),
    ]),
  ],
})
export class QuestionCatalogueFormTemplateComponent {
  fields: FormlyFieldConfig[] = [];
  form: FormGroup;

  isAnimating = false;
  animationState = 'idle';
  currentCardKey = 0;

  @Input() question: CatalogueQuestion | null = null;
  @Input() currentStep = 0;
  @Input() projectTitle = '';

  @Output() previousClicked = new EventEmitter();
  @Output() nextClicked = new EventEmitter<{
    formData: Record<string, any>;
  }>();
  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({});
  }

  onAnimationDone(event: any) {
    if (event.toState !== 'idle') {
      this.animationState = 'idle';
    }
  }

  updateForm(question?: CatalogueQuestion | null) {
    this.form = this.fb.group({});
    this.fields = [];
    const labelList: string[] = [];
    if (question == null) return;

    const labelFn = () => {
      if (!labelList.includes(question.questionText)) {
        labelList.push(question.questionText);
        return question.questionText;
      }
      return '{[none]}';
    };

    //region formly field init
    this.fields.push({
      key: question.questionId,
      props: { label: question.questionText },
      fieldGroup:
        question.type !== 'multi-single'
          ? [
              ...question.answerOptions.map((answ) => {
                return {
                  key: question.questionId + '#_#' + answ.answerId.toString(),
                  wrappers: [FormlyWrapperHeading],
                  type: question.type,
                  ...(question.type === 'checkbox' && {
                    validators: { validation: ['requiredTrue'] },
                  }),
                  ...(question.type.includes('number') && {
                    defaultValue: 0,
                  }),
                  props: {
                    ...((question.type === 'string' ||
                      question.type === 'date' ||
                      question.type.includes('number')) && {
                      placeholder: answ.answerText,
                    }),
                    name: answ.answerText,
                    label: labelFn(),
                    required: fieldsNotRequired.includes(answ.answerText)
                      ? false
                      : true,
                    tooltip: question.tooltip,
                    ...(fieldsWithInputLimit.includes(question.questionId) && {
                      maxLength: 95,
                    }),
                    ...(question.type === 'date' && {
                      maxDate: formatDate(new Date(), 'yyyy-MM-dd', 'de'),
                    }),
                  },
                };
              }),
            ]
          : [
              {
                key: question.questionId,
                wrappers: [FormlyWrapperHeading],
                type: question.type,
                props: {
                  name: question.questionText,
                  required: true,
                  label: labelFn(),
                  tooltip: question.tooltip,
                  optionsLength: question.answerOptions.length ?? 0,
                  options: question.answerOptions.map((ans) => ({
                    label: ans.answerText,
                    value: ans.answerId,
                  })),
                },
              },
            ],
    });
    //endregion
  }

  onNextClicked() {
    if (this.isAnimating) return;
    this.form.markAllAsTouched();
    if (this.form.valid) {
      this.isAnimating = true;
      this.animationState = 'right';

      // Use requestAnimationFrame to ensure smooth animation timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.nextClicked.emit({ formData: this.form.value });
          this.currentCardKey++;
          this.animationState = 'idle';
          this.isAnimating = false;

          // Defer scroll to avoid interference with animation
          requestAnimationFrame(() => {
            try {
              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            } catch (e) {
              console.error('Scroll error:', e);
            }
          });
        }, 500); // Match the total animation duration
      });
    }
  }

  patchForm(objToPatch: any) {
    //in a delay because when patchValue gets Called the Form hasn't initialized fully yet
    setTimeout(() => {
      this.form.patchValue(objToPatch);
    }, 10);
  }

  updateCurrentStep(targetIndex: number) {
    this.currentStep = targetIndex;
  }

  onPreviousClicked() {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.animationState = 'left';

    // Use requestAnimationFrame to ensure smooth animation timing
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.previousClicked.emit();
        this.currentCardKey++;
        this.animationState = 'idle';
        this.isAnimating = false;

        // Defer scroll to avoid interference with animation
        requestAnimationFrame(() => {
          try {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          } catch (e) {
            console.error('Scroll error:', e);
          }
        });
      }, 500); // Match the total animation duration
    });
  }
}
