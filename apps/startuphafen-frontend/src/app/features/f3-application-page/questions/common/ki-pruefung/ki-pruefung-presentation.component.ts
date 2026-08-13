import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { AnswerObject } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-ki-pruefung-presentation',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  templateUrl: './ki-pruefung-presentation.component.html',
  styleUrls: ['./ki-pruefung-presentation.component.scss'],
})
export class KiPruefungPresentationComponent {
  @Input() form: FormGroup = new FormGroup({});
  @Input() formModel: Record<string, AnswerObject[string]['value']> = {};
  @Input() fields: FormlyFieldConfig[] = [];
  @Input() canRunHwkAi = false;
  @Input() hwkAiError: string | null = null;
  @Input() hwkAiNotice: string | null = null;
  @Input() hwkAiLoading = false;

  @Output() runHwkAi = new EventEmitter<void>();

  onRunHwkAi() {
    this.runHwkAi.emit();
  }
}
