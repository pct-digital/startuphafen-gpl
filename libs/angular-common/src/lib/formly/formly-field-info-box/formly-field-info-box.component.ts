import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

/*
Renders a small, non-interactive info/hint box. The message is taken from
props.label. Use it for contextual hints inside a form, e.g. explaining that
certain data is filled in automatically.
*/
@Component({
  selector: 'formly-info-box',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule, CommonModule],
  template: `
    <div
      class="flex items-start gap-2 mt-4 p-3 rounded-lg  border border-primary"
      style="background-color: rgba(var(--sh-color-primary-rgb), 0.09);"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-primary shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span class="text-sm text-primary">{{ props.label }}</span>
    </div>
  `,
  styles: [],
})
export class FormlyFieldInfoBoxComponent extends FieldType<FieldTypeConfig> {}
