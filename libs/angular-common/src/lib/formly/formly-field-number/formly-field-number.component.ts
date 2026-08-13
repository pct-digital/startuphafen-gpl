import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-number',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="relative w-full transition-all duration-200">
      <div class="text-primary text-lg md:text-xl font-semibold">
        {{ props['name'] }}
      </div>
      <div class="w-full max-w-sm relative">
        <div class="relative">
          <input
            type="text"
            inputmode="numeric"
            class="w-full h-14 text-tertiary text-md md:text-lg p-4 sm:p-6 border rounded-2xl pl-8 sm:pl-10 pr-10 sm:pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none touch-manipulation"
            [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
            style="background-color: rgba(var(--sh-color-primary-rgb), 0.09); -moz-appearance: textfield;"
            [name]="props['name']"
            [formControl]="formControl"
            [formlyAttributes]="field"
          />
        </div>
        @if (formControl.touched && formControl.errors) { @if
        (formControl.errors['required']) {
        <div class="text-red-500 text-sm mt-1">
          Dieses Feld ist erforderlich
        </div>
        } @else { @for (errorKey of getErrorKeys(); track errorKey) {
        <div class="text-red-500 text-sm mt-1">
          {{ getErrorMessage(errorKey) }}
        </div>
        } } }
      </div>
    </div>
  `,
  styles: `
    .mask-icon {
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    }
  `,
})
export class FormlyFieldNumberComponent extends FieldType<FieldTypeConfig> {
  @HostListener('input', ['$event'])
  onInput(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    input.value = this.sanitizeValue(input.value);
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

  private sanitizeValue(rawValue: string): string {
    if (!rawValue) {
      return '';
    }

    let value = rawValue.replace(/\./g, ',');
    value = value.replace(/[^0-9-]/g, '');

    const inputNoDec = String(value);
    let inputSan = '';
    if (this.props['allowNegatives'] && inputNoDec[0] === '-') {
      inputSan = inputNoDec.slice(1, inputNoDec.length).replaceAll('-', '');
      inputSan = (inputNoDec[0] + inputSan).toString();
    } else {
      inputSan = inputNoDec.replaceAll('-', '').toString();
    }
    return inputSan;
  }
}
