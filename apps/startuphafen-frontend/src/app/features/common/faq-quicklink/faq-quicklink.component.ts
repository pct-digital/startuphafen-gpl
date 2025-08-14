import { CommonModule } from '@angular/common';
import { Component, OnDestroy, TemplateRef } from '@angular/core';
import { PopupService } from '@startuphafen/angular-common';
import { Subject, takeUntil } from 'rxjs';
import { FaqPageContainerComponent } from '../../f4_faq-page/container/faq-page-container/faq-page-container.component';

@Component({
  selector: 'sh-faq-quicklink',
  standalone: true,
  imports: [CommonModule, FaqPageContainerComponent],
  templateUrl: './faq-quicklink.component.html',
  styles: ``,
})
export class FaqQuicklinkComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private popupService: PopupService) {}

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popupService
        .open(popupTemplate, { width: 70 })
        .pipe(takeUntil(this.destroy$))
        .subscribe((action) => {
          console.log('popupAction', action);
        });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
