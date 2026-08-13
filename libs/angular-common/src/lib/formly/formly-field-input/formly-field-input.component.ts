import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-input',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="flex flex-col gap-1">
      <div class="relative">
        <input
          class="w-full h-14 text-tertiary text-md md:text-lg p-4 md:p-6 border rounded-2xl"
          [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
          [ngClass]="props['disabled'] ? 'cursor-not-allowed' : ''"
          style="background-color: rgba(var(--sh-color-primary-rgb), 0.09)"
          type="input"
          [name]="props['name']"
          [formControl]="formControl"
          [formlyAttributes]="field"
          [maxlength]="props['maxLength'] ?? null"
          (blur)="trimWhitespace()"
        />
        @if(props["maxLength"]){
        <div class="text-tertiary text-sm absolute right-3 md:right-4 bottom-0">
          {{ formControl.value == null ? 0 : formControl.value.length }}
          / {{ props['maxLength'] }}
        </div>
        }
      </div>
    </div>
    @if (formControl.touched && formControl.errors) { @if
    (formControl.errors['required']) {
    <div class="text-red-500 text-sm mt-1">Dieses Feld ist erforderlich</div>
    } @else { @for (errorKey of getErrorKeys(); track errorKey) {
    <div class="text-red-500 text-sm mt-1">
      {{ getErrorMessage(errorKey) }}
    </div>
    } } }
  `,
  styles: ``,
})
export class FormlyFieldInputComponent extends FieldType<FieldTypeConfig> {
  trimWhitespace() {
    if (this.formControl.value && typeof this.formControl.value === 'string') {
      const trimmedValue = this.formControl.value.trim();
      if (trimmedValue !== this.formControl.value) {
        this.formControl.setValue(trimmedValue);
      }
    }
  }

  getErrorKeys(): string[] {
    if (!this.formControl.errors) return [];
    return Object.keys(this.formControl.errors).filter(
      (key) => key !== 'required'
    );
  }

  getErrorMessage(errorKey: string): string | undefined {
    // Check if there's a custom message defined in field.validation.messages
    if (this.field.validation?.messages?.[errorKey]) {
      const message = this.field.validation.messages[errorKey];
      if (typeof message === 'function') {
        const result = message(this.formControl.errors?.[errorKey], this.field);
        return typeof result === 'string' ? result : undefined;
      }
      return typeof message === 'string' ? message : undefined;
    }

    // Check if there's a message defined directly in the validator
    if (this.field.validators?.[errorKey]?.message) {
      const message = this.field.validators[errorKey].message;
      if (typeof message === 'function') {
        const result = message(this.formControl.errors?.[errorKey], this.field);
        return typeof result === 'string' ? result : undefined;
      }
      return typeof message === 'string' ? message : undefined;
    }

    // Fallback to a generic error message
    return 'Ungültiger Wert';
  }
}
