import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-number-euro',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="relative w-full md:w-1/2 transition-all duration-200 mt-2">
      <div class="text-primary text-md sm:text-lg font-semibold">
        {{ props['name'] }}
      </div>

      <div class="w-full max-w-sm relative -mt-4">
        <div class="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            class="absolute w-4 h-4 sm:w-5 sm:h-5 top-[1.2rem] left-2 sm:left-2.5 text-[var(--sh-color-secondary)]"
            viewBox="0 0 512 512"
          >
            <path
              d="M231.8 272v-48H376l8-48H231.8v-8.12c0-38.69 16.47-62.56 87.18-62.56 28.89 0 61.45 2.69 102.5 9.42l10.52-70A508.54 508.54 0 00315.46 32C189.26 32 135 76.4 135 158.46V176H80v48h55v48H80v48h55v33.54C135 435.6 189.23 480 315.43 480a507.76 507.76 0 00116.44-12.78l-10.58-70c-41.05 6.73-73.46 9.42-102.35 9.42-70.7 0-87.14-20.18-87.14-67.94V320h128.47l7.87-48z"
            />
          </svg>

          <input
            type="text"
            inputmode="numeric"
            class="w-full h-14 text-tertiary text-md md:text-lg p-4 sm:p-6 border rounded-2xl pl-8 sm:pl-10 pr-10 sm:pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none touch-manipulation"
            [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
            style="background-color: rgba(var(--sh-color-primary-rgb), 0.09); -moz-appearance: textfield;"
            [name]="props['name']"
            #numberInput
            [formControl]="formControl"
            [formlyAttributes]="field"
          />
        </div>
        @if (formControl.touched && formControl.errors) { @if
        (formControl.errors['required']) {
        <div class="text-red-500 text-sm mt-1 px-1">
          Dieses Feld ist erforderlich
        </div>
        } @else { @for (errorKey of getErrorKeys(); track errorKey) {
        <div class="text-red-500 text-sm mt-1 px-1">
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
export class FormlyFieldNumberEuroComponent extends FieldType<FieldTypeConfig> {
  @HostListener('input', ['$event'])
  onInput(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    const sanitizedValue = this.sanitizeValue(input.value);

    if (input.value !== sanitizedValue) {
      input.value = sanitizedValue;
    }

    if (this.formControl.value !== sanitizedValue) {
      this.formControl.setValue(sanitizedValue);
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
