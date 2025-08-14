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
      <div class="text-primary text-lg md:text-xl font-semibold mb-4">
        {{ props['name'] }}
      </div>

      <div class="w-full max-w-sm relative mt-4">
        <div class="relative">
          <button
            id="decreaseButton"
            class="absolute right-0 top-[2.1rem] md:top-[2.42rem] rounded-br-2xl bg-[var(--sh-color-secondary)] p-1 md:p-1.5 border border-transparent text-center text-sm text-white transition-all  active:bg-[var(--sh-color-secondary-tint)] hover:bg-[var(--sh-color-primary-shade)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
            type="button"
            tabindex="-1"
            (click)="decreaseValue()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="w-5 h-5 md:w-6 md:h-6"
            >
              <path
                d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z"
              />
            </svg>
          </button>

          <input
            type="text"
            inputmode="numeric"
            class="w-full text-tertiary text-lg md:text-xl p-4 md:p-6 border rounded-2xl pl-4 md:pl-6 pr-10 md:pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
            style="background-color: rgba(var(--sh-color-primary-rgb), 0.09); -moz-appearance: textfield;"
            [name]="props['name']"
            [formControl]="formControl"
            [formlyAttributes]="field"
          />
          <button
            id="increaseButton"
            class="absolute right-0 top-0 rounded-tr-2xl bg-[var(--sh-color-secondary)] p-1 md:p-1.5 border border-transparent text-center text-sm text-white transition-all  active:bg-[var(--sh-color-secondary-tint)] hover:bg-[var(--sh-color-primary-shade)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
            type="button"
            tabindex="-1"
            (click)="increaseValue()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="w-5 h-5 md:w-6 md:h-6"
            >
              <path
                d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"
              />
            </svg>
          </button>
        </div>
        <div
          *ngIf="formControl.touched && formControl.errors?.['required']"
          class="text-red-500 text-sm mt-1"
        >
          Dieses Feld ist erforderlich
        </div>
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
    input.value = input.value.replace(/[^0-9-]/g, '');
  }

  increaseValue() {
    this.formControl.patchValue(Number(this.formControl.value) + 1);
  }
  decreaseValue() {
    this.formControl.patchValue(Number(this.formControl.value) - 1);
  }
}
