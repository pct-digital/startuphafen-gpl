import { Directive } from '@angular/core';

@Directive({
  selector: '[shCardSubtitle]',
  standalone: true,
  host: {
    class: 'text-center font-bold font-sans text-lg text-tertiary',
  },
})
export class ShCardSubtitleDirective {
  constructor() {}
}
