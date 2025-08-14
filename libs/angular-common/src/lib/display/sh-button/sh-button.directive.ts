import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[shButton]',
  standalone: true,
})
export class ShButtonDirective {
  @Input() outline = false;

  private baseClasses =
    'flex items-center gap-3 rounded-full px-8 h-12 text-lg disabled:opacity-50 disabled:bg-gray-400 disabled:hover:bg-gray-400 disabled:cursor-not-allowed';
  private noOutlineClasses =
    'bg-primary hover:bg-primary-shade active:bg-tertiary text-white';
  private outlineClasses =
    'bg-white hover:bg-background active:bg-background-tint text-primary border border-primary';

  @HostBinding('class')
  get elementClasses(): string {
    return `${this.baseClasses} ${
      this.outline ? this.outlineClasses : this.noOutlineClasses
    }`;
  }
}
