import { Directive } from '@angular/core';

@Directive({
  selector: '[shInput]',
  standalone: true,
  host: {
    class:
      'border-primary-shade w-full text-tertiary text-xl p-6 border rounded-2xl bg-[rgba(var(--sh-color-primary-rgb), 0.09)]',
  },
})
export class ShInputDirective {
  constructor() {}
}
