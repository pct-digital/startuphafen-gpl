import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-check',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule],
  template: `
    <div
      class="p-4 md:p-8 rounded-2xl bg-[rgba(var(--sh-color-primary-rgb),0.09)]
          w-full transition-all duration-200
          hover:bg-[rgba(var(--sh-color-primary-rgb),0.15)]
          peer-checked:ring-2 peer-checked:ring-primary
          cursor-pointer"
      (click)="toggleCheckbox()"
    >
      <div class="flex-1 flex flex-col items-start gap-3">
        <div class="relative h-6 w-6">
          <input
            type="checkbox"
            [name]="props['name']"
            [formControl]="formControl"
            class="hidden peer"
          />
          <div
            class="absolute h-full w-full rounded-lg
               bg-white transition-colors duration-200
               peer-checked:border-primary-shade"
          ></div>
          <div
            class="absolute inset-0 m-auto h-full w-full bg-primary rounded-lg
               transition-transform duration-200 origin-center
               scale-0 peer-checked:scale-100"
          ></div>
          <svg
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
               w-4 h-4 text-white transition-opacity duration-200
               opacity-0 peer-checked:opacity-100"
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
        <span class="text-lg md:text-xl text-primary font-semibold">
          {{ formControl.value ? 'Ja' : 'Nein' }}
        </span>
      </div>
    </div>
  `,
  styles: ``,
})
export class FormlyFieldCheckComponent extends FieldType<FieldTypeConfig> {
  toggleCheckbox() {
    this.formControl.setValue(!this.formControl.value);
  }
}
