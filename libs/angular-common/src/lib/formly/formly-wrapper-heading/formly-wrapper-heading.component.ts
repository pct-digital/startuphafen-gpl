import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FieldWrapper } from '@ngx-formly/core';
import { ShTooltipComponent } from '../../display/sh-tooltip/sh-tooltip.component';

@Component({
  selector: 'formly-wrapper-heading',
  standalone: true,
  imports: [CommonModule, ShTooltipComponent],
  template: `
    @if(props.label != null && props.label !== ''){
    <div class="flex flex-col gap-2 mt-4 md:mt-8">
      <div class="flex justify-between">
        <label class="text-primary text-xl md:text-2xl font-semibold">
          {{ props.label }}
        </label>
        @if(tooltip != null){
        <sh-tooltip [content]="tooltip"></sh-tooltip>
        }
      </div>
      @if(props['secondaryLabel'] != null){ @if(props['required']){
      <label class="text-primary text-sm md:text-md font-semibold">
        {{ props['secondaryLabel'] }}
      </label>
      }@else {
      <label class="text-primary text-sm md:text-md font-semibold">
        {{ props['secondaryLabel'] + ' (optional)' }}
      </label>
      } } @if(field['type'] !== 'empty'){
      <div>
        <ng-container #fieldComponent></ng-container>
      </div>
      }
    </div>
    }@else if (props['secondaryLabel'] != null) {
    <div class="flex flex-col gap-2 mt-2 md:mt-4">
      <div class="flex justify-between leading-none">
        @if(props['required']){
        <label class="text-primary text-sm md:text-md font-semibold">
          {{ props['secondaryLabel'] }}
        </label>
        }@else {
        <label class="text-primary text-sm md:text-md font-semibold">
          {{ props['secondaryLabel'] + ' (optional)' }}
        </label>
        } @if(tooltip != null){
        <sh-tooltip [content]="tooltip" [size]="4"></sh-tooltip>
        }
      </div>
      @if(field['type'] !== 'empty'){
      <div>
        <ng-container #fieldComponent></ng-container>
      </div>
      }
    </div>
    } @else {
    <div class="flex flex-col mt-4">
      <ng-container #fieldComponent></ng-container>
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
