import { Directive } from '@angular/core';

@Directive({
  selector: '[shCard]',
  standalone: true,
  host: {
    class:
      'flex flex-col gap-3 bg-white border shadow-lg rounded-xl min-h-[350px] flex items-center justify-center p-2 sm:p-2 md:p-4 lg:p-6',
  },
})
export class ShCardDirective {
  constructor() {}
}
