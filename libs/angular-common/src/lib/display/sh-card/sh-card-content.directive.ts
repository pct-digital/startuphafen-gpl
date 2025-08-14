import { Directive } from '@angular/core';

@Directive({
  selector: '[shCardContent]',
  standalone: true,
  host: {
    class: 'font-normal text-center text-tertiary font-sans',
  },
})
export class ShCardContentDirective {
  constructor() {}
}
