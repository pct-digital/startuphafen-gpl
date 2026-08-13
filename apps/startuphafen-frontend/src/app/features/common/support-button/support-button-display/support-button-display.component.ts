import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PopupService,
  ShButtonDirective,
  ShCardDirective,
  ShCardSubtitleDirective,
  ShCardTitleDirective,
  ShInputDirective,
} from '@startuphafen/angular-common';
import { Subject, takeUntil } from 'rxjs';

export interface SupportTicketPayload {
  file: Uint8Array | null;
  description: string;
  email: string;
  phone: string;
}

@Component({
  selector: 'sh-support-button-display',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardSubtitleDirective,
    ShButtonDirective,
    ShInputDirective,
  ],
  templateUrl: './support-button-display.component.html',
  styles: `
    .sh-spinner {
      width: 80px;
      height: 80px;
      border: 4px solid #e5e7eb;
      border-top-color: var(--color-primary, #3b82f6);
      border-radius: 50%;
      animation: sh-spin 0.8s linear infinite;
    }
    @keyframes sh-spin {
      to { transform: rotate(360deg); }
    }
  `,
})
export class SupportButtonDisplayComponent {
  popupService = inject(PopupService);
  private destroy$ = new Subject<void>();
  supportUpload: File | null = null;
  @Input() isUploading = false;
  @Input() sendResult: 'success' | 'error' | null = null;
  @Output() supportSubmitted = new EventEmitter<SupportTicketPayload>();
  error: string | null = null;

  phone = '';
  email = '';
  description = '';

  @ViewChild('support', { static: true })
  support?: TemplateRef<any>;

  openPopup(popupTemplate?: TemplateRef<any>) {
    if (popupTemplate) {
      this.popupService
        .open(popupTemplate)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }
  }

  close() {
    this.popupService.closePopup();
  }

  async submit() {
    let fileData: Uint8Array | null = null;
    if (this.supportUpload) {
      const buffer = await this.supportUpload.arrayBuffer();
      fileData = new Uint8Array(buffer);
    }
    this.supportSubmitted.emit({
      file: fileData,
      description: this.description,
      email: this.email,
      phone: this.phone,
    });
  }
  triggerFileInput(input: HTMLInputElement) {
    input.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];

    if (!allowedTypes.includes(file.type)) {
      this.error = 'Bitte nur Bilddateien (PNG/JPG/JPEG) hochladen.';

      this.isInvalidFile(input);

      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      this.error = 'Die Datei ist zu groß (max. 200MB).';

      return;
    }

    this.supportUpload = file;
  }

  private isInvalidFile(input: HTMLInputElement) {
    this.supportUpload = null;

    input.value = '';
  }
}
