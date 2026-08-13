import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-profile-input',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="flex flex-col gap-1">
      @if (props.label) {
      <label [for]="id" class="block text-sm font-medium text-tertiary mb-1">
        {{ props.label }}
        @if (props.required) {
        <span class="text-red-500">*</span>
        }
      </label>
      }
      <div class="relative">
        <input
          class="w-full text-tertiary text-lg p-4 border rounded-2xl disabled:opacity-60"
          [class.border-red-500]="formControl.touched && formControl.invalid"
          style="background-color: rgba(var(--sh-color-primary-rgb), 0.09)"
          [type]="props['type'] || 'text'"
          [id]="id"
          [formControl]="formControl"
          [formlyAttributes]="field"
          [placeholder]="props.placeholder || ''"
          (blur)="trimWhitespace()"
        />
      </div>
      @if (!props['hideErrorMessage'] && formControl.touched &&
      formControl.errors) { @if (formControl.errors['required']) {
      <p class="text-red-500 text-sm mt-1">Dieses Feld ist erforderlich</p>
      } @else if (formControl.errors['pattern']) {
      <p class="text-red-500 text-sm mt-1">
        {{ field.validation?.messages?.['pattern'] || 'Ungültiges Format' }}
      </p>
      } }
    </div>
  `,
})
export class FormlyFieldProfileInputComponent extends FieldType<FieldTypeConfig> {
  trimWhitespace() {
    if (this.formControl.value && typeof this.formControl.value === 'string') {
      const trimmedValue = this.formControl.value.trim();
      if (trimmedValue !== this.formControl.value) {
        this.formControl.setValue(trimmedValue);
      }
    }
  }
}
