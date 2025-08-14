import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-number-euro',
  standalone: true,
  imports: [FormlyModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="relative w-full md:w-1/2 transition-all duration-200">
      <div class="text-primary text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
        {{ props['name'] }}
      </div>

      <div class="w-full max-w-sm relative mt-4">
        <div class="relative">
          <button
            id="decreaseButton"
            class="absolute right-0 top-[2rem] lg:top-[2.42rem] rounded-br-2xl bg-[var(--sh-color-secondary)] p-1 lg:p-1.5 border border-transparent text-center text-sm text-white transition-all active:bg-[var(--sh-color-secondary-tint)] hover:bg-[var(--sh-color-primary-shade)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none touch-manipulation"
            type="button"
            tabindex="-1"
            (click)="decreaseValue()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="w-5 h-5 sm:w-6 sm:h-[1.57rem]"
            >
              <path
                d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z"
              />
            </svg>
          </button>

          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            class="absolute w-4 h-4 sm:w-5 sm:h-5 top-[1.85rem] left-2 sm:left-2.5 text-[var(--sh-color-secondary)]"
            viewBox="0 0 512 512"
          >
            <path
              d="M231.8 272v-48H376l8-48H231.8v-8.12c0-38.69 16.47-62.56 87.18-62.56 28.89 0 61.45 2.69 102.5 9.42l10.52-70A508.54 508.54 0 00315.46 32C189.26 32 135 76.4 135 158.46V176H80v48h55v48H80v48h55v33.54C135 435.6 189.23 480 315.43 480a507.76 507.76 0 00116.44-12.78l-10.58-70c-41.05 6.73-73.46 9.42-102.35 9.42-70.7 0-87.14-20.18-87.14-67.94V320h128.47l7.87-48z"
            />
          </svg>

          <input
            type="text"
            inputmode="numeric"
            class="w-full text-tertiary text-lg sm:text-xl p-4 sm:p-6 border rounded-2xl pl-8 sm:pl-10 pr-10 sm:pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none touch-manipulation"
            [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
            style="background-color: rgba(var(--sh-color-primary-rgb), 0.09); -moz-appearance: textfield;"
            [name]="props['name']"
            [formControl]="formControl"
            [formlyAttributes]="field"
          />
          <button
            id="increaseButton"
            class="absolute right-0 top-0 rounded-tr-2xl bg-[var(--sh-color-secondary)] p-1 lg:p-1.5 border border-transparent text-center text-sm text-white transition-all active:bg-[var(--sh-color-secondary-tint)] hover:bg-[var(--sh-color-primary-shade)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none touch-manipulation"
            type="button"
            tabindex="-1"
            (click)="increaseValue()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="w-5 h-5 sm:w-6 sm:h-[1.57rem]"
            >
              <path
                d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"
              />
            </svg>
          </button>
        </div>
        <div
          *ngIf="formControl.touched && formControl.errors?.['required']"
          class="text-red-500 text-sm mt-1 px-1"
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
export class FormlyFieldNumberEuroComponent extends FieldType<FieldTypeConfig> {
  dateAvailable = false;
  month = 0;

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

  getMonth() {
    const monthString: string = (
      Object.values(this.form['_parent'].value['SteEr79'])[0] as string
    ).split('-')[1];
    return Number(monthString);
  }
}
