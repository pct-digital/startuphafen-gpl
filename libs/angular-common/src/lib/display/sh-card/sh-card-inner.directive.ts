import { Directive } from '@angular/core';

@Directive({
  selector: '[shCardInner]',
  standalone: true,
  host: {
    class: 'border rounded-xl w-fit p-6 sm:p-8 md:p-10 lg:p-12',
    style: 'background-color: rgba(var(--sh-color-primary-rgb), 0.09)',
  },
})
export class ShCardInnerDirective {
  constructor() {}
}
