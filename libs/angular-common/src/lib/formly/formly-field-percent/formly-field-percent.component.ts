import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-percent',
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
            inputmode="decimal"
            class="w-full h-14 text-tertiary text-md md:text-lg p-4 sm:p-6 border rounded-2xl pl-8 sm:pl-10 pr-10 sm:pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none touch-manipulation"
            [class.border-red-500]="formControl.touched && (formControl.errors?.['required'] || formControl.errors?.['min'] || formControl.errors?.['max'])"
            style="background-color: rgba(var(--sh-color-primary-rgb), 0.09); -moz-appearance: textfield;"
            [name]="props['name']"
            [value]="displayValue"
            [disabled]="formControl.disabled"
            [formlyAttributes]="field"
            (input)="onInput($event)"
            (blur)="onBlur($event)"
          />
          <span
            class="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-tertiary text-md md:text-lg pointer-events-none"
          >
            %
          </span>
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
export class FormlyFieldPercentComponent extends FieldType<FieldTypeConfig> {
  displayValue = '';

  ngOnInit(): void {
    // Add min/max validators if not already present
    if (this.props['min'] == null) {
      this.props['min'] = 0;
    }
    if (this.props['max'] == null) {
      this.props['max'] = 100;
    }

    // Format initial value if present
    if (this.formControl.value == null || this.formControl.value === '') {
      this.displayValue = '';
      return;
    }

    const numValue = parseFloat(
      String(this.formControl.value).replace(',', '.')
    );
    if (!isNaN(numValue)) {
      const formatted = numValue.toFixed(4);
      this.formControl.setValue(formatted, { emitEvent: false });
      this.displayValue = this.dotToComma(formatted);
    }
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const display = this.sanitizeDisplayValue(input.value);
    this.displayValue = display;
    input.value = display;

    if (display === '' || display === ',') {
      this.formControl.setValue(null);
      return;
    }

    const normalized = this.commaToDot(display);
    this.formControl.setValue(normalized);
  }

  onBlur(event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    const value = this.sanitizeDisplayValue(input.value);
    this.formControl.markAsTouched();

    if (value === '' || value === ',') {
      this.displayValue = '';
      input.value = '';
      this.formControl.setValue(null);
      this.formControl.updateValueAndValidity();
      return;
    }

    const numValue = parseFloat(this.commaToDot(value));

    if (!isNaN(numValue)) {
      // Format to 4 decimal places
      const formatted = numValue.toFixed(4);
      this.displayValue = this.dotToComma(formatted);
      input.value = this.displayValue;
      this.formControl.setValue(formatted, { emitEvent: false });

      // Trigger validation with the numeric value
      this.formControl.updateValueAndValidity();
    }
  }

  private sanitizeDisplayValue(rawValue: string): string {
    let value = rawValue.replace(/\./g, ',').replace(/[^0-9,]/g, '');
    const parts = value.split(',');

    if (parts.length > 2) {
      value = parts[0] + ',' + parts.slice(1).join('');
    }

    const [integerPart, decimalPart] = value.split(',');
    if (decimalPart != null && decimalPart.length > 4) {
      return `${integerPart},${decimalPart.substring(0, 4)}`;
    }

    return value;
  }

  private commaToDot(value: string): string {
    return value.replace(',', '.');
  }

  private dotToComma(value: string): string {
    return value.replace('.', ',');
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

    // Fallback message based on error type
    if (errorKey === 'min') {
      return 'Der Wert muss mindestens 0% betragen';
    }
    if (errorKey === 'max') {
      return 'Der Wert darf maximal 100% betragen';
    }
    return 'Ungültiger Wert';
  }
}
