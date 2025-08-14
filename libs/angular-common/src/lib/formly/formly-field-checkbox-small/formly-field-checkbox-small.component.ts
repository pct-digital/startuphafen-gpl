import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-checkbox-small',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="inline-flex items-start mx-4 md:mx-8 mt-2">
      <label
        class="flex items-start cursor-pointer relative"
        for="check-with-description"
      >
        <input
          type="checkbox"
          class=" peer h-5 w-5 cursor-pointer transition-all appearance-none rounded border border-slate-300 checked:bg-[var(--sh-color-primary)] checked:border-[var(--sh-color-primary)]"
          id="check-with-description"
          [formControl]="formControl"
          [formlyAttributes]="field"
        />
        <span
          class="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="1"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </span>
      </label>
      <label
        class="cursor-pointer ml-2 text-[var(--sh-color-secondary)] text-sm"
        for="check-with-description"
      >
        <div>
          <p class="font-medium text-base">
            {{ props['textSplitOne'] }}
          </p>
          <p class="text-[var(--sh-color-tertiary)]">
            {{ props['textSplitTwo'] }}
          </p>
        </div>
      </label>
    </div>
    @if (formControl.touched && formControl.errors?.['requiredTrue']) {
    <div class="text-red-500 text-sm mt-1">Dieses Feld ist erforderlich</div>
    }
  `,
  styles: ``,
})
export class FormlyFieldCheckboxSmall extends FieldType<FieldTypeConfig> {}
