import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  Inject,
  Injectable,
  OnDestroy,
  TemplateRef,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { PopupComponent } from '../../display/popup/popup.component';

@Injectable({
  providedIn: 'root',
})
export class PopupService implements OnDestroy {
  private popupNotifier$?: Subject<string>;
  private popupRef?: ComponentRef<any>;

  constructor(
    private appRef: ApplicationRef,
    @Inject(DOCUMENT) private document: Document
  ) {}
  private destroy$ = new Subject<void>();

  open(
    content: TemplateRef<any>,
    options?: {
      title?: string;
      width?: number;
      height?: number;
      context?: any[];
    }
  ) {
    this.popupRef = createComponent(PopupComponent, {
      environmentInjector: this.appRef.injector,
      projectableNodes: [content.createEmbeddedView(null).rootNodes],
    });

    this.popupRef.instance.title = options?.title;
    this.popupRef.instance.width = options?.width;
    this.popupRef.instance.height = options?.height;

    this.popupRef.instance.content = content;
    this.popupRef.instance.context = options?.context;

    this.popupRef.instance.closeEvent
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closePopup());

    this.appRef.attachView(this.popupRef.hostView);
    this.document.body.appendChild(this.popupRef.location.nativeElement);

    this.popupNotifier$ = new Subject();
    return this.popupNotifier$?.asObservable();
  }

  closePopup() {
    if (this.popupRef) {
      this.appRef.detachView(this.popupRef?.hostView);
      this.popupRef.destroy();
      this.popupRef = undefined;
    }

    this.popupNotifier$?.complete();
  }

  contextClicked() {
    this.popupRef?.instance.close();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
