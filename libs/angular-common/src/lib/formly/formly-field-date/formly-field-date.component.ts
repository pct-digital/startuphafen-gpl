import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  ValidatorFn,
} from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-date',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  styles: `
  input[type='date']::-webkit-calendar-picker-indicator {
    display: none;
  }
  @-moz-document url-prefix() {
    .date-input-wrapper .custom-calendar-icon {
      display: none;
    }
    .date-input-wrapper input[type='date'] {
      padding-top: 0;
      padding-bottom: 0;
      padding-right: 1rem;
      min-height: 0;
      line-height: normal;
      box-sizing: border-box;
      display: flex;
      align-items: center;
    }
  }
  input[type='date'] {
    -webkit-text-fill-color: currentColor;
  }
  `,
  template: `
    <div class="flex items-center w-full md:w-1/2 transition-all duration-200">
      <div class="relative flex-1 date-input-wrapper">
        <input
          type="date"
          class="w-full h-14 text-tertiary text-md md:text-lg p-4 md:p-6 border rounded-2xl pr-12 appearance-none"
          [class.border-red-500]="formControl.touched && (formControl.errors?.['required'] || formControl.errors?.['dateMinLimit'] || formControl.errors?.['dateMaxLimit'])"
          style="background-color: rgba(var(--sh-color-primary-rgb), 0.09)"
          [formControl]="formControl"
          [formlyAttributes]="field"
          [min]="props['minDate'] ?? null"
          [max]="props['maxDate'] ?? null"
          #hiddenDateInput
        />
        <span
          class="custom-calendar-icon absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 cursor-pointer z-10"
          (click)="openDatePicker()"
        >
          <img
            src="assets/icons/solid/calendar-days-sharp-solid.svg"
            alt="Calendar Icon"
            class="w-full h-full"
          />
        </span>
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
})
export class FormlyFieldDateComponent
  extends FieldType<FieldTypeConfig>
  implements OnInit
{
  @ViewChild('hiddenDateInput') hiddenDateInput!: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    const minValidator: ValidatorFn = (control: AbstractControl) => {
      return this.validateMinDate(control) ? null : { dateMinLimit: true };
    };

    const maxValidator: ValidatorFn = (control: AbstractControl) => {
      return this.validateMaxDate(control) ? null : { dateMaxLimit: true };
    };

    // Set validators on the form control
    this.formControl.setValidators([
      ...(this.formControl.validator ? [this.formControl.validator] : []),
      minValidator,
      maxValidator,
    ]);
    this.formControl.updateValueAndValidity({ emitEvent: false });

    // Also set them on field for formly
    this.field.validators = {
      ...this.field.validators,
      dateMinLimit: {
        expression: minValidator,
        message: 'Datum liegt vor dem Mindestdatum',
      },
      dateMaxLimit: {
        expression: maxValidator,
        message: 'Datum liegt nach dem Maximaldatum',
      },
    };
  }

  openDatePicker() {
    const input = this.hiddenDateInput.nativeElement;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  private validateMinDate(control: AbstractControl): boolean {
    const minDate = this.normalizeDateValue(this.props['minDate']);
    const currentValue = this.normalizeDateValue(control.value);

    if (!minDate || !currentValue) {
      return true;
    }

    return currentValue >= minDate;
  }

  private validateMaxDate(control: AbstractControl): boolean {
    const maxDate = this.normalizeDateValue(this.props['maxDate']);
    const currentValue = this.normalizeDateValue(control.value);

    if (!maxDate || !currentValue) {
      return true;
    }

    return currentValue <= maxDate;
  }

  private normalizeDateValue(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return this.formatDate(value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmedValue)) {
      return trimmedValue.slice(0, 10);
    }

    const parsedDate = new Date(trimmedValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return this.formatDate(parsedDate);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
