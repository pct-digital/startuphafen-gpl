import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';

/*
This component is used to create quick Headers with tooltips via the Heading-Wrapper.
*/
@Component({
  selector: 'formly-empty',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormlyModule,
    CommonModule,
    FormlySelectModule,
  ],
  template: ``,
  styles: [],
})
export class FormlyFieldEmptyComponent extends FieldType<FieldTypeConfig> {}
