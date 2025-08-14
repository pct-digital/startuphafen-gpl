import { Directive } from '@angular/core';

@Directive({
  selector: '[shCardTitle]',
  standalone: true,
  host: {
    class: 'text-center font-semibold text-3xl font-sans text-primary',
  },
})
export class ShCardTitleDirective {
  constructor() {}
}
