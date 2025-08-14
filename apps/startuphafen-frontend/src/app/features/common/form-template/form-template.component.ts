import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';

@Component({
  selector: 'sh-form-template',
  standalone: true,
  imports: [
    HlmButtonDirective,
    FormlyModule,
    ReactiveFormsModule,
    CommonModule,
  ],
  templateUrl: './form-template.component.html',
  styles: ``,
})
export class FormTemplateComponent {
  @Input() fields: FormlyFieldConfig[] = [];
  @Output() saveClicked = new EventEmitter();
  @Output() nextClicked = new EventEmitter();

  steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  currentStep = 2;

  form: FormGroup;
  model: any = {};

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({});
  }
}
