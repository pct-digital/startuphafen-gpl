import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';

@Component({
  selector: 'formly-radio',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormlyModule,
    CommonModule,
    FormlySelectModule,
  ],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      @if(this.optionsLength > 15) {

      <div class="relative col-span-full w-5/6">
        <select
          [formControl]="formControl"
          [formlyAttributes]="field"
          style="background-color: rgba(var(--sh-color-primary-rgb), 0.09);"
          class="w-full h-14 md:h-16 placeholder:text-slate-400 text-[var(--sh-color-primary)] text-lg border border-slate-200 rounded-2xl pl-3 pr-8 py-2 transition duration-300 ease focus:outline-none appearance-none cursor-pointer focus:border-[var(--sh-color-primary)] hover:border-[var(--sh-color-primary)]"
        >
          @for(option of to.options | formlySelectOptions : field | async; track
          $index){
          <option class="rounded-2xl" [value]="option.value">
            {{ option.label }}
          </option>
          }
        </select>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.2"
          stroke="currentColor"
          class="h-8 w-8 md:h-10 md:w-10 ml-1 absolute top-3 right-[0.15rem] text-[var(--sh-color-primary)]"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
          />
        </svg>
      </div>

      }@else {
      <div
        *ngFor="let option of to.options | formlySelectOptions : field | async"
        class="h-full"
      >
        <label
          class="p-4 md:p-8 rounded-2xl bg-[rgba(var(--sh-color-primary-rgb),0.09)] 
        h-full hover:bg-[rgba(var(--sh-color-primary-rgb),0.15)] flex items-start 
            cursor-pointer gap-4 overflow-hidden border transition-colors"
          [class.border-red-500]="formControl.touched && formControl.errors?.['required']"
          [class.border-transparent]="
            !(formControl.touched && formControl.invalid)
          "
        >
          <input
            type="radio"
            [name]="props['name']"
            [value]="option.value"
            [formControl]="formControl"
            [formlyAttributes]="field"
            class="hidden"
          />
          <div class="flex-1 flex flex-col items-start gap-3">
            <div class="h-6 w-6 bg-white rounded-lg relative flex-shrink-0">
              <div
                class="absolute inset-0 m-auto h-6 w-6 bg-primary rounded-lg
                    transition-transform duration-200"
                [class.scale-100]="formControl.value === option.value"
                [class.scale-0]="formControl.value !== option.value"
              ></div>
              <svg
                class="absolute w-6 h-6 text-white 
                transition-opacity duration-200"
                [class.opacity-0]="formControl.value !== option.value"
                [class.opacity-100]="formControl.value === option.value"
                fill="none"
                viewBox="0 0 25 25"
                stroke="currentColor"
                stroke-width="3"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span class="text-lg md:text-xl text-primary font-semibold">
              {{ option.label }}
            </span>
          </div>
        </label>
      </div>
      }
    </div>

    @if (formControl.touched && formControl.errors?.['required']) {
    <div class="text-red-500 text-sm mt-1">Dieses Feld ist erforderlich</div>
    }
  `,
  styles: [],
})
export class FormlyFieldRadioComponent extends FieldType<FieldTypeConfig> {
  optionsLength = 0;
  ngOnInit() {
    this.optionsLength = this.props['optionsLength'];
  }
}
