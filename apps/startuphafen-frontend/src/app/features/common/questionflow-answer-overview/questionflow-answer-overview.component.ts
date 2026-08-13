import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ShCardDirective,
  ShCardTitleDirective,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { QuestionnaireStep } from '../../f3-application-page/presenter/questionnaire-presenter/questionnaire-presenter.component';

@Component({
  selector: 'sh-questionflow-answer-overview',
  standalone: true,
  imports: [CommonModule, ShCardDirective, ShCardTitleDirective],
  templateUrl: './questionflow-answer-overview.component.html',
})
export class QuestionflowAnswerOverviewComponent {
  @Input() answers: AnswerObject = {};
  @Input() steps: QuestionnaireStep[] = [];
  @Input() stSent = false;
  @Input() gwSent = false;
  @Input() hwkSent = false;
  @Output() continue = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  formatAnswers() {
    const values = Object.values(this.answers).sort((a, b) => {
      const positionA = this.steps.findIndex(
        (step) => step.key === a.componentId.toLowerCase()
      );
      const positionB = this.steps.findIndex(
        (step) => step.key === b.componentId.toLowerCase()
      );
      return positionA - positionB;
    });

    const newValues = structuredClone(values).map((e) => ({
      ...e,
      hasHeader: e.headerText !== null,
      makeSpace: false,
    }));

    for (let i = newValues.length - 1; 0 < i; i--) {
      if (newValues[i].headerText === newValues[i - 1].headerText) {
        newValues[i].headerText = null;
      }
    }
    for (let i = 0; i < newValues.length - 1; i++) {
      if (!newValues[i + 1].hasHeader || newValues[i + 1].headerText !== null) {
        newValues[i].makeSpace = true;
      }
    }

    return newValues;
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const output = new Date(year, month - 1, day);
    return output.toLocaleDateString();
  }
}
