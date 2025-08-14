import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-input',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div
      class="flex flex-col gap-1"
      [ngClass]="{
          'mt-8': !props['additionalField'],
          'mt-6': props['additionalField'],
        }"
    >
      <div class="relative">
        <input
          class="w-full text-tertiary text-lg md:text-xl p-4 md:p-6 border rounded-2xl"
          [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
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
    @if (formControl.touched && formControl.errors?.['required']) {
    <div class="text-red-500 text-sm mt-1">Dieses Feld ist erforderlich</div>
    }
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
}
