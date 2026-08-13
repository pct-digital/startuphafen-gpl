import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-check',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  template: `
    <label class="flex items-start gap-3 cursor-pointer group">
      <div class="relative flex items-center justify-center mt-1">
        <input
          type="checkbox"
          [name]="props['name']"
          [formControl]="formControl"
          class="peer sr-only"
        />
        <div
          class="h-5 w-5 rounded border-2 border-gray-300 bg-white
                 transition-all duration-200
                 peer-checked:border-primary peer-checked:bg-primary
                 group-hover:border-primary-shade"
        >
          <svg
            class="w-full h-full text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="3"
            fill="none"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>
      <span class="flex-1 text-base text-gray-700 group-hover:text-gray-900">
        {{ props['checkboxLabel'] }}
      </span>
    </label>
  `,
  styles: ``,
})
export class FormlyFieldCheckComponent extends FieldType<FieldTypeConfig> {}
