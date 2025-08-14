import { CommonModule } from '@angular/common';
import { Component, Input, TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopupService } from '@startuphafen/angular-common';

@Component({
  selector: 'sh-progress-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-overview.component.html',
  styles: ``,
})
export class ProgressOverviewComponent {
  @Input() currentStep = 0;

  constructor(private popupService: PopupService) {}

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popupService
        .open(popupTemplate, { width: 100, height: 100 })
        .pipe(takeUntilDestroyed())
        .subscribe((action) => {
          console.log('popupAction', action);
        });
    }
  }
}
