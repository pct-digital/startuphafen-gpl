import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ShButtonDirective } from '@startuphafen/angular-common';

export type HwkDocumentUploadItem = {
  id: number;
  filename: string;
  createdAt: Date | string;
};

@Component({
  selector: 'sh-hwk-document-upload-presentation',
  standalone: true,
  imports: [CommonModule, ShButtonDirective],
  templateUrl: './hwk-document-upload-presentation.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class HwkDocumentUploadPresentationComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() isRequired = false;
  @Input() requiredHint =
    'Bitte lade mindestens ein Dokument hoch, um fortzufahren.';
  @Input() showRequiredError = false;
  @Input() roleMissingHint =
    'Für den Dokumenten-Upload musst Du mit BundID verifiziert sein.';
  @Input() maxFiles = 10;
  @Input() maxTotalSizeMb = 10;
  @Input() canUpload = false;
  @Input() isLoading = false;
  @Input() isUploading = false;
  @Input() error: string | null = null;
  @Input() documents: HwkDocumentUploadItem[] = [];
  @Input() deletingDocumentIds: number[] = [];

  @Output() fileSelected = new EventEmitter<File>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() reloadRequested = new EventEmitter<void>();

  triggerFileInput(input: HTMLInputElement) {
    input.click();
  }

  onFileChange(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (!input.files || input.files.length === 0) {
      return;
    }

    this.fileSelected.emit(input.files[0]);
    input.value = '';
  }

  onDeleteRequested(documentId: number) {
    this.deleteRequested.emit(documentId);
  }

  onReloadRequested() {
    this.reloadRequested.emit();
  }

  isDeleting(documentId: number) {
    return this.deletingDocumentIds.includes(documentId);
  }

  trackByDocumentId(_index: number, document: HwkDocumentUploadItem) {
    return document.id;
  }
}
