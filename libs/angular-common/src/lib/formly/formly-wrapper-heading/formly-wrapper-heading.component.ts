// panel-wrapper.component.ts
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FieldWrapper } from '@ngx-formly/core';
import { ShTooltipComponent } from '../../display/sh-tooltip/sh-tooltip.component';

@Component({
  selector: 'formly-wrapper-heading',
  standalone: true,
  imports: [CommonModule, ShTooltipComponent],
  template: `
    @if(props.label !== '{[none]}'){
    <div class="flex flex-col gap-2 mt-8 md:mt-12">
      <div class="flex gap-4">
        <label class="text-primary text-2xl md:text-3xl font-semibold mb-4">
          {{ props.label }}
        </label>
        @if(tooltip != null){
        <sh-tooltip [content]="tooltip"></sh-tooltip>
        }
      </div>
      <div class="">
        <ng-container #fieldComponent></ng-container>
      </div>
    </div>
    }@else {
    <div class="flex flex-col gap-2 mt-4 md:mt-6">
      <div class="">
        <ng-container #fieldComponent></ng-container>
      </div>
    </div>
    }
  `,
})
export class FormlyWrapperHeading extends FieldWrapper {
  tooltip = '';
  ngOnInit() {
    this.tooltip = this.props['tooltip'];
  }
}
