import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-textarea',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="flex flex-col gap-1">
      <div class="relative">
        <textarea
          class="w-full text-tertiary text-md md:text-lg p-4 md:p-6 border rounded-2xl resize-y min-h-[160px]"
          [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
          style="background-color: rgba(var(--sh-color-primary-rgb), 0.09)"
          [name]="props['name']"
          [formControl]="formControl"
          [formlyAttributes]="field"
          [attr.rows]="props['rows'] ?? 6"
          [attr.maxlength]="props['maxLength'] ?? null"
          (blur)="handleBlur()"
        ></textarea>
        @if(props["maxLength"]){
        <div class="text-tertiary text-sm absolute right-3 md:right-4 bottom-2">
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
  styles: '',
})
export class FormlyFieldTextareaComponent extends FieldType<FieldTypeConfig> {
  handleBlur() {
    this.trimWhitespace();
    const onBlur = this.props?.['onBlur'];
    if (typeof onBlur === 'function') {
      onBlur(this.formControl.value);
    }
  }

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
    if (this.field.validation?.messages?.[errorKey]) {
      const message = this.field.validation.messages[errorKey];
      if (typeof message === 'function') {
        const result = message(this.formControl.errors?.[errorKey], this.field);
        return typeof result === 'string' ? result : undefined;
      }
      return typeof message === 'string' ? message : undefined;
    }

    if (this.field.validators?.[errorKey]?.message) {
      const message = this.field.validators[errorKey].message;
      if (typeof message === 'function') {
        const result = message(this.formControl.errors?.[errorKey], this.field);
        return typeof result === 'string' ? result : undefined;
      }
      return typeof message === 'string' ? message : undefined;
    }

    return 'Ungültiger Wert';
  }
}
