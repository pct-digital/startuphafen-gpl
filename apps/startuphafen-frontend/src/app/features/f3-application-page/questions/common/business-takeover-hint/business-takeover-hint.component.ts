import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AnswerObject } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-business-takeover-hint',
  standalone: true,
  templateUrl: './business-takeover-hint.component.html',
})
export class BusinessTakeoverHintComponent {
  static readonly componentId = 'BusinessTakeoverHint';
  readonly businessTakeoverSearchUrl =
    'https://www.nexxt-change.org/DE/Verkaufsangebot/inhalt';

  @Input() answers: AnswerObject = {};
  @Input() isLastStep = false;
  @Input() projectId!: number;
  @Output() stepComplete = new EventEmitter<AnswerObject>();

  form = new FormGroup({});
  model: Record<string, unknown> = {};
  fields = [];

  static isAllowed(_answers: Record<string, unknown>): boolean {
    return true;
  }

  onSubmit() {
    this.stepComplete.emit({});
  }
}
