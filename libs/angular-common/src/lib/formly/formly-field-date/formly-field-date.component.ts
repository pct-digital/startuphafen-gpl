import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-date',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  styles: `
  input[type='date']::-webkit-calendar-picker-indicator {
    background: transparent;
    bottom: 0;
    color: transparent;
    cursor: pointer;
    height: auto;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
    width: auto;
}
  `,
  template: `
    <div
      class="flex items-center w-full md:w-1/2 transition-all duration-200"
      [ngClass]="{
          'mt-8': !props['additionalField'],
          'mt-6': props['additionalField'],
        }"
    >
      <div class="relative flex-1">
        <input
          type="date"
          class="w-full text-tertiary text-lg md:text-xl p-4 md:p-6 border rounded-2xl pr-12 appearance-none"
          [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
          style="background-color: rgba(var(--sh-color-primary-rgb), 0.09)"
          [formControl]="formControl"
          [formlyAttributes]="field"
          [max]="props['maxDate'] ?? null"
          #hiddenDateInput
        />
        <span
          class="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 cursor-pointer z-10"
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
    @if (formControl.touched && formControl.errors?.['required']) {
    <div class="text-red-500 text-sm mt-1">Dieses Feld ist erforderlich</div>
    }
  `,
})
export class FormlyFieldDateComponent extends FieldType<FieldTypeConfig> {
  @ViewChild('hiddenDateInput') hiddenDateInput!: ElementRef;

  openDatePicker() {
    this.hiddenDateInput.nativeElement.showPicker();
  }
}
